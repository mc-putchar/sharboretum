// src/client/components/Background.tsx
// Full-screen randomized scenic background with blur, glow overlays, and ambient sparkles.
// - Picks one of the public images on load
// - Applies a gentle Ken Burns pan/zoom via Framer Motion
// - Adds soft color wash and vignette for focus
// - Renders ambient twinkling sparkles using transform/opacity-only animations

import React, { useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';

export const Background: React.FC = () => {
  // Randomly select a background image from Vite public assets
  const imageSrc = useMemo(() => {
    const options = [
      '/images/backgrounds/sharbor-morning.png',
      '/images/backgrounds/sharbor-evening.png',
      '/images/backgrounds/sharbor-night.png',
    ];
    return options[Math.floor(Math.random() * options.length)];
  }, []);

  const kenBurns = {
    scale: [1.05, 1.1, 1.05],
    x: ['0%', '2%', '-1%'],
    y: ['0%', '-1%', '0%'],
    transition: { duration: 60, repeat: Infinity },
  };

  // As a robust fallback, paint the background directly on the <body> so it's visible
  // even if stacking contexts or portals behave unexpectedly.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const el = document.body;
    const prev = {
      backgroundImage: el.style.backgroundImage,
      backgroundSize: el.style.backgroundSize,
      backgroundPosition: el.style.backgroundPosition,
      backgroundRepeat: el.style.backgroundRepeat,
      backgroundAttachment: el.style.backgroundAttachment,
      backgroundColor: el.style.backgroundColor,
    };
    el.style.backgroundImage = `url(${imageSrc})`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.backgroundAttachment = 'fixed';
    if (!el.style.backgroundColor) el.style.backgroundColor = '#000000';

    return () => {
      el.style.backgroundImage = prev.backgroundImage || '';
      el.style.backgroundSize = prev.backgroundSize || '';
      el.style.backgroundPosition = prev.backgroundPosition || '';
      el.style.backgroundRepeat = prev.backgroundRepeat || '';
      el.style.backgroundAttachment = prev.backgroundAttachment || '';
      el.style.backgroundColor = prev.backgroundColor || '';
    };
  }, [imageSrc]);

  // Ambient twinkle sparkles
  const Sparkles: React.FC<{ count?: number }> = ({ count = 28 }) => {
    const particles = useMemo(
      () =>
        Array.from({ length: count }).map((_, i) => ({
          id: i,
          left: Math.random() * 100, // %
          top: Math.random() * 100, // %
          size: 1.5 + Math.random() * 2.0, // px
          delay: Math.random() * 5,
          duration: 3 + Math.random() * 4,
          hue: 200 + Math.round(Math.random() * 80), // cool hues
        })),
      [count]
    );

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1, pointerEvents: 'none' }}>
        {particles.map((p) => (
          <motion.span
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.size,
              height: p.size,
              backgroundImage: `radial-gradient(circle at 30% 30%, hsla(${p.hue}, 90%, 85%, 0.95) 0%, hsla(${p.hue}, 90%, 85%, 0) 70%)`,
              filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.6))',
              willChange: 'transform, opacity',
            }}
            initial={{ opacity: 0.15, scale: 0.9 }}
            animate={{ opacity: 0.85, scale: 1.1 }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    );
  };

  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;
  return createPortal(
    <>
      {/* Image layer with blur and gentle motion */}
      <motion.div
        animate={kenBurns}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: -1,
          transformOrigin: '50% 50%',
        }}
      >
        <img
          src={imageSrc}
          alt="Scenic background"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(6px) saturate(1.12) brightness(0.94)',
          }}
        />
      </motion.div>

      {/* Soft color wash/glow overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: -1,
          pointerEvents: 'none',
          mixBlendMode: 'soft-light',
          background:
            'radial-gradient(120% 80% at 20% 20%, rgba(255, 220, 180, 0.35) 0%, rgba(0,0,0,0) 60%), radial-gradient(120% 80% at 80% 80%, rgba(160, 200, 255, 0.35) 0%, rgba(0,0,0,0) 60%)',
        }}
      />

      {/* Vignette to focus center content */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: -1,
          pointerEvents: 'none',
          background:
            'radial-gradient(120% 120% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.25) 100%)',
        }}
      />

      {/* Ambient sparkles */}
      <Sparkles count={28} />
    </>
  , portalTarget
  );
};

export default Background;
