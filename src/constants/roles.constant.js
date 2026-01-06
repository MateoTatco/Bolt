// Role-based access control constants
// Each role defines which modules a user can access

import { NOTIFICATION_TYPES } from './notification.constant'

export const USER_ROLES = {
    // Tatco roles
    TATCO_USER: 'tatco_user',
    TATCO_USER_WITH_PROFIT_SHARING: 'tatco_user_profit_sharing',
    
    // FD Construction roles
    FD_CONSTRUCTION_USER: 'fd_construction_user',
    FD_CONSTRUCTION_USER_WITH_PROFIT_SHARING: 'fd_construction_user_profit_sharing',
    
    // On the Mark roles (for future)
    ON_THE_MARK_USER: 'on_the_mark_user',
    ON_THE_MARK_USER_WITH_PROFIT_SHARING: 'on_the_mark_user_profit_sharing',
    
    // Peak Civil roles
    PEAK_CIVIL_USER: 'peak_civil_user',
    PEAK_CIVIL_USER_WITH_PROFIT_SHARING: 'peak_civil_user_profit_sharing',
    
    // Pier Companies roles
    PIER_COMPANIES_USER: 'pier_companies_user',
    PIER_COMPANIES_USER_WITH_PROFIT_SHARING: 'pier_companies_user_profit_sharing',
    
    // Admin role (full access to everything)
    ADMIN: 'admin',
}

// Module identifiers
export const MODULES = {
    CRM: 'crm',
    MASTER_TRACKER: 'masterTracker',
    PROJECT_PROFITABILITY: 'projectProfitability',
    PROFIT_SHARING: 'profitSharing',
}

// Role to modules mapping
export const ROLE_MODULES = {
    [USER_ROLES.TATCO_USER]: [
        MODULES.CRM,
        MODULES.MASTER_TRACKER,
        MODULES.PROJECT_PROFITABILITY,
    ],
    [USER_ROLES.TATCO_USER_WITH_PROFIT_SHARING]: [
        MODULES.CRM,
        MODULES.MASTER_TRACKER,
        MODULES.PROJECT_PROFITABILITY,
        MODULES.PROFIT_SHARING,
    ],
    [USER_ROLES.FD_CONSTRUCTION_USER]: [
        // Currently only profit sharing, but structure allows for future modules
    ],
    [USER_ROLES.FD_CONSTRUCTION_USER_WITH_PROFIT_SHARING]: [
        MODULES.PROFIT_SHARING,
        // Future: Add other FD Construction modules here
    ],
    [USER_ROLES.ON_THE_MARK_USER]: [
        // Future modules
    ],
    [USER_ROLES.ON_THE_MARK_USER_WITH_PROFIT_SHARING]: [
        MODULES.PROFIT_SHARING,
        // Future modules
    ],
    [USER_ROLES.PEAK_CIVIL_USER]: [
        // No access to CRM, Master Tracker, or Project Profitability
        // Future modules can be added here
    ],
    [USER_ROLES.PEAK_CIVIL_USER_WITH_PROFIT_SHARING]: [
        MODULES.PROFIT_SHARING,
        // Future modules can be added here
    ],
    [USER_ROLES.PIER_COMPANIES_USER]: [
        // No access to CRM, Master Tracker, or Project Profitability
        // Future modules can be added here
    ],
    [USER_ROLES.PIER_COMPANIES_USER_WITH_PROFIT_SHARING]: [
        MODULES.PROFIT_SHARING,
        // Future modules can be added here
    ],
    [USER_ROLES.ADMIN]: [
        MODULES.CRM,
        MODULES.MASTER_TRACKER,
        MODULES.PROJECT_PROFITABILITY,
        MODULES.PROFIT_SHARING,
    ],
}

// Role display names for UI
export const ROLE_DISPLAY_NAMES = {
    [USER_ROLES.TATCO_USER]: 'Tatco User',
    [USER_ROLES.TATCO_USER_WITH_PROFIT_SHARING]: 'Tatco User with Profit Sharing',
    [USER_ROLES.FD_CONSTRUCTION_USER]: 'FD Construction User',
    [USER_ROLES.FD_CONSTRUCTION_USER_WITH_PROFIT_SHARING]: 'FD Construction User with Profit Sharing',
    [USER_ROLES.ON_THE_MARK_USER]: 'On the Mark User',
    [USER_ROLES.ON_THE_MARK_USER_WITH_PROFIT_SHARING]: 'On the Mark User with Profit Sharing',
    [USER_ROLES.PEAK_CIVIL_USER]: 'Peak Civil User',
    [USER_ROLES.PEAK_CIVIL_USER_WITH_PROFIT_SHARING]: 'Peak Civil User with Profit Sharing',
    [USER_ROLES.PIER_COMPANIES_USER]: 'Pier Companies User',
    [USER_ROLES.PIER_COMPANIES_USER_WITH_PROFIT_SHARING]: 'Pier Companies User with Profit Sharing',
    [USER_ROLES.ADMIN]: 'Admin',
}

