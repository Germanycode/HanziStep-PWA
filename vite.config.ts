import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

const THIRTY_DAYS = 30 * 24 * 60 * 60;

/**
 * Only three outside services are ever contacted: Gemini, Pixabay and Unsplash.
 * The policy is injected at build time only — a meta tag would also apply to the
 * dev server and break Vite's HMR.
 */
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  // React writes style attributes, which count as inline styles.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://pixabay.com https://cdn.pixabay.com https://images.unsplash.com https://plus.unsplash.com",
  "media-src 'self' blob:",
  "font-src 'self'",
  "worker-src 'self' blob:",
  "connect-src 'self' https://generativelanguage.googleapis.com wss://generativelanguage.googleapis.com https://pixabay.com https://api.unsplash.com https://images.unsplash.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
];

/**
 * `frame-ancestors` is ignored when it arrives in a meta tag (the browser says
 * so in the console), so the tag carries everything else and the preview
 * server — the one `Start HanziStep.bat` uses every day — sends the full
 * policy as a real header.
 */
const META_CSP = CSP_DIRECTIVES.filter((directive) => !directive.startsWith('frame-ancestors')).join('; ');
const HEADER_CSP = CSP_DIRECTIVES.join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'hanzistep-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${META_CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  worker: { format: 'es' },
  // IndexedDB is per origin: keep fixed ports so saved progress is always found.
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true, headers: { 'Content-Security-Policy': HEADER_CSP } },
  plugins: [
    react(),
    tailwindcss(),
    contentSecurityPolicy(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'HanziStep – Học tiếng Trung',
        short_name: 'HanziStep',
        description: 'Học tiếng Trung từng bước: pinyin, từ vựng, đọc, nghe và nói.',
        lang: 'vi',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0f0f1a',
        theme_color: '#0f0f1a',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell plus the small data files needed on every screen.
        globPatterns: [
          '**/*.{js,css,html,svg,png,ico,webmanifest}',
          'audio/sfx/*.mp3',
          'data/v1/manifest.json',
          'data/v1/hanviet.json',
          'data/v1/syllables.json',
          'data/v1/hanzi/*.json',
        ],
        globIgnores: ['music/**', 'audio/syllables/**', 'audio/words/**', 'data/v1/dict/**'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/data\//, /^\/audio\//, /^\/music\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/data/'),
            // Data paths are versioned by the manifest but may keep the same
            // pathname between releases. Revalidate online, fall back offline.
            handler: 'NetworkFirst',
            options: {
              cacheName: 'hanzistep-data',
              networkTimeoutSeconds: 5,
              expiration: { maxAgeSeconds: THIRTY_DAYS },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/audio/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'hanzistep-audio',
              expiration: { maxEntries: 4000, maxAgeSeconds: THIRTY_DAYS },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/music/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'hanzistep-music',
              expiration: { maxEntries: 20, maxAgeSeconds: THIRTY_DAYS },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Cache only public image bytes. Never cache pixabay.com/api URLs,
            // whose query string contains the user's API key.
            urlPattern: ({ url }) => url.hostname === 'cdn.pixabay.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'hanzistep-images',
              expiration: { maxEntries: 500, maxAgeSeconds: THIRTY_DAYS },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
