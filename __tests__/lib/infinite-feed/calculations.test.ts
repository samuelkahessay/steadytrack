import { describe, it, expect } from 'vitest';

/**
 * Tests for scroll index calculations used in the Infinite Learn mode.
 *
 * These calculations determine which card is currently visible based on scroll position,
 * ensuring accurate tracking of user progress through the infinite feed.
 *
 * The calculation formula is:
 * Math.max(0, Math.min(Math.floor(scrollTop / window.innerHeight), cards.length - 1))
 *
 * This ensures:
 * - Index is never negative (Math.max with 0)
 * - Index never exceeds array bounds (Math.min with cards.length - 1)
 * - Scroll position maps to card index (Math.floor of division)
 */

/**
 * Helper function that replicates the scroll index calculation from the infinite feed.
 *
 * @param scrollTop - Current scroll position in pixels
 * @param cardHeight - Height of each card (typically window.innerHeight)
 * @param maxIndex - Maximum valid index (cards.length - 1)
 * @returns The calculated card index (0-based)
 */
function calculateScrollIndex(scrollTop: number, cardHeight: number, maxIndex: number): number {
  return Math.max(0, Math.min(Math.floor(scrollTop / cardHeight), maxIndex));
}

describe('Scroll index calculations', () => {
  const CARD_HEIGHT = 800; // Simulated window.innerHeight
  const MAX_INDEX = 10; // 11 cards (0-10)

  describe('basic index calculation', () => {
    it('should return 0 for scroll position 0', () => {
      expect(calculateScrollIndex(0, CARD_HEIGHT, MAX_INDEX)).toBe(0);
    });

    it('should return 0 for scroll position less than one card height', () => {
      expect(calculateScrollIndex(400, CARD_HEIGHT, MAX_INDEX)).toBe(0);
      expect(calculateScrollIndex(799, CARD_HEIGHT, MAX_INDEX)).toBe(0);
    });

    it('should return 1 for scroll position at exactly one card height', () => {
      expect(calculateScrollIndex(800, CARD_HEIGHT, MAX_INDEX)).toBe(1);
    });

    it('should return 1 for scroll position between 1-2 card heights', () => {
      expect(calculateScrollIndex(801, CARD_HEIGHT, MAX_INDEX)).toBe(1);
      expect(calculateScrollIndex(1200, CARD_HEIGHT, MAX_INDEX)).toBe(1);
      expect(calculateScrollIndex(1599, CARD_HEIGHT, MAX_INDEX)).toBe(1);
    });

    it('should calculate index correctly for multiple card heights', () => {
      expect(calculateScrollIndex(1600, CARD_HEIGHT, MAX_INDEX)).toBe(2);
      expect(calculateScrollIndex(2400, CARD_HEIGHT, MAX_INDEX)).toBe(3);
      expect(calculateScrollIndex(4000, CARD_HEIGHT, MAX_INDEX)).toBe(5);
      expect(calculateScrollIndex(8000, CARD_HEIGHT, MAX_INDEX)).toBe(10);
    });
  });

  describe('bounds checking - lower bound', () => {
    it('should never return negative index for negative scroll', () => {
      expect(calculateScrollIndex(-100, CARD_HEIGHT, MAX_INDEX)).toBe(0);
      expect(calculateScrollIndex(-800, CARD_HEIGHT, MAX_INDEX)).toBe(0);
      expect(calculateScrollIndex(-10000, CARD_HEIGHT, MAX_INDEX)).toBe(0);
    });

    it('should clamp to 0 for any scroll position less than 0', () => {
      const negativeScrollPositions = [-1, -50, -500, -5000];
      negativeScrollPositions.forEach(scrollTop => {
        expect(calculateScrollIndex(scrollTop, CARD_HEIGHT, MAX_INDEX)).toBe(0);
      });
    });
  });

  describe('bounds checking - upper bound', () => {
    it('should clamp to max index when scroll exceeds total content', () => {
      const excessiveScroll = 12000; // Would be index 15 without clamping
      expect(calculateScrollIndex(excessiveScroll, CARD_HEIGHT, MAX_INDEX)).toBe(10);
    });

    it('should return max index for scroll at exactly max position', () => {
      const maxScrollTop = MAX_INDEX * CARD_HEIGHT; // 10 * 800 = 8000
      expect(calculateScrollIndex(maxScrollTop, CARD_HEIGHT, MAX_INDEX)).toBe(10);
    });

    it('should clamp to max index for any scroll beyond max', () => {
      const beyondMaxScrollPositions = [
        8001,   // Just beyond max
        10000,  // Moderately beyond
        50000,  // Far beyond
        100000, // Very far beyond
      ];

      beyondMaxScrollPositions.forEach(scrollTop => {
        expect(calculateScrollIndex(scrollTop, CARD_HEIGHT, MAX_INDEX)).toBe(10);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle single card (max index 0)', () => {
      expect(calculateScrollIndex(0, CARD_HEIGHT, 0)).toBe(0);
      expect(calculateScrollIndex(400, CARD_HEIGHT, 0)).toBe(0);
      expect(calculateScrollIndex(800, CARD_HEIGHT, 0)).toBe(0);
      expect(calculateScrollIndex(5000, CARD_HEIGHT, 0)).toBe(0);
    });

    it('should handle two cards (max index 1)', () => {
      expect(calculateScrollIndex(0, CARD_HEIGHT, 1)).toBe(0);
      expect(calculateScrollIndex(799, CARD_HEIGHT, 1)).toBe(0);
      expect(calculateScrollIndex(800, CARD_HEIGHT, 1)).toBe(1);
      expect(calculateScrollIndex(5000, CARD_HEIGHT, 1)).toBe(1);
    });

    it('should handle very small card heights', () => {
      const smallHeight = 100;
      expect(calculateScrollIndex(0, smallHeight, 10)).toBe(0);
      expect(calculateScrollIndex(50, smallHeight, 10)).toBe(0);
      expect(calculateScrollIndex(100, smallHeight, 10)).toBe(1);
      expect(calculateScrollIndex(250, smallHeight, 10)).toBe(2);
    });

    it('should handle very large card heights', () => {
      const largeHeight = 10000;
      expect(calculateScrollIndex(0, largeHeight, 10)).toBe(0);
      expect(calculateScrollIndex(5000, largeHeight, 10)).toBe(0);
      expect(calculateScrollIndex(10000, largeHeight, 10)).toBe(1);
      expect(calculateScrollIndex(50000, largeHeight, 10)).toBe(5);
    });

    it('should handle fractional scroll positions consistently', () => {
      // Floor behavior should always round down
      expect(calculateScrollIndex(800.1, CARD_HEIGHT, MAX_INDEX)).toBe(1);
      expect(calculateScrollIndex(800.9, CARD_HEIGHT, MAX_INDEX)).toBe(1);
      expect(calculateScrollIndex(1599.99, CARD_HEIGHT, MAX_INDEX)).toBe(1);
    });
  });

  describe('typical viewport heights', () => {
    it('should work with mobile viewport (667px - iPhone SE)', () => {
      const mobileHeight = 667;
      const maxIndex = 20;

      expect(calculateScrollIndex(0, mobileHeight, maxIndex)).toBe(0);
      expect(calculateScrollIndex(667, mobileHeight, maxIndex)).toBe(1);
      expect(calculateScrollIndex(1334, mobileHeight, maxIndex)).toBe(2);
      expect(calculateScrollIndex(6670, mobileHeight, maxIndex)).toBe(10);
    });

    it('should work with tablet viewport (1024px - iPad)', () => {
      const tabletHeight = 1024;
      const maxIndex = 20;

      expect(calculateScrollIndex(0, tabletHeight, maxIndex)).toBe(0);
      expect(calculateScrollIndex(1024, tabletHeight, maxIndex)).toBe(1);
      expect(calculateScrollIndex(2048, tabletHeight, maxIndex)).toBe(2);
      expect(calculateScrollIndex(10240, tabletHeight, maxIndex)).toBe(10);
    });

    it('should work with desktop viewport (1080px - Full HD)', () => {
      const desktopHeight = 1080;
      const maxIndex = 20;

      expect(calculateScrollIndex(0, desktopHeight, maxIndex)).toBe(0);
      expect(calculateScrollIndex(1080, desktopHeight, maxIndex)).toBe(1);
      expect(calculateScrollIndex(2160, desktopHeight, maxIndex)).toBe(2);
      expect(calculateScrollIndex(10800, desktopHeight, maxIndex)).toBe(10);
    });
  });

  describe('scroll behavior consistency', () => {
    it('should maintain consistent index for small scroll movements within same card', () => {
      const baseScroll = 1000; // Card index 1
      const index = calculateScrollIndex(baseScroll, CARD_HEIGHT, MAX_INDEX);

      // Small movements shouldn't change index
      expect(calculateScrollIndex(baseScroll + 100, CARD_HEIGHT, MAX_INDEX)).toBe(index);
      expect(calculateScrollIndex(baseScroll + 200, CARD_HEIGHT, MAX_INDEX)).toBe(index);
      expect(calculateScrollIndex(baseScroll + 500, CARD_HEIGHT, MAX_INDEX)).toBe(index);
    });

    it('should transition to next index at exact card boundary', () => {
      const boundary = 2 * CARD_HEIGHT; // 1600
      expect(calculateScrollIndex(boundary - 1, CARD_HEIGHT, MAX_INDEX)).toBe(1);
      expect(calculateScrollIndex(boundary, CARD_HEIGHT, MAX_INDEX)).toBe(2);
      expect(calculateScrollIndex(boundary + 1, CARD_HEIGHT, MAX_INDEX)).toBe(2);
    });

    it('should never skip indices during continuous scroll', () => {
      // Simulate scrolling through multiple cards
      const scrollPositions = [0, 400, 800, 1200, 1600, 2000, 2400];
      const expectedIndices = [0, 0, 1, 1, 2, 2, 3];

      scrollPositions.forEach((scrollTop, i) => {
        expect(calculateScrollIndex(scrollTop, CARD_HEIGHT, MAX_INDEX)).toBe(expectedIndices[i]);
      });
    });
  });

  describe('performance edge cases', () => {
    it('should handle zero card height gracefully (division by zero)', () => {
      // This should not happen in practice, but handle gracefully
      // Floor of Infinity should be Infinity, then clamped to max
      expect(calculateScrollIndex(1000, 0, MAX_INDEX)).toBe(MAX_INDEX);
    });

    it('should handle very large scroll positions efficiently', () => {
      const massiveScroll = Number.MAX_SAFE_INTEGER;
      // Should clamp to max without overflow
      expect(calculateScrollIndex(massiveScroll, CARD_HEIGHT, MAX_INDEX)).toBe(MAX_INDEX);
    });

    it('should handle rapid scroll position updates consistently', () => {
      // Simulate rapid scroll updates
      const rapidUpdates = Array.from({ length: 100 }, (_, i) => i * 10);

      rapidUpdates.forEach(scrollTop => {
        const result = calculateScrollIndex(scrollTop, CARD_HEIGHT, MAX_INDEX);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(MAX_INDEX);
        expect(Number.isInteger(result)).toBe(true);
      });
    });
  });

  describe('real-world scenarios', () => {
    it('should correctly calculate index when resuming session at card 5', () => {
      const resumeScrollTop = 5 * CARD_HEIGHT; // 4000px
      expect(calculateScrollIndex(resumeScrollTop, CARD_HEIGHT, MAX_INDEX)).toBe(5);
    });

    it('should handle user scrolling to last card', () => {
      const lastCardScroll = MAX_INDEX * CARD_HEIGHT;
      expect(calculateScrollIndex(lastCardScroll, CARD_HEIGHT, MAX_INDEX)).toBe(MAX_INDEX);
    });

    it('should handle over-scroll (bounce effect on mobile)', () => {
      // iOS Safari allows over-scroll beyond content bounds
      const overScroll = (MAX_INDEX + 2) * CARD_HEIGHT; // Scroll beyond last card
      expect(calculateScrollIndex(overScroll, CARD_HEIGHT, MAX_INDEX)).toBe(MAX_INDEX);
    });

    it('should handle under-scroll (rubber band effect)', () => {
      // iOS Safari allows negative scroll during rubber band
      const underScroll = -200;
      expect(calculateScrollIndex(underScroll, CARD_HEIGHT, MAX_INDEX)).toBe(0);
    });

    it('should maintain correct index during snap scroll animation', () => {
      // During snap animation, scroll position gradually changes
      const snapPositions = [1550, 1560, 1570, 1580, 1590, 1600];

      // All positions before boundary should be index 1
      expect(calculateScrollIndex(snapPositions[0], CARD_HEIGHT, MAX_INDEX)).toBe(1);
      expect(calculateScrollIndex(snapPositions[4], CARD_HEIGHT, MAX_INDEX)).toBe(1);

      // Exactly at boundary should be index 2
      expect(calculateScrollIndex(snapPositions[5], CARD_HEIGHT, MAX_INDEX)).toBe(2);
    });
  });
});
