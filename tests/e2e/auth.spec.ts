import { test, expect } from '@playwright/test';
import { login, logout } from './helpers';

test.describe('Authentication', () => {
  test('login with valid credentials redirects to home', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL('/');
    // Should see the dashboard / workspace content
    await expect(page.locator('body')).not.toContainText('Sign in to your account');
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'wrong@example.com');
    await page.fill('#password', 'badpassword');
    await page.click('button[type="submit"]');

    // Should stay on login and display an error
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('logout redirects to login', async ({ page }) => {
    await login(page);
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test('protected page without auth redirects to login', async ({ page }) => {
    await page.goto('/leads');
    await expect(page).toHaveURL(/\/login/);
  });
});
