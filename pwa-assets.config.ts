import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config';

// `npm run icons` renders favicon.ico, pwa-*.png, maskable and apple-touch icons
// from the seal SVG into public/.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset,
  images: ['public/favicon.svg'],
});
