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
  plugins: {
    // Status-bar icon for reminders (task 10.4): a white chevron, tinted with the accent.
    LocalNotifications: {
      smallIcon: 'ic_stat_ascend',
      iconColor: '#4C8DFF',
    },
  },
};

export default config;
