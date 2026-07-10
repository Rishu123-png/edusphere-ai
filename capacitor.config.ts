import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.edusphere.app',
  appName: 'EduSphere AI',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    Camera: {
      permission: "Camera access needed for AI attendance"
    }
  }
};

export default config;
