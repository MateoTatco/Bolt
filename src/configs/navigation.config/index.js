import {
    NAV_ITEM_TYPE_TITLE,
    NAV_ITEM_TYPE_ITEM,
    NAV_ITEM_TYPE_COLLAPSE,
} from '@/constants/navigation.constant'

// Authorized emails that can access Advanced Features Dashboard
const AUTHORIZED_EMAILS = [
    'admin-01@tatco.construction',
    'brett@tatco.construction'
]

const baseNavigationConfig = [
    {
        key: 'home',
        path: '/home',
        title: 'CRM',
        translateKey: 'nav.home',
        icon: 'home',
        type: NAV_ITEM_TYPE_ITEM,
        authority: [],
        subMenu: [],
    },
    {
        key: 'masterTracker',
        path: '/projects',
        title: 'Master Tracker',
        translateKey: 'nav.masterTracker',
        icon: 'masterTracker',
        type: NAV_ITEM_TYPE_ITEM,
        authority: [],
        subMenu: [],
    },
    {
        key: 'projectProfitability',
        path: '/project-profitability',
        title: 'Project Profitability',
        translateKey: 'nav.projectProfitability',
        icon: 'projectProfitability',
        type: NAV_ITEM_TYPE_ITEM,
        authority: [],
        subMenu: [],
    },
    {
        key: 'profitSharing',
        path: '/profit-sharing',
        title: 'Profit Sharing',
        translateKey: 'nav.profitSharing',
        icon: 'profitSharing',
        type: NAV_ITEM_TYPE_ITEM,
        authority: [],
        subMenu: [],
    },
    {
        key: 'advancedFeatures',
        path: '/advanced-features',
        title: 'Advanced Features Dashboard',
        translateKey: 'nav.advancedFeatures',
        icon: 'advancedFeatures',
        type: NAV_ITEM_TYPE_ITEM,
        authority: [],
        subMenu: [],
    },
]

// Function to get navigation config filtered by user email
export const getNavigationConfig = (userEmail) => {
    const userEmailLower = userEmail?.toLowerCase() || ''
    const isAuthorized = AUTHORIZED_EMAILS.some(email => email.toLowerCase() === userEmailLower)
    
    // Filter out advancedFeatures and profitSharing if user is not authorized
    return baseNavigationConfig.filter(nav => {
        if ((nav.key === 'advancedFeatures' || nav.key === 'profitSharing') && !isAuthorized) {
            return false
        }
        return true
    })
}

// Default export for backward compatibility (will be filtered in components that use it)
const navigationConfig = baseNavigationConfig

export default navigationConfig
