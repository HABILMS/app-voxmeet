import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.voxmeet.app',
  appName: 'VoxMeet',
  webDir: 'dist',
  server: {
    url: 'https://voxmeet.vercel.app',
    cleartext: true,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;