import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.affiliateae.app',
  appName: 'AE',
  webDir: 'dist',
  plugins: {
    FirebaseAuthentication: {
      providers: ['phone']
    }
  }
};

export default config;
