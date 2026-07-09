// Your Firebase config from the prompt
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAQN7N3qq8XR6YfOJ-d42bhO_omQbuN1jI",
  authDomain: "edusphere-ai-e8622.firebaseapp.com",
  projectId: "edusphere-ai-e8622",
  storageBucket: "edusphere-ai-e8622.firebasestorage.app",
  messagingSenderId: "726353953169",
  appId: "1:726353953169:web:b69317afcc4193bde45a30",
  measurementId: "G-CHDEXYMQL6"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

isSupported().then(yes => yes && getAnalytics(app)).catch(()=>{});
