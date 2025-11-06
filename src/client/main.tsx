import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tailwind.css';
import { Buffer } from 'buffer';
import App from './App';

/**
 * Polyfill Node Buffer for browser libs (e.g. @ton/core) that expect global Buffer.
 * Required in Vite/React since Node polyfills are not provided by default.
 */
if (typeof globalThis !== 'undefined' && !(globalThis as any).Buffer) {
  (globalThis as any).Buffer = Buffer;
}
// Mount React App into #root
const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
