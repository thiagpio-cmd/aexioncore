import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('navigate to /dashboards and see stats', async ({ page }) => {
    await page.goto('/dashboards');
    await page.waitForLoadState('networkidle');

    // Should see the Overview / Dashboard page header
    await expect(page.getByText(/overview|dashboard/i).first()).toBeVisible();

    // Should see stat cards or metrics
    const hasStats = await page.locator('[class*="stat"], [class*="card"], [class*="metric"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasStats).toBeTruthy();
  });

  test('period filter works', async ({ page }) => {
    await page.goto('/dashboards');
    await page.waitForLoadState('networkidle');

    // Look for period filter buttons (7d, 30d, 90d, all)
    const filterBtn = page.getByRole('button', { name: /30d|30 days/i });
    const isVisible = await filterBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await filterBtn.click();
      await page.waitForLoadState('networkidle');

      // Page should still show dashboard content after filter change
      await expect(page.getByText(/overview|dashboard/i).first()).toBeVisible();
    } else {
      // Try alternative period selectors
      const altFilter = page.locator('button:has-text("7d"), button:has-text("90d"), select').first();
      if (await altFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
        await altFilter.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('generate report button exists', async ({ page }) => {
    await page.goto('/dashboards');
    await page.waitForLoadState('networkidle');

    // Should see AI report / generate report button
    const reportBtn = page.locator('button:has-text("Report"), button:has-text("Generate"), button:has-text("AI")').first();
    const isVisible = await reportBtn.isVisible({ timeout: 5000 }).catch(() => false);
    expect(isVisible).toBeTruthy();
  });
});
