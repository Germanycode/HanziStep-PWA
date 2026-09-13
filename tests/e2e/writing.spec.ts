import { expect, test } from '@playwright/test';

test('writing quiz accepts a simulated stroke and records give-up', async ({ page }) => {
  await page.goto('/settings');
  const toggle = page.getByRole('checkbox', { name: /Viết theo nét/ });
  if (!(await toggle.isChecked())) {
    await toggle.click();
    await page.waitForTimeout(300);
  }

  await page.evaluate(`(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = window.indexedDB.open('hanzistep');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(['chars', 'cards'], 'readwrite');
      transaction.objectStore('chars').put({
        id: '写', character: '写', wordIds: [], pinyin: ['xie3'], meaningsVi: ['viết'], hanViet: ['TẢ'], createdAt: 1, updatedAt: 1,
      });
      transaction.objectStore('cards').put({
        id: 'write:写', subjectType: 'char', subjectId: '写', facet: 'write', state: 'new',
        repetition: 1, easeFactor: 2.5, intervalDays: 0, due: 0, lapses: 0,
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  })()`);

  await page.goto('/writing');
  await page.getByRole('button', { name: 'Bắt đầu' }).click();
  const board = page.getByLabel('Bảng tập viết chữ 写');
  await expect(board).toBeVisible();
  const box = await board.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    await page.mouse.move(box.x + 50, box.y + 60);
    await page.mouse.down();
    await page.mouse.move(box.x + 170, box.y + 80, { steps: 8 });
    await page.mouse.up();
  }
  await page.getByRole('button', { name: 'Bỏ cuộc' }).click();
  await expect(page.getByRole('heading', { name: 'Hoàn thành buổi tập viết' })).toBeVisible();
});

test('a correct stroke survives restart and persists a no-hint quality score', async ({ page }) => {
  await page.goto('/settings');
  const toggle = page.getByRole('checkbox', { name: /Viết theo nét/ });
  if (!(await toggle.isChecked())) {
    await toggle.click();
    await page.waitForTimeout(300);
  }

  await page.evaluate(`(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = window.indexedDB.open('hanzistep');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(['chars', 'cards'], 'readwrite');
      transaction.objectStore('chars').put({
        id: '一', character: '一', wordIds: [], pinyin: ['yi1'], meaningsVi: ['một'], hanViet: ['NHẤT'], createdAt: 1, updatedAt: 1,
      });
      transaction.objectStore('cards').put({
        id: 'write:一', subjectType: 'char', subjectId: '一', facet: 'write', state: 'review',
        repetition: 3, easeFactor: 2.5, intervalDays: 1, due: 0, lapses: 0,
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  })()`);

  await page.goto('/writing');
  await page.getByRole('button', { name: 'Bắt đầu' }).click();
  await page.getByRole('button', { name: 'Làm lại' }).click();
  const board = page.getByLabel('Bảng tập viết chữ 一');
  await expect(board).toBeVisible();
  const box = await board.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    await page.mouse.move(box.x + 42, box.y + 170);
    await page.mouse.down();
    await page.mouse.move(box.x + 242, box.y + 168, { steps: 16 });
    await page.mouse.up();
  }
  await expect(page.getByRole('heading', { name: 'Hoàn thành buổi tập viết' })).toBeVisible({ timeout: 10_000 });

  const persisted = await page.evaluate(`(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = window.indexedDB.open('hanzistep');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const result = await new Promise((resolve, reject) => {
      const transaction = database.transaction(['cards', 'reviewLogs'], 'readonly');
      const cardRequest = transaction.objectStore('cards').get('write:一');
      const logRequest = transaction.objectStore('reviewLogs').getAll();
      transaction.oncomplete = () => resolve({ card: cardRequest.result, logs: logRequest.result });
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
    return result;
  })()`) as { card: { repetition: number }; logs: Array<{ hints: number; quality: number }> };
  expect(persisted.card.repetition).toBe(4);
  expect(persisted.logs.at(-1)).toMatchObject({ subjectId: '一', facet: 'write', correct: true, quality: 5, hints: 0 });
});
