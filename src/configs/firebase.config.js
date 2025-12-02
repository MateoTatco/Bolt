import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, initializeFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const FirebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAzQ6iaCBwvKXTNBDfGEucNlm3BwYqiC3k",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "tatco-crm.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "tatco-crm",
    // NOTE: storage bucket must be the appspot.com form, not firebasestorage.app
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "tatco-crm.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "758117357297",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:758117357297:web:0529da7ebf6b4c07fd3b50",
}

// Initialize Firebase
const app = initializeApp(FirebaseConfig)

// Initialize Firebase services
export const auth = getAuth(app)
// Use auto-detected long polling to avoid QUIC/HTTP3 proxy issues
export const db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
})
export const storage = getStorage(app)

export default FirebaseConfig
