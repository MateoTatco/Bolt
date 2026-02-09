import Logo from '@/components/template/Logo'
import Alert from '@/components/ui/Alert'
import SignInForm from './components/SignInForm'
import ActionLink from '@/components/shared/ActionLink'
import useTimeOutMessage from '@/utils/hooks/useTimeOutMessage'
import { useThemeStore } from '@/store/themeStore'
import { useLocation } from 'react-router'

export const SignInBase = ({
    signUpUrl = '/sign-up',
    forgetPasswordUrl = '/forgot-password',
    disableSubmit,
}) => {
    const [message, setMessage] = useTimeOutMessage()
    const location = useLocation()

    const mode = useThemeStore((state) => state.mode)

    return (
        <>
            <div className="mb-8">
                <Logo
                    type="streamline"
                    mode={mode}
                    imgClass="mx-auto"
                    logoWidth={240}
                />
            </div>
            <div className="mb-10">
                <h2 className="mb-2">Welcome to Bolt!</h2>
                <p className="font-semibold heading-text">
                    Please enter your credentials to sign in!
                </p>
            </div>
            {message && (
                <Alert showIcon className="mb-4" type="danger">
                    <span className="break-all">{message}</span>
                </Alert>
            )}
            <SignInForm
                key={location.pathname}
                disableSubmit={disableSubmit}
                setMessage={setMessage}
                passwordHint={
                    <div className="mb-7 mt-2">
                        <ActionLink
                            to={forgetPasswordUrl}
                            className="font-semibold heading-text mt-2 underline"
                            themeColor={false}
                        >
                            Forgot password
                        </ActionLink>
                    </div>
                }
            />
            <div>
                <div className="mt-6 text-center">
                    <span>{`Don't have an account yet? Get in touch with Tatco.`}</span>
                </div>
            </div>
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <a
                        href="/terms-and-conditions"
                        className="hover:text-primary transition-colors"
                    >
                        Term & Conditions
                    </a>
                    <span className="text-muted"> | </span>
                    <a
                        href="/privacy-policy"
                        className="hover:text-primary transition-colors"
                    >
                        Privacy Policy
                    </a>
                </div>
            </div>
        </>
    )
}

const SignIn = () => {
    return <SignInBase />
}

export default SignIn
