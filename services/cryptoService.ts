
import { CRYPTO_CONSTANTS, EXTENSION_ENCRYPTED, FILE_MAGIC, FILE_VERSION, HEADER_LENGTH } from '../constants';

/**
 * Utilitas untuk membersihkan memori sensitif (Best effort di JS).
 */
export const wipeMemory = (buffer: Uint8Array) => {
  buffer.fill(0);
};

export const generateSalt = (): Uint8Array => window.crypto.getRandomValues(new Uint8Array(CRYPTO_CONSTANTS.SALT_LENGTH));
export const generateIV = (): Uint8Array => window.crypto.getRandomValues(new Uint8Array(CRYPTO_CONSTANTS.IV_LENGTH));

/**
 * Menyiapkan Key Material dengan Hashing SHA-256 untuk Keyfile.
 */
const prepareKeyMaterial = async (password: string, keyFileBuffer?: ArrayBuffer | null): Promise<Uint8Array> => {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  if (!keyFileBuffer) {
    return passwordBytes;
  }

  // Hash keyfile agar ukuran konsisten & aman
  const keyFileHash = await window.crypto.subtle.digest('SHA-256', keyFileBuffer);
  const combined = new Uint8Array(passwordBytes.length + keyFileHash.byteLength);
  combined.set(passwordBytes, 0);
  combined.set(new Uint8Array(keyFileHash), passwordBytes.length);

  return combined;
};

const deriveKey = async (keyMaterialRaw: Uint8Array, salt: Uint8Array, usage: KeyUsage[]): Promise<CryptoKey> => {
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    keyMaterialRaw,
    { name: CRYPTO_CONSTANTS.ALGORITHM_KDF },
    false,
    ['deriveBits', 'deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: CRYPTO_CONSTANTS.ALGORITHM_KDF,
      salt: salt,
      iterations: CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
      hash: CRYPTO_CONSTANTS.HASH_ALGO,
    },
    keyMaterial,
    { name: CRYPTO_CONSTANTS.ALGORITHM_AES, length: CRYPTO_CONSTANTS.KEY_LENGTH },
    false,
    usage
  );
};

const packageChunk = (iv: Uint8Array, ciphertext: ArrayBuffer): Uint8Array => {
  const length = iv.byteLength + ciphertext.byteLength;
  const buffer = new Uint8Array(4 + length);
  const view = new DataView(buffer.buffer);
  
  view.setInt32(0, length, true); // Little Endian Length
  buffer.set(iv, 4);
  buffer.set(new Uint8Array(ciphertext), 4 + iv.byteLength);
  return buffer;
};

/**
 * ENCRYPTION ENGINE V2.1
 * - Streaming Chunked
 * - AbortSignal Support
 * - High Performance Time-Slicing
 */
export const processFileEncrypt = async (
  file: File,
  password: string,
  keyFileBuffer: ArrayBuffer | null,
  signal: AbortSignal,
  onProgress: (bytes: number) => void
): Promise<ArrayBuffer> => {
  const salt = generateSalt();
  const keyMaterial = await prepareKeyMaterial(password, keyFileBuffer);
  const key = await deriveKey(keyMaterial, salt, ['encrypt']);

  // Construct Header
  const header = new Uint8Array(HEADER_LENGTH);
  header.set(FILE_MAGIC, 0);
  header.set([FILE_VERSION], 5);
  header.set(salt, 6);

  const chunks: Uint8Array[] = [header];
  let offset = 0;
  const totalSize = file.size;

  while (offset < totalSize) {
    if (signal.aborted) throw new Error("Operation Cancelled");

    const chunkEnd = Math.min(offset + CRYPTO_CONSTANTS.CHUNK_SIZE, totalSize);
    const slice = file.slice(offset, chunkEnd);
    const chunkBuffer = await slice.arrayBuffer();
    
    const iv = generateIV();
    const encryptedContent = await window.crypto.subtle.encrypt(
      { name: CRYPTO_CONSTANTS.ALGORITHM_AES, iv: iv },
      key,
      chunkBuffer
    );

    chunks.push(packageChunk(iv, encryptedContent));
    
    offset += chunkBuffer.byteLength;
    onProgress(offset);
    
    // Time-slicing: Memberi napas ke UI thread setiap chunk
    await new Promise(r => setTimeout(r, 0)); 
  }

  // Merge Chunks
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let resultOffset = 0;
  for (const chunk of chunks) {
    result.set(chunk, resultOffset);
    resultOffset += chunk.length;
  }

  return result.buffer;
};

