import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom has no matchMedia; screens that preview the theme need a quiet default (light).
// Tests that check theme behaviour replace it with their own mock.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}
