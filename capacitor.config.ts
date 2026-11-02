import type { CapacitorConfig } from '@capacitor/cli';

/** Android app wrapper. The app ID is permanent (DECISIONS.md). */
const config: CapacitorConfig = {
  appId: 'app.ascend.rishi',
  appName: 'ASCEND',
  webDir: 'dist',
  android: {
    // Matches the dark background so there's no white flash on start.
    backgroundColor: '#0E1116',
  },
};

export default config;
