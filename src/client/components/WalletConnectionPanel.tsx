import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { TonConnectButton, useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';

type WalletConnectionPanelProps = {
    /**
     * Optional CSS classes to override positioning and layout.
     * By default the panel is fixed at the top-right corner.
     */
    className?: string;
    /**
     * Called immediately after a wallet connects with the raw TON address string.
     * You can hook into your backend here (e.g., POST /api/heartbeat).
     */
    onWalletConnect?: (tonAddress: string) => Promise<void> | void;
    /**
     * Called when the user disconnects the wallet.
     */
    onWalletDisconnect?: () => Promise<void> | void;
    /**
     * If true, shows a minimal inline style (no fixed positioning).
     */
    inline?: boolean;
};

function truncateAddress(addr: string, start = 4, end = 4): string {
    if (!addr || addr.length <= start + end) return addr;
    return `${addr.slice(0, start)}...${addr.slice(-end)}`;
}

/**
 * Default Heartbeat caller used when onWalletConnect is not provided.
 * Sends a POST request to /api/heartbeat with the connected address.
 * Safe no-op on errors (logs to console).
 */
async function defaultHeartbeat(tonAddress: string): Promise<void> {
    try {
        await fetch('/api/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ton_address: tonAddress,
                timestamp: Math.floor(Date.now() / 1000),
            }),
        });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Heartbeat failed (non-blocking):', err);
    }
}

export const WalletConnectionPanel: React.FC<WalletConnectionPanelProps> = ({
    className,
    onWalletConnect,
    onWalletDisconnect,
    inline = false,
}) => {
    const wallet = useTonWallet();
    const [tonConnectUI] = useTonConnectUI();

    const [busy, setBusy] = useState(false);
    const processedAddrRef = useRef<string | null>(null);

    const rawAddress = useMemo(() => wallet?.account?.address ?? null, [wallet]);
    const displayAddress = useMemo(() => (rawAddress ? truncateAddress(rawAddress, 4, 4) : ''), [rawAddress]);

    // Trigger authentication/heartbeat when wallet connects or changes
    useEffect(() => {
        const addr = rawAddress;
        if (!addr) {
            processedAddrRef.current = null;
            return;
        }
        if (processedAddrRef.current === addr) return; // prevent duplicate firing for the same address

        processedAddrRef.current = addr;

        // Prefer caller's hook; fallback to default heartbeat
        const run = async () => {
            try {
                await (onWalletConnect ? onWalletConnect(addr) : defaultHeartbeat(addr));
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error('onWalletConnect handler error:', err);
            }
        };
        void run();
    }, [rawAddress, onWalletConnect]);

    const handleDisconnect = useCallback(async () => {
        if (!tonConnectUI) return;
        try {
            setBusy(true);
            await tonConnectUI.disconnect(); // ensures provider state clears securely
            if (onWalletDisconnect) {
                await onWalletDisconnect();
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('Disconnect error:', err);
        } finally {
            setBusy(false);
        }
    }, [tonConnectUI, onWalletDisconnect]);

    const rootClass = useMemo(() => {
        const base =
            'pointer-events-auto ' +
            'rounded-2xl border border-white/15 ' +
            'bg-white/10 backdrop-blur-md ' +
            'shadow-lg';
        const fixed = inline ? '' : ' fixed top-4 right-4 z-50';
        return `${base}${fixed}${className ? ` ${className}` : ''}`;
    }, [className, inline]);

    // Disconnected UI: prominent Connect button using TonConnectButton
    if (!rawAddress) {
        return (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <div className="absolute items-center gap-3 p-3">
                    {/* TonConnectButton opens the wallet selection modal automatically */}
                    <div className="ml-auto">
                        <TonConnectButton className="tc-connect-btn" />
                    </div>
                </div>
            </motion.div>
        );
    }

    // Connected UI: elegant small panel with truncated address and Disconnect button
    return (
        <motion.div
            className={rootClass}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
        >
            <div className="flex items-center gap-3 p-3">
                <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-wide text-emerald-200/90">Connected</span>
                    <span className="text-sm font-semibold text-white">{displayAddress}</span>
                </div>
                <div className="ml-auto">
                    <button
                        type="button"
                        onClick={handleDisconnect}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-md text-sm font-medium
                                   bg-rose-600/90 hover:bg-rose-500/90 disabled:opacity-60
                                   text-white shadow-sm transition-colors"
                        title="Disconnect wallet"
                        aria-busy={busy}
                    >
                        {busy ? '...' : 'Disconnect'}
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

export default WalletConnectionPanel;
