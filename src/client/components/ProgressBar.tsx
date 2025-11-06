// src/client/components/ProgressBar.tsx
// Semicircular horizontal progress indicator designed for Health/Growth.
// - Container is a half-ellipse "pebble" with overflow hidden.
// - Inner fill animates its width with Framer Motion (tween/spring).
// - Color can be provided or auto-interpolated from value (green->yellow->red).
// - Direction can be left (anchor to left) or right (anchor to right) for symmetrical placement.
//
// Notes on performance:
// - Animates width and backgroundColor only; limited to a small subtree to minimize reflow.
// - Use modest sizes to fit Telegram Mini Apps; low DOM weight.

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export type SemiCircleProgressProps = {
  value: number; // 0..100
  label?: string;
  color?: string; // override fill color; otherwise auto from value
  direction?: 'left' | 'right';
  sizePx?: number; // overall width of the semicircle container; default 120
  thicknessPx?: number; // height of the semicircle; default sizePx/2
  className?: string;
};

function autoColor(value: number) {
  const v = Math.max(0, Math.min(100, value));
  // 0 -> red (0deg), 50 -> yellow (50-60deg), 100 -> green (120deg)
  const hue = (v / 100) * 120;
  return `hsl(${hue}, 70%, 45%)`;
}

export const SemiCircleProgress: React.FC<SemiCircleProgressProps> = ({
  value,
  label,
  color,
  direction = 'left',
  sizePx = 120,
  thicknessPx,
  className,
}) => {
  const val = Math.max(0, Math.min(100, value));
  const height = thicknessPx ?? Math.round(sizePx / 2);
  const borderRadius = `${sizePx}px ${sizePx}px 0 0`;

  const fillColor = useMemo(() => color || autoColor(val), [color, val]);

  return (
    <div className={className}>
      <div
        className="relative overflow-hidden bg-white/40 shadow-sm ring-1 ring-white/50 backdrop-blur-sm"
        style={{
          width: sizePx,
          height,
          borderTopLeftRadius: borderRadius.split(' ')[0],
          borderTopRightRadius: borderRadius.split(' ')[1],
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        }}
        aria-label={label}
        role="img"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={val}
      >
        {/* Track subtle texture */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.05] bg-[radial-gradient(circle_at_20%_20%,#000_1px,transparent_1px)] [background-size:8px_8px]" />

        {/* Animated fill */}
        <motion.div
          className="absolute top-0 bottom-0"
          style={{
            [direction === 'left' ? 'left' : ('right' as const)]: 0,
            borderTopLeftRadius: borderRadius.split(' ')[0],
            borderTopRightRadius: borderRadius.split(' ')[1],
            backgroundColor: fillColor,
          }}
          initial={{ width: 0, opacity: 0.9 }}
          animate={{ width: `${val}%`, backgroundColor: fillColor, opacity: 1 }}
          transition={{ type: 'tween', duration: 0.6 }}
        />
        {/* Soft inner highlight for depth */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-white/25" />
      </div>

      {label && (
        <div
          className="mt-1 text-center text-[10px] font-medium text-slate-700"
          style={{ width: sizePx }}
        >
          {label} • {val}%
        </div>
      )}
    </div>
  );
};

export default SemiCircleProgress;
