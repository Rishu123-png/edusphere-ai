// Firebase - Safe for PWA / Mobile / Capacitor
import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getDatabase } from 'firebase/database'
import { getStorage } from 'firebase/storage'
import type { Analytics } from 'firebase/analytics'

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
}

const missingConfigKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value || String(value).startsWith('your-'))
  .map(([key]) => key)

if (missingConfigKeys.length) {
  console.warn(`[EduSphere] Firebase config is incomplete: ${missingConfigKeys.join(', ')}. Copy .env.example to .env and fill your keys.`)
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

// Analytics safe - only load if supported and window exists
export let analytics: Analytics | null = null
if (typeof window !== 'undefined') {
  import('firebase/analytics').then(({ getAnalytics, isSupported }) => {
    isSupported().then(supported => {
      if (supported) {
        try {
          analytics = getAnalytics(app)
        } catch (error) {
          console.warn('[EduSphere] Analytics could not be initialized', error)
        }
      }
    }).catch(error => {
      console.warn('[EduSphere] Analytics support check failed', error)
    })
  }).catch(error => {
    console.warn('[EduSphere] Analytics module could not be loaded', error)
  })
}

export const auth = getAuth(app)
export const db = getDatabase(app)
export const storage = getStorage(app)
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export default app
