// Role-based access control constants
// Each role defines which modules a user can access

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
    [USER_ROLES.ADMIN]: 'Admin',
}

// Helper function to check if a role has access to a module
export const hasModuleAccess = (role, module) => {
    if (!role || !module) return false
    const modules = ROLE_MODULES[role] || []
    return modules.includes(module)
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

// Backward compatibility exports for legacy code
export const ADMIN = USER_ROLES.ADMIN
export const USER = USER_ROLES.TATCO_USER // Default user role for backward compatibility
