import { BrowserRouter, useLocation, useNavigate } from 'react-router'
import { useEffect } from 'react'
import Theme from '@/components/template/Theme'
import Layout from '@/components/layouts'
import { AuthProvider } from '@/auth'
import Views from '@/views'
import appConfig from './configs/app.config'

if (appConfig.enableMock) {
    import('./mock')
}

// Global OAuth callback handler - redirects to project-profitability if OAuth code is present
function OAuthCallbackHandler() {
    const location = useLocation()
    const navigate = useNavigate()

    useEffect(() => {
        const urlParams = new URLSearchParams(location.search)
        const code = urlParams.get('code')
        const state = urlParams.get('state')
        const error = urlParams.get('error')

        // If we have an OAuth callback (code or error) and we're not on project-profitability, redirect there
        if ((code || error) && !location.pathname.includes('project-profitability')) {
            const redirectPath = `/project-profitability${location.search}`
            console.log('OAuth callback detected on root, redirecting to:', redirectPath)
            navigate(redirectPath, { replace: true })
        }
    }, [location, navigate])

    return null
}

function AppContent() {
    return (
        <AuthProvider>
            <OAuthCallbackHandler />
            <Layout>
                <Views />
            </Layout>
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
