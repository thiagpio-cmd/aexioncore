import { type Page, expect } from '@playwright/test';

export async function login(
  page: Page,
  email = 'aexion@aexioncore.com',
  password = 'aexion123',
) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 10000 });
}

/**
 * Verify the user lands on a protected page after login.
 * Useful as a quick sanity check before running page-specific assertions.
 */
export async function loginAndNavigate(page: Page, path: string) {
  await login(page);
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

/**
 * Logout by clicking the user avatar / logout button in the sidebar.
 */
export async function logout(page: Page) {
  // The sidebar has a "Sign out" / logout button
  const logoutBtn = page.getByText('Sign out');
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
  } else {
    // Fallback: hit the signout API
    await page.goto('/api/auth/signout');
    const csrfBtn = page.locator('button[type="submit"]');
    if (await csrfBtn.isVisible({ timeout: 3000 })) {
      await csrfBtn.click();
    }
  }
  await page.waitForURL(/\/login/, { timeout: 10000 });
}
