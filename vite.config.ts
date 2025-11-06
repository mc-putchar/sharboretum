/* eslint-disable */
// @ts-nocheck
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dynamically support local dev and optional ngrok tunneling without hardcoding a domain.
// To enable ngrok HMR over WSS set:
//   NGROK_DOMAIN=your-subdomain.ngrok-free.dev
// Optionally override protocol via VITE_HMR_PROTOCOL (default 'wss') and port via PORT
const NGROK_DOMAIN = process.env.NGROK_DOMAIN || process.env.VITE_HMR_HOST || '';
const HMR_PROTOCOL = process.env.VITE_HMR_PROTOCOL || 'wss';
const DEV_PORT = Number(process.env.PORT || 5173);
const __API_BASE__ = process.env.API_BASE || 'http://localhost:3001';

// Vite config for the Sharboretum Telegram Mini App frontend
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind to all interfaces so it's reachable externally through a tunnel
    host: true,
    port: DEV_PORT,
    // Allow explicit ngrok domain if provided; otherwise include the current ngrok subdomain explicitly
    allowedHosts: NGROK_DOMAIN ? [NGROK_DOMAIN] : ['valleylike-tamia-perfectly.ngrok-free.dev', 'localhost', '127.0.0.1'],
    // Configure HMR for ngrok over HTTPS/WSS only when a domain is provided
    hmr: NGROK_DOMAIN
      ? {
          host: NGROK_DOMAIN,
          protocol: HMR_PROTOCOL,
          clientPort: HMR_PROTOCOL === 'wss' ? 443 : undefined,
        }
      : undefined,
  },
  build: {
    outDir: 'web-dist',
    sourcemap: true,
  },
});
