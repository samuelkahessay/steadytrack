'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QuizCard } from './components/QuizCard';
import { SubjectModal } from './components/SubjectModal';
import { ProgressBar } from './components/ProgressBar';
import { InfiniteCard } from '@/lib/infinite-feed/types';
import * as infiniteStorage from '@/lib/storage/infinite';
import * as quickCheckStorage from '@/lib/storage/quick-checks';
import { logger } from '@/lib/logger';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

// All possible Alberta high school subjects (UI display names)
const ALL_SUBJECTS = [
  'Math 30-1',
  'Math 20-1',
  'Biology 30',
  'Biology 20',
  'Chemistry 30',
  'Chemistry 20',
  'Physics 30',
  'Physics 20',
  'English Language Arts 30-1',
  'English Language Arts 20-1',
  'Social Studies 30-1',
  'Social Studies 20-1'
];

export default function InfiniteFeedPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(true);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [cards, setCards] = useState<InfiniteCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [viewedCards, setViewedCards] = useState<Set<string>>(new Set());
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  const [positionIndex, setPositionIndex] = useState(0);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSessionUpdateRef = useRef<number>(0);
  const sessionUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resumeScrollIndexRef = useRef<number | null>(null);
  const currentIndexRef = useRef(0);
  const scrollRafRef = useRef<number | null>(null);

  // Check for existing session on mount (local-first, no auth needed)
  useEffect(() => {
    const checkExistingSession = () => {
      try {
        const session = infiniteStorage.getSession();
        if (session && session.expires_at && new Date(session.expires_at) > new Date()) {
          setHasActiveSession(true);
        }
      } catch (error) {
        logger.error('Failed to check existing infinite session', error instanceof Error ? error : undefined);
      }
    };
    checkExistingSession();
  }, []);

  // Fetch available subjects with card counts on mount
  useEffect(() => {
    const fetchAvailableSubjects = async () => {
      setIsLoadingSubjects(true);
      try {
        const response = await fetch('/api/infinite-feed/subjects?min_cards=10');
        if (!response.ok) {
          logger.error('Failed to fetch subject availability', new Error(`HTTP ${response.status}`));
          showToast('Unable to load available subjects. Please refresh and try again.', 'error');
          setIsLoadingSubjects(false);
          return;
        }

        const data = await response.json();
        const uiSubjects = data.subjects?.map((s: { subject: string }) => s.subject) || [];

        // Filter ALL_SUBJECTS to only include subjects with available cards
        const filtered = ALL_SUBJECTS.filter(subject => uiSubjects.includes(subject));

        if (filtered.length === 0) {
          logger.warn('No subjects with sufficient cards found');
          showToast('No subjects available at this time. Please try again later.', 'error');
        }

        setAvailableSubjects(filtered);
      } catch (error) {
        logger.error('Failed to fetch available subjects', error instanceof Error ? error : undefined);
        showToast('Error loading subjects. Please refresh the page.', 'error');
      } finally {
        setIsLoadingSubjects(false);
      }
    };

    void fetchAvailableSubjects();
  }, [showToast]);

  // Save session progress on unmount
  useEffect(() => {
    // Capture the ref value in the effect scope
    const container = containerRef.current;

    return () => {
      // Cleanup: save final state when component unmounts
      try {
        // Only save if there's an active session
        if (infiniteStorage.getSession()) {
          // Get the actual scroll position to calculate the current card index
          const actualIndex = container
            ? Math.max(0, Math.min(
                Math.floor(container.scrollTop / window.innerHeight),
                cards.length - 1
              ))
            : currentIndex;

          infiniteStorage.updateSession({
            current_card_index: actualIndex,
          });
        }
      } catch (error) {
        logger.error('Failed to save infinite session on unmount', error instanceof Error ? error : undefined);
      }

      // Clear any pending timeout and animation frame
      if (sessionUpdateTimeoutRef.current) {
        clearTimeout(sessionUpdateTimeoutRef.current);
      }
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, [currentIndex, cards.length]);

  // IntersectionObserver for accurate position tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            const index = parseInt(entry.target.getAttribute('data-card-index') || '0');
            const cardId = entry.target.getAttribute('data-card-id');
            setPositionIndex(index);

            // Update last viewed card ID for scroll resume
            if (cardId) {
              infiniteStorage.updateLastViewedCard(cardId);
            }
          }
        });
      },
      { threshold: 0.5, rootMargin: '0px' }
    );

    const elements = document.querySelectorAll('[data-card-index]');
    elements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, [cards.length]);

  // Resume scroll to last viewed card (ID-based with index fallback)
  useEffect(() => {
    if (!showModal && cards.length > 0 && resumeScrollIndexRef.current !== null) {
      const resumeToCard = async () => {
        const container = containerRef.current;
        if (!container) return;

        // Get saved card ID from session
        const session = infiniteStorage.getSession();
        const targetCardId = session?.lastViewedCardId;
        const targetIndex = resumeScrollIndexRef.current;

        // Wait for render
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => requestAnimationFrame(resolve));

        try {
          // Disable snap during programmatic scroll
          container.style.scrollSnapType = 'none';

          // Try to find element by ID first (with retry for race condition mitigation)
          if (targetCardId) {
            // Retry mechanism to wait for card to be attached to DOM
            const waitForCard = async (cardId: string, maxAttempts = 10): Promise<Element | null> => {
              for (let i = 0; i < maxAttempts; i++) {
                const element = document.querySelector(`[data-card-id="${cardId}"]`);
                if (element) return element;
                await new Promise(resolve => requestAnimationFrame(resolve));
              }
              return null;
            };

            const element = await waitForCard(targetCardId);
            if (element) {
              try {
                element.scrollIntoView({ behavior: 'instant', block: 'start' });
                resumeScrollIndexRef.current = null;
                return;
              } catch (error) {
                // scrollIntoView can throw in some browsers - fall through to index-based scroll
                logger.error('Scroll resume failed, using index fallback', error instanceof Error ? error : undefined);
              }
            }
          }

          // Fallback to index-based scroll
          if (targetIndex !== null) {
            container.scrollTop = targetIndex * window.innerHeight;
          }
        } finally {
          // Re-enable snap after scroll
          await new Promise(resolve => requestAnimationFrame(resolve));
          container.style.scrollSnapType = 'y mandatory';
          resumeScrollIndexRef.current = null;
        }
      };

      resumeToCard();
    }
  }, [showModal, cards.length]);

  // Apply scroll-snap-stop to new card elements
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (CSS.supports('scroll-snap-stop', 'always')) {
      const cardElements = container.querySelectorAll('[data-card-index]');
      cardElements.forEach((el: Element) => {
        (el as HTMLElement).style.scrollSnapStop = 'always';
      });
    }
  }, [cards.length]);

  const handleStartSession = async (subjects: string[]) => {
    setIsLoading(true);
    setSelectedSubjects(subjects);

    try {
      // Create session in localStorage
      infiniteStorage.createSession(subjects);
      setHasActiveSession(true);

      // Fetch initial cards
      const response = await fetch('/api/infinite-feed/cards?' + new URLSearchParams({
        subjects: subjects.join(','),
        limit: '20'
      }));

      if (!response.ok) {
        throw new Error('Failed to fetch cards');
      }

      const data = await response.json();
      const newCards = (data.cards || []).filter((card: InfiniteCard) =>
        !loadedIds.has(card.id)
      );
      setCards(newCards);
      setLoadedIds(new Set(newCards.map((c: InfiniteCard) => c.id)));
      setHasMore(data.has_more || false);
      setShowModal(false);
      setCurrentIndex(0);
    } catch (error) {
      logger.error('Failed to start infinite learning session', error instanceof Error ? error : undefined, {
        subjects: subjects.length
      });
      showToast('Failed to load questions. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    setIsLoading(true);
    try {
      const session = infiniteStorage.getSession();
      if (!session) {
        showToast('No active session found', 'error');
        return;
      }

      setSelectedSubjects(session.selected_subjects);
      setViewedCards(new Set(session.cards_viewed || []));
      setCurrentIndex(session.current_card_index || 0);

      const viewedCardIds = session.cards_viewed || [];
      let allCards: InfiniteCard[] = [];

      // First, fetch the previously viewed cards to restore history
      if (viewedCardIds.length > 0) {
        const viewedResponse = await fetch('/api/infinite-feed/cards?' + new URLSearchParams({
          subjects: session.selected_subjects.join(','),
          ids: viewedCardIds.join(','),
          limit: String(viewedCardIds.length)
        }));

        if (viewedResponse.ok) {
          const viewedData = await viewedResponse.json();
          allCards = viewedData.cards || [];
        }
      }

      // Then fetch new cards (excluding already viewed)
      const newResponse = await fetch('/api/infinite-feed/cards?' + new URLSearchParams({
        subjects: session.selected_subjects.join(','),
        exclude: viewedCardIds.join(','),
        limit: '20'
      }));

      if (!newResponse.ok) {
        throw new Error('Failed to fetch new cards');
      }

      const newData = await newResponse.json();
      const newCardsFiltered = (newData.cards || []).filter((card: InfiniteCard) =>
        !loadedIds.has(card.id)
      );
      allCards = [...allCards, ...newCardsFiltered];

      setCards(allCards);
      setLoadedIds(new Set(allCards.map(c => c.id)));
      setHasMore(newData.has_more || false);

      // Set resume scroll index to trigger scroll resume effect
      resumeScrollIndexRef.current = session.current_card_index || 0;

      setShowModal(false);
    } catch (error) {
      logger.error('Failed to resume infinite learning session', error instanceof Error ? error : undefined);
      showToast('Failed to resume session. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = async (cardIndex: number, selectedIndex: number, _timeSpent: number, _retryCount: number) => {
    const card = cards[cardIndex];

    // Validate answer client-side
    let correctAnswerIndex = card.quick_check.choices.findIndex(
      choice => choice === card.quick_check.answer
    );

    // Handle case where exact match fails (-1) - implement robust matching
    if (correctAnswerIndex === -1) {
      const normalizedAnswer = card.quick_check.answer.toLowerCase().trim();
      correctAnswerIndex = card.quick_check.choices.findIndex(
        choice => choice.toLowerCase().trim() === normalizedAnswer
      );

      // If still no match, log error and skip feedback to avoid misleading user
      if (correctAnswerIndex === -1) {
        logger.error('Answer validation failed - answer not found in choices', new Error('Invalid quiz data'), {
          cardId: card.id,
          subject: card.subject
        });
        showToast('Unable to validate answer. Please try again.', 'error');
        return; // Skip showing feedback for unreliable data
      }
    }

    const isCorrect = selectedIndex === correctAnswerIndex;

    // Store result in localStorage
    quickCheckStorage.addResult({
      plan_id: null, // infinite mode doesn't use plans
      subject: card.subject,
      unit_id: card.unit_id,
      outcome_code: card.outcome_code,
      microcard_id: card.id,
      correct: isCorrect,
      selected: card.quick_check.choices[selectedIndex],
    });

    // Update UI with result
    type AnswerCallback = (isCorrect: boolean, correctIndex: number, explanation: string) => void;
    type WindowWithCallbacks = Window & Record<string, AnswerCallback | unknown>;

    const setAnswerFn = (window as unknown as WindowWithCallbacks)[`setAnswerResult_${card.id}`] as AnswerCallback | undefined;
    if (setAnswerFn) {
      setAnswerFn(
        isCorrect,
        correctAnswerIndex,
        card.quick_check.explanation
      );
    }

    // Mark card as viewed
    setViewedCards(prev => new Set([...prev, card.id]));

    // Update localStorage session with new viewed card
    infiniteStorage.markCardViewed(card.id);

    // Prefetch more cards if running low (fix race condition by including current card)
    if (cards.length - cardIndex < 5 && !isLoading) {
      setIsLoading(true);
      try {
        // Include current card ID to prevent race condition
        const excludeList = [...Array.from(viewedCards), card.id];
        const response = await fetch('/api/infinite-feed/cards?' + new URLSearchParams({
          subjects: selectedSubjects.join(','),
          exclude: excludeList.join(','),
          limit: '20'
        }));

        if (response.ok) {
          const data = await response.json();
          const newCards = (data.cards || []).filter((newCard: InfiniteCard) =>
            !loadedIds.has(newCard.id)
          );

          if (newCards.length > 0) {
            setCards(prev => [...prev, ...newCards]);
            setLoadedIds(prev => new Set([...prev, ...newCards.map((c: InfiniteCard) => c.id)]));
          }

          setHasMore(data.has_more || false);
        }
      } catch (error) {
        logger.error('Failed to prefetch infinite learning cards', error instanceof Error ? error : undefined);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Handle scroll with rAF throttling and debounced session persistence
  const handleScroll = () => {
    if (scrollRafRef.current) return; // Already scheduled

    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      if (!containerRef.current) return;

      const scrollTop = containerRef.current.scrollTop;
      const newIndex = Math.max(0, Math.min(
        Math.floor(scrollTop / window.innerHeight),
        cards.length - 1
      ));

      if (newIndex !== currentIndexRef.current) {
        currentIndexRef.current = newIndex;
        setCurrentIndex(newIndex);

        // Debounce session updates to avoid excessive writes
        if (sessionUpdateTimeoutRef.current) {
          clearTimeout(sessionUpdateTimeoutRef.current);
        }

        // Schedule update after 2 seconds of no scrolling
        sessionUpdateTimeoutRef.current = setTimeout(() => {
          try {
            infiniteStorage.updateCardIndex(newIndex);
            lastSessionUpdateRef.current = Date.now();
          } catch (error) {
            logger.error('Failed to update infinite session on scroll', error instanceof Error ? error : undefined);
          }
        }, 2000);
      }
    });
  };

  const handleBack = () => {
    showToast('Progress saved! Resume anytime from the home page.', 'success');
    router.push('/');
  };

  if (showModal) {
    return (
      <SubjectModal
        isOpen={showModal}
        onClose={() => router.push('/')}
        onStart={handleStartSession}
        onResume={handleResume}
        availableSubjects={availableSubjects}
        hasActiveSession={hasActiveSession}
        isLoadingSubjects={isLoadingSubjects}
      />
    );
  }

  return (
    <div className="relative h-screen overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b">
        <div className="flex items-center gap-4 p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Exit
          </Button>

          <div className="flex-1 max-w-xs">
            <ProgressBar
              current={positionIndex + 1}
              total={loadedIds.size}
              showNumbers={true}
              hasMore={hasMore}
            />
          </div>
        </div>
      </div>

      {/* Card feed */}
      <div
        ref={containerRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory pt-16"
        style={{ scrollPaddingTop: '64px' }}
        onScroll={handleScroll}
      >
        {cards.map((card, index) => (
          <div
            key={card.id}
            data-card-id={card.id}
            data-card-index={index}
            style={{
              contentVisibility: 'auto',
              containIntrinsicSize: '100vh',
              scrollMarginTop: '64px'
            }}
          >
            <QuizCard
              card={card}
              onAnswer={(selectedIndex, timeSpent, retryCount) =>
                handleAnswer(index, selectedIndex, timeSpent, retryCount)
              }
              isActive={index === currentIndex}
            />
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="h-screen snap-start flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading more questions...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
