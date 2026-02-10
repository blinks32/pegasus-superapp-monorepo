import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pegasus.driver',
  appName: 'Driver',
  webDir: 'www',
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true
  },
  server: {
    androidScheme: 'http',
    cleartext: true,
    allowNavigation: [
      '*'
    ]
  },
  plugins: {
    Keyboard: {
      resize: 'none'
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      showSpinner: false
    },
    CapacitorHttp: {
      enabled: false
    }
  }
};

export default config;