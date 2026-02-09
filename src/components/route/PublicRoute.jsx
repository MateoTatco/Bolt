import { Navigate, Outlet, useLocation } from 'react-router'
import appConfig from '@/configs/app.config'
import { useAuth } from '@/auth'

const { authenticatedEntryPath, unAuthenticatedEntryPath } = appConfig

// Pages that unauthenticated users can access
const ALLOWED_UNAUTHENTICATED_PAGES = [
    '/privacy-policy',
    '/terms-and-conditions',
    '/sign-in',
    '/sign-up',
    '/forgot-password',
    '/reset-password',
]

// Pages that authenticated users can also access from public routes
const ALLOWED_AUTHENTICATED_PUBLIC_PAGES = [
    '/privacy-policy',
    '/terms-and-conditions',
    '/reset-password',
]

const PublicRoute = () => {
    const { authenticated } = useAuth()
    const location = useLocation()

    // If authenticated, allow access to specific public pages, otherwise redirect to home
    if (authenticated && !ALLOWED_AUTHENTICATED_PUBLIC_PAGES.includes(location.pathname)) {
        return <Navigate to={authenticatedEntryPath} />
    }

    // If not authenticated, only allow access to specific pages
    if (!authenticated && !ALLOWED_UNAUTHENTICATED_PAGES.includes(location.pathname)) {
        return <Navigate to={unAuthenticatedEntryPath} />
    }

    return <Outlet />
}

export default PublicRoute

