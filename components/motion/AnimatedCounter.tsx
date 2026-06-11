'use client';

import { useEffect, useRef } from 'react';
import { useInView, useMotionValue, animate } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  label: string;
  duration?: number;
  className?: string;
}

export default function AnimatedCounter({
  value,
  label,
  duration = 1.2,
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const motionValue = useMotionValue(0);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const displayRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isInView) return;

    const controls = animate(motionValue, value, {
      duration,
      ease: [0.25, 0.1, 0.25, 1],
      onUpdate: (latest) => {
        if (displayRef.current) {
          displayRef.current.textContent = Math.round(latest).toLocaleString();
        }
      },
    });

    return () => controls.stop();
  }, [isInView, value, duration, motionValue]);

  return (
    <div ref={ref} className={className}>
      <span
        ref={displayRef}
        className="font-display font-extrabold text-4xl lg:text-5xl text-gray-900 tabular-nums"
      >
        0
      </span>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}
