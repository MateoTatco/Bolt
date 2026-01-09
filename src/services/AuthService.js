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
    // Custom password reset using Firestore tokens with 48-hour expiration
    console.error('🚨🚨🚨 apiResetPassword CALLED 🚨🚨🚨');
    console.error('🚨 Input data:', { hasPassword: !!data.password, hasToken: !!data.token });
    
    const { password, token } = data;
    
    if (!token) {
        console.error('❌ No token provided');
        throw new Error('Reset token is required');
    }
    
    if (!password) {
        console.error('❌ No password provided');
        throw new Error('New password is required');
    }
    
    try {
        console.error('🔍🔍🔍 STARTING PASSWORD RESET PROCESS 🔍🔍🔍');
        console.error('🔍 Token present:', !!token);
        console.error('🔍 Token length:', token?.length || 0);
        console.error('🔍 Token preview:', token ? `${token.substring(0, 20)}...${token.substring(token.length - 10)}` : 'MISSING');
        console.error('🔍 Password present:', !!password);
        console.error('🔍 Password length:', password?.length || 0);
        
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        console.error('🔍 Firebase functions imported');
        
        // Specify region to match deployed functions (us-central1)
        const functions = getFunctions(undefined, 'us-central1');
        console.error('🔍 Functions instance created for region: us-central1');
        
        const resetPasswordFunction = httpsCallable(functions, 'resetPasswordWithToken');
        console.error('🔍 Callable function created: resetPasswordWithToken');
        
        console.error('🔍 About to call resetPasswordWithToken with:', {
            tokenLength: token?.length,
            passwordLength: password?.length,
            hasToken: !!token,
            hasPassword: !!password
        });
        
        const result = await resetPasswordFunction({ token, newPassword: password });
        
        console.error('✅✅✅ FUNCTION CALL SUCCEEDED ✅✅✅');
        console.error('✅ Result object:', result);
        console.error('✅ Result data:', result.data);
        console.error('✅ Result data type:', typeof result.data);
        
        // Cloud Functions return data in result.data
        if (result && result.data) {
            if (result.data.success) {
                return { success: true, message: result.data.message || 'Password reset successfully' };
            } else {
                // Function returned but with success: false
                throw new Error(result.data.message || 'Failed to reset password');
            }
        } else {
            // No data returned
            throw new Error('No response from server. Please try again.');
        }
    } catch (error) {
        console.error('❌ Password reset error:', error);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error details:', error.details);
        console.error('❌ Full error object:', JSON.stringify(error, null, 2));
        console.error('❌ Error stack:', error.stack);
        
        // Extract error message - Firebase Functions errors can have message in details or message property
        // Firebase Functions errors have the message in error.details, not error.message
        let errorMessage = error.details || error.message || 'Failed to reset password';
        
        // Handle Firebase Functions errors with specific, user-friendly messages
        if (error.code === 'functions/not-found') {
            errorMessage = error.details || 'Invalid or expired reset token. The link may have expired or been used already. Please request a new password reset link.';
        } else if (error.code === 'functions/deadline-exceeded') {
            errorMessage = error.details || 'This reset link has expired. Please request a new password reset link.';
        } else if (error.code === 'functions/failed-precondition') {
            errorMessage = error.details || 'This reset link has already been used. Please request a new password reset link.';
        } else if (error.code === 'functions/invalid-argument') {
            if (errorMessage.includes('Password must be at least')) {
                errorMessage = 'Password must be at least 6 characters long.';
            } else if (errorMessage.includes('Token')) {
                errorMessage = errorMessage; // Keep the specific token error
            } else {
                errorMessage = error.details || errorMessage || 'Invalid password or token. Please check your input.';
            }
        } else if (error.code === 'functions/internal') {
            // Internal errors might have more details
            errorMessage = error.details || error.message || 'An internal error occurred. Please try again or contact support.';
        }
        
        // Create error with the extracted message
        const finalError = new Error(errorMessage);
        finalError.code = error.code;
        finalError.originalError = error;
        throw finalError;
    }
}
