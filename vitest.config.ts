import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Run tests in Vietnam's timezone (UTC+7) so day-key tests catch the old
// `toISOString().slice(0, 10)` bug, where a new day started at 07:00 local.
process.env.TZ = 'Asia/Ho_Chi_Minh';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  define: { __APP_VERSION__: JSON.stringify('test') },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    restoreMocks: true,
  },
});
