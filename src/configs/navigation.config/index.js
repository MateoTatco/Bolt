import {
    NAV_ITEM_TYPE_TITLE,
    NAV_ITEM_TYPE_ITEM,
    NAV_ITEM_TYPE_COLLAPSE,
} from '@/constants/navigation.constant'
import { MODULES, hasModuleAccess, USER_ROLES } from '@/constants/roles.constant'

// Authorized emails that can access Advanced Features Dashboard
const AUTHORIZED_EMAILS = [
    'admin-01@tatco.construction',
    'brett@tatco.construction'
]

const baseNavigationConfig = [
    {
        key: 'home',
        path: '/home',
        title: 'Home',
        translateKey: 'nav.home',
        icon: 'home',
        type: NAV_ITEM_TYPE_ITEM,
        authority: [],
        subMenu: [],
        module: null, // Home is accessible to all roles
    },
    {
        key: 'crm',
        path: '/crm',
        title: 'CRM',
        translateKey: 'nav.crm',
        icon: 'crm',
        type: NAV_ITEM_TYPE_ITEM,
        authority: [],
        subMenu: [],
        module: MODULES.CRM, // CRM is only for Tatco roles
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
        module: MODULES.MASTER_TRACKER,
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
        module: MODULES.PROJECT_PROFITABILITY,
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
        module: MODULES.PROFIT_SHARING,
    },
    {
        key: 'warrantyTracker',
        path: '/warranty-tracker',
        title: 'Warranty Tracker',
        translateKey: 'nav.warrantyTracker',
        icon: 'warrantyTracker',
        type: NAV_ITEM_TYPE_ITEM,
        authority: [],
        subMenu: [],
        module: MODULES.WARRANTY_TRACKER,
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
        module: null, // Advanced Features is email-based, not role-based
    },
]

// Function to get navigation config filtered by user email, role, and access
export const getNavigationConfig = (userEmail, hasProfitSharingAccess = false, userRole = null) => {
    const userEmailLower = userEmail?.toLowerCase() || ''
    const isAuthorized = AUTHORIZED_EMAILS.some(email => email.toLowerCase() === userEmailLower)
    
    // If user has a role, filter by role-based module access
    // Otherwise, fall back to legacy email-based and profit sharing access checks
    const filtered = baseNavigationConfig.filter(nav => {
        // Ensure nav is a valid object with a key
        if (!nav || !nav.key) {
            return false
        }
        
        // Home is always accessible to all users
        if (nav.key === 'home') {
            return true
        }
        
        // Advanced Features: accessible by authorized emails OR admin role
        if (nav.key === 'advancedFeatures') {
            // Admin role has access - handle both string and array
            if (userRole) {
                const roles = Array.isArray(userRole) ? userRole : [userRole]
                if (roles.includes(USER_ROLES.ADMIN) || roles.includes('admin')) {
                    return true
                }
            }
            // Legacy: authorized emails also have access
            return isAuthorized
        }
        
        // If user has a role, use role-based filtering
        if (userRole) {
            // Handle both single role (string) and multiple roles (array)
            const roles = Array.isArray(userRole) ? userRole : [userRole]
            
            // Admin has access to everything
            if (roles.includes(USER_ROLES.ADMIN)) {
                return true
            }
            
            // If nav item has a module, check if any role has access to that module
            if (nav.module) {
                return roles.some(role => hasModuleAccess(role, nav.module))
            }
            
            // Items without modules (like advancedFeatures) are handled above
            return true
        }
        
        // Legacy behavior: filter by email and profit sharing access
        // This maintains backward compatibility for users without roles
        // Also check if user has role with profit sharing access (even if not in profitSharingAccess collection)
        const userHasRoleBasedProfitSharing = false // Will be checked via hasProfitSharingAccess which now checks roles
        if (nav.key === 'profitSharing' && !hasProfitSharingAccess && !userHasRoleBasedProfitSharing) {
            return false
        }
        
        // For other items, show them (legacy behavior)
        return true
    })
    
    // Ensure we always return an array (never null or undefined)
    return filtered || []
}

// Default export for backward compatibility (will be filtered in components that use it)
const navigationConfig = baseNavigationConfig

export default navigationConfig