// Helper function to check if a role has access to a module
export const hasModuleAccess = (role, module) => {
    if (!role || !module) return false
    const modules = ROLE_MODULES[role] || []
    return modules.includes(module)
}

// Helper function to check if a role should see the welcome/under construction page
export const shouldShowWelcomePage = (role) => {
    if (!role) return false
    const roles = Array.isArray(role) ? role : [role]
    
    // Roles that should see welcome page (non-Tatco roles without CRM access)
    const welcomePageRoles = [
        USER_ROLES.FD_CONSTRUCTION_USER,
        USER_ROLES.FD_CONSTRUCTION_USER_WITH_PROFIT_SHARING,
        USER_ROLES.ON_THE_MARK_USER,
        USER_ROLES.ON_THE_MARK_USER_WITH_PROFIT_SHARING,
        USER_ROLES.PEAK_CIVIL_USER,
        USER_ROLES.PEAK_CIVIL_USER_WITH_PROFIT_SHARING,
        USER_ROLES.PIER_COMPANIES_USER,
        USER_ROLES.PIER_COMPANIES_USER_WITH_PROFIT_SHARING,
    ]
    
    // If user has any role that should see welcome page, return true
    // But exclude if they also have ADMIN or TATCO roles
    const hasWelcomeRole = roles.some(r => welcomePageRoles.includes(r))
    const hasTatcoRole = roles.some(r => r === USER_ROLES.TATCO_USER || r === USER_ROLES.TATCO_USER_WITH_PROFIT_SHARING)
    const hasAdminRole = roles.some(r => r === USER_ROLES.ADMIN)
    
    // Show welcome page if they have a welcome role and no Tatco/Admin roles
    return hasWelcomeRole && !hasTatcoRole && !hasAdminRole
}

// Helper function to get all modules for a role
export const getModulesForRole = (role) => {
    return ROLE_MODULES[role] || []
}

// Get role options grouped by company for invitation form
export const getRoleOptionsByCompany = () => {
    return [
        {
            label: 'Tatco',
            options: [
                { value: USER_ROLES.TATCO_USER, label: ROLE_DISPLAY_NAMES[USER_ROLES.TATCO_USER] },
                { value: USER_ROLES.TATCO_USER_WITH_PROFIT_SHARING, label: ROLE_DISPLAY_NAMES[USER_ROLES.TATCO_USER_WITH_PROFIT_SHARING] },
            ]
        },
        {
            label: 'FD Construction',
            options: [
                { value: USER_ROLES.FD_CONSTRUCTION_USER, label: ROLE_DISPLAY_NAMES[USER_ROLES.FD_CONSTRUCTION_USER] },
                { value: USER_ROLES.FD_CONSTRUCTION_USER_WITH_PROFIT_SHARING, label: ROLE_DISPLAY_NAMES[USER_ROLES.FD_CONSTRUCTION_USER_WITH_PROFIT_SHARING] },
            ]
        },
        {
            label: 'On the Mark',
            options: [
                { value: USER_ROLES.ON_THE_MARK_USER, label: ROLE_DISPLAY_NAMES[USER_ROLES.ON_THE_MARK_USER] },
                { value: USER_ROLES.ON_THE_MARK_USER_WITH_PROFIT_SHARING, label: ROLE_DISPLAY_NAMES[USER_ROLES.ON_THE_MARK_USER_WITH_PROFIT_SHARING] },
            ]
        },
        {
            label: 'Peak Civil',
            options: [
                { value: USER_ROLES.PEAK_CIVIL_USER, label: ROLE_DISPLAY_NAMES[USER_ROLES.PEAK_CIVIL_USER] },
                { value: USER_ROLES.PEAK_CIVIL_USER_WITH_PROFIT_SHARING, label: ROLE_DISPLAY_NAMES[USER_ROLES.PEAK_CIVIL_USER_WITH_PROFIT_SHARING] },
            ]
        },
        {
            label: 'Pier Companies',
            options: [
                { value: USER_ROLES.PIER_COMPANIES_USER, label: ROLE_DISPLAY_NAMES[USER_ROLES.PIER_COMPANIES_USER] },
                { value: USER_ROLES.PIER_COMPANIES_USER_WITH_PROFIT_SHARING, label: ROLE_DISPLAY_NAMES[USER_ROLES.PIER_COMPANIES_USER_WITH_PROFIT_SHARING] },
            ]
        },
    ]
}

