// src/client/utils/sharboretumClient.ts
// Frontend utilities for TON Connect, heartbeat, and claim transaction payloads for Sharboretum.
//
// Important note:
// - Your Merkle Root contract (contracts/merkle_root.tolk) exposes only:
//     * Internal admin-only UpdateMerkleRoot (opcode 0xA1C3BEEF)
//     * Getters: get_merkle_root and verify_proof(leaf, proof)
//   It DOES NOT accept a user "claim" message. Therefore the claim transaction below targets a
//   consumer contract that performs on-chain verification using the same algorithm. An optional
//   off-chain verification helper against the Merkle Root getter is provided.
//
// Dependencies to install in the app:
//   - @tonconnect/ui-react (React bindings)
//   - @tonconnect/ui (UI controller)
//   - @ton/core (cells, addresses, toNano)
//   - sqlite3 (types only; generally NOT used client-side)
//
// Tailwind and React are assumed to be set up elsewhere in your client app.

import { useEffect, useState, useCallback } from 'react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { TonConnectUI, TonConnectUiOptions } from '@tonconnect/ui';
import { Address, beginCell, Cell, toNano } from '@ton/core';
import { Buffer } from 'buffer';
// SQLite: types only on the frontend (bundling sqlite3 in browser is not typical)
import type sqlite3 from 'sqlite3';
import { setActiveTonAddress } from './tonAddressStore';
import { getTelegramUser } from './telegram';

/**
 * Convert BOC bytes to base64 for TonConnect payloads (works in Node and browser).
 * Accepts Buffer-like objects (with toString('base64')), Uint8Array, or ArrayBuffer.
 */
function toBase64(bytes: Uint8Array | ArrayBuffer | any): string {
  // Prefer native Buffer-like .toString('base64') if available (Node / polyfilled browser)
  try {
    if (bytes && typeof bytes.toString === 'function') {
      return bytes.toString('base64');
    }
  } catch {
    // ignore
  }

  // Normalize to Uint8Array
  const arr: Uint8Array =
    bytes instanceof Uint8Array
      ? bytes
      : bytes instanceof ArrayBuffer
      ? new Uint8Array(bytes)
      : new Uint8Array(bytes as ArrayBuffer);

  // Node.js fallback using Buffer if present; prefer ArrayBuffer signature to satisfy types
  if (typeof Buffer !== 'undefined' && typeof (Buffer as any).from === 'function') {
    return (Buffer as any)
      .from(arr.buffer, (arr as Uint8Array).byteOffset ?? 0, (arr as Uint8Array).byteLength ?? (arr as Uint8Array).length)
      .toString('base64');
  }

  // Browser fallback
  let binary = '';
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  // eslint-disable-next-line no-undef
  return btoa(binary);
}

// Basic runtime config (override via globals or environment injection)
export const ENV = {
  API_BASE:
    typeof window !== 'undefined' && (window as any).__API_BASE__
      ? (window as any).__API_BASE__
      : '',
  // Consumer contract that will process "claim" (NOT the Merkle Root contract)
  CONSUMER_CONTRACT:
    typeof window !== 'undefined' && (window as any).__CONSUMER_CONTRACT__
      ? (window as any).__CONSUMER_CONTRACT__
      : 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c', // placeholder
  // Optional: Merkle Root address for off-chain get-method verification helper
  MERKLE_ROOT_CONTRACT:
    typeof window !== 'undefined' && (window as any).__MERKLE_ROOT_CONTRACT__
      ? (window as any).__MERKLE_ROOT_CONTRACT__
      : 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9d', // placeholder
};

