// src/client/polyfills.ts
// Ensure Node-style globals required by some libraries (e.g. @ton/core) exist in the browser.
// This must be loaded BEFORE any other modules that import @ton/core or use Buffer at module init.

import { Buffer } from 'buffer';

// Expose Buffer globally for libraries that expect a Node.js environment
if (typeof globalThis !== 'undefined' && !(globalThis as any).Buffer) {
  (globalThis as any).Buffer = Buffer;
}

// Optional: some packages check for process.env; provide a minimal stub if needed
if (typeof globalThis !== 'undefined' && !(globalThis as any).process) {
  (globalThis as any).process = { env: {} } as any;
}
