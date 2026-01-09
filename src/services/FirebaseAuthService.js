import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail,
    updateProfile,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential
} from 'firebase/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'
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
    },

    // Update password
    updatePassword: async (currentPassword, newPassword) => {
        try {
            const user = auth.currentUser
            if (!user || !user.email) {
                return {
                    success: false,
                    error: 'No authenticated user found'
                }
            }

            // Re-authenticate user with current password
            const credential = EmailAuthProvider.credential(user.email, currentPassword)
            await reauthenticateWithCredential(user, credential)

            // Update password
            await updatePassword(user, newPassword)

            return { success: true }
        } catch (error) {
            return {
                success: false,
                error: error.message
            }
        }
    },

    // Create user with email and send welcome email with password reset link
    // This is used for admin-created users who need to set their own password
    // Uses Cloud Function to avoid authentication issues
    createUserWithPasswordReset: async (email, displayName) => {
        try {
            // Call Cloud Function to create user and send welcome email
            // This uses Admin SDK so admin stays authenticated
            const functions = getFunctions()
            const createUserFunction = httpsCallable(functions, 'createUser')
            const result = await createUserFunction({ email, displayName })
            
            if (result.data && result.data.success) {
                return {
                    success: true,
                    userId: result.data.userId,
                    email: result.data.email
                }
            } else {
                throw new Error(result.data?.message || 'Failed to create user')
            }
        } catch (error) {
            // Handle specific error codes
            let errorCode = error.code
            if (error.code === 'functions/already-exists' || error.code === 'functions/already-exists') {
                errorCode = 'auth/email-already-in-use'
            }
            
            return {
                success: false,
                error: error.message || 'Failed to create user',
                errorCode: errorCode
            }
        }
    }
}

// Generate a secure random password for new users
// They will receive a password reset email to set their own password
function generateSecurePassword() {
    const length = 16
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    let password = ''
    
    // Ensure at least one of each required character type
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)] // uppercase
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)] // lowercase
    password += '0123456789'[Math.floor(Math.random() * 10)] // number
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)] // special char
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
        password += charset[Math.floor(Math.random() * charset.length)]
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('')
}
