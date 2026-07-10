// Firebase - Safe for PWA / Mobile / Capacitor
import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAQN7N3qq8XR6YfOJ-d42bhO_omQbuN1jI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "edusphere-ai-e8622.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://edusphere-ai-e8622-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "edusphere-ai-e8622",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "edusphere-ai-e8622.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "726353953169",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:726353953169:web:b69317afcc4193bde45a30",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-CHDEXYMQL6"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Analytics safe - only load if supported and window exists
export let analytics: any = null;
if (typeof window !== 'undefined') {
  import('firebase/analytics').then(({ getAnalytics, isSupported }) => {
    isSupported().then(supported => {
      if (supported) {
        try { analytics = getAnalytics(app); } catch {}
      }
    }).catch(()=>{})
  }).catch(()=>{})
}

export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export default app;