// 1) TON Connection Utility: React hook to initialize TonConnect and get active address.
export function useTonWalletAddress(options?: TonConnectUiOptions) {
  // If Provider exists, use it; otherwise create a local instance (require manifestUrl in options).
  const [providerUI] = useTonConnectUI();
  const [ui] = useState<TonConnectUI>(() => {
    if (providerUI) return providerUI;
    // Ensure consumer supplies manifestUrl in options for a standalone TonConnectUI
    return new TonConnectUI(options ?? { manifestUrl: '/tonconnect-manifest.json' });
  });

  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to wallet status changes
    const unsub = ui.onStatusChange((walletInfo: any) => {
      const addr = walletInfo?.account?.address ?? null;
      setAddress(addr);
      setActiveTonAddress(addr);
    });
    // Initialize current state
    const initial = ui.wallet?.account?.address ?? null;
    setAddress(initial);
    setActiveTonAddress(initial);
    return () => unsub();
  }, [ui]);

  const connect = useCallback(async () => {
    await ui.connectWallet();
  }, [ui]);

  const disconnect = useCallback(async () => {
    await ui.disconnect();
  }, [ui]);

  return {
    ui,
    address, // TonConnect standard string address (friendly form)
    isConnected: !!address,
    connect,
    disconnect,
  };
}

// Optional non-hook helper to read active address from an instance
export function getActiveTonAddress(ui: TonConnectUI): string | null {
  return ui.wallet?.account?.address ?? null;
}

// 2) Frontend Heartbeat Function
export type HeartbeatResponse =
  | { ok: true; status: number; data?: unknown }
  | { ok: false; status: number; error: string };

