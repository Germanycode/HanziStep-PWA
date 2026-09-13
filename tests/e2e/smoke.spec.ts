import { expect, test } from '@playwright/test';

/**
 * Opens every screen once. Most pages have no other e2e coverage, so this is
 * what catches a crash on first render (a bad import, a null dereference)
 * before the learner does.
 */
const ROUTES = [
  '/',
  '/learn',
  '/review',
  '/reading',
  '/listening',
  '/listening/shadow',
  '/vocab',
  '/stats',
  '/coach',
  '/pinyin',
  '/pinyin/chart',
  '/writing',
  '/settings',
  '/settings/sources',
  '/settings/voices',
];

/** Noise that says nothing about our own code. */
const IGNORED = [/favicon/i, /manifest/i, /service ?worker/i, /React DevTools/i];

test.setTimeout(180_000);

test('every screen opens without a crash', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`${page.url()} — uncaught: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (IGNORED.some((pattern) => pattern.test(text))) return;
    problems.push(`${page.url()} — console: ${text}`);
  });

  for (const route of ROUTES) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 }), `no <h1> on ${route}`).toBeVisible({ timeout: 20_000 });
  }

  expect(problems, `Problems found:\n${problems.join('\n')}`).toEqual([]);
});

test('mobile navigation exposes every route through a visible menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: 'Điều hướng chính' });
  const writing = navigation.getByRole('link', { name: 'Tập viết' });
  await expect(writing).toBeHidden();
  await navigation.getByRole('button', { name: 'Menu' }).click();
  await expect(writing).toBeVisible();
  await writing.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tập viết' })).toBeVisible();
});
