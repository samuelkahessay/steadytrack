'use client';

import { useState } from 'react';
import { ChevronRight, CheckCircle2, Circle, Lightbulb } from 'lucide-react';
import { ContentMicrocard } from '@/lib/types';

interface CardAccordionProps {
  microcards: ContentMicrocard[];
  passedCardIds: Set<string>;
  onCardClick: (microcard: ContentMicrocard) => void;
  isOpen?: boolean;
  onToggle?: () => void;
}

export default function CardAccordion({
  microcards,
  passedCardIds,
  onCardClick,
  isOpen: controlledIsOpen,
  onToggle,
}: CardAccordionProps) {
  // Auto-expand on mobile by default (if not controlled from parent)
  const [internalIsOpen, setInternalIsOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 640; // Auto-expand on mobile
    }
    return false;
  });

  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  if (!microcards || microcards.length === 0) {
    return null;
  }

  const passedCount = microcards.filter((card) => passedCardIds.has(card.id)).length;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalIsOpen(!internalIsOpen);
    }
  };

  return (
    <div>
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 py-3 px-2 -mx-2 w-full text-left rounded-lg text-sm text-gray-700 hover:text-purple-600 hover:bg-purple-50 active:bg-purple-100 transition-colors min-h-[44px]"
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Collapse learning cards' : 'Expand learning cards'}
      >
        <ChevronRight
          className={`w-4 h-4 transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`}
        />
        <span className="flex-1 font-medium">
          Learning Cards {passedCount > 0 && `(${passedCount}/${microcards.length})`}
        </span>
      </button>

      {isOpen && (
        <div className="mt-2 space-y-1 pl-2 border-l-2 border-purple-200">
          {microcards.map((card) => {
            const isPassed = passedCardIds.has(card.id);
            return (
              <div
                key={card.id}
                className="flex items-center gap-3 py-2 group rounded-md hover:bg-purple-50"
              >
                <div className="flex-shrink-0 p-2 -m-1">
                  {isPassed ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300" />
                  )}
                </div>
                <div className="flex-shrink-0">
                  <Lightbulb className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onCardClick(card);
                  }}
                  className={`flex-1 text-sm py-2 text-left ${
                    isPassed ? 'text-green-600 opacity-60' : 'text-gray-700'
                  } hover:text-purple-600 active:text-purple-700 transition-colors`}
                >
                  <div className="font-medium">{card.outcome_code}</div>
                  <div className="text-xs text-gray-500 line-clamp-1">{card.summary}</div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
