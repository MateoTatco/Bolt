import { FirebaseAuthService } from './FirebaseAuthService'
import { FirebaseDbService } from './FirebaseDbService'
import { USER_ROLES } from '@/constants/roles.constant'

export async function apiSignIn(data) {
    const { email, password } = data
    const result = await FirebaseAuthService.signIn(email, password)
    
    if (result.success) {
        const userId = result.user.uid
        
        // Try to load user profile from Firestore
        let userProfile = null
        const superAdminEmails = ['admin-01@tatco.construction', 'brett@tatco.construction']
        const isSuperAdmin = superAdminEmails.includes(email.toLowerCase())
        
        try {
            const profileResult = await FirebaseDbService.users.getById(userId)
            if (profileResult.success && profileResult.data) {
                userProfile = profileResult.data
                
                // If super admin doesn't have admin role, set it
                if (isSuperAdmin && userProfile.role !== USER_ROLES.ADMIN) {
                    await FirebaseDbService.users.upsert(userId, {
                        role: USER_ROLES.ADMIN,
                    })
                    // Reload the profile to get updated role
                    const updatedProfileResult = await FirebaseDbService.users.getById(userId)
                    if (updatedProfileResult.success && updatedProfileResult.data) {
                        userProfile = updatedProfileResult.data
                    }
                }
            } else {
                // User doesn't exist in Firestore, create it
                const initialRole = isSuperAdmin ? USER_ROLES.ADMIN : null
                await FirebaseDbService.users.upsert(userId, {
                    email: result.user.email,
                    lastName: result.user.displayName || email.split('@')[0] || '', // Use lastName instead of userName
                    firstName: '',
                    avatar: result.user.photoURL || '',
                    role: initialRole, // Set admin role for super admins
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
                uid: userId, // Add uid for compatibility
                email: userProfile?.email || result.user.email,
                userName: userProfile?.userName || userProfile?.lastName || result.user.displayName || '',
                lastName: userProfile?.lastName || userProfile?.userName || result.user.displayName || '',
                firstName: userProfile?.firstName || '',
                phoneNumber: userProfile?.phoneNumber || '',
                avatar: userProfile?.avatar || result.user.photoURL || '',
                displayName: userProfile?.userName || userProfile?.lastName || result.user.displayName,
                photoURL: userProfile?.avatar || result.user.photoURL,
                role: userProfile?.role || null // Include role from Firestore profile
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
