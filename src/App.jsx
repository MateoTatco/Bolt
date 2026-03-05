import { BrowserRouter, useLocation, useNavigate } from 'react-router'
import { useEffect } from 'react'
import Theme from '@/components/template/Theme'
import Layout from '@/components/layouts'
import { AuthProvider } from '@/auth'
import { ProfitSharingAccessProvider } from '@/context/ProfitSharingAccessContext'
import Views from '@/views'
import appConfig from './configs/app.config'

if (appConfig.enableMock) {
    import('./mock')
}

// Global OAuth callback handler - routes OAuth callbacks to the appropriate page
function OAuthCallbackHandler() {
    const location = useLocation()
    const navigate = useNavigate()

    useEffect(() => {
        const urlParams = new URLSearchParams(location.search)
        const code = urlParams.get('code')
        const error = urlParams.get('error')
        const realmId = urlParams.get('realmId')

        // Only handle when an OAuth response is present
        if (!code && !error) {
            return
        }

        // If we're already on a target page, don't re-route
        if (location.pathname.includes('project-profitability') || location.pathname.includes('quickbooks-oauth-callback')) {
            return
        }

        // QuickBooks OAuth responses always include a realmId; route those to the QuickBooks callback page
        if (realmId) {
            const redirectPath = `/quickbooks-oauth-callback${location.search}`
            console.log('OAuth callback detected (QuickBooks), redirecting to:', redirectPath)
            navigate(redirectPath, { replace: true })
            return
        }

        // Default OAuth case (e.g. Procore) goes to Project Profitability
        const redirectPath = `/project-profitability${location.search}`
        console.log('OAuth callback detected (default), redirecting to:', redirectPath)
        navigate(redirectPath, { replace: true })
    }, [location, navigate])

    return null
}

function AppContent() {
    return (
        <AuthProvider>
            <ProfitSharingAccessProvider>
                <OAuthCallbackHandler />
                <Layout>
                    <Views />
                </Layout>
            </ProfitSharingAccessProvider>
        </AuthProvider>
    )
}

function App() {
    return (
        <Theme>
            <BrowserRouter>
                <AppContent />
            </BrowserRouter>
        </Theme>
    )
}

export default App
