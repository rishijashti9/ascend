import type { CapacitorConfig } from '@capacitor/cli';

/** Android app wrapper. The app ID is permanent (DECISIONS.md). */
const config: CapacitorConfig = {
  appId: 'app.ascend.rishi',
  appName: 'ASCEND',
  webDir: 'dist',
  android: {
    // ELEVATE black, so there's no flash on start.
    backgroundColor: '#000000',
  },
  plugins: {
    // Status-bar icon for reminders (task 10.4): a white chevron, tinted with the accent (ELEVATE lime).
    LocalNotifications: {
      smallIcon: 'ic_stat_ascend',
      iconColor: '#C8F03C',
    },
  },
};

export default config;
