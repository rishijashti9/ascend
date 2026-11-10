/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };
import vercel from './vercel.json' with { type: 'json' };

/**
 * The security headers Vercel sends on every page (CSP and friends, hardening V-03). `vite
 * preview` sends the same ones, so the end-to-end tests run under the exact production policy —
 * a CSP violation shows up as a console error, which every e2e test already fails on.
 */
const securityHeaders = Object.fromEntries(
  (vercel.headers.find((h) => h.source === '/(.*)')?.headers ?? []).map((h) => [h.key, h.value]),
);

export default defineConfig({
  preview: { headers: securityHeaders },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Never reload on our own: show "Update ready — reload" and let Rishi choose (SPEC 9).
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'ASCEND',
        short_name: 'ASCEND',
        description: 'A personal leveling system for real life.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Everything needed to run fully offline, fonts included.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    // Screen tests click through whole flows; on a busy laptop they can pass the 5 s default.
    testTimeout: 15_000,
    // This laptop has 8 GB of RAM: 7 parallel jsdom workers made it swap until workers failed
    // to start. 2 workers is steadier.
    maxWorkers: 2,
  },
});
