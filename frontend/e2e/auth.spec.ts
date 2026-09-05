import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
  test('allows customer registration and OTP verification', async ({ page }) => {
    // 1. Visit Register Page
    await page.goto('/auth/register');
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();

    // 2. Fill registration form
    await page.getByPlaceholder('e.g. Rahul Sharma').fill('Test Playwright User');
    await page.getByPlaceholder('name@example.com').fill(`playwright_${Date.now()}@example.com`);
    await page.locator('input[type="password"]').first().fill('Password123');
    await page.locator('input[type="password"]').last().fill('Password123');

    // 3. Submit
    await page.getByRole('button', { name: /create account/i }).click();

    // 4. Verify redirected to OTP page
    await expect(page.getByRole('heading', { name: /otp verification/i })).toBeVisible();

    // 5. Enter 6-digit OTP code 123456
    const inputs = page.locator('input[inputmode="numeric"]');
    await expect(inputs).toHaveCount(6);
    await inputs.first().fill('1');
    await inputs.nth(1).fill('2');
    await inputs.nth(2).fill('3');
    await inputs.nth(3).fill('4');
    await inputs.nth(4).fill('5');
    await inputs.nth(5).fill('6');

    // 6. Submit OTP
    await page.getByRole('button', { name: /verify/i }).click();

    // 7. Verify navigation to Home page
    await expect(page).toHaveURL('/');
  });

  test('allows demo quick fill login for Facility Owner', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('button', { name: /owner/i }).click();
    await page.getByRole('button', { name: /sign in/i }).click();

    // Verify redirected to Owner Dashboard
    await expect(page).toHaveURL('/owner');
  });
});
