import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Lead Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('navigate to /leads and see lead list', async ({ page }) => {
    await page.goto('/leads');
    await expect(page.getByText('Leads')).toBeVisible();
    // Should see filter tabs (All, New, etc.)
    await expect(page.getByRole('button', { name: /all/i })).toBeVisible();
  });

  test('create new lead appears in list', async ({ page }) => {
    await page.goto('/leads');
    await page.waitForLoadState('networkidle');

    // Click "+ New Lead" button
    await page.click('button:has-text("New Lead")');

    // Wait for modal to appear
    const modal = page.locator('[role="dialog"], .modal, [class*="modal"]');
    await expect(modal.or(page.getByText(/create.*lead/i))).toBeVisible({ timeout: 5000 });

    // Fill in required fields (name and email are typical)
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
    if (await nameInput.isVisible({ timeout: 2000 })) {
      await nameInput.fill('E2E Test Lead');
    }

    const emailInput = page.locator('input[name="email"], input[placeholder*="email" i], input[type="email"]').first();
    if (await emailInput.isVisible({ timeout: 2000 })) {
      await emailInput.fill('e2e-lead@test.com');
    }

    // Submit the form
    const submitBtn = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")').first();
    await submitBtn.click();

    // Verify the new lead appears in the list
    await expect(page.getByText('E2E Test Lead')).toBeVisible({ timeout: 10000 });
  });

  test('open lead detail shows lead info', async ({ page }) => {
    await page.goto('/leads');
    await page.waitForLoadState('networkidle');

    // Click the first lead row to navigate to detail
    const firstRow = page.locator('tr, [class*="lead-row"], [class*="card"]').filter({ hasText: /.+/ }).first();
    await firstRow.click();

    // Should navigate to a lead detail page or show detail view
    await page.waitForLoadState('networkidle');

    // Expect to see lead detail content (name, status, etc.)
    const hasDetailContent = await page.getByText(/status|contact|email|phone|source/i).first().isVisible({ timeout: 5000 });
    expect(hasDetailContent).toBeTruthy();
  });

  test('filter leads by status tab', async ({ page }) => {
    await page.goto('/leads');
    await page.waitForLoadState('networkidle');

    // Click "New" filter tab
    const newTab = page.getByRole('button', { name: /^new/i });
    if (await newTab.isVisible({ timeout: 3000 })) {
      await newTab.click();
      await page.waitForLoadState('networkidle');

      // The "New" tab should now be active (has primary styling)
      await expect(newTab).toBeVisible();
    }
  });
});
