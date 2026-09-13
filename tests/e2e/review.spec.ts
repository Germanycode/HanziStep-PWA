import { expect, test, type Page } from '@playwright/test';

/** Introduces one word and answers its quick check correctly (the right option carries the word id). */
async function learnOneWord(page: Page) {
  await page.getByRole('button', { name: 'Kiểm tra nhanh' }).click();
  // Read the id from the check panel, so a re-render cannot hand back the previous word.
  const wordId = await page.locator('[data-word-id]').first().getAttribute('data-word-id');
  expect(wordId).toBeTruthy();
  await page.locator(`[data-choice-id="${wordId ?? ''}"]`).click();
  await page.getByRole('button', { name: 'Từ tiếp theo' }).click();
}

test('learn words, review with a mistake, retry, and restore a backup', async ({ page, browser }) => {
  // Frozen clock: the 20-minute learning step and the backup comparison need a known "now".
  await page.clock.install();

  await page.goto('/learn');
  await page.getByRole('button', { name: 'Bắt đầu học' }).click();
  await learnOneWord(page);
  await learnOneWord(page);

  // A listening card unlocks as soon as its word has been read once, so two cards are due now.
  await page.goto('/review');
  await expect(page.getByTestId('due-count')).toHaveText('2');
  await page.getByRole('button', { name: 'Bắt đầu ôn' }).click();

  // Answer the first question wrong on purpose.
  const question = page.locator('[data-word-id][data-question-type]');
  await expect(question).toBeVisible();
  const askedWordId = await question.getAttribute('data-word-id');
  await question.locator(`[data-choice-id]:not([data-choice-id="${askedWordId ?? ''}"])`).first().click();
  await expect(page.getByTestId('answer-feedback')).toContainText('Chưa đúng');
  await page.getByRole('button', { name: /Tiếp theo/ }).click();

  // Answer the second question right, so exactly one mistake is left over.
  const secondWordId = await question.getAttribute('data-word-id');
  await question.locator(`[data-choice-id="${secondWordId ?? ''}"]`).click();
  await expect(page.getByTestId('answer-feedback')).toContainText('Chính xác');
  await page.getByRole('button', { name: /Xem kết quả/ }).click();
  await expect(page.getByTestId('session-score')).toHaveText('1/2');

  // The mistake round practises without changing the schedule.
  await page.getByRole('button', { name: /Ôn lại 1 câu sai/ }).click();
  await expect(page.getByRole('heading', { name: 'Ôn lại câu sai' })).toBeVisible();
  await page.locator('[data-choice-id]').first().click();
  await page.getByRole('button', { name: /Xem kết quả/ }).click();
  await expect(page.getByTestId('session-score')).toBeVisible();

  // After the 20-minute step the reading cards come back.
  await page.clock.fastForward('21:00');
  await expect(page.getByTestId('next-due')).toContainText('Đã có thẻ mới đến hạn');
  await page.getByRole('button', { name: 'Ôn tiếp' }).click();
  await expect(page.getByTestId('due-count')).toHaveText('2');
  const frozenNow = await page.evaluate(() => Date.now());

  await page.goto('/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải bản sao lưu (JSON)' }).click();
  const backupPath = await (await downloadPromise).path();

  // A fresh profile restores the backup and sees the same cards due at the same instant.
  const fresh = await browser.newContext();
  const freshPage = await fresh.newPage();
  await freshPage.clock.install({ time: frozenNow });
  freshPage.on('dialog', (dialog) => void dialog.accept());
  await freshPage.goto('/review');
  await expect(freshPage.getByTestId('due-count')).toHaveText('0');

  await freshPage.goto('/settings');
  await freshPage.locator('input[type="file"]').setInputFiles(backupPath);
  await expect(freshPage.getByText(/Đã khôi phục/)).toBeVisible();
  await freshPage.goto('/review');
  await expect(freshPage.getByTestId('due-count')).toHaveText('2');
  await fresh.close();
});
