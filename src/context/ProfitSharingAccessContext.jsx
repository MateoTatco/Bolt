import { createContext, useContext, useState, useEffect } from 'react'
import { useSessionUser } from '@/store/authStore'
import { FirebaseDbService } from '@/services/FirebaseDbService'

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

