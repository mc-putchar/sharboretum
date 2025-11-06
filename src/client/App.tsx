// src/client/App.tsx
// Sharboretum Dashboard App Shell with animated UI overlays.
// - Central low-poly Sharbor 3D canvas occupies the majority of the screen.
// - Animated Top Status Panel (spring drop-in) showing SHARD balance and lineage.
// - Progress Rings (motion.svg) tracking Health and Growth with strokeDashoffset animation.
// - Bottom Action Bar with hover/tap feedback and urgent pulse for Water/Nourish.
// - Social/Lineage Side Panel trigger button (hover scale, brief rotation on click) bottom-right.
// - Tailwind classes tuned to serene palette (soft greens, teals, light purples), subtle blurs.
// - Framer Motion extensively used for performant transitions.
//
// NOTE: This file assumes framer-motion, react, and tailwind are already set up.

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { waterFriend, shareSharbor } from './utils/social';
import { Sharbor } from './components/SharborCard';
import { DiamondPlus } from 'lucide-react';
import { ToastHost, ToastMessage } from './components/Toast';
import { SocialPanel } from './components/SocialPanel';
import { SparkleBurst } from './components/SparkleBurst';
import { Background } from './components/Background';
import { Sharboretum3D, SharborState } from './components/Sharboretum3D';
import { useBackgroundMusic } from './utils/useBackgroundMusic';
import { MusicControl } from './components/MusicControl';

import { IntegrationTests } from './components/IntegrationTests';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type GrowthStage = 'seedling' | 'sprout' | 'sharbor';

function stageFromGrowth(percent: number | undefined): GrowthStage {
    const p = typeof percent === 'number' ? percent : 0;
    if (p < 33) return 'seedling';
    if (p < 80) return 'sprout';
    return 'sharbor';
}

// Interpolate health color from green -> yellow -> red
function healthColor(health: number | undefined): string {
    const h = typeof health === 'number' ? Math.max(0, Math.min(100, health)) : 50;
    const hue = (h / 100) * 120; // 0 red, 120 green
    return `hsl(${hue}, 60%, 45%)`;
}

// ---------------------------------------------------------------------------
// Status Card (Compact status display)
// ---------------------------------------------------------------------------
type StatusCardProps = {
    shardBalance: number;
    generation: number | undefined;
    lineageLength: number | undefined;
};

