// src/client/components/SparkleBurst.tsx
// Lightweight sparkle/ripple burst for action feedback.
// - Emits N particles from a center point, expanding outward then fading.
// - Uses transform/opacity-only animations for performance.
// - Designed to be placed inside a relatively positioned parent.
// Usage:
//   <AnimatePresence>
//     <SparkleBurst key={`burst-${k}`} from="center" count={8} duration={0.9} />
//   </AnimatePresence>

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export type SparkleBurstProps = {
  from?: 'center' | 'lineage';
  count?: number;
  duration?: number; // total animation time
  maxRadiusPx?: number; // how far particles travel
  className?: string;
};

type Particle = {
  id: number;
  angle: number; // radians
  radius: number; // px
  size: number; // px
  delay: number; // s
  hue: number; // 0..360
};

export const SparkleBurst: React.FC<SparkleBurstProps> = ({
  from = 'center',
  count = 10,
  duration = 0.9,
  maxRadiusPx = 60,
  className,
}) => {
  const particles = useMemo<Particle[]>(() => {
    const arr: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() * Math.PI) / 6; // slight jitter
      const radius = maxRadiusPx * (0.6 + Math.random() * 0.4); // 60%-100% of max
      const size = 4 + Math.round(Math.random() * 4); // 4-8 px
      const delay = (i / count) * (duration * 0.35); // gentle stagger
      const hue = 180 + Math.round(Math.random() * 120); // cool hues (blue->green)
      arr.push({ id: i, angle, radius, size, delay, hue });
    }
    return arr;
  }, [count, duration, maxRadiusPx]);

  // Origin point positioning inside parent
  const originStyle: React.CSSProperties =
    from === 'center'
      ? { left: '50%', top: 0, transform: 'translate(-50%, -50%)' }
      : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div className={['pointer-events-none absolute', className || ''].join(' ')} style={originStyle}>
      {particles.map((p) => {
        const dx = Math.cos(p.angle) * p.radius;
        const dy = Math.sin(p.angle) * p.radius;
        const color = `radial-gradient(circle at 30% 30%, hsla(${p.hue}, 85%, 70%, 1) 0%, hsla(${p.hue}, 85%, 70%, 0) 70%)`;

        return (
          <motion.span
            key={p.id}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              left: 0,
              top: 0,
              backgroundImage: color,
              filter: 'drop-shadow(0 0 6px hsla(0,0%,100%,0.6))',
              willChange: 'transform, opacity',
            }}
            initial={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
            animate={{ x: dx, y: dy, scale: 1, opacity: 1 }}
            exit={{ scale: 0.2, opacity: 0 }}
            transition={{
              duration,
              delay: p.delay,
            }}
          />
        );
      })}
      {/* Expanding ripple ring for additional feedback */}
      <motion.div
        className="absolute rounded-full border border-white/50"
        style={{ width: 8, height: 8, left: -4, top: -4, boxShadow: '0 0 20px rgba(255,255,255,0.3) inset' }}
        initial={{ scale: 0.2, opacity: 0.6 }}
        animate={{ scale: 8, opacity: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: duration * 1.1 }}
      />
    </div>
  );
};

export default SparkleBurst;
