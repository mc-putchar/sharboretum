// src/client/components/AnimatedButton.tsx
// Reusable motion-enabled button with nature-inspired "pebble" styling.
// - whileHover: slight scale-up, deepen shadow, subtle lift.
// - whileTap: brief squish/press effect.
// - Uses transform-only animations for GPU acceleration (no layout thrash).
// - Tailwind for base styling; colorClass prop customizes palette per use case.

import React from 'react';
import { motion } from 'framer-motion';

export type AnimatedButtonProps = {
  label: string;
  onClick?: () => void;
  className?: string;
  colorClass?: string; // e.g., "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white"
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
};

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  label,
  onClick,
  className,
  colorClass = 'bg-slate-800 hover:bg-slate-900 active:bg-black text-white',
  iconLeft,
  iconRight,
  disabled,
  ariaLabel,
}) => {
  return (
    <motion.button
      type="button"
      aria-label={ariaLabel || label}
      onClick={onClick}
      disabled={disabled}
      // Pebble-inspired rounded pill with soft shadow
      className={[
        'inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold',
        'shadow-[0_8px_20px_rgba(0,0,0,0.10)] transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-300',
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
        colorClass,
        className || '',
      ].join(' ')}
      // Hover: gentle lift/scale; Tap: squish/compress feedback
      whileHover={{ scale: disabled ? 1 : 1.03, y: disabled ? 0 : -1 }}
      whileTap={{ scale: disabled ? 1 : 0.98, y: disabled ? 0 : 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      style={{ willChange: 'transform' }}
    >
      {iconLeft && <span className="mr-2 inline-flex">{iconLeft}</span>}
      <span>{label}</span>
      {iconRight && <span className="ml-2 inline-flex">{iconRight}</span>}
    </motion.button>
  );
};

export default AnimatedButton;
