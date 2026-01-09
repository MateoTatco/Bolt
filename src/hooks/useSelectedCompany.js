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
                
                // First, check if user has manually added companies through profit sharing access records
                // If they do, respect their selection and don't force role-based company
                let hasManualAccess = false
                let manualAccessCompanyIds = []
                if (currentUser) {
                    try {
                        const accessResult = await FirebaseDbService.profitSharingAccess.getByUserId(currentUser.uid)
                        if (accessResult.success && accessResult.data.length > 0) {
                            hasManualAccess = true
                            manualAccessCompanyIds = accessResult.data.map(r => r.companyId).filter(Boolean)
                            
                            // If user has explicit company selection AND it's in their manual access, keep it
                            if (companyId && manualAccessCompanyIds.includes(companyId)) {
                                // User has manually selected a company they have access to - respect it
                                setSelectedCompanyIdState(companyId)
                                setLoading(false)
                                return
                            }
                        }
                    } catch (accessError) {
                        console.warn('Error checking manual access records:', accessError)
                    }
                }
                
                // If user has a role-based company, check if current selection matches
                // BUT only apply OKC prioritization if they don't have manual access OR if their selection is not in manual access
                if (roleCompanyName && companyId) {
                    // Skip OKC prioritization if user has manual access to the currently selected company
                    const shouldSkipPrioritization = hasManualAccess && manualAccessCompanyIds.includes(companyId)
                    
                    if (!shouldSkipPrioritization) {
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
                            
                            // For Tatco roles, prioritize OKC over Florida (only if no manual access)
                            if (roleCompanyName.toLowerCase() === 'tatco' && selectedCompany) {
                                const selectedName = (selectedCompany.name || '').toLowerCase()
                                const isFlorida = selectedName.includes('florida')
                                const isOKC = selectedName.includes('okc')
                                
                                // If Florida is selected (even if OKC is also in the name), switch to OKC
                                // BUT only if user doesn't have manual access to Florida
                                if (isFlorida && !isOKC) {
                                    // Check if user has been manually added to Florida
                                    const hasFloridaAccess = manualAccessCompanyIds.some(id => {
                                        const company = companiesResult.data.find(c => c.id === id)
                                        return company && company.name.toLowerCase().includes('florida')
                                    })
                                    
                                    // Only switch to OKC if user hasn't been manually added to Florida
                                    if (!hasFloridaAccess) {
                                        const okcCompany = companiesResult.data.find(c => {
                                            const cName = (c.name || '').toLowerCase().trim()
                                            return (cName.includes('tatco') && cName.includes('okc') && !cName.includes('florida'))
                                        })
                                        
                                        if (okcCompany) {
                                            companyId = okcCompany.id
                                            await setSelectedCompany(companyId)
                                            setSelectedCompanyIdState(companyId)
                                        }
                                    }
                                } else if (!isOKC) {
                                    // If OKC is not in the selected company name, check if OKC exists and prefer it
                                    // BUT only if user doesn't have manual access to the current company
                                    const okcCompany = companiesResult.data.find(c => {
                                        const cName = (c.name || '').toLowerCase().trim()
                                        return (cName.includes('tatco') && cName.includes('okc') && !cName.includes('florida'))
                                    })
                                    
                                    if (okcCompany && okcCompany.id !== companyId) {
                                        // Only switch if current company is not in manual access
                                        if (!manualAccessCompanyIds.includes(companyId)) {
                                            companyId = okcCompany.id
                                            await setSelectedCompany(companyId)
                                            setSelectedCompanyIdState(companyId)
                                        }
                                    }
                                }
                            }
                            
                            // If selected company doesn't match role company, update it
                            // BUT only if user doesn't have manual access to the selected company
                            if (roleCompany && (!selectedCompany || selectedCompany.id !== roleCompany.id)) {
                                // Skip if user has manual access to the current selection
                                if (!manualAccessCompanyIds.includes(companyId)) {
                                    if (companyId !== roleCompany.id) {
                                        companyId = roleCompany.id
                                        await setSelectedCompany(companyId)
                                        setSelectedCompanyIdState(companyId)
                                    }
                                }
                            } else if (!roleCompany) {
                                // Role company not found, but user has a role - clear selection to force fallback
                                // BUT only if no manual access
                                if (!hasManualAccess) {
                                    companyId = null
                                }
                            }
                        }
                    }
                }
                
                // If user has manual access and no explicit selection, prioritize OKC from their access records
                // OR if they have manual access but their current selection is not in their access list
                if (hasManualAccess && (!companyId || !manualAccessCompanyIds.includes(companyId))) {
                    const companiesResult = await FirebaseDbService.companies.getAll()
                    if (companiesResult.success && companiesResult.data.length > 0) {
                        // For Tatco roles, prioritize OKC from their access records
                        if (roleCompanyName && roleCompanyName.toLowerCase() === 'tatco') {
                            // Find OKC company from their access records
                            const okcCompany = companiesResult.data.find(c => {
                                const cName = (c.name || '').toLowerCase().trim()
                                return manualAccessCompanyIds.includes(c.id) &&
                                       cName.includes('okc') && 
                                       !cName.includes('florida')
                            })
                            
                            if (okcCompany) {
                                companyId = okcCompany.id
                                await setSelectedCompany(companyId)
                                setSelectedCompanyIdState(companyId)
                            } else if (manualAccessCompanyIds.length > 0) {
                                // Fallback to first company in their access records
                                companyId = manualAccessCompanyIds[0]
                                await setSelectedCompany(companyId)
                                setSelectedCompanyIdState(companyId)
                            }
                        } else if (manualAccessCompanyIds.length > 0) {
                            // For non-Tatco roles, use first company in their access records
                            companyId = manualAccessCompanyIds[0]
                            await setSelectedCompany(companyId)
                            setSelectedCompanyIdState(companyId)
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
                                // For Tatco roles, prioritize "Tatco Construction OKC" or "Tatco OKC"
                                let roleCompany = null
                                if (roleCompanyName.toLowerCase() === 'tatco') {
                                    // First, try to find "Tatco Construction OKC" or "Tatco OKC"
                                    roleCompany = companiesResult.data.find(c => {
                                        const cName = (c.name || '').toLowerCase().trim()
                                        return cName === 'tatco construction okc' || 
                                               cName === 'tatco okc' ||
                                               (cName.includes('tatco') && cName.includes('okc'))
                                    })
                                    
                                    // If not found, fall back to any Tatco company (but exclude Florida)
                                    if (!roleCompany) {
                                        roleCompany = companiesResult.data.find(c => {
                                            const cName = (c.name || '').toLowerCase().trim()
                                            return (cName.includes('tatco') && !cName.includes('florida'))
                                        })
                                    }
                                    
                                    // Last resort: any Tatco company
                                    if (!roleCompany) {
                                        roleCompany = companiesResult.data.find(c => {
                                            const cName = (c.name || '').toLowerCase().trim()
                                            return cName.includes('tatco')
                                        })
                                    }
                                } else {
                                    // For other companies, use flexible matching
                                    roleCompany = companiesResult.data.find(c => {
                                        const cName = (c.name || '').toLowerCase().trim()
                                        const rName = roleCompanyName.toLowerCase().trim()
                                        return cName === rName || 
                                               cName.replace(/\s+/g, ' ') === rName.replace(/\s+/g, ' ') ||
                                               cName.includes(rName) || 
                                               rName.includes(cName)
                                    })
                                }
                                
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
                                // Get all companies to match names
                                const companiesResult = await FirebaseDbService.companies.getAll()
                                const companiesMap = new Map()
                                if (companiesResult.success) {
                                    companiesResult.data.forEach(c => {
                                        companiesMap.set(c.id, c.name)
                                    })
                                }
                                
                                // For Tatco roles, prioritize OKC over Florida
                                let selectedAccessRecord = null
                                if (roleCompanyName && roleCompanyName.toLowerCase() === 'tatco') {
                                    // Find OKC company first
                                    const okcRecord = accessResult.data.find(r => {
                                        const companyName = companiesMap.get(r.companyId) || ''
                                        return companyName.toLowerCase().includes('okc') && !companyName.toLowerCase().includes('florida')
                                    })
                                    if (okcRecord) {
                                        selectedAccessRecord = okcRecord
                                    } else {
                                        // Fallback to first record
                                        selectedAccessRecord = accessResult.data[0]
                                    }
                                } else {
                                    // For non-Tatco, use first record
                                    selectedAccessRecord = accessResult.data[0]
                                }
                                
                                if (selectedAccessRecord && selectedAccessRecord.companyId) {
                                    companyId = selectedAccessRecord.companyId
                                    await setSelectedCompany(companyId)
                                    setSelectedCompanyIdState(companyId)
                                }
                            }
                        } catch (accessError) {
                            console.warn('Error loading access records for auto-select:', accessError)
                        }
                    }
                    
                    // If still no company, try to auto-select from stakeholder records (prioritize OKC for Tatco)
                    if (!companyId && currentUser && roleCompanyName && roleCompanyName.toLowerCase() === 'tatco') {
                        try {
                            // Get all stakeholders and filter by linkedUserId
                            const stakeholdersResult = await FirebaseDbService.stakeholders.getAll()
                            if (stakeholdersResult.success && stakeholdersResult.data.length > 0) {
                                // Filter stakeholders for this user
                                const userStakeholders = stakeholdersResult.data.filter(sh => sh.linkedUserId === currentUser.uid)
                                
                                if (userStakeholders.length > 0) {
                                    // Get all companies to match names
                                    const companiesResult = await FirebaseDbService.companies.getAll()
                                    const companiesMap = new Map()
                                    if (companiesResult.success) {
                                        companiesResult.data.forEach(c => {
                                            companiesMap.set(c.id, c.name)
                                        })
                                    }
                                    
                                    // Find stakeholder with OKC company first
                                    const okcStakeholder = userStakeholders.find(sh => {
                                        const companyName = companiesMap.get(sh.companyId) || ''
                                        return companyName.toLowerCase().includes('okc') && !companyName.toLowerCase().includes('florida')
                                    })
                                    
                                    if (okcStakeholder && okcStakeholder.companyId) {
                                        companyId = okcStakeholder.companyId
                                        await setSelectedCompany(companyId)
                                        setSelectedCompanyIdState(companyId)
                                    } else if (userStakeholders[0] && userStakeholders[0].companyId) {
                                        // Fallback to first stakeholder's company
                                        companyId = userStakeholders[0].companyId
                                        await setSelectedCompany(companyId)
                                        setSelectedCompanyIdState(companyId)
                                    }
                                }
                            }
                        } catch (stakeholderError) {
                            console.warn('Error loading stakeholders for auto-select:', stakeholderError)
                        }
                    }
                    
                    // If still no company, try to find "Tatco OKC" as fallback (for backward compatibility)
                    if (!companyId) {
                        const companiesResult = await FirebaseDbService.companies.getAll()
                        if (companiesResult.success && companiesResult.data.length > 0) {
                            // For Tatco roles, prioritize OKC
                            let tatcoOKC = null
                            if (roleCompanyName && roleCompanyName.toLowerCase() === 'tatco') {
                                tatcoOKC = companiesResult.data.find(c => {
                                    const cName = (c.name || '').toLowerCase()
                                    return (cName.includes('okc') && !cName.includes('florida')) ||
                                           cName === 'tatco okc' ||
                                           cName === 'tatco construction okc'
                                })
                            }
                            
                            // If not found, fallback to any Tatco company
                            if (!tatcoOKC) {
                                tatcoOKC = companiesResult.data.find(c => 
                                    c.name === 'Tatco OKC' || 
                                    c.name === 'Tatco' ||
                                    c.name?.toLowerCase().includes('tatco')
                                )
                            }
                            
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
