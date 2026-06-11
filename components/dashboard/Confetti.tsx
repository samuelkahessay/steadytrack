'use client';

import { useEffect, useState } from 'react';

interface ConfettiProps {
  trigger: boolean;
  onComplete?: () => void;
}

export default function Confetti({ trigger, onComplete }: ConfettiProps) {
  const [particles, setParticles] = useState<Array<{ id: number; left: string; delay: string; color: string }>>([]);

  useEffect(() => {
    if (trigger) {
      // Generate random confetti particles
      const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 'bg-purple-500', 'bg-pink-500'];
      const newParticles = Array.from({ length: 12 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 0.3}s`,
        color: colors[Math.floor(Math.random() * colors.length)],
      }));

      setParticles(newParticles);

      // Clean up after animation
      const timer = setTimeout(() => {
        setParticles([]);
        onComplete?.();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [trigger, onComplete]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className={`absolute top-1/2 w-2 h-2 rounded-full ${particle.color} animate-confetti`}
          style={{
            left: particle.left,
            animationDelay: particle.delay,
          }}
        />
      ))}
    </div>
  );
}
