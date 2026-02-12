/**
 * Playwright eval: chat page and Load facilities.
 * Run: npx playwright test tests/eval-chat.spec.js
 * Optional: CHAT_BASE_URL=https://your-app.vercel.app npx playwright test tests/eval-chat.spec.js
 */
const { test, expect } = require('@playwright/test');

test('chat page loads and Load facilities can be evaluated', async ({ page }) => {
  await page.goto('/chat.html');

  await expect(page.getByRole('heading', { name: /METRC Chat/i })).toBeVisible();
  const apiInput = page.locator('#apiBase');
  await expect(apiInput).toBeVisible();

  // If API URL is empty, set to current origin (same as page)
  const currentValue = await apiInput.inputValue();
  if (!currentValue.trim()) {
    await apiInput.fill(page.url().replace(/\/chat\.html.*$/, ''));
  }

  const facilitySelect = page.locator('#facility');
  const loadBtn = page.getByRole('button', { name: /Load facilities/i });
  const status = page.locator('#status');

  await loadBtn.click();

  // Wait for either facilities loaded (options > 1) or error message
  await expect(async () => {
    const options = await facilitySelect.locator('option').count();
    const statusText = await status.textContent();
    if (options > 1) return true;
    if (statusText && (statusText.includes('Error') || statusText.includes('Failed'))) return true;
    throw new Error('Still loading');
  }).toPass({ timeout: 15_000 });

  const optionCount = await facilitySelect.locator('option').count();
  const statusText = await status.textContent();

  if (optionCount > 1) {
    console.log('Eval OK: facilities loaded, count =', optionCount - 1);
  } else {
    console.log('Eval: Load facilities returned error:', statusText);
  }
});