export async function sendHeartbeat(tonAddress: string): Promise<HeartbeatResponse> {
  try {
    const res = await fetch(`${ENV.API_BASE}/api/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ton_address: tonAddress,
        auth_payload: getTelegramUser(),
        timestamp: Math.floor(Date.now() / 1000),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: text || 'Heartbeat failed' };
    }

    let data: unknown = undefined;
    try {
      data = await res.json();
    } catch {
      // backend might return empty/primitive
    }
    return { ok: true, status: res.status, data };
  } catch (err: any) {
    return { ok: false, status: 0, error: err?.message ?? 'Network error' };
  }
}

// 3) Claim Reward Transaction Builder
// The Merkle Root contract does not accept claim messages. Build payload for the consumer contract,
// which should implement the same proof verification algorithm and a "claim" opcode.
//
// Canonical message layout for consumer contract:
//
// struct (0x434C4149) ClaimReward {
//   queryId: uint64
//   leaf: cell
//   proof: cell   // sequence of (dir_bit, sibling_ref) pairs in a slice: dir_bit: 0 left, 1 right
//   recipient?: address (optional)
// }
//
// This is TonConnect-friendly as a simple internal message payload.

export type ClaimBuildOptions = {
  // Target address (defaults to ENV.CONSUMER_CONTRACT)
  to?: string;
  // Amount of TON to attach for gas (default 0.05 TON)
  amountTon?: string; // e.g., '0.05'
  // Optional: queryId for idempotency/tracing
  queryId?: bigint | number;
  // Optional: bounce behavior
  bounce?: boolean;
  // Optional: recipient override to embed in payload
  recipient?: string | null;
};

// Helper: normalize user-friendly address into canonical string for TonConnect
function normalizeToRawAddress(anyForm: string): string {
  const addr = Address.parse(anyForm);
  return addr.toString(); // raw bounceable by default
}

// Helper: hex -> Cell (raw bytes stored into a cell slice)
export function cellFromHex(hex: string): Cell {
  const s = hex.replace(/^0x/i, '');
  const bytes = Uint8Array.from(s.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
  const b = beginCell();
  b.storeBuffer(Buffer.from(bytes));
  return b.endCell();
}

// Helper: merkle proof encoding to a single Cell
// Accepts either:
//  - Hex-encoded serialized cell: "0x...". Wrapped by ref into a new cell.
//  - JSON array: [{ dir: 0|1, siblingHex: "0x..." }, ...], encoded into the slice as per contract.
export function buildProofCell(merkleProof: string): Cell {
  const trimmed = merkleProof.trim();
  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    const inner = cellFromHex(trimmed);
    const b = beginCell();
    b.storeRef(inner);
    return b.endCell();
  }
  try {
    const seq = JSON.parse(trimmed) as Array<{ dir: 0 | 1; siblingHex: string }>;
    const b = beginCell();
    for (const step of seq) {
      if (step.dir !== 0 && step.dir !== 1) throw new Error('dir must be 0 or 1');
      b.storeUint(step.dir, 1);
      const sib = cellFromHex(step.siblingHex);
      b.storeRef(sib);
    }
    return b.endCell();
  } catch {
    throw new Error('Unsupported merkleProof format. Provide 0x-hex cell or JSON array of {dir,siblingHex}.');
  }
}

// Helper: leaf cell from leaf hash hex
// Note: Ensure the consumer contract builds/compares leaf identically. If your leaf hash represents
// a specific serialization (e.g., storeUint/storeAddress sequence), mirror that here.
export function buildLeafCell(leafHashHex: string): Cell {
  return cellFromHex(leafHashHex);
}

// Claim opcode: 0x434C4149 == 'CLAI'
const OP_CLAIM = 0x434C4149;

// Build internal message body for claim
export function buildClaimBody(
  merkleProof: string,
  leafHash: string,
  opts?: { queryId?: bigint | number; recipient?: string | null }
): Cell {
  const queryId = BigInt(opts?.queryId ?? 0n);
  const leaf = buildLeafCell(leafHash);
  const proof = buildProofCell(merkleProof);

  const b = beginCell();
  b.storeUint(OP_CLAIM, 32);
  b.storeUint(queryId, 64);
  b.storeRef(leaf);
  b.storeRef(proof);
  if (opts?.recipient) {
    const addr = Address.parse(opts.recipient);
    b.storeAddress(addr);
  }
  return b.endCell();
}

// TonConnect-compatible transaction request for TonConnectUI.sendTransaction()
export function buildClaimTransaction(merkleProof: string, leafHash: string, options?: ClaimBuildOptions) {
  const to = normalizeToRawAddress(options?.to ?? ENV.CONSUMER_CONTRACT);
  const amount = options?.amountTon ? toNano(options.amountTon).toString() : toNano('0.05').toString();
  const bounce = options?.bounce ?? true;
  const body = buildClaimBody(merkleProof, leafHash, {
    queryId: options?.queryId,
    recipient: options?.recipient ?? null,
  });

  return {
    validUntil: Math.floor(Date.now() / 1000) + 600, // 10 minutes
    messages: [
      {
        address: to,
        amount,
        payload: toBase64(body.toBoc()),
        bounce,
      },
    ],
  };
}

// Optional: Off-chain verification helper against Merkle Root contract getter.
// Requires a provider capable of running get-methods (e.g., toncenter/tonweb/@ton/core RPC).
// Not a TonConnect transaction; purely an RPC call.
export interface TonGetMethodProvider {
  runGetMethod(address: string, method: string, stack: any[]): Promise<{ success: boolean; stack: any }>;
}

export async function verifyProofOffchain(
  provider: TonGetMethodProvider,
  merkleRootAddress: string,
  leafHash: string,
  merkleProof: string
): Promise<boolean> {
  const leaf = buildLeafCell(leafHash);
  const proof = buildProofCell(merkleProof);

  // Provider stack format varies; adapt as necessary.
  const stack = [
    ['tvm.Cell', toBase64(leaf.toBoc({ idx: false }))],
    ['tvm.Cell', toBase64(proof.toBoc({ idx: false }))],
  ];

  const res = await provider.runGetMethod(merkleRootAddress, 'verify_proof', stack);
  if (!res.success) return false;

  try {
    const top = res.stack?.[0];
    if (Array.isArray(top)) {
      const val = top[1];
      return val === '1' || val === 1 || val === true || val === '0x1';
    }
    return false;
  } catch {
    return false;
  }
}

// Usage examples:
//
// const { ui, address, connect } = useTonWalletAddress({ manifestUrl: '/tonconnect-manifest.json' });
// const hb = await sendHeartbeat(address!);
// const tx = buildClaimTransaction(proofJsonOrHex, leafHex, { to: ENV.CONSUMER_CONTRACT, amountTon: '0.05' });
// await ui.sendTransaction(tx);
//
// For off-chain verification with Merkle Root:
// const ok = await verifyProofOffchain(provider, ENV.MERKLE_ROOT_CONTRACT, leafHex, proofJsonOrHex);
// if (ok) { /* proceed to instruct backend or consumer contract */ }
