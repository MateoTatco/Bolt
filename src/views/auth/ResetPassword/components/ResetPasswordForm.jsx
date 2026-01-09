import { useState } from 'react'
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
        mode: 'onChange',
    })

    const onResetPassword = async (values) => {
        const { newPassword } = values

        // Get token from URL query parameters
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        if (!token) {
            const errorMsg = 'Invalid reset link. Please check your email for a valid reset link.';
            setMessage?.(errorMsg);
            setSubmitting(false);
            return;
        }

        setSubmitting(true)
        try {
            const resp = await apiResetPassword({
                password: newPassword,
                token: token,
            })
            
            if (resp && resp.success) {
                setSubmitting(false)
                setResetComplete?.(true)
                // Automatically redirect to login after 2 seconds
                setTimeout(() => {
                    navigate('/sign-in')
                }, 2000)
            } else {
                throw new Error(resp?.message || 'Failed to reset password')
            }
        } catch (errors) {
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
            
            setMessage?.(errorMessage);
            setSubmitting(false)
        }
    }

    return (
        <div className={className}>
            {!resetComplete ? (
                <Form onSubmit={handleSubmit(
                    async (data) => {
                        try {
                            await onResetPassword(data);
                        } catch (error) {
                            setMessage?.(error.message || 'Failed to reset password');
                            setSubmitting(false);
                        }
                    },
                    (validationErrors) => {
                        // Show validation errors to user
                        const firstError = Object.values(validationErrors)[0];
                        if (firstError?.message) {
                            setMessage?.(firstError.message);
                        } else {
                            setMessage?.('Please check the form for errors');
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
