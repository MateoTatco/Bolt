import { useState, useEffect, useCallback } from 'react'
import { getAuth } from 'firebase/auth'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { getCompanyForRole } from '@/constants/roles.constant'

const SELECTED_COMPANY_STORAGE_KEY = 'profitSharing_selectedCompanyId'

/**
 * Hook to manage the selected company for profit sharing
 * Persists to both localStorage and Firestore user profile
 */
export const useSelectedCompany = () => {
    const [selectedCompanyId, setSelectedCompanyIdState] = useState(null)
    const [loading, setLoading] = useState(true)

    // Set selected company (persist to both localStorage and Firestore)
    const setSelectedCompany = useCallback(async (companyId) => {
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
    }, [])

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
                let userRole = null
                let roleCompanyName = null
                
                if (currentUser) {
                    const userResult = await FirebaseDbService.users.getById(currentUser.uid)
                    if (userResult.success && userResult.data) {
                        if (userResult.data.profitSharingSelectedCompanyId) {
                            firestoreCompanyId = userResult.data.profitSharingSelectedCompanyId
                        }
                        if (userResult.data.role) {
                            userRole = userResult.data.role
                            roleCompanyName = getCompanyForRole(userRole)
                        }
                    }
                }

                // Priority: Firestore > localStorage
                let companyId = firestoreCompanyId || localCompanyId
                
                // If user has a role-based company, check if current selection matches
                if (roleCompanyName && companyId) {
                    // Verify the selected company matches the user's role
                    const companiesResult = await FirebaseDbService.companies.getAll()
                    if (companiesResult.success && companiesResult.data.length > 0) {
                        const selectedCompany = companiesResult.data.find(c => c.id === companyId)
                        const roleCompany = companiesResult.data.find(c => {
                            const cName = (c.name || '').toLowerCase().trim()
                            const rName = roleCompanyName.toLowerCase().trim()
                            return cName === rName || 
                                   cName.replace(/\s+/g, ' ') === rName.replace(/\s+/g, ' ') ||
                                   cName.includes(rName) || 
                                   rName.includes(cName)
                        })
                        
                        // If selected company doesn't match role company, update it
                        if (roleCompany && (!selectedCompany || selectedCompany.id !== roleCompany.id)) {
                            companyId = roleCompany.id
                            await setSelectedCompany(companyId)
                            setSelectedCompanyIdState(companyId)
                        } else if (!roleCompany) {
                            // Role company not found, but user has a role - clear selection to force fallback
                            companyId = null
                        }
                    }
                }
                
                if (companyId) {
                    setSelectedCompanyIdState(companyId)
                } else {
                    // If no company is selected, try to auto-select based on user's role
                    if (currentUser && roleCompanyName) {
                        try {
                            // Find company by name (with flexible matching)
                            const companiesResult = await FirebaseDbService.companies.getAll()
                            if (companiesResult.success && companiesResult.data.length > 0) {
                                const roleCompany = companiesResult.data.find(c => {
                                    const cName = (c.name || '').toLowerCase().trim()
                                    const rName = roleCompanyName.toLowerCase().trim()
                                    return cName === rName || 
                                           cName.replace(/\s+/g, ' ') === rName.replace(/\s+/g, ' ') ||
                                           cName.includes(rName) || 
                                           rName.includes(cName)
                                })
                                if (roleCompany) {
                                    companyId = roleCompany.id
                                    await setSelectedCompany(companyId)
                                    setSelectedCompanyIdState(companyId)
                                }
                            }
                        } catch (accessError) {
                            console.warn('Error loading company for auto-select:', accessError)
                        }
                    }
                    
                    // If still no company, try to auto-select from user's profit sharing access records
                    if (!companyId && currentUser) {
                        try {
                            const accessResult = await FirebaseDbService.profitSharingAccess.getByUserId(currentUser.uid)
                            if (accessResult.success && accessResult.data.length > 0) {
                                // Get the first company from their access records
                                const firstAccessRecord = accessResult.data[0]
                                if (firstAccessRecord.companyId) {
                                    companyId = firstAccessRecord.companyId
                                    await setSelectedCompany(companyId)
                                    setSelectedCompanyIdState(companyId)
                                }
                            }
                        } catch (accessError) {
                            console.warn('Error loading access records for auto-select:', accessError)
                        }
                    }
                    
                    // If still no company, try to find "Tatco OKC" as fallback (for backward compatibility)
                    if (!companyId) {
                        const companiesResult = await FirebaseDbService.companies.getAll()
                        if (companiesResult.success && companiesResult.data.length > 0) {
                            const tatcoOKC = companiesResult.data.find(c => 
                                c.name === 'Tatco OKC' || 
                                c.name === 'Tatco' ||
                                c.name?.toLowerCase().includes('tatco')
                            )
                            if (tatcoOKC) {
                                await setSelectedCompany(tatcoOKC.id)
                                setSelectedCompanyIdState(tatcoOKC.id)
                            }
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setSelectedCompany])

    return {
        selectedCompanyId,
        setSelectedCompany,
        loading
    }
}
