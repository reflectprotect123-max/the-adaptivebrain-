import { test, expect } from 'playwright/test';

test('moved Coach opens its offline workspace with local scripts intact', async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  const errors = [];
  const missing = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith('http://127.0.0.1:8874/') && response.status() >= 400) missing.push(response.url());
  });
  await page.goto('/coach.html');
  await page.getByRole('button', { name: 'Demo coach (offline)' }).click();
  await expect(page.getByText('Coach Home', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Week 1 Day 1' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Coach Home', { exact: true }).first()).toBeVisible();
  expect(missing).toEqual([]);
  expect(errors).toEqual([]);
});
