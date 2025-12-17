import { useState, useEffect } from 'react'
import { useSessionUser } from '@/store/authStore'
import { FirebaseDbService } from '@/services/FirebaseDbService'

// Admin user IDs that always have full access
const SUPER_ADMIN_EMAILS = ['admin-01@tatco.construction', 'brett@tatco.construction']

export const useProfitSharingAccess = () => {
    const user = useSessionUser((state) => state.user)
    const [accessRecords, setAccessRecords] = useState([])
    const [userRole, setUserRole] = useState(null) // 'admin', 'user', or null (no access)
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

            // Check if super admin
            if (userEmail && SUPER_ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
                setHasAccess(true)
                setUserRole('admin')
                setLoading(false)
                return
            }

            // Check profitSharingAccess collection
            const result = await FirebaseDbService.profitSharingAccess.getByUserId(userId)
            
            if (result.success && result.data.length > 0) {
                setAccessRecords(result.data)
                // Get highest role (admin > user)
                const hasAdminAccess = result.data.some(r => r.role === 'admin')
                setUserRole(hasAdminAccess ? 'admin' : 'user')
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
    
    // Helper to check if user can only view
    const isViewOnly = userRole === 'user'

    return {
        hasAccess,
        userRole,
        accessRecords,
        loading,
        canEdit,
        isViewOnly,
        refreshAccess
    }
}

export default useProfitSharingAccess

