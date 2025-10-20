import { FirebaseAuthService } from './FirebaseAuthService'

export async function apiSignIn(data) {
    const { email, password } = data
    const result = await FirebaseAuthService.signIn(email, password)
    
    if (result.success) {
        return {
            token: result.token,
            user: {
                id: result.user.uid,
                email: result.user.email,
                displayName: result.user.displayName,
                photoURL: result.user.photoURL
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
        return {
            token: result.token,
            user: {
                id: result.user.uid,
                email: result.user.email,
                displayName: result.user.displayName,
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
