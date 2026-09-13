import { expect, test } from '@playwright/test';

// The dictionary import (125k entries) runs on first load and segmentation waits for it.
test.setTimeout(180_000);

test('read a pasted text, look up a word, and meet it first in Học mới', async ({ page }) => {
  await page.goto('/reading');
  await page.locator('header').getByRole('button', { name: 'Dán văn bản' }).click();
  await page.getByLabel('Tiêu đề').fill('Bài thử');
  await page.getByLabel('Nội dung').fill('我去银行。他行走很快。');
  await page.getByRole('button', { name: 'Tạo bài đọc' }).click();
  await expect(page.getByTestId('reader-body')).toBeVisible();

  // Context decides the boundaries: 银行 is one word and 行走 is not cut apart.
  const bank = page.locator('[data-token-text="银行"]');
  await expect(bank).toHaveCount(1);
  await expect(page.locator('[data-token-text="行走"]')).toHaveCount(1);
  // The reading only appears once the dictionary import has finished and the reader re-prepares.
  await expect(bank).toHaveAttribute('title', 'yin2 hang2', { timeout: 150_000 });

  await bank.click();
  const popover = page.getByRole('dialog', { name: /Tra từ/ });
  await expect(popover).toBeVisible();
  // Tapping offers every length that exists at this position.
  await expect(popover.getByRole('button', { name: '银行', exact: true })).toBeVisible();
  await expect(popover.getByRole('button', { name: '银', exact: true })).toBeVisible();
  await popover.getByRole('button', { name: 'Nét chữ' }).click();
  await expect(popover.getByRole('button', { name: 'Xem nét chữ 银' })).toBeVisible();
  await popover.getByRole('button', { name: 'Xem nét chữ 行' }).click();
  await expect(popover.getByLabel('Bảng tập viết chữ 行')).toBeVisible();
  await popover.getByRole('button', { name: 'Lưu từ' }).click();
  await expect(popover).toBeHidden();

  // A word saved from a text is learned first, and keeps the sentence it came from.
  await page.goto('/learn');
  await page.getByRole('button', { name: 'Bắt đầu học' }).click();
  const card = page.locator('[data-word-id]').first();
  await expect(card).toContainText('银行');
  await expect(card).toContainText('我去银行。');
});
