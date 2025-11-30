import { vi } from 'vitest';
import crypto from 'crypto';

// Polyfill window.crypto.subtle untuk environment Node/JSDOM
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: (arr: any) => crypto.randomBytes(arr.length),
    subtle: (crypto as any).webcrypto.subtle,
    randomUUID: () => crypto.randomUUID()
  }
});

// Polyfill TextEncoder/Decoder jika belum ada
if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder;
}
if (typeof TextDecoder === 'undefined') {
  global.TextDecoder = require('util').TextDecoder;
}