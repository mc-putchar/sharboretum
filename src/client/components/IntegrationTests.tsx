import React, { useCallback, useMemo, useRef, useState } from 'react';
import Sharboretum3D, { SharborState } from './Sharboretum3D';

type LogLevel = 'info' | 'success' | 'error';
type LogEntry = { ts: number; level: LogLevel; message: string; details?: unknown };

type HeartbeatResponse = {
    shard_balance: number;
    leaf_hash: string;
    timestamp: number;
};

type SharborStateResponse = {
    ton_address: string;
    shard_balance: number;
    health: number; // 0..100
    growth_percent: number; // 0..100
    mutation_score: number;
    last_heartbeat?: number | null;
    last_heartbeat_time?: number | null;
};

type SocialActionResponse = {
    receiver_address: string;
    mutation_score: number;
    applied: boolean;
    timestamp: number;
};

type MerkleProofResponse = {
    sinceTimestamp: number;
    leavesCount: number;
    merkleRootHex: string;
    sample: {
        ton_address: string;
        timestamp: number;
        leaf_hash: string;
        merkleProofPath: string[]; // array of hex strings
        verified: boolean;
    };
};

type TonConnectMessage = {
    address: string;
    amount: string; // nanotons as string
    payload?: string; // base64-encoded payload
    state_init?: string;
};

type TonConnectTransactionRequest = {
    valid_until: number;
    messages: TonConnectMessage[];
};

const BACKEND_URL: string =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_BACKEND_URL) || 'http://localhost:3001';

const EQB_MOCK_TON_ADDRESS = 'EQB_MOCK_TON_ADDRESS';
const EQB_MOCK_SENDER = 'EQB_MOCK_SENDER';

function nowSec() {
    return Math.floor(Date.now() / 1000);
}

function safeStringify(x: unknown) {
    try {
        return JSON.stringify(x, null, 2);
    } catch {
        return String(x);
    }
}

function base64FromJson(obj: unknown): string {
    const json = safeStringify(obj);
    // Browser-safe base64
    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
        // Encode as UTF-8 before btoa
        return window.btoa(unescape(encodeURIComponent(json)));
    }
    // Fallback to global Buffer (polyfilled in main.tsx)
    const Buf =
        typeof globalThis !== 'undefined' && (globalThis as any).Buffer ? (globalThis as any).Buffer : undefined;
    if (Buf && typeof Buf.from === 'function') {
        return Buf.from(json, 'utf8').toString('base64');
    }
    throw new Error('No base64 encoder available');
}

/**
 * Mock TON claim transaction builder.
 * Constructs a TonConnect "sendTransaction" request using the leaf hash and merkle proof path.
 * This does NOT perform real cell encoding and is intended for integration testing only.
 */
function buildClaimTransaction(params: {
    claimantTonAddress: string;
    merkleRootContract: string; // placeholder contract address
    leafHashHex: string;
    merkleProofPath: string[]; // hex strings
}): TonConnectTransactionRequest {
    const { claimantTonAddress, merkleRootContract, leafHashHex, merkleProofPath } = params;

    const claimPayload = {
        op: 'CLAIM_REWARD',
        claimant: claimantTonAddress,
        leaf: leafHashHex,
        proof: merkleProofPath,
        ts: nowSec(),
        note: 'Simulated TON claim payload for integration testing',
    };

    const payloadBase64 = base64FromJson(claimPayload);

    const messages: TonConnectMessage[] = [
        {
            address: merkleRootContract,
            amount: '0', // no TON transfer for this mock claim
            payload: payloadBase64,
        },
    ];

    return {
        valid_until: nowSec() + 300, // 5 minutes
        messages,
    };
}

