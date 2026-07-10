import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.edusphere.app',
  appName: 'EduSphere AI',
  webDir: 'dist',
  backgroundColor: '#4f46e5',
  android: {
    backgroundColor: '#4f46e5',
  },
  server: {
    androidScheme: 'https',
    iosScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#4f46e5'
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#4f46e5'
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    Camera: {
      permission: "Camera access needed for AI attendance"
    },
    Haptics: {}
  }
};

export default config;