/**
 * DECRYPTION ENGINE V2.1
 */
export const processFileDecrypt = async (
  fileBuffer: ArrayBuffer,
  password: string,
  keyFileBuffer: ArrayBuffer | null,
  signal: AbortSignal,
  onProgress: (bytes: number) => void
): Promise<ArrayBuffer> => {
  const dataView = new DataView(fileBuffer);
  const uint8View = new Uint8Array(fileBuffer);

  // Header Check
  for (let i = 0; i < FILE_MAGIC.length; i++) {
    if (uint8View[i] !== FILE_MAGIC[i]) throw new Error("Format file tidak valid (.aegis required)");
  }
  
  const version = uint8View[FILE_MAGIC.length];
  if (version !== 2) throw new Error(`Versi file tidak didukung (v${version}). Update aplikasi anda.`);

  let offset = 6;
  const salt = uint8View.slice(offset, offset + CRYPTO_CONSTANTS.SALT_LENGTH);
  offset += CRYPTO_CONSTANTS.SALT_LENGTH;

  const keyMaterial = await prepareKeyMaterial(password, keyFileBuffer);
  const key = await deriveKey(keyMaterial, salt, ['decrypt']);

  const decryptedChunks: ArrayBuffer[] = [];
  const totalLength = fileBuffer.byteLength;

  while (offset < totalLength) {
    if (signal.aborted) throw new Error("Operation Cancelled");

    // Read Chunk Length
    if (offset + 4 > totalLength) break;
    const chunkLen = dataView.getInt32(offset, true);
    offset += 4;

    if (offset + chunkLen > totalLength) throw new Error("File corrupt: Unexpected EOF");

    const iv = uint8View.slice(offset, offset + CRYPTO_CONSTANTS.IV_LENGTH);
    const ciphertext = uint8View.slice(offset + CRYPTO_CONSTANTS.IV_LENGTH, offset + chunkLen);

    try {
      const decrypted = await window.crypto.subtle.decrypt(
        { name: CRYPTO_CONSTANTS.ALGORITHM_AES, iv: iv },
        key,
        ciphertext
      );
      decryptedChunks.push(decrypted);
    } catch (e) {
      throw new Error("Password salah atau file/keyfile tidak cocok.");
    }

    offset += chunkLen;
    onProgress(offset);
    await new Promise(r => setTimeout(r, 0));
  }

  // Merge
  const finalSize = decryptedChunks.reduce((acc, c) => acc + c.byteLength, 0);
  const result = new Uint8Array(finalSize);
  let writeOffset = 0;
  for (const chunk of decryptedChunks) {
    result.set(new Uint8Array(chunk), writeOffset);
    writeOffset += chunk.byteLength;
  }

  return result.buffer;
};

export const downloadBlob = (data: ArrayBuffer, filename: string) => {
  const blob = new Blob([data], { type: 'application/octet-stream' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

export const getEncryptedFilename = (originalName: string): string => `${originalName}${EXTENSION_ENCRYPTED}`;
export const getDecryptedFilename = (encryptedName: string): string => {
  return encryptedName.endsWith(EXTENSION_ENCRYPTED) 
    ? encryptedName.slice(0, -EXTENSION_ENCRYPTED.length) 
    : `decrypted_${encryptedName}`;
};
