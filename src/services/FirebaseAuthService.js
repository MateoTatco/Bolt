import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail,
    updateProfile
} from 'firebase/auth'
import { auth } from '@/configs/firebase.config'

// Google Auth Provider
const googleProvider = new GoogleAuthProvider()

export const FirebaseAuthService = {
    // Sign in with email and password
    signIn: async (email, password) => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password)
            return {
                success: true,
                user: userCredential.user,
                token: await userCredential.user.getIdToken()
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            }
        }
    },

    // Sign up with email and password
    signUp: async (email, password, displayName) => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password)
            
            // Update display name
            if (displayName) {
                await updateProfile(userCredential.user, { displayName })
            }
            
            return {
                success: true,
                user: userCredential.user,
                token: await userCredential.user.getIdToken()
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            }
        }
    },

    // Sign in with Google
    signInWithGoogle: async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider)
            return {
                success: true,
                user: result.user,
                token: await result.user.getIdToken()
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            }
        }
    },

    // Sign out
    signOut: async () => {
        try {
            await signOut(auth)
            return { success: true }
        } catch (error) {
            return {
                success: false,
                error: error.message
            }
        }
    },

    // Reset password
    resetPassword: async (email) => {
        try {
            await sendPasswordResetEmail(auth, email)
            return { success: true }
        } catch (error) {
            return {
                success: false,
                error: error.message
            }
        }
    },

    // Get current user
    getCurrentUser: () => {
        return auth.currentUser
    },

    // Listen to auth state changes
    onAuthStateChanged: (callback) => {
        return onAuthStateChanged(auth, callback)
    }
}
