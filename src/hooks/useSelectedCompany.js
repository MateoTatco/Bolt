import { useState, useEffect } from 'react'
import { getAuth } from 'firebase/auth'
import { FirebaseDbService } from '@/services/FirebaseDbService'

const SELECTED_COMPANY_STORAGE_KEY = 'profitSharing_selectedCompanyId'

/**
 * Hook to manage the selected company for profit sharing
 * Persists to both localStorage and Firestore user profile
 */
export const useSelectedCompany = () => {
    const [selectedCompanyId, setSelectedCompanyIdState] = useState(null)
    const [loading, setLoading] = useState(true)

    // Load selected company on mount
    useEffect(() => {
        const loadSelectedCompany = async () => {
            try {
                // First, try to get from localStorage
                const localCompanyId = localStorage.getItem(SELECTED_COMPANY_STORAGE_KEY)
                
                // Then, try to get from Firestore user profile
                const auth = getAuth()
                const currentUser = auth.currentUser
                let firestoreCompanyId = null
                
                if (currentUser) {
                    const userResult = await FirebaseDbService.users.getById(currentUser.uid)
                    if (userResult.success && userResult.data?.profitSharingSelectedCompanyId) {
                        firestoreCompanyId = userResult.data.profitSharingSelectedCompanyId
                    }
                }

                // Priority: Firestore > localStorage
                const companyId = firestoreCompanyId || localCompanyId
                
                if (companyId) {
                    setSelectedCompanyIdState(companyId)
                } else {
                    // If no company is selected, try to find or create "Tatco OKC"
                    const companiesResult = await FirebaseDbService.companies.getAll()
                    if (companiesResult.success && companiesResult.data.length > 0) {
                        const tatcoOKC = companiesResult.data.find(c => c.name === 'Tatco OKC')
                        if (tatcoOKC) {
                            await setSelectedCompany(tatcoOKC.id)
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading selected company:', error)
            } finally {
                setLoading(false)
            }
        }

        loadSelectedCompany()
    }, [])

    // Set selected company (persist to both localStorage and Firestore)
    const setSelectedCompany = async (companyId) => {
        try {
            // Update localStorage immediately
            if (companyId) {
                localStorage.setItem(SELECTED_COMPANY_STORAGE_KEY, companyId)
            } else {
                localStorage.removeItem(SELECTED_COMPANY_STORAGE_KEY)
            }

            // Update Firestore user profile
            const auth = getAuth()
            const currentUser = auth.currentUser
            if (currentUser) {
                await FirebaseDbService.users.update(currentUser.uid, {
                    profitSharingSelectedCompanyId: companyId || null
                })
            }

            setSelectedCompanyIdState(companyId)
        } catch (error) {
            console.error('Error setting selected company:', error)
            // Still update local state even if Firestore fails
            if (companyId) {
                localStorage.setItem(SELECTED_COMPANY_STORAGE_KEY, companyId)
            } else {
                localStorage.removeItem(SELECTED_COMPANY_STORAGE_KEY)
            }
            setSelectedCompanyIdState(companyId)
        }
    }

    return {
        selectedCompanyId,
        setSelectedCompany,
        loading
    }
}


