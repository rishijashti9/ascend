import { z } from 'zod';

/**
 * Hardening V-03: the site's Content-Security-Policy forbids `eval`. Zod 4 probes
 * `new Function` to turn on a faster object parser; the probe is caught, but a strict CSP still
 * reports it as a violation. `jitless` skips the probe (same results, plain parsing).
 *
 * Must run before any schema is defined, so it is the FIRST import of `main.tsx` (and of the
 * test setup, so tests run the same code path).
 */
z.config({ jitless: true });
