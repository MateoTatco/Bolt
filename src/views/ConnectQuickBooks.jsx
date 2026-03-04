import React, { useState, useEffect } from 'react'
import { Card, Button } from '@/components/ui'
import QuickBooksService from '@/services/QuickBooksService'

/**
 * Simple page to connect Bolt to QuickBooks (OAuth 2.0).
 * After connecting, you are redirected back to the callback page where you can copy the Realm ID.
 * Access: e.g. from Advanced Features or direct /connect-quickbooks (add to nav if desired).
 */
const ConnectQuickBooks = () => {
    const [loading, setLoading] = useState(false)
    const [tokenStatus, setTokenStatus] = useState(null) // { hasToken, realmId } or null

    useEffect(() => {
        QuickBooksService.checkToken()
            .then(setTokenStatus)
            .catch(() => setTokenStatus({ hasToken: false, realmId: null }))
    }, [])

    const handleConnect = async () => {
        setLoading(true)
        try {
            await QuickBooksService.initiateOAuth()
        } catch (err) {
            console.error(err)
            setLoading(false)
        }
    }

    return (
        <div className="max-w-lg mx-auto p-6">
            <Card className="p-6">
                <h1 className="text-xl font-semibold mb-2">Connect QuickBooks</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Connect your QuickBooks company so Bolt can compare costs with Procore. You will be redirected to Intuit to sign in and authorize. After connecting, you’ll see your Realm ID on the next page—save it if you need it for configuration.
                </p>
                {tokenStatus?.hasToken && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-4">
                        QuickBooks is connected{tokenStatus.realmId ? ` (Realm ID: ${tokenStatus.realmId})` : ''}. You can reconnect to switch companies.
                    </p>
                )}
                <Button
                    variant="solid"
                    loading={loading}
                    disabled={loading}
                    onClick={handleConnect}
                >
                    {loading ? 'Redirecting…' : 'Connect to QuickBooks'}
                </Button>
            </Card>
        </div>
    )
}

export default ConnectQuickBooks
