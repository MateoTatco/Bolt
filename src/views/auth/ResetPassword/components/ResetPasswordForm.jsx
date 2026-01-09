import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import Button from '@/components/ui/Button'
import { FormItem, Form } from '@/components/ui/Form'
import PasswordInput from '@/components/shared/PasswordInput'
import { apiResetPassword } from '@/services/AuthService'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const validationSchema = z
    .object({
        newPassword: z.string()
            .min(1, 'Please enter your password')
            .min(6, 'Password must be at least 6 characters long'),
        confirmPassword: z.string().min(1, 'Confirm Password Required'),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: 'Your passwords do not match',
        path: ['confirmPassword'],
    })

const ResetPasswordForm = (props) => {
    // DEBUG: Log when component mounts
    useEffect(() => {
        console.error('🟢 ResetPasswordForm component mounted');
    }, []);
    
    const [isSubmitting, setSubmitting] = useState(false)
    const navigate = useNavigate()

    const { className, setMessage, setResetComplete, resetComplete, children } =
        props

    const {
        handleSubmit,
        formState: { errors },
        control,
    } = useForm({
        resolver: zodResolver(validationSchema),
        mode: 'onChange', // Validate on change to catch errors early
    })
    
    // DEBUG: Log form state changes (commented to avoid spam on every render)
    // Uncomment if needed for debugging
    // console.error('🔍 Form errors:', errors);
    // console.error('🔍 Form state:', { hasErrors: Object.keys(errors).length > 0 });

    const onResetPassword = async (values) => {
        // VISIBLE TEST: Show error message immediately to confirm function is called
        setMessage?.('🔄 Starting password reset... Please wait.');
        
        // DEBUG: Try multiple ways to log
        console.error('🚨🚨🚨 onResetPassword FUNCTION CALLED 🚨🚨🚨');
        console.log('🚨🚨🚨 onResetPassword FUNCTION CALLED (log) 🚨🚨🚨');
        console.warn('🚨🚨🚨 onResetPassword FUNCTION CALLED (warn) 🚨🚨🚨');
        
        const { newPassword } = values

        // Get token from URL query parameters
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        // DEBUG: Log token extraction
        console.error('🔍 Token extracted from URL:', token ? `${token.substring(0, 20)}...` : 'MISSING');

        // Log to console (use error level so it shows even if console is filtered)
        console.error('🔍 Password reset attempt:', {
            hasToken: !!token,
            tokenLength: token?.length,
            passwordLength: newPassword?.length,
            url: window.location.href
        });

        if (!token) {
            const errorMsg = 'Invalid reset link. Please check your email for a valid reset link.';
            console.error('No token found in URL');
            setMessage?.(errorMsg);
            setSubmitting(false);
            return;
        }

        setSubmitting(true)
        try {
            console.error('🔍 About to call apiResetPassword...');
            const resp = await apiResetPassword({
                password: newPassword,
                token: token,
            })
            console.error('🔍 apiResetPassword returned:', resp);
            
            if (resp && resp.success) {
                console.error('✅ Password reset successful!');
                setSubmitting(false)
                setResetComplete?.(true)
                // Automatically redirect to login after 2 seconds
                setTimeout(() => {
                    navigate('/sign-in')
                }, 2000)
            } else {
                console.error('❌ Password reset returned but success is false:', resp);
                throw new Error(resp?.message || 'Failed to reset password')
            }
        } catch (errors) {
            console.error('❌❌❌ CATCH BLOCK - Password reset error:', errors);
            console.error('❌ Error type:', typeof errors);
            console.error('❌ Error constructor:', errors?.constructor?.name);
            console.error('❌ Error message:', errors?.message);
            console.error('❌ Error code:', errors?.code);
            console.error('❌ Error details:', errors?.details);
            console.error('❌ Error stack:', errors?.stack);
            
            // Extract error message - could be in message property or be the error itself
            let errorMessage = 'Failed to reset password';
            if (errors?.message) {
                errorMessage = errors.message;
            } else if (typeof errors === 'string') {
                errorMessage = errors;
            } else if (errors?.details) {
                errorMessage = errors.details;
            } else if (errors?.code) {
                errorMessage = `Error ${errors.code}: ${errors.message || 'Unknown error'}`;
            }
            
            // Add debug info to error message for visibility
            const debugInfo = errors?.code ? ` (Code: ${errors.code})` : '';
            errorMessage = `${errorMessage}${debugInfo}`;
            
            console.error('❌ Final error message to display:', errorMessage);
            setMessage?.(errorMessage);
            setSubmitting(false)
        }
    }

    return (
        <div className={className}>
            {!resetComplete ? (
                <Form onSubmit={handleSubmit(
                    async (data) => {
                        // Validation passed - call the reset function
                        console.error('✅✅✅ FORM VALIDATION PASSED ✅✅✅');
                        console.error('✅ Form data:', data);
                        try {
                            await onResetPassword(data);
                        } catch (error) {
                            console.error('❌ Error in onResetPassword catch:', error);
                            setMessage?.(error.message || 'Failed to reset password');
                            setSubmitting(false);
                        }
                    },
                    (validationErrors) => {
                        // This callback runs when validation fails
                        console.error('🚨🚨🚨 FORM VALIDATION FAILED 🚨🚨🚨');
                        console.error('🚨 Validation errors:', validationErrors);
                        console.error('🚨 Form errors object:', errors);
                        // Show validation errors to user
                        const firstError = Object.values(validationErrors)[0];
                        if (firstError?.message) {
                            setMessage?.(firstError.message);
                        }
                    }
                )}>
                    <FormItem
                        label="Password"
                        invalid={Boolean(errors.newPassword)}
                        errorMessage={errors.newPassword?.message}
                    >
                        <Controller
                            name="newPassword"
                            control={control}
                            render={({ field }) => (
                                <PasswordInput
                                    autoComplete="off"
                                    placeholder="••••••••••••"
                                    {...field}
                                />
                            )}
                        />
                    </FormItem>
                    <FormItem
                        label="Confirm Password"
                        invalid={Boolean(errors.confirmPassword)}
                        errorMessage={errors.confirmPassword?.message}
                    >
                        <Controller
                            name="confirmPassword"
                            control={control}
                            render={({ field }) => (
                                <PasswordInput
                                    autoComplete="off"
                                    placeholder="Confirm Password"
                                    {...field}
                                />
                            )}
                        />
                    </FormItem>
                    <Button
                        block
                        loading={isSubmitting}
                        variant="solid"
                        type="submit"
                        onClick={(e) => {
                            console.error('🚨🚨🚨 SUBMIT BUTTON CLICKED 🚨🚨🚨');
                            console.error('🚨 Form errors at click:', errors);
                            console.error('🚨 Is submitting:', isSubmitting);
                            console.error('🚨 Current URL:', window.location.href);
                            console.error('🚨 Token in URL:', new URLSearchParams(window.location.search).get('token') ? 'YES' : 'NO');
                            // Don't prevent default - let form handle it
                        }}
                    >
                        {isSubmitting ? 'Submiting...' : 'Submit'}
                    </Button>
                </Form>
            ) : (
                <>{children}</>
            )}
        </div>
    )
}

export default ResetPasswordForm
