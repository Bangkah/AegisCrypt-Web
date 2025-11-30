import { describe, it, expect } from 'vitest';
import { 
  generateSalt, 
  generateIV, 
  prepareKeyMaterial, 
  deriveKey, 
  processFileEncrypt, 
  processFileDecrypt 
} from '../services/cryptoService';
import { CRYPTO_CONSTANTS, FILE_MAGIC } from '../constants';

describe('AegisCrypt Core Security Audit', () => {

  // --- Basic Cryptography Checks ---

  it('should generate secure random Salt and IVs', () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    expect(salt1.length).toBe(CRYPTO_CONSTANTS.SALT_LENGTH);
    // Ensure randomness
    expect(salt1).not.toEqual(salt2); 
    
    const iv = generateIV();
    expect(iv.length).toBe(CRYPTO_CONSTANTS.IV_LENGTH);
  });

  it('should derive AES-GCM-256 keys correctly', async () => {
    const salt = generateSalt();
    const keyMaterial = await prepareKeyMaterial('testPass', null);
    const key = await deriveKey(keyMaterial, salt, ['encrypt', 'decrypt']);

    expect(key.algorithm.name).toBe('AES-GCM');
    expect((key.algorithm as any).length).toBe(256);
    expect(key.extractable).toBe(false); // Key should not be exportable for security
  });

  // --- End-to-End Encryption Flow ---

  it('should successfully encrypt and decrypt a file (Password Only)', async () => {
    const content = "Confidential Data";
    const file = new File([content], "test.txt", { type: "text/plain" });
    const password = "strongPassword123";
    const controller = new AbortController();

    // Encrypt
    const encryptedBlob = await processFileEncrypt(file, password, null, controller.signal, () => {});
    const encryptedBuffer = await encryptedBlob.arrayBuffer();

    // Verify Header
    const view = new Uint8Array(encryptedBuffer);
    for(let i=0; i<FILE_MAGIC.length; i++) {
        expect(view[i]).toBe(FILE_MAGIC[i]);
    }

    // Decrypt
    const decryptedBlob = await processFileDecrypt(encryptedBuffer, password, null, controller.signal, () => {});
    const result = await decryptedBlob.text();

    expect(result).toBe(content);
  });

  // --- Keyfile Integration Test ---

  it('should encrypt and decrypt using Password + Keyfile', async () => {
    const content = "Dual Factor Auth Content";
    const file = new File([content], "doc.pdf");
    const password = "userPass";
    
    // Create a dummy Keyfile (simulating an image or random file)
    const keyFileBuffer = new Uint8Array([10, 20, 30, 40, 50]).buffer;
    const controller = new AbortController();

    // Encrypt with Keyfile
    const encryptedBlob = await processFileEncrypt(file, password, keyFileBuffer, controller.signal, () => {});
    const encryptedBuffer = await encryptedBlob.arrayBuffer();

    // Decrypt with SAME Keyfile -> Should Success
    const decryptedBlob = await processFileDecrypt(encryptedBuffer, password, keyFileBuffer, controller.signal, () => {});
    expect(await decryptedBlob.text()).toBe(content);

    // Decrypt WITHOUT Keyfile -> Should Fail
    await expect(processFileDecrypt(encryptedBuffer, password, null, controller.signal, () => {}))
        .rejects.toThrow();
        
    // Decrypt with WRONG Keyfile -> Should Fail
    const wrongKeyBuffer = new Uint8Array([10, 20, 99, 99]).buffer;
    await expect(processFileDecrypt(encryptedBuffer, password, wrongKeyBuffer, controller.signal, () => {}))
        .rejects.toThrow();
  });

  // --- Cancellation Test ---

  it('should abort operation when signal is triggered', async () => {
    const largeContent = new Uint8Array(1024 * 1024 * 5); // 5MB to ensure it hits multiple chunks
    const file = new File([largeContent], "large.dat");
    const controller = new AbortController();

    const promise = processFileEncrypt(file, "pass", null, controller.signal, () => {
        // Abort immediately after start
        controller.abort();
    });

    await expect(promise).rejects.toThrow(/Cancelled/);
  });

  // --- Corrupt File Handling ---

  it('should reject files with invalid chunk sizes (Memory Safety)', async () => {
    // Manually construct a malicious file header
    const header = new Uint8Array(100);
    header.set(FILE_MAGIC, 0);
    header[5] = 2; // Version 2
    // ... salt ...
    
    // Malicious Chunk Length at offset
    const offset = 6 + 32; // Magic + Ver + Salt
    const view = new DataView(header.buffer);
    
    // Claim chunk is 1GB, but file is only 100 bytes
    view.setInt32(offset, 1024 * 1024 * 1024, true); 

    const controller = new AbortController();
    await expect(processFileDecrypt(header.buffer, "pass", null, controller.signal, () => {}))
        .rejects.toThrow(/corrupt/);
  });
});