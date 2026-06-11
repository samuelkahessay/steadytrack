'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import MicrocardContent from './MicrocardContent';
import QuickCheckCard from './QuickCheckCard';
import type { ContentMicrocard } from '@/lib/types';
import { getSubjectIcon } from '@/lib/utils/curriculum';

interface MicrocardModalProps {
  isOpen: boolean;
  onClose: () => void;
  microcards: ContentMicrocard[];
  planId?: string;
  initialIndex?: number;
  onAnswered?: (microcardId: string, isCorrect: boolean) => void;
}

export default function MicrocardModal({
  isOpen,
  onClose,
  microcards,
  planId,
  initialIndex = 0,
  onAnswered,
}: MicrocardModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showCelebration, setShowCelebration] = useState(false);

  if (microcards.length === 0) {
    return null;
  }

  const currentCard = microcards[currentIndex];
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < microcards.length - 1;

  const handlePrevious = () => {
    if (hasPrevious) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleCorrectAnswer = () => {
    // Brief celebration
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">
              {getSubjectIcon(currentCard.subject)}
            </span>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
              {currentCard.outcome_code}
            </span>
            {showCelebration && (
              <Sparkles className="w-5 h-5 text-yellow-500 animate-spin" />
            )}
          </div>
          <DialogTitle className="text-xl">
            Learning Card
          </DialogTitle>
          <DialogDescription>
            {currentCard.subject} • Unit {currentCard.unit_id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 overflow-y-auto flex-1">
          {/* Progress Indicator */}
          {microcards.length > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>
                Card {currentIndex + 1} of {microcards.length}
              </span>
              <div className="flex gap-1">
                {microcards.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full ${
                      index === currentIndex ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Microcard Content */}
          <MicrocardContent microcard={currentCard} />

          {/* Divider */}
          <div className="border-t border-gray-200 my-6" />

          {/* Quick Check */}
          <QuickCheckCard
            key={currentCard.id}
            microcard={currentCard}
            {...(planId ? { planId } : {})}
            onCorrectAnswer={handleCorrectAnswer}
            onAnswered={(isCorrect) => onAnswered?.(currentCard.id, isCorrect)}
          />

          {/* Navigation */}
          <div className="pt-4 border-t border-gray-200 space-y-3">
            {microcards.length > 1 && (
              <div className="flex justify-between items-center">
                <Button
                  onClick={handlePrevious}
                  disabled={!hasPrevious}
                  variant="outline"
                  size="sm"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>

                <span className="text-sm text-gray-600">
                  {currentIndex + 1} / {microcards.length}
                </span>

                <Button
                  onClick={handleNext}
                  disabled={!hasNext}
                  variant="outline"
                  size="sm"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}

            {/* Close button - always visible */}
            <div className="flex justify-center">
              <Button
                onClick={onClose}
                variant="secondary"
                size="sm"
                className="min-w-[120px]"
              >
                {microcards.length > 1 ? 'Done' : 'Close'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
