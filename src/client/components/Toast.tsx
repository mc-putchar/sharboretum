// src/client/components/Toast.tsx
// ToastHost: lightweight toast notification system with AnimatePresence.
// - Each toast slides/fades in and out.
// - Auto-dismiss after a short duration; manual close supported.
// - Nature-inspired, soft, pebble-like cards with subtle shadows.

import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AnimatedButton } from './AnimatedButton';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export type ToastMessage = {
    id: string;
    type: ToastKind;
    title: string;
    message?: string;
    // Optional override for how long to show this toast (ms)
    durationMs?: number;
};

export type ToastHostProps = {
    toasts: ToastMessage[];
    onDismiss: (id: string) => void;
    // Positioning controls if needed later
    position?: 'top' | 'bottom';
};

const kindStyles: Record<ToastKind, { bg: string; text: string; border: string; bgColor: string }> = {
    success: {
        bg: 'bg-emerald-600',
        text: 'text-white',
        border: 'ring-emerald-300/60',
        bgColor: 'rgba(5, 150, 105, 0.95)',
    },
    error: {
        bg: 'bg-rose-600',
        text: 'text-white',
        border: 'ring-rose-300/60',
        bgColor: 'rgba(220, 38, 38, 0.95)',
    },
    info: {
        bg: 'bg-slate-800',
        text: 'text-white',
        border: 'ring-slate-300/60',
        bgColor: 'rgba(30, 41, 59, 0.95)',
    },
    warning: {
        bg: 'bg-amber-500',
        text: 'text-black',
        border: 'ring-amber-200/80',
        bgColor: 'rgba(245, 158, 11, 0.95)',
    },
};

// Single toast item with auto-dismiss
const ToastItem: React.FC<{
    toast: ToastMessage;
    onDismiss: (id: string) => void;
}> = ({ toast, onDismiss }) => {
    useEffect(() => {
        const t = setTimeout(() => onDismiss(toast.id), toast.durationMs ?? 2600);
        return () => clearTimeout(t);
    }, [toast.id, toast.durationMs, onDismiss]);

    const s = kindStyles[toast.type];

    return (
        <motion.div
            layout
            initial={{ y: -20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 0.75, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className={[
                'pointer-events-auto flex w-[92vw] max-w-sm items-start gap-3 rounded-2xl px-4 py-3 shadow-2xl ring-1 backdrop-blur-sm',
                s.bg,
                s.text,
                s.border,
            ].join(' ')}
            style={{
                backgroundColor: s.bgColor,
                backdropFilter: 'blur(8px) saturate(150%)',
                margin: '2px',
                padding: '4px',
                borderRadius: '16px',
            }}
            role="status"
            aria-live="polite"
        >
            <div className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-white/70 shadow-[0_0_8px_rgba(255,255,255,0.85)]" />
            <div className="flex-1">
                <div className="text-sm font-semibold">{toast.title}</div>
                {toast.message && <div className="mt-0.5 text-xs opacity-90">{toast.message}</div>}
            </div>
            <AnimatedButton
                label="×"
                ariaLabel="Dismiss"
                onClick={() => onDismiss(toast.id)}
                colorClass="bg-white/20 hover:bg-white/30 active:bg-white/40 text-white"
                className="px-2 py-1 text-base leading-none"
            />
        </motion.div>
    );
};

export const ToastHost: React.FC<ToastHostProps> = ({ toasts, onDismiss, position = 'top' }) => {
    const top = position === 'top';

    return (
        <div
            className={[
                'pointer-events-none fixed left-1/2 z-[1000] flex -translate-x-1/2 items-center justify-center',
                top ? 'top-3' : 'bottom-3',
            ].join(' ')}
        >
            <div className="flex max-h-[40vh] w-full flex-col items-center gap-3">
                <AnimatePresence initial={false}>
                    {toasts.slice(0, 5).map((t) => (
                        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default ToastHost;
