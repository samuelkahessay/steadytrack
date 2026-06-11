'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { ContentMicrocard } from '@/lib/types';
import { useQuickCheckLocal } from '@/lib/hooks/useQuickCheckLocal';
import * as quickCheckStorage from '@/lib/storage/quick-checks';

interface QuickCheckCardProps {
  microcard: ContentMicrocard;
  planId?: string;
  onCorrectAnswer?: () => void;
  onAnswered?: (isCorrect: boolean) => void;
}

type FeedbackState = 'none' | 'correct' | 'incorrect';

export default function QuickCheckCard({ microcard, planId, onCorrectAnswer, onAnswered }: QuickCheckCardProps) {
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>('none');
  const [showExplanation, setShowExplanation] = useState(false);
  const { submitResult, submitting } = useQuickCheckLocal();
  const hydratedFor = useRef<string | null>(null);

  // Hydrate from latest saved attempt so revisits show status immediately
  useEffect(() => {
    function loadLatestAttempt() {
      try {
        if (hydratedFor.current === microcard.id) return; // already hydrated for this card
        // Guard: skip hydration if user has already interacted
        if (feedback !== 'none' || selectedChoice !== null) return;

        // Get latest result from localStorage
        const latest = quickCheckStorage.getLastAttempt(microcard.id);

        if (!latest) return;

        setSelectedChoice(latest.selected);
        setFeedback(latest.correct ? 'correct' : 'incorrect');
        setShowExplanation(true);
        hydratedFor.current = microcard.id;
      } catch {
        // Silent hydration failure
      }
    }

    loadLatestAttempt();
  }, [microcard.id, feedback, selectedChoice]);

  const handleChoiceSelect = async (choice: string) => {
    if (feedback !== 'none') return; // Already answered

    setSelectedChoice(choice);
    const isCorrect = choice === microcard.quick_check.answer;
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    setShowExplanation(true);

    // Submit result to database (gracefully handles unauthenticated users)
    await submitResult({
      microcardId: microcard.id,
      outcomeCode: microcard.outcome_code,
      subject: microcard.subject,
      unitId: microcard.unit_id,
      ...(planId ? { planId } : {}),
      correct: isCorrect,
      selected: choice,
    });

    // Notify parent that an answer was submitted (correct or incorrect)
    if (onAnswered) {
      onAnswered(isCorrect);
    }

    // Trigger celebration if correct
    if (isCorrect && onCorrectAnswer) {
      onCorrectAnswer();
    }
  };

  const handleTryAgain = () => {
    setSelectedChoice(null);
    setFeedback('none');
    setShowExplanation(false);
    hydratedFor.current = microcard.id; // Block re-hydration for this instance
  };

  const getChoiceLetter = (index: number) => String.fromCharCode(65 + index); // A, B, C, D

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Question - Prominent */}
      <div className="mb-4 md:mb-6">
        <div className="flex items-start gap-2 mb-4">
          <span className="text-2xl">❓</span>
          <h3 className="text-lg md:text-xl font-bold text-gray-900">Quick Check</h3>
        </div>
        <p className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">
          {microcard.quick_check.question}
        </p>
      </div>

      {/* Choices - Min 56px height for accessibility */}
      <div className="space-y-3 md:space-y-4">
        {microcard.quick_check.choices.map((choice: string, index: number) => {
          const letter = getChoiceLetter(index);
          const isSelected = selectedChoice === choice;
          const isCorrectAnswer = choice === microcard.quick_check.answer;
          const showAsCorrect = feedback !== 'none' && isCorrectAnswer;
          const showAsIncorrect = feedback !== 'none' && isSelected && !isCorrectAnswer;

          return (
            <button
              key={index}
              onClick={() => handleChoiceSelect(choice)}
              disabled={feedback !== 'none' || submitting}
              className={`
                w-full text-left p-4 md:p-5 rounded-xl border-3 transition-all duration-200 min-h-[56px]
                ${feedback === 'none'
                  ? 'border-gray-200 hover:border-blue-400 hover:bg-blue-50 active:scale-[0.98]'
                  : ''}
                ${isSelected && feedback === 'none'
                  ? 'border-blue-500 bg-blue-50'
                  : ''}
                ${showAsCorrect
                  ? 'border-green-500 bg-green-50 animate-pulse'
                  : ''}
                ${showAsIncorrect
                  ? 'border-red-500 bg-red-50'
                  : ''}
                ${feedback !== 'none' && !isSelected && !isCorrectAnswer
                  ? 'opacity-50'
                  : ''}
                disabled:cursor-not-allowed disabled:active:scale-100
              `}
            >
              <div className="flex items-center gap-4">
                {/* Letter badge - Large */}
                <span className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full bg-gray-100 flex items-center justify-center font-bold text-lg md:text-xl text-gray-700">
                  {letter}
                </span>

                {/* Choice text - Large, readable */}
                <span className="flex-1 text-base md:text-lg font-medium text-gray-800">
                  {choice}
                </span>

                {/* Status icon - Larger */}
                {showAsCorrect && (
                  <CheckCircle2 className="w-7 h-7 md:w-8 md:h-8 text-green-600 flex-shrink-0" />
                )}
                {showAsIncorrect && (
                  <XCircle className="w-7 h-7 md:w-8 md:h-8 text-red-600 flex-shrink-0" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Explanation / Feedback - Large, easy to read */}
      {showExplanation && (
        <div
          className={`
            p-5 md:p-6 rounded-xl border-2 animate-slide-up
            ${feedback === 'correct'
              ? 'bg-gradient-to-br from-green-50 to-blue-50 border-green-200'
              : 'bg-blue-50 border-blue-200'}
          `}
        >
          <div className="flex items-start gap-3 mb-3">
            {feedback === 'correct' ? (
              <>
                <CheckCircle2 className="w-6 h-6 md:w-7 md:h-7 text-green-600 flex-shrink-0 mt-1" />
                <h4 className="text-lg md:text-xl font-semibold text-green-900">
                  {feedback === 'correct' ? '✅ Correct!' : '💡 Not quite'}
                </h4>
              </>
            ) : (
              <>
                <XCircle className="w-6 h-6 md:w-7 md:h-7 text-blue-600 flex-shrink-0 mt-1" />
                <h4 className="text-lg md:text-xl font-semibold text-blue-900">
                  💡 Not quite
                </h4>
              </>
            )}
          </div>
          <p className="text-base md:text-lg leading-relaxed text-gray-800">
            {microcard.quick_check.explanation}
          </p>

          {feedback === 'incorrect' && (
            <Button
              onClick={handleTryAgain}
              variant="outline"
              size="lg"
              className="mt-4 w-full sm:w-auto"
            >
              Try Again
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
