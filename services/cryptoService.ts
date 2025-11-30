import { CRYPTO_CONSTANTS, EXTENSION_ENCRYPTED, FILE_MAGIC, FILE_VERSION, HEADER_LENGTH } from '../constants';

/**
 * Generates a cryptographically strong random salt.
 */
export const generateSalt = (): Uint8Array => {
  return window.crypto.getRandomValues(new Uint8Array(CRYPTO_CONSTANTS.SALT_LENGTH));
};

/**
 * Generates a cryptographically strong random IV (Nonce).
 */
export const generateIV = (): Uint8Array => {
  return window.crypto.getRandomValues(new Uint8Array(CRYPTO_CONSTANTS.IV_LENGTH));
};

/**
 * Derives a cryptographic key from a password using PBKDF2.
 */
const deriveKey = async (password: string, salt: Uint8Array, usage: KeyUsage[]): Promise<CryptoKey> => {
  const textEncoder = new TextEncoder();
  const passwordBuffer = textEncoder.encode(password);

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
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
 * Encrypts file data using AES-256-GCM and wraps it in the .aegis format.
 * Format: [Magic "AEGIS" (5b)] [Version (1b)] [Salt (16b)] [IV (12b)] [Ciphertext + Tag]
 */
export const encryptFileContent = async (fileBuffer: ArrayBuffer, password: string): Promise<ArrayBuffer> => {
  try {
    const salt = generateSalt();
    const iv = generateIV();
    const key = await deriveKey(password, salt, ['encrypt']);

    const encryptedContent = await window.crypto.subtle.encrypt(
      {
        name: CRYPTO_CONSTANTS.ALGORITHM_AES,
        iv: iv,
        tagLength: CRYPTO_CONSTANTS.TAG_LENGTH_BITS,
      },
      key,
      fileBuffer
    );

    // Prepare Header Components
    const magic = FILE_MAGIC;
    const version = new Uint8Array([FILE_VERSION]);

    // Calculate Total Size
    const totalSize = magic.length + version.length + salt.byteLength + iv.byteLength + encryptedContent.byteLength;
    const resultBuffer = new Uint8Array(totalSize);
    
    // Construct the Binary File
    let offset = 0;
    
    resultBuffer.set(magic, offset);
    offset += magic.length;

    resultBuffer.set(version, offset);
    offset += version.length;

    resultBuffer.set(salt, offset);
    offset += salt.byteLength;

    resultBuffer.set(iv, offset);
    offset += iv.byteLength;

    resultBuffer.set(new Uint8Array(encryptedContent), offset);

    return resultBuffer.buffer;
  } catch (error) {
    console.error("Encryption failed:", error);
    throw new Error("Encryption failed. Please check parameters.");
  }
};

/**
 * Decrypts .aegis file data.
 * Validates Magic Header and Version before decryption.
 */
export const decryptFileContent = async (fileBuffer: ArrayBuffer, password: string): Promise<ArrayBuffer> => {
  try {
    if (fileBuffer.byteLength < HEADER_LENGTH) {
      throw new Error("File is too small. Corrupted or invalid format.");
    }

    const dataView = new Uint8Array(fileBuffer);
    
    // 1. Validate Magic Header ("AEGIS")
    for (let i = 0; i < FILE_MAGIC.length; i++) {
      if (dataView[i] !== FILE_MAGIC[i]) {
        throw new Error("Invalid file format. Not an .aegis file.");
      }
    }

    // 2. Validate Version
    const version = dataView[FILE_MAGIC.length];
    if (version !== FILE_VERSION) {
      throw new Error(`Unsupported file version: v${version}. Please update AegisCrypt.`);
    }

    let offset = FILE_MAGIC.length + 1; // Magic (5) + Version (1)

    // 3. Extract Metadata
    const salt = dataView.slice(offset, offset + CRYPTO_CONSTANTS.SALT_LENGTH);
    offset += CRYPTO_CONSTANTS.SALT_LENGTH;

    const iv = dataView.slice(offset, offset + CRYPTO_CONSTANTS.IV_LENGTH);
    offset += CRYPTO_CONSTANTS.IV_LENGTH;

    const ciphertext = dataView.slice(offset);

    // 4. Decrypt
    const key = await deriveKey(password, salt, ['decrypt']);

    const decryptedContent = await window.crypto.subtle.decrypt(
      {
        name: CRYPTO_CONSTANTS.ALGORITHM_AES,
        iv: iv,
        tagLength: CRYPTO_CONSTANTS.TAG_LENGTH_BITS,
      },
      key,
      ciphertext
    );

    return decryptedContent;
  } catch (error: any) {
    console.error("Decryption failed:", error);
    if (error.message.includes("Invalid file format")) throw error;
    if (error.message.includes("Unsupported file version")) throw error;
    throw new Error("Decryption failed. Incorrect password or corrupted file.");
  }
};

/**
 * Helper to download the processed file
 */
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

export const getEncryptedFilename = (originalName: string): string => {
  return `${originalName}${EXTENSION_ENCRYPTED}`;
};

export const getDecryptedFilename = (encryptedName: string): string => {
  if (encryptedName.endsWith(EXTENSION_ENCRYPTED)) {
    return encryptedName.slice(0, -EXTENSION_ENCRYPTED.length);
  }
  return `decrypted_${encryptedName}`;
};