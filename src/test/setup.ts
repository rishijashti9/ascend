import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { configure } from '@testing-library/dom';

// The full suite runs many jsdom files in parallel; on a busy laptop a screen can take longer
// than Testing Library's default 1 s to settle. findBy*/waitFor wait up to 5 s instead.
configure({ asyncUtilTimeout: 5000 });

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
