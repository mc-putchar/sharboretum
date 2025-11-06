import React from 'react';
import { motion } from 'framer-motion';

interface MusicControlProps {
    isMuted: boolean;
    onToggle: () => void;
}

export const MusicControl: React.FC<MusicControlProps> = ({ isMuted, onToggle }) => {
    return (
        <motion.button
            type="button"
            className="relative float-right z-30 grid h-10 w-10 place-items-center rounded-full bg-white/40 backdrop-blur-md shadow-lg border border-teal-300/50 pointer-events-auto"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggle}
            aria-label={isMuted ? 'Unmute background music' : 'Mute background music'}
            title={isMuted ? 'Unmute background music' : 'Mute background music'}
        >
            <motion.div
                className="relative flex items-center justify-center"
                animate={{
                    color: isMuted ? '#64748b' : '#10b981', // slate-500 to emerald-500
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
                {/* Speaker Icon */}
                <motion.svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="drop-shadow-sm"
                >
                    {/* Speaker body */}
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />

                    {/* Sound waves - animate opacity and scale */}
                    <motion.g
                        animate={{
                            opacity: isMuted ? 0 : 1,
                            scale: isMuted ? 0.8 : 1,
                        }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </motion.g>
                </motion.svg>

                {/* Mute slash overlay */}
                <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    animate={{
                        opacity: isMuted ? 1 : 0,
                        scale: isMuted ? 1 : 0.8,
                    }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="drop-shadow-sm"
                    >
                        <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                </motion.div>
            </motion.div>

            {/* Subtle glow effect when playing */}
            <motion.div
                className="absolute inset-0 rounded-full"
                animate={{
                    boxShadow: isMuted
                        ? '0 0 0 0 rgba(0,0,0,0)'
                        : '0 0 0 0 rgba(16,185,129,0.3), 0 0 20px rgba(16,185,129,0.2)',
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
            />
        </motion.button>
    );
};
