export const CRYPTO_CONSTANTS = {
  PBKDF2_ITERATIONS: 100000,
  SALT_LENGTH: 16,
  IV_LENGTH: 12, // Standard for GCM
  TAG_LENGTH_BITS: 128,
  ALGORITHM_AES: 'AES-GCM',
  ALGORITHM_KDF: 'PBKDF2',
  HASH_ALGO: 'SHA-256',
  KEY_LENGTH: 256
};

// Official File Format Specifications
export const EXTENSION_ENCRYPTED = '.aegis';
export const FILE_MAGIC = new Uint8Array([0x41, 0x45, 0x47, 0x49, 0x53]); // "AEGIS" in ASCII
export const FILE_VERSION = 1;
export const HEADER_LENGTH = FILE_MAGIC.length + 1 + CRYPTO_CONSTANTS.SALT_LENGTH + CRYPTO_CONSTANTS.IV_LENGTH;