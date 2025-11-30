import { CRYPTO_CONSTANTS, EXTENSION_ENCRYPTED } from '../constants';

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
 * Encrypts file data using AES-256-GCM.
 * Output Format: [Salt (16b)] [IV (12b)] [Ciphertext + Tag]
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

    // Combine Salt + IV + Encrypted Data
    const resultBuffer = new Uint8Array(
      salt.byteLength + iv.byteLength + encryptedContent.byteLength
    );
    
    resultBuffer.set(salt, 0);
    resultBuffer.set(iv, salt.byteLength);
    resultBuffer.set(new Uint8Array(encryptedContent), salt.byteLength + iv.byteLength);

    return resultBuffer.buffer;
  } catch (error) {
    console.error("Encryption failed:", error);
    throw new Error("Encryption failed. Please check parameters.");
  }
};

/**
 * Decrypts file data.
 * Expects Input Format: [Salt (16b)] [IV (12b)] [Ciphertext + Tag]
 */
export const decryptFileContent = async (fileBuffer: ArrayBuffer, password: string): Promise<ArrayBuffer> => {
  try {
    const minLength = CRYPTO_CONSTANTS.SALT_LENGTH + CRYPTO_CONSTANTS.IV_LENGTH;
    if (fileBuffer.byteLength < minLength) {
      throw new Error("File is too small to be a valid encrypted file.");
    }

    const dataView = new Uint8Array(fileBuffer);
    
    // Extract Metadata
    const salt = dataView.slice(0, CRYPTO_CONSTANTS.SALT_LENGTH);
    const iv = dataView.slice(
      CRYPTO_CONSTANTS.SALT_LENGTH, 
      CRYPTO_CONSTANTS.SALT_LENGTH + CRYPTO_CONSTANTS.IV_LENGTH
    );
    const ciphertext = dataView.slice(
      CRYPTO_CONSTANTS.SALT_LENGTH + CRYPTO_CONSTANTS.IV_LENGTH
    );

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
  } catch (error) {
    console.error("Decryption failed:", error);
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
