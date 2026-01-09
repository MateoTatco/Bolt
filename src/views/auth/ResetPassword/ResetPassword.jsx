import { useState, useEffect } from 'react'
import Alert from '@/components/ui/Alert'
import Button from '@/components/ui/Button'
import ActionLink from '@/components/shared/ActionLink'
import ResetPasswordForm from './components/ResetPasswordForm'
import useTimeOutMessage from '@/utils/hooks/useTimeOutMessage'
import { useNavigate, useLocation } from 'react-router'
import { useAuth } from '@/auth'
import { signOut as firebaseSignOut } from 'firebase/auth'
import { auth } from '@/configs/firebase.config'

export const ResetPasswordBase = ({ signInUrl = '/sign-in' }) => {
    // DEBUG: Log when component mounts
    useEffect(() => {
        console.error('🔵 ResetPasswordBase component mounted');
        console.error('🔵 URL:', window.location.href);
        console.error('🔵 Token in URL:', new URLSearchParams(window.location.search).get('token') ? 'YES' : 'NO');
    }, []);
    
    const [resetComplete, setResetComplete] = useState(false)
    const [message, setMessage] = useTimeOutMessage()
    const navigate = useNavigate()
    const location = useLocation()
    const { authenticated, signOut } = useAuth()

    // If user has a token in URL, ensure they're not auto-authenticated
    // Sign out any existing session so they can set their password
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search)
        const token = searchParams.get('token')
        
        if (token) {
            // User has a reset token - ensure they're signed out so they can set their password
            // This prevents auto-authentication issues
            if (authenticated) {
                const handleSignOut = async () => {
                    try {
                        // Sign out from Firebase Auth
                        await firebaseSignOut(auth)
                        // Sign out from app state
                        await signOut()
                    } catch (error) {
                        console.warn('Error signing out during password reset:', error)
                        // Continue anyway - the reset password form will still work
                    }
                }
                handleSignOut()
            }
        } else if (!resetComplete) {
            // No token and password not yet reset - show error
            setMessage?.('Invalid reset link. Please check your email for a valid reset link with a token.')
        }
    }, [location.search, authenticated, signOut, resetComplete, setMessage])

    const handleContinue = () => {
        navigate(signInUrl)
    }

    return (
        <div>
            <div className="mb-6">
                {resetComplete ? (
                    <>
                        <h3 className="mb-1">Reset done</h3>
                        <p className="font-semibold heading-text">
                            Your password has been successfully reset
                        </p>
                    </>
                ) : (
                    <>
                        <h3 className="mb-1">Set new password</h3>
                        <p className="font-semibold heading-text">
                            Your new password must different to previos password
                        </p>
                    </>
                )}
            </div>
            {message && (
                <Alert showIcon className="mb-4" type="danger">
                    <span className="break-all">{message}</span>
                </Alert>
            )}
            <ResetPasswordForm
                resetComplete={resetComplete}
                setMessage={setMessage}
                setResetComplete={setResetComplete}
            >
                <Button
                    block
                    variant="solid"
                    type="button"
                    onClick={handleContinue}
                >
                    Continue
                </Button>
            </ResetPasswordForm>
            <div className="mt-4 text-center">
                <span>Back to </span>
                <ActionLink
                    to={signInUrl}
                    className="heading-text font-bold"
                    themeColor={false}
                >
                    Sign in
                </ActionLink>
            </div>
        </div>
    )
}

const ResetPassword = () => {
    return <ResetPasswordBase />
}

export default ResetPassword
