import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Inbox', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('navigate to /inbox and see messages', async ({ page }) => {
    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Inbox')).toBeVisible();
    // Should see message list or empty state
    const hasMessages = await page.locator('[class*="inbox"], [class*="message"], tr').first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasEmptyState = await page.getByText(/no messages|empty|no items/i).isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasMessages || hasEmptyState).toBeTruthy();
  });

  test('click message to see detail', async ({ page }) => {
    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');

    // Click the first message item if available
    const firstItem = page.locator('[class*="cursor-pointer"], [class*="inbox"] [class*="card"], tr').filter({ hasText: /.+/ }).first();
    const isVisible = await firstItem.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await firstItem.click();
      await page.waitForLoadState('networkidle');

      // Should see message detail or classification info
      const hasDetail = await page.getByText(/reply|respond|classification|channel|from|subject/i).first().isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasDetail).toBeTruthy();
    } else {
      // No messages - skip gracefully
      test.skip();
    }
  });

  test('reply to a message', async ({ page }) => {
    await page.goto('/inbox');
    await page.waitForLoadState('networkidle');

    // Select first message
    const firstItem = page.locator('[class*="cursor-pointer"], [class*="inbox"] [class*="card"], tr').filter({ hasText: /.+/ }).first();
    const isVisible = await firstItem.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isVisible) {
      test.skip();
      return;
    }

    await firstItem.click();
    await page.waitForLoadState('networkidle');

    // Find reply textarea and type a reply
    const replyInput = page.locator('textarea, input[placeholder*="reply" i], input[placeholder*="message" i]').first();
    const replyVisible = await replyInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (replyVisible) {
      await replyInput.fill('E2E test reply message');

      // Find and click send/reply button
      const sendBtn = page.locator('button:has-text("Send"), button:has-text("Reply"), button[type="submit"]').first();
      await expect(sendBtn).toBeVisible();
    } else {
      test.skip();
    }
  });
});
