// src/client/components/SocialPanel.tsx
// Collapsible Social Panel (bottom sheet) with staggered friend entries.
// - Uses AnimatePresence for sheet/overlay mount/unmount.
// - Panel slides in from bottom; overlay fades in.
// - Friend items animate in with staggerChildren on open.
// - Water button triggers backend viral action; success shows subtle feedback via button state.
// - Optimized for Telegram Mini App constraints (compact layout, low DOM weight).

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { AnimatedButton } from './AnimatedButton';
import { waterFriend } from '../utils/social';

export type SocialPanelProps = {
    open: boolean;
    onClose?: () => void;
};

type Friend = {
    name: string;
    address: string;
    mutationScore: number;
};

const sheetVariants: Variants = {
    hidden: { y: '100%', opacity: 0.25 },
    visible: {
        y: 0,
        opacity: 0.85,
        transition: { type: 'spring', stiffness: 220, damping: 28 },
    },
    // Remove ease to satisfy stricter framer-motion TS types
    exit: { y: '100%', opacity: 0.25, transition: { duration: 0.24 } },
};

const overlayVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 0.4, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.2 } },
};

const listVariants: Variants = {
    hidden: {},
    visible: {
        transition: { staggerChildren: 0.05, delayChildren: 0.05 },
    },
};

const itemVariants: Variants = {
    hidden: { y: 10, opacity: 0, scale: 0.98 },
    visible: {
        y: 0,
        opacity: 1,
        scale: 1,
        transition: { type: 'spring', stiffness: 340, damping: 26 },
    },
};

const pebble = '';

export const SocialPanel: React.FC<SocialPanelProps> = ({ open, onClose }) => {
    // Demo friend list; in production this would come from API.
    const friends = useMemo<Friend[]>(
        () => [
            { name: 'Luna', address: 'EQB6...0x12', mutationScore: 47 },
            { name: 'Kai', address: 'EQD2...9afA', mutationScore: 61 },
            { name: 'Mira', address: 'EQFs...72bC', mutationScore: 29 },
            { name: 'Orin', address: 'EQZ0...cc9D', mutationScore: 83 },
        ],
        [],
    );

    const [watering, setWatering] = useState<Record<string, 'idle' | 'busy' | 'done' | 'limit' | 'error'>>({});

    async function onWater(address: string) {
        try {
            setWatering((prev) => ({ ...prev, [address]: 'busy' }));
            const res = await waterFriend(address);
            if (res.ok) {
                setWatering((prev) => ({ ...prev, [address]: res.applied ? 'done' : 'limit' }));
            } else {
                setWatering((prev) => ({ ...prev, [address]: 'error' }));
            }
            // Reset to idle after a short delay
            setTimeout(() => setWatering((prev) => ({ ...prev, [address]: 'idle' })), 1600);
        } catch {
            setWatering((prev) => ({ ...prev, [address]: 'error' }));
            setTimeout(() => setWatering((prev) => ({ ...prev, [address]: 'idle' })), 1600);
        }
    }

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Dim overlay */}
                    <motion.div
                        className="fixed inset-0 z-40 bg-black"
                        variants={overlayVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        onClick={onClose}
                    />

                    {/* Bottom sheet */}
                    <motion.div
                        className="fixed inset-x-0 bottom-0 z-50"
                        variants={sheetVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                    >
                        <div className="mx-auto w-full max-w-xl px-4 pb-6">
                            <div
                                className="rounded-3xl bg-gradient-to-br from-white/95 via-slate-50/90 to-slate-100/85 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] ring-1 ring-white/60 border border-white/40 px-4 pt-3 pb-4"
                                style={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.85)',
                                    backdropFilter: 'blur(16px) saturate(180%)',
                                }}
                            >
                                {/* Drag handle */}
                                <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-300/70" />
                                {/* Header */}
                                <div className="mb-2 flex items-center justify-between">
                                    <div>
                                        <div className="text-xs uppercase tracking-wide text-slate-500">Friends</div>
                                        <div className="text-base font-semibold text-slate-900">
                                            Help and Leaderboard
                                        </div>
                                    </div>
                                    <AnimatedButton
                                        label="Close"
                                        ariaLabel="Close friends"
                                        onClick={onClose}
                                        colorClass="bg-slate-900/80 hover:bg-slate-900 text-white"
                                    />
                                </div>

                                {/* Friend list */}
                                <motion.ul
                                    variants={listVariants}
                                    initial="hidden"
                                    animate="visible"
                                    className="flex flex-col gap-2"
                                >
                                    {friends.map((f) => {
                                        const state = watering[f.address] ?? 'idle';
                                        return (
                                            <motion.li
                                                key={f.address}
                                                variants={itemVariants}
                                                className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 shadow-sm ring-1 ring-slate-200 border border-slate-100"
                                            >
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-semibold text-slate-900">
                                                        {f.name}
                                                    </div>
                                                    <div className="truncate text-xs text-slate-500">{f.address}</div>
                                                </div>
                                                <div className="ml-3 flex items-center gap-2">
                                                    <div className="text-xs text-slate-600">
                                                        Mutation{' '}
                                                        <span className="font-semibold">{f.mutationScore}</span>
                                                    </div>
                                                    <AnimatedButton
                                                        label={
                                                            state === 'busy'
                                                                ? 'Watering…'
                                                                : state === 'done'
                                                                  ? 'Watered +5'
                                                                  : state === 'limit'
                                                                    ? 'Limit'
                                                                    : state === 'error'
                                                                      ? 'Error'
                                                                      : 'Water'
                                                        }
                                                        disabled={state === 'busy'}
                                                        onClick={() => onWater(f.address)}
                                                        colorClass={
                                                            state === 'done'
                                                                ? 'bg-emerald-600 hover:bg-emerald-600 active:bg-emerald-700 text-white'
                                                                : state === 'limit'
                                                                  ? 'bg-amber-500 hover:bg-amber-500 active:bg-amber-600 text-black'
                                                                  : state === 'error'
                                                                    ? 'bg-rose-600 hover:bg-rose-600 active:bg-rose-700 text-white'
                                                                    : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white'
                                                        }
                                                    />
                                                </div>
                                            </motion.li>
                                        );
                                    })}
                                </motion.ul>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default SocialPanel;
