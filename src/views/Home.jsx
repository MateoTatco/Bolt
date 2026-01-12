import React from 'react'
import { useSessionUser } from '@/store/authStore'
import { shouldShowWelcomePage, USER_ROLES } from '@/constants/roles.constant'

// Welcome page component for users without CRM access
const WelcomePage = () => {
            return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
            <div className="text-center space-y-6 max-w-2xl">
                <h1 className="text-6xl md:text-7xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                    Welcome To Bolt
                </h1>
                <div className="pt-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 dark:bg-primary/20 rounded-full">
                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            We're building something amazing for you
                        </span>
                    </div>
                </div>
                    </div>
                </div>
            )
        }

// Dashboard/home page for Tatco users
const TatcoHomePage = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
            <div className="text-center space-y-6 max-w-2xl">
                <h1 className="text-6xl md:text-7xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                    Welcome To Bolt
                </h1>
                <div className="pt-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 dark:bg-primary/20 rounded-full">
                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            We're building something amazing for you
                        </span>
        </div>
                        </div>
                        </div>
                            </div>
    )
}

const Home = () => {
    const user = useSessionUser((state) => state.user)
    
    // Check if user should see welcome page (non-Tatco roles)
    const showWelcomePage = shouldShowWelcomePage(user?.role)
    
    // Check if user has Tatco role
    const roles = Array.isArray(user?.role) ? user.role : (user?.role ? [user.role] : [])
    const hasTatcoRole = roles.some(r => r === USER_ROLES.TATCO_USER || r === USER_ROLES.TATCO_USER_WITH_PROFIT_SHARING)
    const hasAdminRole = roles.some(r => r === USER_ROLES.ADMIN)
    
    // Show welcome page for non-Tatco roles, dashboard for Tatco/Admin
    if (showWelcomePage) {
        return <WelcomePage />
    }
    
    // For Tatco users and admins, show dashboard
    if (hasTatcoRole || hasAdminRole) {
        return <TatcoHomePage />
    }
    
    // Fallback to welcome page
    return <WelcomePage />
}

export default Home
