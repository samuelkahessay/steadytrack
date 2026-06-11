// Card fetching logic for Infinite Learning Mode

import { InfiniteCard } from './types';

export async function fetchInfiniteCards(
  subjects: string[],
  excludeIds: string[] = [],
  limit: number = 20
): Promise<InfiniteCard[]> {
  const params = new URLSearchParams({
    subjects: subjects.join(','),
    limit: limit.toString(),
  });

  if (excludeIds.length > 0) {
    params.append('exclude', excludeIds.join(','));
  }

  const response = await fetch(`/api/infinite-feed/cards?${params}`);

  if (!response.ok) {
    throw new Error('Failed to fetch cards');
  }

  const data = await response.json();
  return data.cards || [];
}

export function findCorrectAnswerIndex(card: InfiniteCard): number {
  const { answer, choices } = card.quick_check;
  return choices.findIndex(choice => choice === answer);
}

export function getAnswerLetter(index: number): string {
  return String.fromCharCode(65 + index); // 0→A, 1→B, 2→C, 3→D
}
