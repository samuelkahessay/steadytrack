'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  BookOpen,
  ListOrdered,
  AlertTriangle,
  ExternalLink,
  Link as LinkIcon
} from 'lucide-react';
import { getAnswerLetter } from '@/lib/infinite-feed/cards';
import * as quickCheckStorage from '@/lib/storage/quick-checks';
import type { ContentMicrocard } from '@/lib/types';

interface InlineMicrocardProps {
  microcard: ContentMicrocard;
  planId: string;
  onComplete: () => void;
}

interface AnswerState {
  selectedIndex: number | null;
  isAnswered: boolean;
  isCorrect: boolean | null;
  correctIndex: number | null;
}

export function InlineMicrocard({ microcard, planId, onComplete }: InlineMicrocardProps) {
  const [state, setState] = useState<AnswerState>({
    selectedIndex: null,
    isAnswered: false,
    isCorrect: null,
    correctIndex: null,
  });
  // Auto-expand microcards by default (isCollapsed = false means expanded)
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Restore previous answer state from localStorage on mount
  useEffect(() => {
    const lastAttempt = quickCheckStorage.getLastAttempt(microcard.id);

    if (lastAttempt) {
      // Find which index the user selected
      const selectedIndex = microcard.quick_check.choices.findIndex(
        choice => choice === lastAttempt.selected
      );

      // Find the correct answer index
      let correctAnswerIndex = microcard.quick_check.choices.findIndex(
        choice => choice === microcard.quick_check.answer
      );

      // Handle case where exact match fails
      if (correctAnswerIndex === -1) {
        const normalizedAnswer = microcard.quick_check.answer.toLowerCase().trim();
        correctAnswerIndex = microcard.quick_check.choices.findIndex(
          choice => choice.toLowerCase().trim() === normalizedAnswer
        );
      }

      // Restore the answer state
      setState({
        selectedIndex: selectedIndex >= 0 ? selectedIndex : null,
        isAnswered: true,
        isCorrect: lastAttempt.correct,
        correctIndex: correctAnswerIndex >= 0 ? correctAnswerIndex : null,
      });
    }
  }, [microcard.id, microcard.quick_check.choices, microcard.quick_check.answer]);

  const handleSelectAnswer = (index: number) => {
    if (state.isAnswered) return;

    // Find correct answer
    let correctAnswerIndex = microcard.quick_check.choices.findIndex(
      choice => choice === microcard.quick_check.answer
    );

    // Handle case where exact match fails
    if (correctAnswerIndex === -1) {
      const normalizedAnswer = microcard.quick_check.answer.toLowerCase().trim();
      correctAnswerIndex = microcard.quick_check.choices.findIndex(
        choice => choice.toLowerCase().trim() === normalizedAnswer
      );
    }

    const isCorrect = index === correctAnswerIndex;

    // Update state
    setState({
      selectedIndex: index,
      isAnswered: true,
      isCorrect,
      correctIndex: correctAnswerIndex >= 0 ? correctAnswerIndex : null,
    });

    // Store result in localStorage
    quickCheckStorage.addResult({
      plan_id: planId,
      subject: microcard.subject,
      unit_id: microcard.unit_id,
      outcome_code: microcard.outcome_code,
      microcard_id: microcard.id,
      correct: isCorrect,
      selected: microcard.quick_check.choices[index],
    });

    // Call onComplete if correct
    if (isCorrect) {
      onComplete();
    }
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className="border-2 border-blue-500 dark:border-blue-600 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 overflow-hidden shadow-sm">
      {/* Header - always visible */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors"
        onClick={toggleCollapse}
      >
        <div className="flex items-center gap-3 flex-1">
          <span className="text-base font-semibold text-blue-900 dark:text-blue-100">
            📝 Quick Check: {microcard.outcome_code}
          </span>
          {state.isAnswered && (
            <span className="text-xs">
              {state.isCorrect ? (
                <CheckCircle2 className="w-4 h-4 text-green-600 inline" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600 inline" />
              )}
            </span>
          )}
        </div>
        {isCollapsed ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        )}
      </div>

      {/* Content - collapsible */}
      {!isCollapsed && (
        <div className="border-t p-4 space-y-4">
          {/* Summary Section */}
          {microcard.summary && (
            <div className="bg-white dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-2 mb-2">
                <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Summary
                </h4>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {microcard.summary}
              </p>
            </div>
          )}

          {/* Learning Steps */}
          {microcard.steps && microcard.steps.length > 0 && (
            <div className="bg-white dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-2 mb-2">
                <ListOrdered className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Learning Steps
                </h4>
              </div>
              <ol className="space-y-1.5 ml-1">
                {microcard.steps.map((step, index) => (
                  <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
                    <span className="font-medium text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                      {index + 1}.
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Common Pitfall */}
          {microcard.pitfall && (
            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2 mb-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  Common Pitfall
                </h4>
              </div>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {microcard.pitfall}
              </p>
            </div>
          )}

          {/* Quick Check (MCQ) */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">
              📝 Quick Check
            </h4>

            {/* Question */}
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              {microcard.quick_check.question}
            </p>

            {/* Answer choices */}
            <div className="space-y-2">
              {microcard.quick_check.choices.map((choice, index) => {
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
                      w-full p-3 rounded-lg text-left transition-all text-sm
                      ${!state.isAnswered && 'hover:bg-blue-100 dark:hover:bg-blue-800/50'}
                      ${isSelected && !state.isAnswered && 'bg-blue-100 dark:bg-blue-800/30'}
                      ${showCorrect && 'bg-green-50 dark:bg-green-900/30 border border-green-500'}
                      ${showIncorrect && 'bg-red-50 dark:bg-red-900/30 border border-red-500'}
                      ${!isSelected && !showCorrect && 'bg-white dark:bg-gray-800/50'}
                      disabled:cursor-not-allowed
                    `}
                    whileTap={!state.isAnswered ? { scale: 0.98 } : {}}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{getAnswerLetter(index)}.</span>
                      <span className="flex-1">{choice}</span>
                      {showCorrect && <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />}
                      {showIncorrect && <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Feedback */}
            <AnimatePresence>
              {state.isAnswered && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-2 mt-3"
                >
                  {/* Result message */}
                  <div
                    className={`
                      p-2 rounded-lg text-center text-sm font-medium
                      ${state.isCorrect
                        ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200'
                        : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200'
                      }
                    `}
                  >
                    {state.isCorrect ? '✅ Correct!' : '❌ Not quite'}
                  </div>

                  {/* Explanation */}
                  {microcard.quick_check.explanation && (
                    <div className="bg-white dark:bg-gray-800/50 p-3 rounded-lg border border-blue-300 dark:border-blue-700">
                      <p className="text-xs font-medium text-blue-900 dark:text-blue-200 mb-1">
                        💡 Explanation:
                      </p>
                      <p className="text-xs text-blue-800 dark:text-blue-300">
                        {microcard.quick_check.explanation}
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Recommended Resource */}
          {microcard.recommended_resource_url && (
            <div className="bg-white dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-2 mb-2">
                <ExternalLink className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Recommended Resource
                </h4>
              </div>
              <a
                href={microcard.recommended_resource_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 hover:underline"
              >
                <span>View resource</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Sources */}
          {microcard.sources && microcard.sources.length > 0 && (
            <div className="bg-white dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-2 mb-2">
                <LinkIcon className="w-4 h-4 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Additional Sources
                </h4>
              </div>
              <ul className="space-y-1.5">
                {microcard.sources.map((source, index) => (
                  <li key={index}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
                    >
                      <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        [{source.type}]
                      </span>
                      <span>{source.title}</span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
