import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Opportunity Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('navigate to /opportunities and see list', async ({ page }) => {
    await page.goto('/opportunities');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Opportunities')).toBeVisible();
    // Should see filter tabs or table headers
    await expect(page.getByRole('button', { name: /all/i })).toBeVisible();
  });

  test('open opportunity detail shows deal info', async ({ page }) => {
    await page.goto('/opportunities');
    await page.waitForLoadState('networkidle');

    // Click the first opportunity row
    const firstRow = page.locator('tr, [class*="opportunity"], [class*="card"]').filter({ hasText: /.+/ }).first();
    await firstRow.click();

    await page.waitForLoadState('networkidle');

    // Should see opportunity detail content (stage, value, etc.)
    const hasDetail = await page.getByText(/stage|value|discovery|qualification|proposal|negotiation/i).first().isVisible({ timeout: 5000 });
    expect(hasDetail).toBeTruthy();
  });

  test('navigate to /pipeline and see kanban board', async ({ page }) => {
    await page.goto('/pipeline');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Pipeline')).toBeVisible();

    // Should see stage columns (Discovery, Qualification, etc.)
    await expect(page.getByText('Discovery')).toBeVisible();
    await expect(page.getByText('Qualification')).toBeVisible();
    await expect(page.getByText('Proposal')).toBeVisible();
  });
});
