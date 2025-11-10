import { FirebaseAuthService } from './FirebaseAuthService'
import { FirebaseDbService } from './FirebaseDbService'

export async function apiSignIn(data) {
    const { email, password } = data
    const result = await FirebaseAuthService.signIn(email, password)
    
    if (result.success) {
        const userId = result.user.uid
        
        // Try to load user profile from Firestore
        let userProfile = null
        try {
            const profileResult = await FirebaseDbService.users.getById(userId)
            if (profileResult.success && profileResult.data) {
                userProfile = profileResult.data
            } else {
                // User doesn't exist in Firestore, create it
                await FirebaseDbService.users.upsert(userId, {
                    email: result.user.email,
                    userName: result.user.displayName || email.split('@')[0] || '',
                    firstName: '',
                    phoneNumber: '',
                    avatar: result.user.photoURL || '',
                })
                // Reload the profile
                const newProfileResult = await FirebaseDbService.users.getById(userId)
                if (newProfileResult.success && newProfileResult.data) {
                    userProfile = newProfileResult.data
                }
            }
        } catch (error) {
            console.warn('Could not load/create user profile from Firestore:', error)
        }
        
        return {
            token: result.token,
            user: {
                id: userId,
                email: userProfile?.email || result.user.email,
                userName: userProfile?.userName || result.user.displayName || '',
                firstName: userProfile?.firstName || '',
                phoneNumber: userProfile?.phoneNumber || '',
                avatar: userProfile?.avatar || result.user.photoURL || '',
                displayName: userProfile?.userName || result.user.displayName,
                photoURL: userProfile?.avatar || result.user.photoURL
            }
        }
    } else {
        throw new Error(result.error)
    }
}

export async function apiSignUp(data) {
    const { email, password, displayName } = data
    const result = await FirebaseAuthService.signUp(email, password, displayName)
    
    if (result.success) {
        const userId = result.user.uid
        
        // Create initial user profile in Firestore
        try {
            await FirebaseDbService.users.upsert(userId, {
                email: result.user.email,
                userName: displayName || '',
                firstName: '',
                phoneNumber: '',
                avatar: result.user.photoURL || '',
            })
        } catch (error) {
            console.warn('Could not create user profile in Firestore:', error)
        }
        
        return {
            token: result.token,
            user: {
                id: userId,
                email: result.user.email,
                userName: displayName || '',
                firstName: '',
                phoneNumber: '',
                avatar: result.user.photoURL || '',
                displayName: displayName || result.user.displayName,
                photoURL: result.user.photoURL
            }
        }
    } else {
        throw new Error(result.error)
    }
}

export async function apiSignOut() {
    const result = await FirebaseAuthService.signOut()
    if (!result.success) {
        throw new Error(result.error)
    }
    return { success: true }
}

export async function apiForgotPassword(data) {
    const { email } = data
    const result = await FirebaseAuthService.resetPassword(email)
    
    if (result.success) {
        return { success: true, message: 'Password reset email sent' }
    } else {
        throw new Error(result.error)
    }
}

export async function apiResetPassword(data) {
    // Firebase handles password reset through email link
    // This would typically be handled on the frontend after email verification
    throw new Error('Password reset is handled through email link')
}
