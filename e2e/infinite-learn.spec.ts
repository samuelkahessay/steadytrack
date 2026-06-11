import { test, expect } from '@playwright/test';

test.describe('Infinite Learn Mode', () => {
  test('subjects with sufficient cards appear in modal', async ({ page }) => {
    await page.goto('/learn/infinite');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Only subjects with >= 10 cards appear (filtered by /api/infinite-feed/subjects?min_cards=10)
    const subjects = [
      'Math 20-1', 'Math 30-1',
      'Biology 20', 'Biology 30',
      'Chemistry 20', 'Chemistry 30',
      'Physics 20', 'Physics 30',
      'English Language Arts 20-1'
      // Excluded: English Language Arts 30-1 (0 cards), Social Studies 20-1/30-1 (4 cards each)
    ];

    for (const subject of subjects) {
      await expect(page.locator(`text=${subject}`)).toBeVisible({ timeout: 10000 });
    }
  });

  test('scroll resume works correctly', async ({ page }) => {
    await page.goto('/learn/infinite');
    // Start session
    await page.click('text=Math 30-1');
    await page.click('text=Start Learning');

    // Wait for first card to load
    await page.waitForSelector('[data-card-index="0"]', { timeout: 10000 });

    // Scroll to 3rd card using the scroll container
    await page.evaluate(() => {
      const container = document.querySelector('.overflow-y-scroll');
      if (container) {
        container.scrollTop = window.innerHeight * 2;
      }
    });
    await page.waitForTimeout(2500); // Wait for debounced save

    // Refresh page
    await page.reload();
    await page.click('text=Resume Session');

    // Wait for scroll restoration
    await page.waitForTimeout(1000);

    // Check scroll position
    const { scrollTop, innerHeight } = await page.evaluate(() => ({
      scrollTop: document.querySelector('.overflow-y-scroll')?.scrollTop || 0,
      innerHeight: window.innerHeight
    }));
    expect(scrollTop).toBeGreaterThan(innerHeight * 1.5);
  });

  test('no duplicate cards appear', async ({ page }) => {
    await page.goto('/learn/infinite');
    await page.click('text=Biology 30');
    await page.click('text=Start Learning');

    // Wait for first card to load
    await page.waitForSelector('[data-card-index="0"]', { timeout: 10000 });

    const cardIds = new Set();
    // Check first 10 cards (limited by available test data for Biology 30)
    for (let i = 0; i < 10; i++) {
      const cardLocator = page.locator('[data-card-index="' + i + '"]');
      await cardLocator.waitFor({ state: 'attached', timeout: 5000 });
      const cardId = await cardLocator.getAttribute('data-card-id');
      if (cardId) {
        expect(cardIds.has(cardId)).toBe(false);
        cardIds.add(cardId);
      }
    }
  });
});