const StatusCard: React.FC<StatusCardProps> = ({ shardBalance, generation, lineageLength }) => {
    return (
        <motion.div
            style={{
                backgroundColor: 'rgba(240, 253, 250, 0.15)',
                borderColor: 'rgba(255, 255, 255, 0.6)',
                backdropFilter: 'blur(16px) saturate(180%) brightness(110%)',
                borderRadius: '24px',
                margin: '4px',
                padding: '8px',
            }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
        >
            <div className="flex flex-col gap-3 p">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-emerald-800"> SHARDS:</span>
                    <span className="text-sm font-semibold text-emerald-900">{shardBalance ?? 0}</span>
                    <DiamondPlus
                        style={{
                            color: 'rgba(5, 195, 105, 0.95)',
                            filter: 'drop-shadow(0 0 6px rgba(16,185,129,0.2))',
                        }}
                    />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex items-center gap-2">
                        <span className="inline-block h-3 w-3 rounded-full bg-violet-400 shadow-[0_0_12px_2px_rgba(139,92,246,0.5)]" />
                        <span className="text-sm font-medium text-violet-800">Generation:</span>
                        <span className="text-sm font-semibold text-violet-900">{generation ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-violet-800">Lineage:</span>
                        <span className="text-sm font-semibold text-violet-900">{lineageLength ?? '—'}</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// ---------------------------------------------------------------------------
// Control Card (Music and other controls)
// ---------------------------------------------------------------------------
type ControlCardProps = {
    isMuted: boolean;
    onToggleMute: () => void;
};

const ControlCard: React.FC<ControlCardProps> = ({ isMuted, onToggleMute }) => {
    return (
        <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
        >
            <div className="z-42">
                <MusicControl isMuted={isMuted} onToggle={onToggleMute} />
            </div>
        </motion.div>
    );
};

// ---------------------------------------------------------------------------
// ProgressRings (motion.svg + strokeDashoffset animation)
// ---------------------------------------------------------------------------
// - Two overlapping circular rings for Health and Growth.
// - Uses circumference-based strokeDasharray/strokeDashoffset.
// - Animates only when values change via Framer Motion's animate prop.
// - Smooth duration and easing for a serene feel.
type ProgressRingProps = {
    value: number; // 0..1
    size?: number;
    stroke?: number;
    color?: string; // stroke color
    trackColor?: string;
    label?: string;
};

const ProgressRing: React.FC<ProgressRingProps> = ({
    value,
    size = 64,
    stroke = 8,
    color = '#14b8a6', // teal-500
    trackColor = 'rgba(255,255,255,0.35)',
    label,
}) => {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - Math.max(0, Math.min(1, value)));

    return (
        <div className="relative flex select-none items-center justify-center">
            <motion.svg width={size} height={size} className="drop-shadow-sm" style={{ transform: 'rotate(-90deg)' }}>
                {/* Track */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={trackColor}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={0}
                />
                {/* Progress */}
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    fill="transparent"
                    strokeDasharray={circumference}
                    // Framer Motion animates strokeDashoffset when value changes
                    initial={{ strokeDashoffset: dashOffset }}
                    animate={{ strokeDashoffset: dashOffset }}
                    transition={{ duration: 1.0, ease: 'easeInOut' }}
                />
            </motion.svg>
            {label && <div className="absolute text-xs font-semibold text-white drop-shadow">{label}</div>}
        </div>
    );
};

const ProgressRings: React.FC<{ health: number; growth: number }> = ({ health, growth }) => {
    const healthValue = Math.max(0, Math.min(1, health));
    const growthValue = Math.max(0, Math.min(1, growth));
    return (
        <>
            {/* Health Ring - Bottom Left */}
            <div className="z-30 pointer-events-none float-left">
                <div
                    style={{
                        backgroundColor: 'rgba(13, 148, 136, 0.12)',
                        // borderColor: 'rgba(255, 255, 255, 0.7)',
                        backdropFilter: 'blur(16px) saturate(180%) brightness(110%)',
                        borderRadius: '24px',
                        margin: '2px',
                        padding: '8px',
                    }}
                >
                    <ProgressRing value={healthValue} label="Health" color="#14b8a6" />
                </div>
            </div>
            {/* Growth Ring - Top Right */}
            <div className="z-30 pointer-events-none float-right">
                <div
                    style={{
                        backgroundColor: 'rgba(139, 92, 246, 0.12)',
                        // borderColor: 'rgba(255, 255, 255, 0.7)',
                        backdropFilter: 'blur(16px) saturate(180%) brightness(110%)',
                        borderRadius: '24px',
                        margin: '2px',
                        padding: '8px',
                    }}
                >
                    <ProgressRing value={growthValue} label="Growth" color="#8b5cf6" />
                </div>
            </div>
        </>
    );
};

// ---------------------------------------------------------------------------
// SocialPanelButton
// ---------------------------------------------------------------------------
// - Hover: scale 1.1
// - Click: brief rotation to signify transition, then open side panel.
const SocialPanelButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
    const [spin, setSpin] = useState(false);

    useEffect(() => {
        if (!spin) return;
        const t = setTimeout(() => setSpin(false), 220);
        return () => clearTimeout(t);
    }, [spin]);

    return (
        <motion.button
            type="button"
            className="fixed bottom-4 right-4 z-30 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-teal-500/80 via-teal-600/70 to-teal-700/60 text-white shadow-2xl backdrop-blur-xl border border-white/50 pointer-events-auto"
            style={{
                backgroundColor: 'rgba(13, 148, 136, 0.8)',
                borderColor: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(12px) saturate(150%)',
                borderRadius: '50%',
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ rotate: 20 }}
            animate={spin ? { rotate: [0, 20, 0], transition: { duration: 0.24 } } : undefined}
            onClick={() => {
                setSpin(true);
                onClick();
            }}
            aria-label="Open Social / Lineage"
            title="Open Social / Lineage"
        >
            {/* Simple icon glyph; can replace with real icon */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="drop-shadow-sm">
                <path
                    d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5Z"
                    stroke="white"
                    strokeWidth="2"
                />
                <path
                    d="M2 22c0-4.418 3.582-8 8-8h4c4.418 0 8 3.582 8 8"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                />
            </svg>
        </motion.button>
    );
};

// ---------------------------------------------------------------------------
// ActionBar (Bottom sticky bar)
// ---------------------------------------------------------------------------
// Detailed Framer Motion implementation:
// - Buttons: whileHover scale + glow, whileTap deep press.
// - Conditional animation: Water/Nourish pulses with urgency when health < 0.5.
// - Palette: emerald/teal for success, amber for claim, violet for shard.
type ActionBarProps = {
    onWaterClick: () => void;
    onClaimClick: () => void;
    onShardClick: () => void;
    onHurtClick?: () => void; // for demo/testing
    onUngrowClick?: () => void; // for demo/testing
    waterUrgent: boolean;
};

const ActionBar: React.FC<ActionBarProps> = ({
    onWaterClick,
    onClaimClick,
    onShardClick,
    onHurtClick,
    onUngrowClick,
    waterUrgent,
}) => {
    const urgentPulse = {
        scale: [1, 1.06, 1],
        boxShadow: [
            '0 0 0 0 rgba(0,0,0,0), 0 0 10px rgba(16,185,129,0.0)',
            '0 0 0 0 rgba(0,0,0,0), 0 0 18px rgba(16,185,129,0.65)',
            '0 0 0 0 rgba(0,0,0,0), 0 0 10px rgba(16,185,129,0.0)',
        ],
        transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' as const },
    };

    return (
        <div className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 pointer-events-auto">
            <div
                className="flex items-center gap-3 rounded-full bg-gradient-to-r from-white/20 via-slate-50/15 to-white/10 px-4 py-2 backdrop-blur-xl shadow-2xl border border-white/60"
                style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    borderColor: 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(20px) saturate(200%) brightness(120%)',
                    borderRadius: '9999px',
                }}
            >
                <motion.button
                    type="button"
                    className="rounded-full bg-gradient-to-br from-emerald-500/90 via-emerald-600/80 to-emerald-700/70 px-4 py-2 text-sm font-semibold text-white shadow-2xl backdrop-blur-sm border border-emerald-400/50"
                    style={{
                        backgroundColor: 'rgba(5, 150, 105, 0.85)',
                        borderColor: 'rgba(52, 211, 153, 0.6)',
                        backdropFilter: 'blur(8px)',
                        borderRadius: '9999px',
                    }}
                    whileHover={{ scale: 1.05, boxShadow: '0 0 0 0 rgba(0,0,0,0), 0 0 14px rgba(16,185,129,0.6)' }}
                    whileTap={{ scale: 0.95 }}
                    animate={waterUrgent ? urgentPulse : undefined}
                    onClick={onWaterClick}
                >
                    Water / Nourish
                </motion.button>

                <motion.button
                    type="button"
                    className="rounded-full bg-gradient-to-br from-amber-400/90 via-amber-500/80 to-amber-600/70 px-4 py-2 text-sm font-semibold text-amber-950 shadow-2xl backdrop-blur-sm border border-amber-300/50"
                    style={{
                        backgroundColor: 'rgba(245, 158, 11, 0.85)',
                        borderColor: 'rgba(252, 211, 77, 0.6)',
                        backdropFilter: 'blur(8px)',
                        borderRadius: '9999px',
                    }}
                    whileHover={{ scale: 1.05, boxShadow: '0 0 0 0 rgba(0,0,0,0), 0 0 14px rgba(245,158,11,0.6)' }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onClaimClick}
                >
                    Claim
                </motion.button>

                <motion.button
                    type="button"
                    className="rounded-full bg-gradient-to-br from-violet-500/90 via-violet-600/80 to-violet-700/70 px-4 py-2 text-sm font-semibold text-white shadow-2xl backdrop-blur-sm border border-violet-400/50"
                    style={{
                        backgroundColor: 'rgba(124, 58, 237, 0.85)',
                        borderColor: 'rgba(167, 139, 250, 0.6)',
                        backdropFilter: 'blur(8px)',
                        borderRadius: '9999px',
                    }}
                    whileHover={{ scale: 1.05, boxShadow: '0 0 0 0 rgba(0,0,0,0), 0 0 14px rgba(139,92,246,0.6)' }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onShardClick}
                >
                    Shard
                </motion.button>
                {/* Demo buttons for testing */}
                {onHurtClick && (
                    <motion.button
                        type="button"
                        className="rounded-full bg-red-600/90 px-3 py-1 text-sm font-semibold text-white shadow-2xl backdrop-blur-sm border border-red-400/50"
                        style={{
                            backgroundColor: 'rgba(220, 38, 38, 0.85)',
                            borderColor: 'rgba(248, 113, 113, 0.6)',
                            backdropFilter: 'blur(8px)',
                            borderRadius: '9999px',
                        }}
                        whileHover={{ scale: 1.05, boxShadow: '0 0 0 0 rgba(0,0,0,0), 0 0 14px rgba(220,38,38,0.6)' }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onHurtClick}
                    >
                        Hurt (Demo)
                    </motion.button>
                )}
                {onUngrowClick && (
                    <motion.button
                        type="button"
                        className="rounded-full bg-yellow-600/90 px-3 py-1 text-sm font-semibold text-white shadow-2xl backdrop-blur-sm border border-yellow-400/50"
                        style={{
                            backgroundColor: 'rgba(202, 138, 4, 0.85)',
                            borderColor: 'rgba(253, 224, 71, 0.6)',
                            backdropFilter: 'blur(8px)',
                            borderRadius: '9999px',
                        }}
                        whileHover={{ scale: 1.05, boxShadow: '0 0 0 0 rgba(0,0,0,0), 0 0 14px rgba(202,138,4,0.6)' }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onUngrowClick}
                    >
                        Ungrow (Demo)
                    </motion.button>
                )}
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------

export const App: React.FC = () => {
    // Demo state; in real app this would be fetched from backend
    const [sharbor, setSharbor] = useState<Sharbor>({
        ton_address: 'EQCk...abcd',
        shard_balance: 42,
        mutation_score: 57,
        health: 46,
        growth_percent: 2,
        nft_id: '12345',
        generation: 2,
        parent_nft_address: 'EQBparentParentParentParentParentParentParent1234',
    });

    const health01 = Math.max(0, Math.min(1, (sharbor.health ?? 50) / 100));
    const growth01 = Math.max(0, Math.min(1, (sharbor.growth_percent ?? 0) / 100));
    const mutation01 = Math.max(0, Math.min(1, (sharbor.mutation_score ?? 0) / 100));
    const sharborState: SharborState = {
        health: health01,
        growth: growth01,
        mutationScore: mutation01,
    };

    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const [sparkleKey, setSparkleKey] = useState<number>(0);
    const [socialOpen, setSocialOpen] = useState<boolean>(false);
    const [showTests, setShowTests] = useState<boolean>(false);

    // Debug logging
    console.log('Current socialOpen state:', socialOpen);

    // Background music hook
    const { isMuted, toggleMute, handleUserInteraction } = useBackgroundMusic();

    const stage = useMemo(() => stageFromGrowth(sharbor.growth_percent), [sharbor.growth_percent]);
    const healthCol = useMemo(() => healthColor(sharbor.health), [sharbor.health]);

    async function handleWater() {
        handleUserInteraction(); // Start background music on first interaction\
        setSharbor((prev) => {
            const nextHealth = Math.min(100, (prev.health || 50) + 10);
            return { ...prev, health: nextHealth };
        });
        setToasts((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                type: 'success',
                title: 'Watered',
                message: '+10% Health.',
            },
        ]);
        ``;
    }

    function handleShare() {
        handleUserInteraction(); // Start background music on first interaction
        shareSharbor(String(sharbor.nft_id || sharbor.ton_address));
        setToasts((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                type: 'info',
                title: 'Share',
                message: 'Opened Telegram sharing interface.',
            },
        ]);
    }

    function handleClaim() {
        handleUserInteraction(); // Start background music on first interaction
        // Demo claim: increment shards a bit and growth percent
        setSharbor((prev) => {
            const nextGrowth = Math.min(100, (prev.growth_percent || 0) + 3);
            const nextShard = prev.shard_balance + 1;
            return { ...prev, growth_percent: nextGrowth, shard_balance: nextShard };
        });
        setToasts((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                type: 'success',
                title: 'Claimed',
                message: '+1 Shard, +3% Growth.',
            },
        ]);
    }

    function handleHurtDEMO() {
        handleUserInteraction(); // Start background music on first interaction
        setSharbor((prev) => {
            const nextHealth = Math.max(0, (prev.health || 50) - 15);
            return { ...prev, health: nextHealth };
        });
        setToasts((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                type: 'error',
                title: 'Oh no!',
                message: '-15% Health (Demo)',
            },
        ]);
    }

    function handleUngrowDEMO() {
        handleUserInteraction(); // Start background music on first interaction
        setSharbor((prev) => {
            const nextGrowth = Math.max(0, (prev.growth_percent || 0) - 10);
            return { ...prev, growth_percent: nextGrowth };
        });
        setToasts((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                type: 'warning',
                title: 'Regression',
                message: '-10% Growth (Demo)',
            },
        ]);
    }

    // Mutation celebration: when mutation score crosses certain thresholds
    const celebrateMutation = useMemo(() => {
        const ms = sharbor.mutation_score || 0;
        return ms >= 80; // VERY HIGH threshold
    }, [sharbor.mutation_score]);

    // Derived lineage length (placeholder: use generation for display)
    const lineageLength = sharbor.generation ?? undefined;

    return (
        <div className="min-h-screen w-full overflow-hidden bg-gradient-to-b from-teal-900 via-slate-900 to-violet-900">
            {/* Animated Background */}
            <Background />

            {/* Subtle noise overlay for low-poly mood */}
            <div className="pointer-events-none fixed inset-0 z-[1] opacity-[0.04] bg-[radial-gradient(circle_at_20%_20%,#000_1px,transparent_1px)] [background-size:10px_10px]" />

            {/* Toast notifications */}
            <ToastHost
                toasts={toasts}
                onDismiss={(id: string) => setToasts((prev: ToastMessage[]) => prev.filter((t) => t.id !== id))}
            />

            <div className="relative z-0 w-full" style={{ height: '80%', paddingBottom: '80px' }}>
                {/* Mutation celebration particles from top area */}
                <AnimatePresence>
                    {celebrateMutation && (
                        <SparkleBurst key={`celebrate-${sparkleKey}`} from="lineage" count={12} duration={1.2} />
                    )}
                </AnimatePresence>

                {/* Card-based Layout */}
                <div className="relative w-full p-4 lg:p-6" style={{ minHeight: '100vh' }}>
                    <div className="mx-auto max-w-7xl">
                        {/* Top Cards Row */}
                        <motion.div
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6"
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                        >
                            <ControlCard isMuted={isMuted} onToggleMute={toggleMute} />
                            <StatusCard
                                shardBalance={sharbor.shard_balance ?? 0}
                                generation={sharbor.generation}
                                lineageLength={lineageLength}
                            />
                        </motion.div>

                        {/* Progress Cards Overlay */}
                        <div className="inset-0 z-10 pointer-events-none p-4">
                            <div className="grid grid-cols-2 gap-4 h-full">
                                <ProgressRings health={health01} growth={growth01} />
                            </div>
                        </div>

                        {/* Main Content Area with Cards Overlay */}
                        <div className="relative overflow-hidden" style={{ height: '60vh' }}>
                            {/* Central 3D Canvas */}
                            <div
                                className="z-1 overflow-hidden"
                                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                            >
                                <Sharboretum3D sharborStatus={sharborState} />
                            </div>

                            {/* Mutation celebration particles */}
                            <AnimatePresence>
                                {celebrateMutation && (
                                    <SparkleBurst
                                        key={`celebrate-${sparkleKey}`}
                                        from="lineage"
                                        count={12}
                                        duration={1.2}
                                    />
                                )}
                            </AnimatePresence>

                            <div className="z-0" style={{ position: 'absolute', bottom: 0 }}>
                                <ActionBar
                                    onWaterClick={handleWater}
                                    onClaimClick={handleClaim}
                                    onShardClick={handleShare}
                                    onHurtClick={handleHurtDEMO}
                                    onUngrowClick={handleUngrowDEMO}
                                    waterUrgent={health01 < 0.5}
                                />
                            </div>

                            {/*<div className="inset-0 z-15 pointer-events-none rounded-3xl border-2 border-white/10" />*/}

                            {/* Social Panel with smooth animations */}
                            <div className="relative inset-0 z-40">
                                <SocialPanel open={socialOpen} onClose={() => setSocialOpen(false)} />
                            </div>
                        </div>

                        <div className="sticky bottom-0 z-20 pointer-events-auto">
                            {/* Social Panel Button */}
                            <SocialPanelButton onClick={() => setSocialOpen((s) => !s)} />
                            {/* Open Integration Tests */}
                            <button
                                type="button"
                                className="fixed z-30"
                                style={{
                                    backgroundColor: 'rgba(142, 142, 142, 0.8)',
                                    borderColor: 'rgba(255, 255, 255, 0.7)',
                                    backdropFilter: 'blur(12px) saturate(150%)',
                                    borderRadius: '20%',
                                    right: 16,
                                }}
                                onClick={() => setShowTests(true)}
                                title="Open Integration Tests"
                            >
                                Tests
                            </button>
                        </div>
                    </div>
                </div>

                {showTests && (
                    <div className="fixed inset-0 z-100 overflow-auto bg-black/60 backdrop-blur-sm">
                        <div className="max-w-7xl mx-auto p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h1 className="text-white font-semibold">Sharboretum Integration Tests</h1>
                                <button
                                    className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white"
                                    onClick={() => setShowTests(false)}
                                >
                                    Back to App
                                </button>
                            </div>
                            <div className="rounded-lg border border-slate-700 bg-slate-900/70">
                                <IntegrationTests />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
export default App;
