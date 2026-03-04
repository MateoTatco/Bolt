import React, { useEffect, useState } from 'react'
import { Card, Button } from '@/components/ui'
import QuickBooksService from '@/services/QuickBooksService'
import { useNavigate } from 'react-router'

/**
 * OAuth 2.0 callback page for QuickBooks (Intuit).
 * URL: /quickbooks-oauth-callback?code=...&realmId=...&state=...
 * Exchanges the code for tokens, stores them in the backend, and shows the realmId so you can copy it.
 */
const QuickBooksOAuthCallback = () => {
    const navigate = useNavigate()
    const [status, setStatus] = useState('exchanging') // exchanging | success | error
    const [realmId, setRealmId] = useState(null)
    const [errorMessage, setErrorMessage] = useState(null)
    const [returnUrl, setReturnUrl] = useState(null)

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search)
        const code = searchParams.get('code')
        if (!code) {
            setStatus('error')
            setErrorMessage('No authorization code in URL. Start the flow from "Connect QuickBooks" first.')
            return
        }

        let cancelled = false
        QuickBooksService.handleOAuthCallback(searchParams)
            .then((result) => {
                if (cancelled) return
                if (result.success) {
                    setStatus('success')
                    setRealmId(result.realmId || null)
                    setReturnUrl(sessionStorage.getItem('quickbooksOAuthReturnUrl') || '/home')
                    sessionStorage.removeItem('quickbooksOAuthReturnUrl')
                } else {
                    setStatus('error')
                    setErrorMessage(result.error || 'Connection failed.')
                }
            })
            .catch((err) => {
                if (cancelled) return
                setStatus('error')
                setErrorMessage(err?.message || err?.details || 'Failed to connect QuickBooks.')
            })

        return () => { cancelled = true }
    }, [])

    const handleGoBack = () => {
        const url = returnUrl || '/home'
        window.history.replaceState({}, document.title, url)
        navigate(url, { replace: true })
    }

    const copyRealmId = () => {
        if (!realmId) return
        navigator.clipboard.writeText(realmId)
    }

    return (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
            <Card className="max-w-md w-full p-6">
                {status === 'exchanging' && (
                    <>
                        <h2 className="text-lg font-semibold mb-2">Connecting to QuickBooks…</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Exchanging authorization code for access. Please wait.
                        </p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <h2 className="text-lg font-semibold mb-2 text-emerald-600 dark:text-emerald-400">
                            QuickBooks connected
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            You can use this in the Cost Reconciliation module. Save this value if you need to configure it elsewhere.
                        </p>
                        {realmId && (
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                    Realm ID (Company ID)
                                </label>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded text-sm break-all">
                                        {realmId}
                                    </code>
                                    <Button size="sm" variant="twoTone" onClick={copyRealmId}>
                                        Copy
                                    </Button>
                                </div>
                            </div>
                        )}
                        <Button variant="solid" onClick={handleGoBack}>
                            Continue to Bolt
                        </Button>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <h2 className="text-lg font-semibold mb-2 text-red-600 dark:text-red-400">
                            Connection failed
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            {errorMessage}
                        </p>
                        <Button variant="solid" onClick={handleGoBack}>
                            Back to Bolt
                        </Button>
                    </>
                )}
            </Card>
        </div>
    )
}

export default QuickBooksOAuthCallback
