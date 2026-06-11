'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface CelebrationModalProps {
  isOpen: boolean;
  milestone: number | null | undefined;
  onClose: () => void;
}

const MILESTONE_CONFIG: Record<number, { emoji: string; title: string; message: string }> = {
  25: {
    emoji: '🎯',
    title: 'Quarter Way There!',
    message: "You've completed 25% of your study plan. Great start!",
  },
  50: {
    emoji: '🔥',
    title: 'Halfway Champion!',
    message: "You're halfway through! Your consistency is paying off!",
  },
  75: {
    emoji: '⭐',
    title: 'Almost There!',
    message: '75% complete—nice work! Almost there.',
  },
  100: {
    emoji: '🎉',
    title: 'Plan Complete!',
    message: "You did it! You've completed your entire study plan!",
  },
};

export default function CelebrationModal({ isOpen, milestone, onClose }: CelebrationModalProps) {
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldAnimate(true);
    }
  }, [isOpen]);

  if (!milestone || !MILESTONE_CONFIG[milestone]) {
    return null;
  }

  const config = MILESTONE_CONFIG[milestone];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
      >
        <DialogHeader className="text-center">
          <div
            className={`
              text-8xl mb-4 mx-auto
              ${shouldAnimate ? 'animate-bounce' : ''}
            `}
          >
            {config.emoji}
          </div>
          <DialogTitle className="text-2xl font-bold text-center">
            {config.title}
          </DialogTitle>
          <DialogDescription className="text-lg text-center pt-2">
            {config.message}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="relative w-full h-4 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-1000 ease-out"
              style={{ width: `${milestone}%` }}
            />
          </div>
          <p className="text-center text-sm text-gray-600 mt-2">{milestone}% Complete</p>
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full" size="lg">
            Keep Going! 💪
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
