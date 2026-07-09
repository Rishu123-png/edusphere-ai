import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAQN7N3qq8XR6YfOJ-d42bhO_omQbuN1jI",
  authDomain: "edusphere-ai-e8622.firebaseapp.com",
  projectId: "edusphere-ai-e8622",
  storageBucket: "edusphere-ai-e8622.firebasestorage.app",
  messagingSenderId: "726353953169",
  appId: "1:726353953169:web:b69317afcc4193bde45a30",
  measurementId: "G-CHDEXYMQL6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);

export default app;