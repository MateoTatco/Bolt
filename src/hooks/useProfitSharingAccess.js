import { useState, useEffect } from 'react'
import { useSessionUser } from '@/store/authStore'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { USER_ROLES, hasModuleAccess, MODULES } from '@/constants/roles.constant'

// Admin user IDs that always have full access
const SUPER_ADMIN_EMAILS = ['admin-01@tatco.construction', 'brett@tatco.construction']

export const useProfitSharingAccess = () => {
    const user = useSessionUser((state) => state.user)
    const [accessRecords, setAccessRecords] = useState([])
    const [userRole, setUserRole] = useState(null) // 'admin', 'supervisor', 'user', or null (no access)
    const [loading, setLoading] = useState(true)
    const [hasAccess, setHasAccess] = useState(false)

    useEffect(() => {
        // Wait for user to load
        if (user === undefined) {
            return
        }
        
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
                    // For role-based users, check if they have admin role in profit sharing
                    // For now, assign 'user' role - can be enhanced later
                    setUserRole('user')
                    setLoading(false)
                    return
                }
            }

            // LEGACY: Fall back to profitSharingAccess collection for backward compatibility
            const result = await FirebaseDbService.profitSharingAccess.getByUserId(userId)
            
            if (result.success && result.data.length > 0) {
                setAccessRecords(result.data)
                // Get highest role (admin > supervisor > user)
                const hasAdminAccess = result.data.some(r => r.role === 'admin')
                const hasSupervisorAccess = result.data.some(r => r.role === 'supervisor')
                if (hasAdminAccess) {
                    setUserRole('admin')
                } else if (hasSupervisorAccess) {
                    setUserRole('supervisor')
                } else {
                    setUserRole('user')
                }
                setHasAccess(true)
            } else {
                setAccessRecords([])
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

    // Helper to check if user can edit (admin only)
    const canEdit = userRole === 'admin'
    
    // Helper to check if user can only view (user role)
    const isViewOnly = userRole === 'user'
    
    // Helper to check if user is supervisor (can see direct reports)
    const isSupervisor = userRole === 'supervisor'

    return {
        hasAccess,
        userRole,
        accessRecords,
        loading,
        canEdit,
        isViewOnly,
        isSupervisor,
        refreshAccess
    }
}

export default useProfitSharingAccess

