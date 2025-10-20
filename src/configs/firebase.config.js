import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const FirebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAzQ6iaCBwvKXTNBDfGEucNlm3BwYqiC3k",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "tatco-crm.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "tatco-crm",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "tatco-crm.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "758117357297",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:758117357297:web:0529da7ebf6b4c07fd3b50",
}

// Debug: Check if environment variables are loaded
console.log('Environment check:', {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID
})

// Initialize Firebase
const app = initializeApp(FirebaseConfig)

// Initialize Firebase services
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

export default FirebaseConfig
