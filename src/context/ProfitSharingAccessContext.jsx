import { createContext, useContext, useState, useEffect } from 'react'
import { useSessionUser } from '@/store/authStore'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { USER_ROLES, hasModuleAccess, MODULES } from '@/constants/roles.constant'

// Super admin emails that always have full access
const SUPER_ADMIN_EMAILS = ['admin-01@tatco.construction', 'brett@tatco.construction']

const ProfitSharingAccessContext = createContext({
    hasAccess: false,
    userRole: null,
    loading: true,
    canEdit: false,
    isViewOnly: false,
    refreshAccess: () => {}
})

export const ProfitSharingAccessProvider = ({ children }) => {
    const user = useSessionUser((state) => state.user)
    const [hasAccess, setHasAccess] = useState(false)
    const [userRole, setUserRole] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (user === undefined) return
        
        if (!user?.id && !user?.uid && !user?.email) {
            setLoading(false)
            setHasAccess(false)
            setUserRole(null)
            return
        }

        loadUserAccess()
    }, [user])

    const loadUserAccess = async () => {
        setLoading(true)
        try {
            const userId = user?.id || user?.uid
            const userEmail = user?.email
            const userRoleFromProfile = user?.role // Get role from user profile

            // Check if super admin (always has access)
            if (userEmail && SUPER_ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
                setHasAccess(true)
                setUserRole('admin')
                setLoading(false)
                return
            }

            // NEW: Check user role from user profile first
            if (userRoleFromProfile) {
                // Handle both single role (string) and multiple roles (array)
                const roles = Array.isArray(userRoleFromProfile) ? userRoleFromProfile : [userRoleFromProfile]
                
                // Admin role has full access
                if (roles.includes(USER_ROLES.ADMIN)) {
                    setHasAccess(true)
                    setUserRole('admin')
                    setLoading(false)
                    return
                }
                
                // Check if any role has profit sharing module access
                const hasProfitSharingAccess = roles.some(role => hasModuleAccess(role, MODULES.PROFIT_SHARING))
                if (hasProfitSharingAccess) {
                    setHasAccess(true)
                    // Determine profit sharing role: if role includes profit sharing, they're a user
                    // For now, all role-based users are 'user' role in profit sharing
                    // (can be enhanced later to differentiate admin/supervisor in profit sharing)
                    setUserRole('user')
                    setLoading(false)
                    return
                }
            }

            // LEGACY: Fall back to profitSharingAccess collection for backward compatibility
            // This handles old users who don't have roles set yet
            const result = await FirebaseDbService.profitSharingAccess.getByUserId(userId)
            
            if (result.success && result.data.length > 0) {
                const hasAdminAccess = result.data.some(r => r.role === 'admin')
                setUserRole(hasAdminAccess ? 'admin' : 'user')
                setHasAccess(true)
            } else {
                setUserRole(null)
                setHasAccess(false)
            }
        } catch (error) {
            console.error('Error loading profit sharing access:', error)
            setHasAccess(false)
            setUserRole(null)
        } finally {
            setLoading(false)
        }
    }

    const refreshAccess = () => {
        loadUserAccess()
    }

    const canEdit = userRole === 'admin'
    const isViewOnly = userRole === 'user'

    return (
        <ProfitSharingAccessContext.Provider value={{
            hasAccess,
            userRole,
            loading,
            canEdit,
            isViewOnly,
            refreshAccess
        }}>
            {children}
        </ProfitSharingAccessContext.Provider>
    )
}

export const useProfitSharingAccessContext = () => useContext(ProfitSharingAccessContext)

export default ProfitSharingAccessContext


