// Generates the app icons (public/pwa-*.png, favicon, Apple touch icon) from public/icon.svg.
// Run with: npm run icons
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#0b0b0c' } },
    apple: { ...minimal2023Preset.apple, padding: 0.1, resizeOptions: { background: '#0b0b0c' } },
  },
  images: ['public/icon.svg'],
});
