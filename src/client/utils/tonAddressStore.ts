// src/client/utils/tonAddressStore.ts
// Simple singleton store to expose the active Ton wallet address to non-React utility functions.

let activeTonAddress: string | null = null;

/**
 * Set the active Ton wallet address (friendly string).
 * Call this when TonConnect connects or disconnects.
 */
export function setActiveTonAddress(address: string | null): void {
  activeTonAddress = address ?? null;
  // Also mirror to a global for any legacy code paths
  (window as any).__TON_ADDRESS__ = activeTonAddress;
}

/**
 * Get the active Ton wallet address (friendly string) from the singleton store or global.
 */
export function getActiveTonAddress(): string | null {
  return activeTonAddress ?? (window as any).__TON_ADDRESS__ ?? null;
}

/**
 * Require a sender address and throw a descriptive error if not available.
 */
export function requireSenderAddress(): string {
  const addr = getActiveTonAddress();
  if (!addr) {
    throw new Error('No connected TON wallet address found. Please connect your wallet via TonConnect.');
  }
  return addr;
}