// Flatten role options for Select component
export const getAllRoleOptions = () => {
    const grouped = getRoleOptionsByCompany()
    const allOptions = grouped.flatMap(group => group.options)
    // Add Admin role at the beginning
    return [
        { value: USER_ROLES.ADMIN, label: ROLE_DISPLAY_NAMES[USER_ROLES.ADMIN] },
        ...allOptions
    ]
}

// Role to company mapping for profit sharing
export const ROLE_TO_COMPANY = {
    [USER_ROLES.TATCO_USER]: 'Tatco',
    [USER_ROLES.TATCO_USER_WITH_PROFIT_SHARING]: 'Tatco',
    [USER_ROLES.FD_CONSTRUCTION_USER]: 'FD Construction',
    [USER_ROLES.FD_CONSTRUCTION_USER_WITH_PROFIT_SHARING]: 'FD Construction',
    [USER_ROLES.ON_THE_MARK_USER]: 'On The Mark',
    [USER_ROLES.ON_THE_MARK_USER_WITH_PROFIT_SHARING]: 'On The Mark',
    [USER_ROLES.PEAK_CIVIL_USER]: 'Peak Civil',
    [USER_ROLES.PEAK_CIVIL_USER_WITH_PROFIT_SHARING]: 'Peak Civil',
    [USER_ROLES.PIER_COMPANIES_USER]: 'Pier Companies',
    [USER_ROLES.PIER_COMPANIES_USER_WITH_PROFIT_SHARING]: 'Pier Companies',
    [USER_ROLES.ADMIN]: null, // Admin can see all companies
}

// Get company name for a role (for profit sharing default view)
export const getCompanyForRole = (role) => {
    if (!role) return null
    const roles = Array.isArray(role) ? role : [role]
    
    // If user has admin role, return null (can see all)
    if (roles.includes(USER_ROLES.ADMIN)) {
        return null
    }
    
    // Return the first matching company (users typically have one primary role)
    for (const r of roles) {
        if (ROLE_TO_COMPANY[r]) {
            return ROLE_TO_COMPANY[r]
        }
    }
    
    return null
}

// Get visible notification types for a role
export const getVisibleNotificationTypes = (role) => {
    if (!role) {
        // No role - show all (backward compatibility)
        return Object.values(NOTIFICATION_TYPES || {})
    }
    
    const roles = Array.isArray(role) ? role : [role]
    
    // Tatco roles and admin see all notification types
    const hasTatcoRole = roles.some(r => 
        r === USER_ROLES.TATCO_USER || 
        r === USER_ROLES.TATCO_USER_WITH_PROFIT_SHARING
    )
    const hasAdminRole = roles.some(r => r === USER_ROLES.ADMIN)
    
    if (hasTatcoRole || hasAdminRole) {
        return Object.values(NOTIFICATION_TYPES || {})
    }
    
    // Non-Tatco roles only see profit sharing and system notifications
    // Hide: task notifications, entity notifications (lead/client/project), attachment notifications, activity notifications
    const visibleTypes = []
    
    // Only show profit sharing notifications
    if (typeof NOTIFICATION_TYPES !== 'undefined') {
        if (NOTIFICATION_TYPES.PROFIT_SHARING) {
            visibleTypes.push(NOTIFICATION_TYPES.PROFIT_SHARING)
        }
        if (NOTIFICATION_TYPES.PROFIT_SHARING_ADMIN) {
            visibleTypes.push(NOTIFICATION_TYPES.PROFIT_SHARING_ADMIN)
        }
        if (NOTIFICATION_TYPES.SYSTEM) {
            visibleTypes.push(NOTIFICATION_TYPES.SYSTEM)
        }
    }
    
    return visibleTypes
}

// Backward compatibility exports for legacy code
export const ADMIN = USER_ROLES.ADMIN
export const USER = USER_ROLES.TATCO_USER // Default user role for backward compatibility
