import { expect, test } from '@playwright/test';

test('finish a pinyin lesson and a tone drill round, then see progress on Today', async ({ page }) => {
  await page.goto('/pinyin');
  await page.getByRole('link', { name: /Bốn thanh điệu và thanh nhẹ/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Bốn thanh điệu');
  await page.getByRole('button', { name: 'Chọn ma1' }).click();
  await page.getByRole('button', { name: 'Hoàn thành bài học' }).click();
  await expect(page.getByText('Đã hoàn thành')).toBeVisible();
  await page.getByRole('link', { name: /Bài tiếp: Vận mẫu đơn/ }).click();
  await expect(page.getByRole('button', { name: 'Hoàn thành bài học' })).toBeDisabled();

  await page.goto('/pinyin/drill/tone-id');
  for (let question = 1; question <= 10; question++) {
    await expect(page.getByTestId('drill-counter')).toHaveText(`Câu ${question}/10`);
    await page.getByRole('button', { name: /Thanh 1/ }).click();
    await page.getByRole('button', { name: question === 10 ? 'Xem kết quả' : 'Tiếp theo' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Hoàn thành vòng luyện' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('drill-score')).toHaveText(/^\d+\/10$/);

  await page.goto('/');
  await expect(page.getByTestId('streak-current')).toHaveText('1');
  // 25 XP for the lesson + 15 XP for the round (+10 bonus only with ≥ 90% correct).
  await expect(page.getByTestId('total-xp')).toHaveText(/^(40|50) XP/);
});

test('pinyin chart shows syllables and typing drill checks answers', async ({ page }) => {
  await page.goto('/pinyin/chart');
  await page.getByRole('button', { name: 'zhuang', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nghe zhuāng' })).toBeVisible();

  await page.goto('/pinyin/drill/pinyin-typing');
  await expect(page.getByTestId('drill-counter')).toHaveText('Câu 1/10');
  await page.getByLabel('Pinyin bạn nghe được').fill('ma3');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Âm vừa nghe');
});
