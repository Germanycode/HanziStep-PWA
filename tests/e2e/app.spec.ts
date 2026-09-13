import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

/** Browser-side navigator shape; e2e specs are typechecked without the DOM lib. */
type BrowserNavigator = { serviceWorker: { ready: Promise<unknown>; controller: unknown } };

test('shell renders, settings persist, and the app reloads offline', async ({ page, context }) => {
  await page.goto('/');
  const mainNav = page.getByRole('navigation', { name: 'Điều hướng chính' });
  await expect(mainNav).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Chào buổi');

  // Settings are stored in IndexedDB and survive a reload.
  await mainNav.getByRole('link', { name: 'Cài đặt' }).click();
  await page.getByRole('button', { name: 'Sáng', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  // Once the service worker controls the page, the app shell loads without a network.
  await page.evaluate(async () => {
    await (navigator as unknown as BrowserNavigator).serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean((navigator as unknown as BrowserNavigator).serviceWorker.controller)))
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(mainNav).toBeVisible();
  await mainNav.getByRole('link', { name: 'Từ vựng' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Từ vựng' })).toBeVisible();
  await context.setOffline(false);
});

test('backup export downloads a HanziStep backup file', async ({ page }) => {
  await page.goto('/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải bản sao lưu (JSON)' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^hanzistep-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const content = JSON.parse(await readFile(await download.path(), 'utf8')) as { format: string; includesSecrets: boolean };
  expect(content.format).toBe('hanzistep-backup');
  expect(content.includesSecrets).toBe(false);
});
