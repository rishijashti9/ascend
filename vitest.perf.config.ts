import base from './vite.config';

/** `npm run perf`: the 10-year performance test (task 10.6), kept out of the normal test run. */
export default {
  ...base,
  test: { ...base.test, include: ['src/**/*.perf.ts'], testTimeout: 900_000 },
};
