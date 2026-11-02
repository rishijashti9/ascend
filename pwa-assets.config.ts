import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

/** Generates all app icons from public/icon.svg. Run: npm run icons */
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      padding: 0,
      resizeOptions: { background: '#0E1116' },
    },
    apple: { ...minimal2023Preset.apple, padding: 0.15, resizeOptions: { background: '#0E1116' } },
  },
  images: ['public/icon.svg'],
});
