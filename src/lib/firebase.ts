// Firebase - Safe for PWA / Mobile / Capacitor
import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Validate critical config
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes('your-')) {
  console.warn('[EduSphere] Firebase keys not configured. Copy .env.example to .env and fill your keys.');
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Analytics safe - only load if supported and window exists
export let analytics: any = null;
if (typeof window !== 'undefined') {
  import('firebase/analytics').then(({ getAnalytics, isSupported }) => {
    isSupported().then(supported => {
      if (supported) {
        try { analytics = getAnalytics(app); } catch {}
      }
    }).catch(() => {});
  }).catch(() => {});
}

export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export default app;
