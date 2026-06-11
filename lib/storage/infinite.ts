/**
 * Infinite Learning Mode localStorage adapter
 * Handles session state management for infinite learning
 */

import { v4 as uuidv4 } from 'uuid';
import * as storage from './local';
import { LocalInfiniteSession, LocalInfiniteSessionSchema } from '@/types/storage';

const INFINITE_KEY = 'infinite';

/**
 * Generate session expiry (24 hours from now)
 */
function generateExpiry(): string {
  const now = new Date();
  const expiry = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
  return expiry.toISOString();
}

/**
 * Check if session is expired
 */
function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

/**
 * Get current session (or null if expired/doesn't exist)
 */
export function getSession(): LocalInfiniteSession | null {
  const session = storage.get<LocalInfiniteSession | null>(INFINITE_KEY, null);

  if (!session) return null;

  try {
    const validated = LocalInfiniteSessionSchema.parse(session);

    // Check if expired
    if (isExpired(validated.expires_at)) {
      clearSession();
      return null;
    }

    return validated;
  } catch (error) {
    console.error('Invalid infinite session data:', error);
    clearSession();
    return null;
  }
}

/**
 * Create a new session
 */
export function createSession(selectedSubjects: string[]): LocalInfiniteSession {
  const now = new Date().toISOString();

  const session: LocalInfiniteSession = {
    id: uuidv4(),
    selected_subjects: selectedSubjects,
    cards_viewed: [],
    current_card_index: 0,
    started_at: now,
    last_active_at: now,
    expires_at: generateExpiry(),
  };

  const validated = LocalInfiniteSessionSchema.parse(session);

  storage.set(INFINITE_KEY, validated);

  return validated;
}

/**
 * Update session (card index, viewed cards, etc.)
 */
export function updateSession(
  updates: Partial<Omit<LocalInfiniteSession, 'id' | 'started_at'>>
): LocalInfiniteSession | null {
  const current = getSession();

  if (!current) {
    console.error('No active session to update');
    return null;
  }

  const updated: LocalInfiniteSession = {
    ...current,
    ...updates,
    last_active_at: new Date().toISOString(),
  };

  const validated = LocalInfiniteSessionSchema.parse(updated);

  storage.set(INFINITE_KEY, validated);

  return validated;
}

/**
 * Add a card to viewed cards
 */
export function markCardViewed(cardId: string): LocalInfiniteSession | null {
  const current = getSession();

  if (!current) return null;

  // Don't add if already viewed
  if (current.cards_viewed.includes(cardId)) {
    return current;
  }

  return updateSession({
    cards_viewed: [...current.cards_viewed, cardId],
  });
}

/**
 * Update current card index
 */
export function updateCardIndex(index: number): LocalInfiniteSession | null {
  return updateSession({
    current_card_index: index,
  });
}

/**
 * Update last viewed card ID (for scroll resume)
 */
export function updateLastViewedCard(cardId: string): LocalInfiniteSession | null {
  return updateSession({
    lastViewedCardId: cardId,
  });
}

/**
 * Advance to next card
 */
export function advanceToNextCard(cardId: string): LocalInfiniteSession | null {
  const current = getSession();

  if (!current) return null;

  return updateSession({
    cards_viewed: current.cards_viewed.includes(cardId)
      ? current.cards_viewed
      : [...current.cards_viewed, cardId],
    current_card_index: current.current_card_index + 1,
  });
}

/**
 * Reset session (go back to beginning)
 */
export function resetSession(): LocalInfiniteSession | null {
  return updateSession({
    cards_viewed: [],
    current_card_index: 0,
  });
}

/**
 * Clear/delete session
 */
export function clearSession(): void {
  storage.remove(INFINITE_KEY);
}

/**
 * Get or create session
 */
export function getOrCreateSession(selectedSubjects: string[]): LocalInfiniteSession {
  const existing = getSession();

  if (existing) {
    // Check if subjects match
    const subjectsMatch =
      existing.selected_subjects.length === selectedSubjects.length &&
      existing.selected_subjects.every(s => selectedSubjects.includes(s));

    if (subjectsMatch) {
      return existing;
    }

    // Subjects don't match, create new session
    clearSession();
  }

  return createSession(selectedSubjects);
}

/**
 * Get session progress
 */
export function getSessionProgress(): {
  cardsViewed: number;
  currentIndex: number;
  subjects: string[];
  isActive: boolean;
} | null {
  const session = getSession();

  if (!session) {
    return null;
  }

  return {
    cardsViewed: session.cards_viewed.length,
    currentIndex: session.current_card_index,
    subjects: session.selected_subjects,
    isActive: !isExpired(session.expires_at),
  };
}

/**
 * Extend session expiry (refresh 24 hours)
 */
export function extendSession(): LocalInfiniteSession | null {
  return updateSession({
    expires_at: generateExpiry(),
  });
}

/**
 * Check if a card has been viewed
 */
export function hasViewedCard(cardId: string): boolean {
  const session = getSession();
  return session?.cards_viewed.includes(cardId) ?? false;
}