export const IntegrationTests: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [running, setRunning] = useState(false);

    // Persist the receiver across the whole run to keep logs consistent
    const receiverRef = useRef<string>(`EQB_MOCK_RECEIVER_${Date.now()}`);

    const [tonPayload, setTonPayload] = useState<TonConnectTransactionRequest | null>(null);
    const [merkleData, setMerkleData] = useState<MerkleProofResponse | null>(null);

    // Feed Sharboretum3D with the latest state from Test 4
    const [renderSharborState, setRenderSharborState] = useState<SharborState | undefined>(undefined);

    const appendLog = useCallback((level: LogLevel, message: string, details?: unknown) => {
        const entry: LogEntry = { ts: Date.now(), level, message, details };
        setLogs((prev) => [...prev, entry]);
        // Useful during development
        // eslint-disable-next-line no-console
        console[level === 'error' ? 'error' : level === 'success' ? 'log' : 'info'](
            `[${level.toUpperCase()}] ${message}`,
            details ?? '',
        );
    }, []);

    const clearLogs = useCallback(() => {
        setLogs([]);
        setTonPayload(null);
        setMerkleData(null);
        setRenderSharborState(undefined);
    }, []);

    // Helpers to call backend
    const postJson = useCallback(async <T,>(path: string, body: unknown): Promise<T> => {
        const resp = await fetch(`${BACKEND_URL}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body ?? {}),
        });
        const data = (await resp.json()) as T;
        if (!resp.ok) {
            throw new Error(`POST ${path} failed: ${safeStringify(data)}`);
        }
        return data;
    }, []);

    const getJson = useCallback(async <T,>(path: string): Promise<T> => {
        const resp = await fetch(`${BACKEND_URL}${path}`);
        const data = (await resp.json()) as T;
        if (!resp.ok) {
            throw new Error(`GET ${path} failed: ${safeStringify(data)}`);
        }
        return data;
    }, []);

    // TEST 1: User Onboarding & Heartbeat (PoA)
    const runTest1 = useCallback(async (): Promise<void> => {
        appendLog('info', 'Test 1: Starting Heartbeat & Onboarding...');
        const hb = await postJson<HeartbeatResponse>('/api/heartbeat', {
            ton_address: EQB_MOCK_TON_ADDRESS,
            auth_payload: { mock: true },
            timestamp: nowSec(),
        });

        if (typeof hb.shard_balance !== 'number') {
            throw new Error('Heartbeat did not return a numeric shard_balance');
        }
        appendLog('info', `Heartbeat acknowledged. Balance: ${hb.shard_balance}, Leaf: ${hb.leaf_hash}`);

        // Verify user entry and last_heartbeat_time created
        const state = await getJson<SharborStateResponse>(
            `/api/sharbor-state/${encodeURIComponent(EQB_MOCK_TON_ADDRESS)}`,
        );
        if (!state || state.ton_address !== EQB_MOCK_TON_ADDRESS) {
            throw new Error('Sharbor/User row not found after heartbeat');
        }
        if (!state.last_heartbeat_time || state.last_heartbeat_time <= 0) {
            throw new Error('last_heartbeat_time not set on user after heartbeat');
        }

        appendLog('success', '✅ Test 1: Heartbeat & Onboarding Successful.', state);
    }, [appendLog, getJson, postJson]);

    // TEST 2: Social Mutation Score Integration Test
    const runTest2 = useCallback(async (): Promise<void> => {
        appendLog('info', 'Test 2: Starting Social Mutation Score update (water a friend)...');
        const receiver = receiverRef.current;

        const before = await getJson<SharborStateResponse>(`/api/sharbor-state/${encodeURIComponent(receiver)}`);
        const beforeScore = before?.mutation_score ?? 0;
        appendLog('info', `Receiver baseline mutation_score: ${beforeScore}`, before);

        const sa = await postJson<SocialActionResponse>('/api/social-action', {
            sender_address: EQB_MOCK_SENDER,
            receiver_address: receiver,
        });

        if (!('mutation_score' in sa)) {
            throw new Error('Social action did not return mutation_score');
        }

        const after = await getJson<SharborStateResponse>(`/api/sharbor-state/${encodeURIComponent(receiver)}`);
        const afterScore = after?.mutation_score ?? 0;

        // If applied, expect +5 increment; otherwise allow equality (viral-loop guard)
        if (sa.applied) {
            if (afterScore - beforeScore !== 5) {
                throw new Error(`Expected mutation_score to increase by 5, got delta=${afterScore - beforeScore}`);
            }
        } else {
            if (afterScore !== beforeScore) {
                throw new Error('Social action not applied, but mutation_score changed unexpectedly');
            }
        }

        appendLog('success', '✅ Test 2: Social Mutation Score Updated.', {
            beforeScore,
            afterScore,
            applied: sa.applied,
        });
    }, [appendLog, getJson, postJson]);

    // TEST 3: Merkle Proof Generation & Claim Test (Simulated)
    const runTest3 = useCallback(async (): Promise<void> => {
        appendLog('info', 'Test 3: Requesting Merkle Proof & constructing TON payload...');
        const merkle = await getJson<MerkleProofResponse>(
            `/api/test-merkle-proof?ton_address=${encodeURIComponent(EQB_MOCK_TON_ADDRESS)}`,
        );

        if (!merkle.merkleRootHex || merkle.merkleRootHex.length !== 64) {
            throw new Error('Invalid merkleRootHex returned by backend');
        }
        if (!merkle.sample || !merkle.sample.leaf_hash || !Array.isArray(merkle.sample.merkleProofPath)) {
            throw new Error('Invalid merkle proof sample returned by backend');
        }

        setMerkleData(merkle);
        appendLog('info', 'Merkle proof received.', merkle);

        // Simulate a TON Connect payload construction for claim
        const tx = buildClaimTransaction({
            claimantTonAddress: EQB_MOCK_TON_ADDRESS,
            merkleRootContract: 'EQC_MERKLE_CLAIM_CONTRACT', // placeholder
            leafHashHex: merkle.sample.leaf_hash,
            merkleProofPath: merkle.sample.merkleProofPath,
        });

        setTonPayload(tx);
        appendLog('success', '✅ Test 3: Merkle Proof Generated & TON Payload Constructed.', tx);
    }, [appendLog, getJson]);

    // TEST 4: Growth/Health Update Test
    const runTest4 = useCallback(async (): Promise<void> => {
        appendLog('info', 'Test 4: Fetching Sharbor state for render integration...');
        const state = await getJson<SharborStateResponse>(
            `/api/sharbor-state/${encodeURIComponent(EQB_MOCK_TON_ADDRESS)}`,
        );

        if (typeof state.health !== 'number' || typeof state.growth_percent !== 'number') {
            throw new Error('Sharbor state missing health or growth_percent');
        }

        const health01 = Math.max(0, Math.min(1, (state.health ?? 0) / 100));
        const growth01 = Math.max(0, Math.min(1, (state.growth_percent ?? 0) / 100));
        const mutation01 = Math.max(0, Math.min(1, (state.mutation_score ?? 0) / 100));

        const renderState: SharborState = {
            health: health01,
            growth: growth01,
            mutationScore: mutation01,
        };
        setRenderSharborState(renderState);

        appendLog('success', '✅ Test 4: Sharbor State Retrieved and Render-Ready.', {
            health: state.health,
            growth_percent: state.growth_percent,
            mutation_score: state.mutation_score,
        });
    }, [appendLog, getJson]);

    const runAll = useCallback(async () => {
        if (running) return;
        setRunning(true);
        setTonPayload(null);
        setMerkleData(null);
        setRenderSharborState(undefined);
        setLogs([]);

        // For isolation of Test 2 across multiple runs
        receiverRef.current = `EQB_MOCK_RECEIVER_${Date.now()}`;

        try {
            await runTest1();
            await runTest2();
            await runTest3();
            await runTest4();
            appendLog('success', '🎉 All tests completed successfully.');
        } catch (err) {
            appendLog('error', '❌ Test run aborted due to error.', err instanceof Error ? err.message : err);
        } finally {
            setRunning(false);
        }
    }, [appendLog, runTest1, runTest2, runTest3, runTest4, running]);

    const backendInfo = useMemo(
        () => `Backend: ${BACKEND_URL} | Mock TON: ${EQB_MOCK_TON_ADDRESS} | Receiver: ${receiverRef.current}`,
        [],
    );

    return (
        <div className="p-4 rounded-md border border-slate-700 bg-slate-900/50 text-slate-100 space-y-3">
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Sharboretum Integration Tests</h2>
                <div className="flex items-center gap-2">
                    <button
                        className={`px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50`}
                        onClick={runAll}
                        disabled={running}
                        aria-busy={running}
                    >
                        {running ? 'Running…' : 'Run Tests'}
                    </button>
                    <button
                        className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600"
                        onClick={clearLogs}
                        disabled={running}
                    >
                        Clear
                    </button>
                </div>
            </div>

            <div className="text-xs text-slate-400">{backendInfo}</div>

            <div className="space-y-2">
                <div className="rounded bg-slate-800/60 p-3 max-h-64 overflow-auto">
                    {logs.length === 0 ? (
                        <div className="text-slate-400 text-sm">No logs yet. Click "Run Tests" to begin.</div>
                    ) : (
                        <ul className="space-y-1">
                            {logs.map((l, i) => (
                                <li key={`${l.ts}-${i}`} className="text-xs">
                                    <span
                                        className={
                                            l.level === 'success'
                                                ? 'text-emerald-400'
                                                : l.level === 'error'
                                                  ? 'text-rose-400'
                                                  : 'text-slate-200'
                                        }
                                    >
                                        [{new Date(l.ts).toLocaleTimeString()}] {l.message}
                                    </span>
                                    {typeof l.details !== 'undefined' && (
                                        <pre className="mt-1 whitespace-pre-wrap break-words text-slate-300">
                                            {safeStringify(l.details)}
                                        </pre>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {merkleData && (
                    <div className="rounded bg-slate-800/60 p-3">
                        <div className="font-medium mb-1">Merkle Proof (from backend)</div>
                        <pre className="text-xs whitespace-pre-wrap break-words">{safeStringify(merkleData)}</pre>
                    </div>
                )}

                {tonPayload && (
                    <div className="rounded bg-slate-800/60 p-3">
                        <div className="font-medium mb-1">Constructed TON Connect Payload</div>
                        <pre className="text-xs whitespace-pre-wrap break-words">{safeStringify(tonPayload)}</pre>
                    </div>
                )}
            </div>

            <div className="rounded bg-slate-800/60 p-3">
                <div className="font-medium mb-2">Sharboretum3D Render (from Test 4 data)</div>
                {renderSharborState ? (
                    <div className="h-64 border border-slate-700 rounded">
                        <Sharboretum3D sharborStatus={renderSharborState} />
                    </div>
                ) : (
                    <div className="text-sm text-slate-400">No render data yet.</div>
                )}
            </div>
        </div>
    );
};

export default IntegrationTests;
