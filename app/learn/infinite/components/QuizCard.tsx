'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { InfiniteCard, CardAnswerState } from '@/lib/infinite-feed/types';
import { getAnswerLetter } from '@/lib/infinite-feed/cards';
import { logger } from '@/lib/logger';
import { ChevronDown, RotateCcw, CheckCircle2, XCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
import { get, set } from '@/lib/storage/local';
import * as quickCheckStorage from '@/lib/storage/quick-checks';

interface QuizCardProps {
  card: InfiniteCard;
  onAnswer: (selectedIndex: number, timeSpent: number, retryCount: number) => Promise<void>;
  isActive: boolean;
}

export function QuizCard({ card, onAnswer, isActive }: QuizCardProps) {
  const [state, setState] = useState<CardAnswerState>({
    selectedIndex: null,
    isAnswered: false,
    isCorrect: null,
    correctIndex: null,
    explanation: null,
    retryCount: 0,
    timeStarted: Date.now()
  });
  const [feedbackGiven, setFeedbackGiven] = useState<'helpful' | 'not_helpful' | null>(null);
  const [sessionId, setSessionId] = useState<string>('');

  // Get or create session ID for anonymous feedback tracking
  useEffect(() => {
    let id = get<string | null>('infinite-session-id', null);
    if (!id) {
      id = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      set('infinite-session-id', id);
    }
    setSessionId(id);
  }, []);

  useEffect(() => {
    // Check if user has already answered this card
    const lastAttempt = quickCheckStorage.getLastAttempt(card.id);

    if (lastAttempt) {
      // Restore previous answer state
      const selectedIndex = card.quick_check.choices.findIndex(
        choice => choice === lastAttempt.selected
      );

      // Find the correct answer index
      let correctAnswerIndex = card.quick_check.choices.findIndex(
        choice => choice === card.quick_check.answer
      );

      // Handle case where exact match fails
      if (correctAnswerIndex === -1) {
        const normalizedAnswer = card.quick_check.answer.toLowerCase().trim();
        correctAnswerIndex = card.quick_check.choices.findIndex(
          choice => choice.toLowerCase().trim() === normalizedAnswer
        );
      }

      setState({
        selectedIndex: selectedIndex >= 0 ? selectedIndex : null,
        isAnswered: true,
        isCorrect: lastAttempt.correct,
        correctIndex: correctAnswerIndex >= 0 ? correctAnswerIndex : null,
        explanation: card.quick_check.explanation,
        retryCount: 0,
        timeStarted: Date.now()
      });
    } else {
      // Reset state for new/unanswered card
      setState({
        selectedIndex: null,
        isAnswered: false,
        isCorrect: null,
        correctIndex: null,
        explanation: null,
        retryCount: 0,
        timeStarted: Date.now()
      });
    }

    setFeedbackGiven(null);
  }, [card.id, card.quick_check.choices, card.quick_check.answer, card.quick_check.explanation]);

  const handleFeedback = async (type: 'helpful' | 'not_helpful') => {
    if (!sessionId || feedbackGiven) return;

    setFeedbackGiven(type);

    try {
      await fetch('/api/infinite-feed/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          microcard_id: card.id,
          feedback_type: type,
          was_correct: state.isCorrect,
          session_id: sessionId
        })
      });
    } catch (error) {
      logger.error('Failed to submit quiz feedback', error instanceof Error ? error : undefined);
      // Silently fail - don't interrupt user experience
    }
  };

  const handleSelectAnswer = async (index: number) => {
    if (state.isAnswered) return;

    // Show selection immediately
    setState(prev => ({ ...prev, selectedIndex: index }));

    // Brief animation delay for user to see their selection
    await new Promise(resolve => setTimeout(resolve, 300));

    const timeSpent = Date.now() - state.timeStarted;

    // Call parent to record answer - parent will call setAnswerResult
    await onAnswer(index, timeSpent, state.retryCount);
  };

  const handleTryAgain = () => {
    setState(prev => ({
      ...prev,
      selectedIndex: null,
      isAnswered: false,
      isCorrect: null,
      retryCount: prev.retryCount + 1,
      timeStarted: Date.now()
    }));
  };

  // Expose method for parent to set answer result immediately
  useEffect(() => {
    // Store callback on window for parent component to call
    type AnswerCallback = (isCorrect: boolean, correctIndex: number, explanation: string) => void;
    type WindowWithCallbacks = Window & Record<string, AnswerCallback | unknown>;

    (window as unknown as WindowWithCallbacks)[`setAnswerResult_${card.id}`] = (isCorrect: boolean, correctIndex: number, explanation: string) => {
      setState(prev => ({
        ...prev,
        isAnswered: true,
        isCorrect,
        correctIndex,
        explanation
      }));
    };

    return () => {
      delete (window as unknown as WindowWithCallbacks)[`setAnswerResult_${card.id}`];
    };
  }, [card.id]);

  return (
    <div className="h-screen snap-start flex flex-col items-center justify-center p-3 md:p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 relative">
      <div className="w-full max-w-2xl md:max-w-3xl space-y-3 md:space-y-6">
        {/* Subject badge */}
        <div className="text-xs md:text-sm font-medium text-muted-foreground">
          {card.subject} • {card.outcome_code}
        </div>

        {/* Question */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-8 shadow-lg">
          <h2 className="text-lg md:text-2xl font-bold mb-4 md:mb-6">{card.quick_check.question}</h2>

          {/* Answer choices */}
          <div className="space-y-2 md:space-y-3">
            {card.quick_check.choices.map((choice, index) => {
              const isSelected = state.selectedIndex === index;
              const isCorrect = state.correctIndex === index;
              const showCorrect = state.isAnswered && isCorrect;
              const showIncorrect = state.isAnswered && isSelected && !state.isCorrect;

              return (
                <motion.button
                  key={index}
                  onClick={() => handleSelectAnswer(index)}
                  disabled={state.isAnswered}
                  className={`
                    w-full p-3 md:p-4 rounded-xl text-left transition-all duration-300
                    ${!state.isAnswered && 'hover:bg-accent hover:scale-[1.02]'}
                    ${isSelected && !state.isAnswered && 'bg-blue-100 dark:bg-blue-900'}
                    ${showCorrect && 'bg-green-100 dark:bg-green-900 border-2 border-green-500'}
                    ${showIncorrect && 'bg-red-100 dark:bg-red-900 border-2 border-red-500'}
                    ${!isSelected && !showCorrect && 'bg-gray-50 dark:bg-gray-700'}
                  `}
                  whileTap={!state.isAnswered ? { scale: 0.98 } : {}}
                >
                  <div className="flex items-center gap-2 md:gap-3">
                    <span className="font-semibold text-base md:text-lg">{getAnswerLetter(index)}.</span>
                    <span className="flex-1 text-sm md:text-base">{choice}</span>
                    {showCorrect && <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-green-600 flex-shrink-0" />}
                    {showIncorrect && <XCircle className="w-5 h-5 md:w-6 md:h-6 text-red-600 flex-shrink-0" />}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Feedback section */}
        <AnimatePresence>
          {state.isAnswered && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-2 md:space-y-3"
            >
              {/* Result message */}
              <div
                className={`
                  p-3 md:p-4 rounded-xl text-center font-semibold text-sm md:text-base
                  ${state.isCorrect
                    ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                    : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                  }
                `}
              >
                {state.isCorrect ? '✅ Correct! Great job!' : '❌ Not quite right'}
              </div>

              {/* Explanation */}
              {state.explanation && (
                <div className="bg-blue-50 dark:bg-blue-900/30 p-3 md:p-4 rounded-xl">
                  <p className="text-xs md:text-sm font-medium text-blue-900 dark:text-blue-200 mb-1 md:mb-2">
                    💡 Explanation:
                  </p>
                  <p className="text-xs md:text-sm text-blue-800 dark:text-blue-300">
                    {state.explanation}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col gap-2 items-center">
                {!state.isCorrect && (
                  <Button
                    onClick={handleTryAgain}
                    variant="outline"
                    className="w-full max-w-xs text-sm md:text-base py-2"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                )}
              </div>

              {/* Feedback buttons */}
              <div className="mt-2 md:mt-3 flex items-center justify-center gap-2 md:gap-3">
                <p className="text-xs md:text-sm text-muted-foreground">Was this helpful?</p>
                <div className="flex gap-1.5 md:gap-2">
                  <button
                    onClick={() => handleFeedback('helpful')}
                    disabled={!!feedbackGiven}
                    className={`p-1.5 md:p-2 rounded-full transition-all ${
                      feedbackGiven === 'helpful'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-green-100 dark:hover:bg-green-900 text-gray-600 dark:text-gray-300'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    aria-label="Helpful"
                  >
                    <ThumbsUp className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </button>
                  <button
                    onClick={() => handleFeedback('not_helpful')}
                    disabled={!!feedbackGiven}
                    className={`p-1.5 md:p-2 rounded-full transition-all ${
                      feedbackGiven === 'not_helpful'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900 text-gray-600 dark:text-gray-300'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    aria-label="Not helpful"
                  >
                    <ThumbsDown className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Fixed scroll hint at bottom - only show when active and not answered */}
      {isActive && !state.isAnswered && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="fixed bottom-12 md:bottom-8 left-1/2 -translate-x-1/2 z-10"
        >
          <div className="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-300">
            <ChevronDown className="w-4 h-4 md:w-5 md:h-5 animate-bounce" />
            <p className="text-xs md:text-sm font-medium">Scroll to skip</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
