import { useState, useEffect, useCallback, useRef } from 'react';
import useSound from 'use-sound';

const MUSIC_STORAGE_KEY = 'sharboretum-music-muted';

export const useBackgroundMusic = () => {
  const [isMuted, setIsMuted] = useState(() => {
    // Load mute state from localStorage
    const stored = localStorage.getItem(MUSIC_STORAGE_KEY);
    return stored ? JSON.parse(stored) : false;
  });

  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [play, { stop }] = useSound('/audio/music/ambient.ogg', {
    loop: true,
    volume: isMuted ? 0 : 0.3, // Low volume for ambient background music
    preload: true,
  });

  const interactionTimeoutRef = useRef<NodeJS.Timeout>();

  // Handle first user interaction to start music
  const handleUserInteraction = useCallback(() => {
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
      // Small delay to ensure smooth playback start
      interactionTimeoutRef.current = setTimeout(() => {
        if (!isMuted) {
          play();
        }
      }, 100);
    }
  }, [hasUserInteracted, isMuted, play]);

  // Toggle mute state
  const toggleMute = useCallback(() => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    // Save to localStorage
    localStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify(newMutedState));

    // Control audio playback
    if (newMutedState) {
      stop();
    } else if (hasUserInteracted) {
      play();
    }
  }, [isMuted, hasUserInteracted, play, stop]);



  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
    };
  }, []);

  return {
    isMuted,
    toggleMute,
    handleUserInteraction,
    hasUserInteracted,
  };
};
