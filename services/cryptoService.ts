
import { CRYPTO_CONSTANTS, EXTENSION_ENCRYPTED, FILE_MAGIC, FILE_VERSION, HEADER_LENGTH } from '../constants';



/**
 * ==========================================
 * AEGISCRYPT CRYPTO ENGINE (Web Crypto API)
 * ==========================================
 * 
 * CORE FEATURES:
 * 1. AES-256-GCM: Authenticated Encryption.
 * 2. PBKDF2: Key derivation with high iteration count (100k).
 * 3. Streaming (v2): Processes files in chunks to support large files with low RAM usage.
 * 
 * AUDIT NOTES:
 * - IV Uniqueness: Generated freshly for EVERY chunk.
 * - Memory Safety: Uses Blob construction to avoid contiguous heap allocation.
 */

export const generateSalt = (): Uint8Array => window.crypto.getRandomValues(new Uint8Array(CRYPTO_CONSTANTS.SALT_LENGTH));
export const generateIV = (): Uint8Array => window.crypto.getRandomValues(new Uint8Array(CRYPTO_CONSTANTS.IV_LENGTH));

/**
 * 🔑 KEY PREPARATION
 * Combines Password + Optional Keyfile into a single byte array.
 */
export const prepareKeyMaterial = async (password: string, keyFileBuffer?: ArrayBuffer | null): Promise<Uint8Array> => {
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

/**
 * 🗝️ KEY DERIVATION (PBKDF2)
 */
export const deriveKey = async (keyMaterialRaw: Uint8Array, salt: Uint8Array, usage: KeyUsage[]): Promise<CryptoKey> => {
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

/**
 * Helper: Packages an encrypted chunk.
 * Format: [Length (4 bytes)] [IV (12 bytes)] [Ciphertext]
 */
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
 * 🔒 ENCRYPTION PROCESS (Streaming v2)
 * Returns a Blob instead of ArrayBuffer to handle large files efficiently.
 */
export const processFileEncrypt = async (
  file: File,
  password: string,
  keyFileBuffer: ArrayBuffer | null,
  signal: AbortSignal,
  onProgress: (bytes: number) => void
): Promise<Blob> => {
  const salt = generateSalt();
  const keyMaterial = await prepareKeyMaterial(password, keyFileBuffer);
  const key = await deriveKey(keyMaterial, salt, ['encrypt']);

  // Construct Header
  const header = new Uint8Array(HEADER_LENGTH);
  header.set(FILE_MAGIC, 0);
  header.set([FILE_VERSION], 5);
  header.set(salt, 6);

  // Store parts as Blob parts, not a single huge ArrayBuffer
  const chunks: (Uint8Array | Blob)[] = [header];
  let offset = 0;
  const totalSize = file.size;

  while (offset < totalSize) {
    if (signal.aborted) throw new Error("Operation Cancelled");

    const chunkEnd = Math.min(offset + CRYPTO_CONSTANTS.CHUNK_SIZE, totalSize);
    const slice = file.slice(offset, chunkEnd);
    const chunkBuffer = await slice.arrayBuffer();
    
    // Unique IV per chunk maximizes security for GCM
    const iv = generateIV();
    const encryptedContent = await window.crypto.subtle.encrypt(
      { name: CRYPTO_CONSTANTS.ALGORITHM_AES, iv: iv },
      key,
      chunkBuffer
    );

    chunks.push(packageChunk(iv, encryptedContent));
    
    offset += chunkBuffer.byteLength;
    onProgress(offset);
    
    await new Promise(r => setTimeout(r, 0)); 
  }

  // Create Blob directly from parts. 
  // Browser handles memory management better than `new Uint8Array(totalLength)`
  return new Blob(chunks, { type: 'application/octet-stream' });
};

/**
 * 🔓 DECRYPTION PROCESS (Streaming v2)
 */
export const processFileDecrypt = async (
  fileBuffer: ArrayBuffer,
  password: string,
  keyFileBuffer: ArrayBuffer | null,
  signal: AbortSignal,
  onProgress: (bytes: number) => void
): Promise<Blob> => {
  const dataView = new DataView(fileBuffer);
  const uint8View = new Uint8Array(fileBuffer);

  // 1. Header Validation
  for (let i = 0; i < FILE_MAGIC.length; i++) {
    if (uint8View[i] !== FILE_MAGIC[i]) throw new Error("Format file tidak valid (.aegis required)");
  }
  
  const version = uint8View[FILE_MAGIC.length];
  if (version !== 2) throw new Error(`Versi file tidak didukung (v${version}). Update aplikasi anda.`);

  let offset = 6;
  const salt = uint8View.slice(offset, offset + CRYPTO_CONSTANTS.SALT_LENGTH);
  offset += CRYPTO_CONSTANTS.SALT_LENGTH;

  // 2. Key Derivation
  const keyMaterial = await prepareKeyMaterial(password, keyFileBuffer);
  const key = await deriveKey(keyMaterial, salt, ['decrypt']);

  const decryptedChunks: ArrayBuffer[] = [];
  const totalLength = fileBuffer.byteLength;

  // 3. Chunk Processing Loop
  while (offset < totalLength) {
    if (signal.aborted) throw new Error("Operation Cancelled");

    // Read Chunk Structure
    if (offset + 4 > totalLength) break;
    const chunkLen = dataView.getInt32(offset, true); // Length includes IV + Ciphertext + Tag
    offset += 4;

    // Security Audit: Sanity check chunk length
    if (chunkLen < 0 || offset + chunkLen > totalLength) {
        throw new Error("File corrupt or tampered: Invalid chunk size definition.");
    }

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

  return new Blob(decryptedChunks, { type: 'application/octet-stream' });
};

// --- Utilities ---

export const downloadBlob = (data: Blob | ArrayBuffer, filename: string) => {
  // If input is ArrayBuffer, convert to Blob. If Blob, use directly.
  const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/octet-stream' });
  
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