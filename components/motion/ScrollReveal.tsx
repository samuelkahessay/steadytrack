'use client';

import { motion, type Variants } from 'framer-motion';
import { type ReactNode } from 'react';

type Direction = 'up' | 'down' | 'left' | 'right' | 'none';

interface ScrollRevealProps {
  children: ReactNode;
  direction?: Direction;
  delay?: number;
  duration?: number;
  once?: boolean;
  className?: string;
}

const getInitialOffset = (direction: Direction) => {
  switch (direction) {
    case 'up': return { y: 24 };
    case 'down': return { y: -24 };
    case 'left': return { x: 24 };
    case 'right': return { x: -24 };
    case 'none': return {};
  }
};

export default function ScrollReveal({
  children,
  direction = 'up',
  delay = 0,
  duration = 0.5,
  once = true,
  className,
}: ScrollRevealProps) {
  const offset = getInitialOffset(direction);

  const variants: Variants = {
    hidden: { opacity: 0, ...offset },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: '-80px' }}
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  );
}
