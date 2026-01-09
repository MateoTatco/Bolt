import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Card, Button, Table, Tag, Drawer, Select, DatePicker, Input, Dialog } from '@/components/ui'
import { HiOutlineArrowLeft, HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineInformationCircle, HiOutlineHome, HiOutlineDocumentText, HiOutlineUsers, HiOutlineChartBar, HiOutlineFlag, HiOutlineCog, HiOutlineCheckCircle, HiOutlineEye, HiOutlineDownload, HiOutlineChevronDown, HiOutlineChevronUp } from 'react-icons/hi'
import { useSessionUser } from '@/store/authStore'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { db } from '@/configs/firebase.config'
import { collection, getDocs, doc, updateDoc, getDoc, serverTimestamp, query, orderBy } from 'firebase/firestore'
import React from 'react'
import { Notification, toast } from '@/components/ui'
import { getAllUsers } from '@/utils/userHelper'
import AwardDocumentModal from './components/AwardDocumentModal'
import DocumentPreviewModal from './components/DocumentPreviewModal'
import { useProfitSharingAccess } from '@/hooks/useProfitSharingAccess'
import { useSelectedCompany } from '@/hooks/useSelectedCompany'
import { createNotification } from '@/utils/notificationHelper'
import { NOTIFICATION_TYPES } from '@/constants/notification.constant'
import { generateAwardDocument } from '@/services/DocumentGenerationService'

// Mock data - in real app, this would come from API/Firebase
const mockStakeholderData = {
    1: {
        id: 1,
        name: 'Simon Cox',
        title: 'Director of Business Development',
        email: 'simon@tatco.construction',
        phone: '555-0101',
        employmentStatus: 'Full time',
        payType: 'Salary',
        payAmount: 120000,
        stockAwards: [],
        profitAwards: [],
        totalStockUnits: 2000,
        estimatedFMV: 388200.00,
        totalAwards: 0
    },
    2: {
        id: 2,
        name: 'Chase Gibson',
        title: 'Controller',
        email: 'chase@tatco.construction',
        phone: '555-0102',
        employmentStatus: 'Full time',
        payType: 'Salary',
        payAmount: 95000,
        stockAwards: [],
        profitAwards: [],
        totalStockUnits: 50,
        estimatedFMV: 9705.00,
        totalAwards: 0
    },
    3: {
        id: 3,
        name: 'Jake Bogner',
        title: 'Bogner',
        email: 'jake@tatco.construction',
        phone: '555-0103',
        employmentStatus: 'Full time',
        payType: 'Hourly',
        payAmount: 45,
        stockAwards: [],
        profitAwards: [],
        totalStockUnits: 0,
        estimatedFMV: 0,
        totalAwards: 0
    },
    4: {
        id: 4,
        name: 'Joe Lassiter',
        title: 'Lassiter',
        email: 'joe@tatco.construction',
        phone: '555-0104',
        employmentStatus: 'Part Time',
        payType: 'Hourly',
        payAmount: 35,
        stockAwards: [],
        profitAwards: [],
        totalStockUnits: 0,
        estimatedFMV: 0,
        totalAwards: 0
    },
    5: {
        id: 5,
        name: 'Robb Billy',
        title: 'VP of Business Operations',
        email: 'robb@tatco.construction',
        phone: '555-0105',
        employmentStatus: 'Full time',
        payType: 'Salary',
        payAmount: 150000,
        stockAwards: [
            {
                id: 1,
                awardDate: 'Pending',
                planName: 'MARE Stock',
                awardAmount: 50,
                awardDatePrice: null,
                fullFMV: 9705.00,
                status: 'Draft'
            }
        ],
        profitAwards: [],
        totalStockUnits: 50,
        estimatedFMV: 9705.00,
        totalAwards: 1
    }
}

const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value)
}

const formatNumber = (value) => {
    return new Intl.NumberFormat('en-US').format(value)
}

const StakeholderDetail = () => {
    const navigate = useNavigate()
    const { stakeholderId } = useParams()
    const user = useSessionUser((state) => state.user)
    const { userRole, canEdit, loading: loadingAccess, isSupervisor, accessRecords } = useProfitSharingAccess()
    const { selectedCompanyId } = useSelectedCompany()
    const isAdmin = canEdit || userRole === 'admin'
    const effectiveIsSupervisor = isSupervisor || userRole === 'supervisor'
    const isRegularUser = !isAdmin && !effectiveIsSupervisor
    const [activeTab, setActiveTab] = useState('profit')
    const [stakeholder, setStakeholder] = useState(null)
    const [linkedUserProfile, setLinkedUserProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [isGeneratingAwardDocument, setIsGeneratingAwardDocument] = useState(false)
    const [showNewAwardDrawer, setShowNewAwardDrawer] = useState(false)
    const [showAwardPreview, setShowAwardPreview] = useState(false)
    const [awardPreviewData, setAwardPreviewData] = useState(null)
    const [profitPlans, setProfitPlans] = useState([])
    const [awardFormData, setAwardFormData] = useState({
        planId: null,
        awardDate: new Date(), // Default to current date
        awardStartDate: null,
        awardEndDate: null,
        triggerAmount: 0,
        sharesIssued: '',
    })
    const [editingAwardId, setEditingAwardId] = useState(null)
    const [detailsFormData, setDetailsFormData] = useState({
        name: '',
        email: '',
        phone: '',
        managerId: null,
    })
    const [reinsRole, setReinsRole] = useState('User')
    const [availableUsers, setAvailableUsers] = useState([])
    const [showDocumentModal, setShowDocumentModal] = useState(false)
    const [editingAward, setEditingAward] = useState(null)
    const [selectedPlan, setSelectedPlan] = useState(null)
    const [valuations, setValuations] = useState([])
    const [expandedAwardId, setExpandedAwardId] = useState(null)
    const [selectedPlanForKPIs, setSelectedPlanForKPIs] = useState(null) // Selected plan for KPI calculations
    const justSavedRef = useRef(false) // Flag to prevent loadStakeholder from running right after save
    const savedNameRef = useRef(null) // Store the name we just saved to prevent overwriting
    const lastSavedNameRef = useRef(null) // Store the last saved name to compare against stale data

    // Move loadStakeholder outside useEffect so it can be called from handleAcceptAward
    const loadStakeholder = useCallback(async () => {
            if (!stakeholderId) {
                navigate('/profit-sharing?tab=stakeholders')
                return
            }

            setLoading(true)
            try {
                // Try to load from Firebase first
                const response = await FirebaseDbService.stakeholders.getById(stakeholderId)
                if (response.success) {
                    const data = response.data
                    
                    // Check if this stakeholder belongs to the selected company
                    // If not, and user is non-admin, they might be viewing the wrong stakeholder
                    if (selectedCompanyId && data.companyId !== selectedCompanyId) {
                        // Company mismatch - log warning for debugging
                    }
                    
                    // For non-admin users viewing their own record, merge awards from all their stakeholder records
                    // This ensures they see all their awards regardless of which company's stakeholder record they're viewing
                    if (!isAdmin) {
                        const currentUserId = user?.id || user?.uid
                        if (currentUserId && data.linkedUserId === currentUserId) {
                            try {
                                const allStakeholdersResponse = await FirebaseDbService.stakeholders.getAll()
                                if (allStakeholdersResponse.success) {
                                    const userStakeholders = allStakeholdersResponse.data.filter(
                                        sh => sh.linkedUserId === currentUserId
                                    )
                                    
                                    // Collect all awards from all stakeholder records for this user
                                    const allAwards = []
                                    userStakeholders.forEach(sh => {
                                        if (sh.profitAwards && Array.isArray(sh.profitAwards) && sh.profitAwards.length > 0) {
                                            // Add companyId to each award so we know which company it belongs to
                                            sh.profitAwards.forEach(award => {
                                                allAwards.push({
                                                    ...award,
                                                    _sourceCompanyId: sh.companyId, // Track which company this award came from
                                                    _sourceStakeholderId: sh.id // Track which stakeholder record this came from
                                                })
                                            })
                                        }
                                    })
                                    
                                    if (allAwards.length > 0) {
                                        // Merge awards into the current stakeholder data
                                        // This ensures the user sees all their awards regardless of which company's record they're viewing
                                        data.profitAwards = allAwards
                                    }
                                }
                            } catch (checkError) {
                                console.error('[StakeholderDetail] Error merging awards from other stakeholder records:', checkError)
                            }
                        }
                    }
                    
                    // Check access permissions
                    // Admins can access all records
                    // Supervisors can access their own records + their direct reports (where managerId matches)
                    // Regular users can only access their own records
                    const currentIsAdmin = canEdit || userRole === 'admin'
                    const currentIsSupervisor = effectiveIsSupervisor
                    if (!currentIsAdmin) {
                        const currentUserId = user?.id || user?.uid
                        const isOwnRecord = data.linkedUserId === currentUserId
                        const isDirectReport = currentIsSupervisor && data.managerId === currentUserId
                        
                        if (!isOwnRecord && !isDirectReport) {
                            // User trying to access someone else's record without permission - redirect
                            toast.push(
                                React.createElement(
                                    Notification,
                                    { type: "warning", duration: 2000, title: "Access Denied" },
                                    currentIsSupervisor 
                                        ? "You can only view your own stakeholder information or your direct reports."
                                        : "You can only view your own stakeholder information."
                                )
                            )
                            navigate('/profit-sharing?tab=stakeholders')
                            return
                        }
                    }
                    
                    // Format the stakeholder data to match expected structure
                    // CRITICAL: Don't overwrite stakeholder state if we just saved a different name
                    // This prevents stale database data from reverting user's changes
                    let nameToUse = data.name || ''
                    
                    // Priority 1: If we have a saved name ref, use it (we just saved)
                    if (savedNameRef.current && data.name !== savedNameRef.current) {
                        nameToUse = savedNameRef.current
                    }
                    // Priority 2: If current stakeholder name matches last saved, but database is different, keep current
                    else if (lastSavedNameRef.current && stakeholder?.name === lastSavedNameRef.current && data.name !== lastSavedNameRef.current) {
                        nameToUse = stakeholder.name
                    }
                    // Priority 3: If current stakeholder name is different from database, and we don't have a saved ref,
                    // check if the current name is newer (was set more recently) - if so, keep it
                    else if (stakeholder?.name && stakeholder.name !== data.name && !savedNameRef.current && !lastSavedNameRef.current) {
                        // This is tricky - we don't know which is newer
                        // But if the current name is in the form data, it's likely what the user wants
                        // For now, use database name
                        nameToUse = data.name || ''
                    }
                    // Priority 4: Default - use database name
                    else {
                        nameToUse = data.name || ''
                    }
                    
                    const stakeholderToSet = {
                        id: data.id,
                        name: nameToUse,
                        email: data.email || '',
                        phone: data.phone || '',
                        managerId: data.managerId || null,
                        stockAwards: Array.isArray(data.stockAwards) ? data.stockAwards : [],
                        profitAwards: Array.isArray(data.profitAwards) ? data.profitAwards : [],
                        totalStockUnits: data.mareStock || 0,
                        estimatedFMV: 0, // Calculate this if needed
                        totalAwards: (Array.isArray(data.stockAwards) ? data.stockAwards.length : 0) + (Array.isArray(data.profitAwards) ? data.profitAwards.length : 0),
                        linkedUserId: data.linkedUserId,
                    }
                    
                    
                    // CRITICAL: Always use saved name if it exists and differs from database
                    // This prevents the page title from reverting when loadStakeholder runs after a save
                    const savedName = savedNameRef.current || lastSavedNameRef.current
                    const hasSavedName = savedName !== null && savedName !== ''
                    const databaseNameIsDifferent = hasSavedName && data.name !== savedName
                    
                    // If we have a saved name and database is different, ALWAYS use the saved name
                    // This handles cases where Firebase hasn't propagated the update yet
                    if (databaseNameIsDifferent) {
                        // Always update stakeholder with saved name to ensure title stays correct
                        const stakeholderWithSavedName = {
                            ...stakeholderToSet,
                            name: savedName, // Use saved name instead of database name
                        }
                        setStakeholder(stakeholderWithSavedName)
                        
                        // Still load the linked user profile though
                        if (data.linkedUserId) {
                            try {
                                const userResult = await FirebaseDbService.users.getById(data.linkedUserId)
                                if (userResult.success && userResult.data) {
                                    setLinkedUserProfile(userResult.data)
                                } else {
                                    setLinkedUserProfile(null)
                                }
                            } catch (profileError) {
                                console.warn('Error loading linked user profile for stakeholder detail:', profileError)
                                setLinkedUserProfile(null)
                            }
                        } else {
                            setLinkedUserProfile(null)
                        }
                        return // Exit early, don't update stakeholder state with stale data
                    }
                    
                    // Only update stakeholder if the name actually changed (prevent unnecessary re-renders)
                    if (!stakeholder || stakeholder.name !== nameToUse) {
                        setStakeholder(stakeholderToSet)
                    }

                    // Load linked user profile for display overrides
                    if (data.linkedUserId) {
                        try {
                            const userResult = await FirebaseDbService.users.getById(data.linkedUserId)
                            if (userResult.success && userResult.data) {
                                setLinkedUserProfile(userResult.data)
                            } else {
                                setLinkedUserProfile(null)
                            }
                        } catch (profileError) {
                            console.warn('Error loading linked user profile for stakeholder detail:', profileError)
                            setLinkedUserProfile(null)
                        }
                    } else {
                        setLinkedUserProfile(null)
                    }
                } else {
                    // Fallback to mock data if Firebase fails
                    const mockData = mockStakeholderData[stakeholderId]
                    if (mockData) {
                        setStakeholder(mockData)
                    } else {
                        navigate('/profit-sharing?tab=stakeholders')
                    }
                }
            } catch (error) {
                console.error('Error loading stakeholder:', error)
                // Fallback to mock data
                const mockData = mockStakeholderData[stakeholderId]
                if (mockData) {
                    setStakeholder(mockData)
                } else {
                    navigate('/profit-sharing?tab=stakeholders')
                }
            } finally {
                setLoading(false)
            }
    }, [stakeholderId, navigate, loadingAccess, canEdit, userRole, user, selectedCompanyId, isAdmin, effectiveIsSupervisor])

    useEffect(() => {
        // Wait for access to load before checking permissions
        if (loadingAccess) {
            return
        }
        
        // Skip loading if we just saved (to prevent overwriting the saved data)
        if (justSavedRef.current) {
            return
        }

        loadStakeholder()
        loadProfitPlans()
        loadUsers()
    }, [loadStakeholder, loadingAccess, stakeholderId, selectedCompanyId, isAdmin])

    // Set default selected plan for KPIs when stakeholder loads
    useEffect(() => {
        if (stakeholder && stakeholder.profitAwards && stakeholder.profitAwards.length > 0) {
            // If no plan is selected, select the first award's plan
            if (!selectedPlanForKPIs) {
                const firstAward = stakeholder.profitAwards.find(a => a.planId)
                if (firstAward && firstAward.planId) {
                    setSelectedPlanForKPIs(firstAward.planId)
                }
            }
        }
    }, [stakeholder, selectedPlanForKPIs, selectedCompanyId])

    useEffect(() => {
        if (stakeholder) {
            
            // Extract phone number (remove +1 prefix if present)
            const phoneNumber = stakeholder.phone ? stakeholder.phone.replace(/^\+1/, '') : ''

            // Use stakeholder name directly - don't override with profile name
            // The name set in Add Stakeholder modal should be the one used everywhere
            const displayName = stakeholder.name || stakeholder.email || ''
            
            // CRITICAL FIX: If form data name matches last saved name, but stakeholder name is different (stale),
            // keep the form data name instead of overwriting with stale stakeholder name
            let nameToUse = displayName
            if (lastSavedNameRef.current && 
                detailsFormData.name && 
                detailsFormData.name === lastSavedNameRef.current && 
                stakeholder.name !== lastSavedNameRef.current) {
                nameToUse = detailsFormData.name
            }
            
            const displayPhone = linkedUserProfile?.phoneNumber 
                ? linkedUserProfile.phoneNumber.replace(/^\+1/, '')
                : phoneNumber

            const newFormData = {
                name: nameToUse,
                email: linkedUserProfile?.email || stakeholder.email || '',
                phone: displayPhone,
                managerId: stakeholder.managerId || null,
            }
            setDetailsFormData(newFormData)
            
            // Load role from profitSharingAccess if stakeholder has linkedUserId
            // Otherwise use reinsRole from stakeholder document
            const loadRole = async () => {
                let roleToSet = stakeholder.reinsRole || 'User'
                if (stakeholder.linkedUserId) {
                    try {
                        const accessResult = await FirebaseDbService.profitSharingAccess.getByUserId(stakeholder.linkedUserId)
                        if (accessResult.success && accessResult.data && accessResult.data.length > 0) {
                            // Get highest role (admin > supervisor > user)
                            const hasAdminAccess = accessResult.data.some(r => r.role === 'admin')
                            const hasSupervisorAccess = accessResult.data.some(r => r.role === 'supervisor')
                            if (hasAdminAccess) {
                                roleToSet = 'Admin'
                            } else if (hasSupervisorAccess) {
                                roleToSet = 'Supervisor'
                            } else {
                                roleToSet = 'User'
                            }
                        }
                    } catch (error) {
                        console.error('Error loading profit sharing access for role:', error)
                        // Fall back to reinsRole if access lookup fails
                    }
                }
                setReinsRole(roleToSet)
            }
            
            loadRole()
        }
    }, [stakeholder, linkedUserProfile])

    const loadUsers = async () => {
        try {
            const users = await getAllUsers()
            setAvailableUsers(users)
        } catch (error) {
            console.error('Error loading users:', error)
        }
    }

    const loadProfitPlans = async () => {
        try {
            const plansRef = collection(db, 'profitSharingPlans')
            const querySnapshot = await getDocs(plansRef)
            const plansData = []
            querySnapshot.forEach((doc) => {
                const data = doc.data()
                // For admins, load all plans globally; for non-admins, only from selected company
                if (isAdmin || data.companyId === selectedCompanyId) {
                    plansData.push({ 
                        value: doc.id, 
                        label: data.name || 'Unnamed Plan',
                        status: data.status || 'draft',
                        ...data 
                    })
                }
            })
            setProfitPlans(plansData)
        } catch (error) {
            console.error('Error loading profit plans:', error)
        }
    }

    const loadValuations = useCallback(async () => {
        if (!selectedCompanyId) {
            setValuations([])
            return
        }
        
        try {
            // Get all companies user belongs to (for non-admin users)
            // IMPORTANT: Check both accessRecords AND stakeholder records to ensure
            // users see valuations for all companies where they have awards
            let companyIdsToLoad = [selectedCompanyId]
            if (!isAdmin) {
                const currentUserId = user?.id || user?.uid
                const accessRecordCompanyIds = accessRecords?.map(record => record.companyId).filter(Boolean) || []
                let stakeholderCompanyIds = []
                
                // Also get company IDs from stakeholder records (where user has awards)
                if (currentUserId) {
                    try {
                        const stakeholdersResponse = await FirebaseDbService.stakeholders.getAll()
                        if (stakeholdersResponse.success) {
                            const userStakeholders = stakeholdersResponse.data.filter(
                                sh => sh.linkedUserId === currentUserId
                            )
                            
                            // Get unique company IDs from ALL stakeholder records (even without awards)
                            userStakeholders.forEach(sh => {
                                if (sh.companyId && !stakeholderCompanyIds.includes(sh.companyId)) {
                                    stakeholderCompanyIds.push(sh.companyId)
                                }
                            })
                        }
                    } catch (stakeholderError) {
                        console.error('[StakeholderDetail] Error loading stakeholder records for valuations:', stakeholderError)
                    }
                }
                
                // Combine all sources: access records, stakeholder records, and selected company
                const allCompanyIds = [...new Set([...accessRecordCompanyIds, ...stakeholderCompanyIds, selectedCompanyId])]
                companyIdsToLoad = allCompanyIds
            }
            
            const valuationsRef = collection(db, 'valuations')
            const q = query(valuationsRef, orderBy('valuationDate', 'desc'))
            const querySnapshot = await getDocs(q)
            const valuationsData = []
            
            querySnapshot.forEach((doc) => {
                const data = doc.data()
                
                // For admins, load all valuations; for non-admins, filter by company
                if (isAdmin || (companyIdsToLoad && companyIdsToLoad.includes(data.companyId))) {
                    valuationsData.push({
                        id: doc.id,
                        ...data,
                        valuationDate: data.valuationDate?.toDate ? data.valuationDate.toDate() : (data.valuationDate ? new Date(data.valuationDate) : null),
                    })
                }
            })
            
            setValuations(valuationsData)
        } catch (error) {
            console.error('Error loading valuations:', error)
            setValuations([])
        }
    }, [selectedCompanyId, isAdmin, accessRecords, user])
    
    // Load valuations when selectedCompanyId changes
    useEffect(() => {
        if (selectedCompanyId) {
            loadValuations()
        } else {
            setValuations([])
        }
    }, [selectedCompanyId, loadValuations])

    // Calculate payouts for a specific award
    const calculateAwardPayouts = (award, includeEstimated = false) => {
        if (!award || !award.planId || !award.sharesIssued) return []
        
        const awardStart = award.awardStartDate ? new Date(award.awardStartDate) : null
        const awardEnd = award.awardEndDate ? new Date(award.awardEndDate) : null
        
        if (!awardStart || !awardEnd) return []
        
        return valuations
            .filter(v => {
                if (!v.valuationDate || v.planId !== award.planId) return false
                // For payout history, only include actual profits (not estimated)
                if (!includeEstimated && v.profitType !== 'actual') return false
                const valDate = v.valuationDate instanceof Date ? v.valuationDate : new Date(v.valuationDate)
                return valDate >= awardStart && valDate <= awardEnd
            })
            .map(v => {
                const pricePerShare = v.pricePerShare || (v.profitAmount && v.totalShares ? v.profitAmount / v.totalShares : 0)
                const payout = (award.sharesIssued || 0) * pricePerShare
                return {
                    valuationId: v.id,
                    profitDate: v.valuationDate,
                    profitAmount: v.profitAmount || v.fmv || 0,
                    profitType: v.profitType || 'actual',
                    pricePerShare,
                    sharesIssued: award.sharesIssued || 0,
                    payout,
                }
            })
            .sort((a, b) => {
                const aDate = a.profitDate?.getTime() || 0
                const bDate = b.profitDate?.getTime() || 0
                return bDate - aDate // Most recent first
            })
    }

    const formatCurrencyInput = (value) => {
        const numericValue = value.replace(/[^0-9.]/g, '')
        if (!numericValue) return ''
        const num = parseFloat(numericValue)
        if (isNaN(num)) return ''
        return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    }

    const handleAwardInputChange = (field, value) => {
        if (field === 'triggerAmount') {
            const sanitized = value.replace(/[^0-9.]/g, '')
            const numValue = sanitized ? parseFloat(sanitized.replace(/,/g, '')) : 0
            setAwardFormData(prev => ({ ...prev, [field]: numValue }))
        } else if (field === 'sharesIssued') {
            const sanitized = value.replace(/[^0-9]/g, '')
            setAwardFormData(prev => ({ ...prev, [field]: sanitized }))
        } else {
            setAwardFormData(prev => ({ ...prev, [field]: value }))
        }
    }

    const isAwardFormComplete = () => {
        return (
            awardFormData.planId &&
            awardFormData.awardStartDate &&
            awardFormData.awardEndDate &&
            awardFormData.triggerAmount > 0 &&
            awardFormData.sharesIssued && parseInt(awardFormData.sharesIssued, 10) > 0
        )
    }

    const handleSaveDetails = async () => {
        try {
            if (!stakeholderId) return

            const stakeholderRef = doc(db, 'stakeholders', stakeholderId)

            // Ensure name is saved - trim whitespace and validate
            const nameToSave = (detailsFormData.name || '').trim()
            
            // Set flag and store saved name BEFORE saving to prevent loadStakeholder from overwriting
            justSavedRef.current = true
            savedNameRef.current = nameToSave // Store the name we're saving (temporary, cleared after 10s)
            lastSavedNameRef.current = nameToSave // Store permanently until next save
            
            if (!nameToSave) {
                toast.push(
                    React.createElement(
                        Notification,
                        { type: "danger", duration: 2000, title: "Error" },
                        "Full name is required"
                    )
                )
                return
            }

            await updateDoc(stakeholderRef, {
                name: nameToSave, // Save the name from form data
                email: detailsFormData.email,
                phone: detailsFormData.phone ? `+1${detailsFormData.phone}` : '',
                managerId: detailsFormData.managerId || null,
                updatedAt: serverTimestamp(),
            })
            
            // Optimistically update both stakeholder state and form data immediately
            // This prevents the form from reverting before the reload completes
            if (stakeholder) {
                const updatedStakeholder = {
                    ...stakeholder,
                    name: nameToSave, // Update name immediately
                    email: detailsFormData.email,
                    phone: detailsFormData.phone ? `+1${detailsFormData.phone}` : stakeholder.phone,
                    managerId: detailsFormData.managerId || null,
                }
                setStakeholder(updatedStakeholder)
                
                // Also update form data immediately to prevent useEffect from overwriting
                const newFormData = {
                    ...detailsFormData,
                    name: nameToSave,
                    email: detailsFormData.email,
                    phone: detailsFormData.phone || detailsFormData.phone,
                    managerId: detailsFormData.managerId || null,
                }
                setDetailsFormData(newFormData)
            }

            toast.push(
                React.createElement(
                    Notification,
                    { type: "success", duration: 2000, title: "Success" },
                    "Stakeholder details saved successfully"
                )
            )

            // Don't reload from database immediately - the optimistic update is sufficient
            // The database will be reloaded on next page load or when loadStakeholder runs naturally
            // This prevents race conditions where stale data overwrites the saved value
            
            // Reset the flag after a delay to allow any pending useEffect calls to complete
            // Keep the savedNameRef for longer to prevent stale data from overwriting
            setTimeout(() => {
                justSavedRef.current = false
            }, 3000)
            
            // Clear savedNameRef after a longer delay (10 seconds should be enough for Firestore to propagate)
            // But keep lastSavedNameRef permanently until next save
            setTimeout(() => {
                savedNameRef.current = null
            }, 10000)
        } catch (error) {
            console.error('[StakeholderDetail] Error saving details:', error)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "danger", duration: 2000, title: "Error" },
                    "Failed to save stakeholder details"
                )
            )
        }
    }

    const handleSavePermissions = async () => {
        try {
            if (!stakeholderId) return

            const stakeholderRef = doc(db, 'stakeholders', stakeholderId)

            // Save reinsRole to stakeholder document
            await updateDoc(stakeholderRef, {
                reinsRole: reinsRole,
                updatedAt: serverTimestamp(),
            })

            // Also update profitSharingAccess records if stakeholder has linkedUserId
            if (stakeholder?.linkedUserId) {
                try {
                    // Convert role format: Admin -> admin, Supervisor -> supervisor, User -> user
                    const accessRole = reinsRole === 'Admin' ? 'admin' : 
                                     reinsRole === 'Supervisor' ? 'supervisor' : 'user'
                    
                    // Get all access records for this user
                    const accessResult = await FirebaseDbService.profitSharingAccess.getByUserId(stakeholder.linkedUserId)
                    if (accessResult.success && accessResult.data && accessResult.data.length > 0) {
                        // Update all access records for this user
                        await Promise.all(
                            accessResult.data.map(access => 
                                FirebaseDbService.profitSharingAccess.update(access.id, {
                                    role: accessRole
                                })
                            )
                        )
                    }
                } catch (accessError) {
                    console.error('Error updating profit sharing access records:', accessError)
                    // Don't fail the whole operation if access update fails
                }
            }

            toast.push(
                React.createElement(
                    Notification,
                    { type: "success", duration: 2000, title: "Success" },
                    "Permissions saved successfully"
                )
            )

            // Reload stakeholder data
            const response = await FirebaseDbService.stakeholders.getById(stakeholderId)
            if (response.success) {
                const data = response.data
                // Use saved name if it exists and differs from database (prevents stale data from overwriting)
                const nameToUse = (lastSavedNameRef.current && data.name !== lastSavedNameRef.current) 
                    ? lastSavedNameRef.current 
                    : (stakeholder?.name || data.name || '')
                setStakeholder({
                    ...stakeholder,
                    name: nameToUse, // Preserve saved name
                    reinsRole: data.reinsRole || 'User',
                })
            }
        } catch (error) {
            console.error('Error saving permissions:', error)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "danger", duration: 2000, title: "Error" },
                    "Failed to save permissions"
                )
            )
        }
    }

    const handleDeleteAwardDocument = async () => {
        if (!editingAward || !stakeholderId) return

        try {
            const stakeholderRef = doc(db, 'stakeholders', stakeholderId)
            const currentData = await FirebaseDbService.stakeholders.getById(stakeholderId)
            
            if (!currentData.success) {
                throw new Error('Failed to load stakeholder data')
            }

            const existingAwards = currentData.data.profitAwards || []
            const updatedAwards = existingAwards.map(a => 
                a.id === editingAward.id 
                    ? { ...a, documentUrl: null, documentStoragePath: null, documentFileName: null }
                    : a
            )

            await updateDoc(stakeholderRef, {
                profitAwards: updatedAwards,
                updatedAt: serverTimestamp(),
            })

            // Update local state
            setEditingAward({
                ...editingAward,
                documentUrl: null,
                documentStoragePath: null,
                documentFileName: null
            })

            toast.push(
                React.createElement(
                    Notification,
                    { type: "success", duration: 2000, title: "Success" },
                    "Document deleted successfully"
                )
            )
        } catch (error) {
            console.error('Error deleting document:', error)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "danger", duration: 2000, title: "Error" },
                    "Failed to delete document"
                )
            )
        }
    }

    const handleDeleteAward = async (awardId) => {
        // Only admins can delete awards
        if (!isAdmin) {
            toast.push(
                React.createElement(
                    Notification,
                    { type: "warning", duration: 2000, title: "Access Denied" },
                    "You do not have permission to delete awards."
                )
            )
            return
        }
        
        if (!window.confirm('Are you sure you want to delete this award?')) {
            return
        }

        try {
            if (!stakeholderId) return

            const stakeholderRef = doc(db, 'stakeholders', stakeholderId)
            const currentData = await FirebaseDbService.stakeholders.getById(stakeholderId)
            
            if (!currentData.success) {
                throw new Error('Failed to load stakeholder data')
            }

            const existingAwards = currentData.data.profitAwards || []
            const updatedAwards = existingAwards.filter(a => a.id !== awardId)

            await updateDoc(stakeholderRef, {
                profitAwards: updatedAwards,
                updatedAt: serverTimestamp(),
            })

            toast.push(
                React.createElement(
                    Notification,
                    { type: "success", duration: 2000, title: "Success" },
                    "Award deleted successfully"
                )
            )

            // Reload stakeholder data
            const response = await FirebaseDbService.stakeholders.getById(stakeholderId)
            if (response.success) {
                const data = response.data
                // Use saved name if it exists and differs from database (prevents stale data from overwriting)
                const nameToUse = (lastSavedNameRef.current && data.name !== lastSavedNameRef.current) 
                    ? lastSavedNameRef.current 
                    : (data.name || '')
                setStakeholder({
                    id: data.id,
                    name: nameToUse,
                    email: data.email || '',
                    phone: data.phone || '',
                    managerId: data.managerId || null,
                    stockAwards: data.stockAwards || [],
                    profitAwards: data.profitAwards || [],
                    totalStockUnits: data.mareStock || 0,
                    estimatedFMV: 0,
                    totalAwards: (data.stockAwards?.length || 0) + (data.profitAwards?.length || 0),
                    reinsRole: data.reinsRole || 'User',
                    linkedUserId: data.linkedUserId,
                })
            }

            // Notify stakeholders list to refresh
            window.dispatchEvent(new Event('stakeholdersUpdated'))
        } catch (error) {
            console.error('Error deleting award:', error)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "danger", duration: 2000, title: "Error" },
                    "Failed to delete award"
                )
            )
        }
    }

    const handleIssueAward = async (awardId) => {
        if (!isAdmin) return
        
        try {
            if (!stakeholderId) return

            const stakeholderRef = doc(db, 'stakeholders', stakeholderId)
            const currentData = await FirebaseDbService.stakeholders.getById(stakeholderId)
            
            if (!currentData.success) {
                throw new Error('Failed to load stakeholder data')
            }

            const existingAwards = currentData.data.profitAwards || []
            const awardIndex = existingAwards.findIndex(a => a.id === awardId)
            
            if (awardIndex === -1) {
                throw new Error('Award not found')
            }

            const award = existingAwards[awardIndex]
            const currentStatus = award.status?.toLowerCase() || 'draft'
            
            // Only allow issuing draft awards
            if (currentStatus !== 'draft' && currentStatus !== 'Draft') {
                toast.push(
                    React.createElement(
                        Notification,
                        { type: "warning", duration: 2000, title: "Invalid Status" },
                        "Only draft awards can be issued"
                    )
                )
                return
            }

            // Get admin name
            const adminName = user?.firstName || user?.userName || user?.name || user?.email || 'Admin'

            const updatedAward = {
                ...award,
                status: 'issued',
                issuedBy: adminName,
                issuedAt: new Date().toISOString(),
            }

            const updatedAwards = existingAwards.map((a, idx) => 
                idx === awardIndex ? updatedAward : a
            )

            await updateDoc(stakeholderRef, {
                profitAwards: updatedAwards,
                updatedAt: serverTimestamp(),
            })

            toast.push(
                React.createElement(
                    Notification,
                    { type: "success", duration: 2000, title: "Success" },
                    "Award issued successfully"
                )
            )

            // Notify the stakeholder user if they have a linked account
            if (currentData.data?.linkedUserId) {
                try {
                    await createNotification({
                        userId: currentData.data.linkedUserId,
                        type: NOTIFICATION_TYPES.PROFIT_SHARING,
                        title: 'New Award to Accept',
                        message: `A new profit sharing award has been issued for you. Please review and accept it.`,
                        entityType: 'profit_sharing',
                        entityId: stakeholderId,
                        relatedUserId: user?.id || user?.uid || null,
                        metadata: {
                            stakeholderId,
                            awardId,
                        },
                    })
                } catch (notifyError) {
                    console.error('Error creating notification:', notifyError)
                }
            }

            // Reload stakeholder data
            const response = await FirebaseDbService.stakeholders.getById(stakeholderId)
            if (response.success) {
                const data = response.data
                // Use saved name if it exists and differs from database (prevents stale data from overwriting)
                const nameToUse = (lastSavedNameRef.current && data.name !== lastSavedNameRef.current) 
                    ? lastSavedNameRef.current 
                    : (data.name || '')
                setStakeholder({
                    id: data.id,
                    name: nameToUse,
                    email: data.email || '',
                    phone: data.phone || '',
                    managerId: data.managerId || null,
                    stockAwards: data.stockAwards || [],
                    profitAwards: data.profitAwards || [],
                    totalStockUnits: data.mareStock || 0,
                    estimatedFMV: 0,
                    totalAwards: (data.stockAwards?.length || 0) + (data.profitAwards?.length || 0),
                    reinsRole: data.reinsRole || 'User',
                    linkedUserId: data.linkedUserId,
                })
            }

            window.dispatchEvent(new Event('stakeholdersUpdated'))
        } catch (error) {
            console.error('Error issuing award:', error)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "danger", duration: 2000, title: "Error" },
                    "Failed to issue award"
                )
            )
        }
    }

    const handleAcceptAward = async (awardId) => {
        try {
            if (!stakeholderId) return

            // First, check if the award is in the current stakeholder record
            let targetStakeholderId = stakeholderId
            let targetStakeholderRef = doc(db, 'stakeholders', stakeholderId)
            let currentData = await FirebaseDbService.stakeholders.getById(stakeholderId)
            
            if (!currentData.success) {
                throw new Error('Failed to load stakeholder data')
            }

            let existingAwards = currentData.data.profitAwards || []
            let awardIndex = existingAwards.findIndex(a => a.id === awardId)
            
            // If award not found in current stakeholder, check if it's from a merged award
            // (merged awards have _sourceStakeholderId property)
            if (awardIndex === -1) {
                // Check if the award exists in the current stakeholder's merged awards
                const mergedAward = stakeholder?.profitAwards?.find(a => a.id === awardId)
                if (mergedAward && mergedAward._sourceStakeholderId) {
                    // Award is from a different stakeholder record, update that record instead
                    targetStakeholderId = mergedAward._sourceStakeholderId
                    targetStakeholderRef = doc(db, 'stakeholders', targetStakeholderId)
                    currentData = await FirebaseDbService.stakeholders.getById(targetStakeholderId)
                    
                    if (!currentData.success) {
                        throw new Error('Failed to load source stakeholder data')
                    }
                    
                    existingAwards = currentData.data.profitAwards || []
                    awardIndex = existingAwards.findIndex(a => a.id === awardId)
                }
            }
            
            if (awardIndex === -1) {
                throw new Error('Award not found')
            }

            const award = existingAwards[awardIndex]
            const currentStatus = award.status?.toLowerCase() || 'draft'
            
            // Only allow accepting issued awards
            if (currentStatus !== 'issued' && currentStatus !== 'Issued') {
                toast.push(
                    React.createElement(
                        Notification,
                        { type: "warning", duration: 2000, title: "Invalid Status" },
                        "Only issued awards can be accepted"
                    )
                )
                return
            }

            // Get user name
            const userName = user?.firstName || user?.lastName || user?.userName || user?.name || user?.email || 'User'

            const updatedAward = {
                ...award,
                status: 'finalized',
                acceptedBy: userName,
                acceptedAt: new Date().toISOString(),
            }

            const updatedAwards = existingAwards.map((a, idx) => 
                idx === awardIndex ? updatedAward : a
            )

            await updateDoc(targetStakeholderRef, {
                profitAwards: updatedAwards,
                updatedAt: serverTimestamp(),
            })

            toast.push(
                React.createElement(
                    Notification,
                    { type: "success", duration: 2000, title: "Success" },
                    "Award accepted successfully"
                )
            )

            // Reload stakeholder data (this will trigger the merge logic if needed)
            // If award was in a different stakeholder record, the merge will pick it up on reload
            loadStakeholder()

            window.dispatchEvent(new Event('stakeholdersUpdated'))
        } catch (error) {
            console.error('Error accepting award:', error)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "danger", duration: 2000, title: "Error" },
                    "Failed to accept award"
                )
            )
        }
    }

    const handleEditAward = async (award) => {
        // Only admins can edit awards (supervisors can view but not edit)
        if (!isAdmin) {
            toast.push(
                React.createElement(
                    Notification,
                    { type: "warning", duration: 2000, title: "Access Denied" },
                    "You can only view award details. Contact an administrator to make changes."
                )
            )
            return
        }
        
        setEditingAwardId(award.id)
        setEditingAward(award)
        
        // Helper to safely parse date
        const parseDate = (dateValue) => {
            if (!dateValue) return null
            const date = dateValue instanceof Date ? dateValue : new Date(dateValue)
            return isNaN(date.getTime()) ? null : date
        }
        
        // Get awardDate, fallback to awardStartDate, then current date
        let awardDate = parseDate(award.awardDate)
        if (!awardDate && award.awardStartDate) {
            awardDate = parseDate(award.awardStartDate)
        }
        if (!awardDate) {
            awardDate = new Date()
        }
        
        setAwardFormData({
            planId: award.planId || null,
            awardDate: awardDate,
            awardStartDate: parseDate(award.awardStartDate),
            awardEndDate: parseDate(award.awardEndDate),
            triggerAmount: award.triggerAmount || award.milestoneAmount || 0, // Backward compatibility
            sharesIssued: award.sharesIssued ? String(award.sharesIssued) : '',
        })
        
        // Load the plan to check its status
        if (award.planId) {
            try {
                const planResponse = await FirebaseDbService.stakeholders.getById(award.planId)
                // Actually, we need to get the plan from profitSharingPlans collection
                const planRef = doc(db, 'profitSharingPlans', award.planId)
                const planSnap = await getDoc(planRef)
                if (planSnap.exists()) {
                    setSelectedPlan(planSnap.data())
                }
            } catch (error) {
                console.error('Error loading plan:', error)
            }
        }
        
        setShowNewAwardDrawer(true)
    }

    const handleSaveAward = async (status) => {
        try {
            if (!stakeholderId) return

            const stakeholderRef = doc(db, 'stakeholders', stakeholderId)
            const currentData = await FirebaseDbService.stakeholders.getById(stakeholderId)
            
            if (!currentData.success) {
                throw new Error('Failed to load stakeholder data')
            }

            const selectedPlan = profitPlans.find(p => p.value === awardFormData.planId)
            
            // Helper function to remove undefined values from object
            const removeUndefined = (obj) => {
                const cleaned = {}
                Object.keys(obj).forEach(key => {
                    if (obj[key] !== undefined) {
                        cleaned[key] = obj[key]
                    }
                })
                return cleaned
            }
            
            // Safely get awardDate - ensure it's a valid Date
            let awardDateValue = awardFormData.awardDate
            if (!(awardDateValue instanceof Date)) {
                if (awardDateValue) {
                    awardDateValue = new Date(awardDateValue)
                } else {
                    awardDateValue = new Date()
                }
            }
            // Validate the date is not invalid
            if (isNaN(awardDateValue.getTime())) {
                awardDateValue = new Date()
            }
            
            const newAward = removeUndefined({
                id: Date.now().toString(),
                planId: awardFormData.planId || null,
                planName: selectedPlan?.label || 'Unknown Plan',
                planTriggerAmount: awardFormData.triggerAmount || 0,
                awardDate: awardDateValue.toISOString(),
                awardStartDate: awardFormData.awardStartDate instanceof Date 
                    ? awardFormData.awardStartDate.toISOString() 
                    : (awardFormData.awardStartDate || null),
                awardEndDate: awardFormData.awardEndDate instanceof Date 
                    ? awardFormData.awardEndDate.toISOString() 
                    : (awardFormData.awardEndDate || null),
                triggerAmount: awardFormData.triggerAmount || 0,
                milestoneAmount: awardFormData.triggerAmount || 0, // Backward compatibility
                sharesIssued: awardFormData.sharesIssued ? parseInt(awardFormData.sharesIssued, 10) : 0,
                paymentSchedule: selectedPlan?.schedule || 'Annually',
                status: status || 'draft', // 'draft', 'issued', or 'finalized'
            })

            const existingAwards = currentData.data.profitAwards || []
            let updatedAwards
            
            if (editingAwardId) {
                // Update existing award - preserve document info if it exists
                const existingAward = existingAwards.find(a => a.id === editingAwardId)
                
                // Safely get awardDate for update - ensure it's a valid Date
                let updateAwardDateValue = awardFormData.awardDate
                if (!(updateAwardDateValue instanceof Date)) {
                    if (updateAwardDateValue) {
                        updateAwardDateValue = new Date(updateAwardDateValue)
                    } else {
                        updateAwardDateValue = new Date()
                    }
                }
                // Validate the date is not invalid
                if (isNaN(updateAwardDateValue.getTime())) {
                    updateAwardDateValue = new Date()
                }
                
                const updatedAward = {
                    ...newAward,
                    id: editingAwardId,
                    awardDate: updateAwardDateValue.toISOString(),
                }
                
                // Only include document fields if they exist (not undefined)
                if (existingAward?.documentUrl !== undefined) {
                    updatedAward.documentUrl = existingAward.documentUrl || null
                }
                if (existingAward?.documentStoragePath !== undefined) {
                    updatedAward.documentStoragePath = existingAward.documentStoragePath || null
                }
                if (existingAward?.documentFileName !== undefined) {
                    updatedAward.documentFileName = existingAward.documentFileName || null
                }
                
                updatedAwards = existingAwards.map(a => 
                    a.id === editingAwardId ? removeUndefined(updatedAward) : a
                )
            } else {
                // Add new award - ensure it has no undefined values
                updatedAwards = [...existingAwards, removeUndefined(newAward)]
            }

            // Clean all awards before saving to prevent undefined values
            const cleanedAwards = updatedAwards.map(award => removeUndefined(award))
            
            await updateDoc(stakeholderRef, {
                profitAwards: cleanedAwards,
                updatedAt: serverTimestamp(),
            })

            // Generate and upload award document
            const finalAwardId = editingAwardId || newAward.id
            setIsGeneratingAwardDocument(true)
            try {
                // Get plan data
                let planData = null
                if (awardFormData.planId) {
                    const planRef = doc(db, 'profitSharingPlans', awardFormData.planId)
                    const planSnap = await getDoc(planRef)
                    if (planSnap.exists()) {
                        planData = { id: planSnap.id, ...planSnap.data() }
                    }
                }

                // Get company data
                let companyData = null
                if (planData?.companyId) {
                    const companyResult = await FirebaseDbService.companies.getById(planData.companyId)
                    if (companyResult.success) {
                        companyData = companyResult.data
                    }
                }

                // Get stakeholder data
                const stakeholderData = currentData.data

                if (planData && companyData && stakeholderData) {
                    const finalAward = updatedAwards.find(a => a.id === finalAwardId)
                    const documentResult = await generateAwardDocument(
                        finalAward || newAward,
                        planData,
                        stakeholderData,
                        companyData,
                        stakeholderId,
                        finalAwardId
                    )
                    
                    // Update award with document URLs (both DOCX and PDF)
                    const updatedAwardsWithDoc = updatedAwards.map(a => 
                        a.id === finalAwardId 
                            ? removeUndefined({ 
                                ...a, 
                                documentUrl: documentResult.url || null, // PDF URL (preferred for viewing)
                                documentStoragePath: documentResult.path || null,
                                documentDocxUrl: documentResult.docxUrl || null, // Original DOCX
                                documentDocxPath: documentResult.docxPath || null,
                                documentPdfUrl: documentResult.pdfUrl || null, // PDF version
                                documentPdfPath: documentResult.pdfPath || null,
                                documentFileName: documentResult.pdfUrl ? `award-${finalAwardId}.pdf` : null // PDF filename
                            })
                            : a
                    )
                    
                    await updateDoc(stakeholderRef, {
                        profitAwards: updatedAwardsWithDoc,
                        updatedAt: serverTimestamp(),
                    })
                }
            } catch (docError) {
                console.error('Error generating award document:', docError)
                // Don't fail the save if document generation fails
                // But ensure we still clean up any undefined values in the awards array
                const cleanedAwards = updatedAwards.map(award => removeUndefined(award))
                await updateDoc(stakeholderRef, {
                    profitAwards: cleanedAwards,
                    updatedAt: serverTimestamp(),
                })
                
                // Show specific error message for missing template
                let errorMessage = "Award saved, but document generation failed."
                let errorTitle = "Warning"
                let errorType = "warning"
                let errorDuration = 5000
                
                if (docError?.isTemplateMissing) {
                    errorTitle = "Template Missing"
                    errorType = "danger"
                    errorDuration = 8000
                    errorMessage = `The award template file is missing from Firebase Storage. Please upload "Profit Award Agreement Template.docx" to profitSharing/templates/ in Firebase Console.`
                    
                    if (docError.existingFiles && docError.existingFiles.length > 0) {
                        errorMessage += ` Found ${docError.existingFiles.length} file(s) in templates directory, but not the expected template.`
                    }
                } else if (docError?.message) {
                    // Check if error message mentions template
                    if (docError.message.includes('template') || docError.message.includes('Template')) {
                        errorMessage = docError.message.split('\n')[0] // Show first line of error
                        if (errorMessage.length > 150) {
                            errorMessage = errorMessage.substring(0, 150) + '...'
                        }
                    }
                }
                
                toast.push(
                    React.createElement(
                        Notification,
                        { type: errorType, duration: errorDuration, title: errorTitle },
                        errorMessage
                    )
                )
            } finally {
                setIsGeneratingAwardDocument(false)
            }

            toast.push(
                React.createElement(
                    Notification,
                    { type: "success", duration: 2000, title: "Success" },
                    `Award ${status === 'finalized' ? 'finalized' : 'saved as draft'} successfully`
                )
            )

            // Reload stakeholder data
            const response = await FirebaseDbService.stakeholders.getById(stakeholderId)
            if (response.success) {
                const data = response.data
                // Use saved name if it exists and differs from database (prevents stale data from overwriting)
                const nameToUse = (lastSavedNameRef.current && data.name !== lastSavedNameRef.current) 
                    ? lastSavedNameRef.current 
                    : (data.name || '')
                setStakeholder({
                    id: data.id,
                    name: nameToUse,
                    email: data.email || '',
                    phone: data.phone || '',
                    managerId: data.managerId || null,
                    stockAwards: data.stockAwards || [],
                    profitAwards: data.profitAwards || [],
                    totalStockUnits: data.mareStock || 0,
                    estimatedFMV: 0,
                    totalAwards: (data.stockAwards?.length || 0) + (data.profitAwards?.length || 0),
                    reinsRole: data.reinsRole || 'User',
                    linkedUserId: data.linkedUserId,
                })
            }

            // Note: Awards are now issued first, then accepted. Notifications happen in handleIssueAward
            // This section is kept for backward compatibility but won't trigger for new flow
            if (status === 'finalized' && currentData.data?.linkedUserId) {
                try {
                    const linkedUserId = currentData.data.linkedUserId
                    // Find the finalized award we just saved
                    const finalizedAward = updatedAwards.find(a => (editingAwardId ? a.id === editingAwardId : a.id === newAward.id))

                    let estimatedPayout = 0
                    if (finalizedAward) {
                        const payouts = calculateAwardPayouts(finalizedAward)
                        estimatedPayout = payouts.reduce((sum, p) => sum + p.payout, 0)
                    }

                    await createNotification({
                        userId: linkedUserId,
                        type: NOTIFICATION_TYPES.PROFIT_SHARING,
                        title: 'New profit sharing award',
                        message: estimatedPayout > 0
                            ? `A profit sharing award has been finalized for you. Current estimated total payout is ${formatCurrency(estimatedPayout)} based on existing profit entries.`
                            : 'A profit sharing award has been finalized for you. You can view details in the Profit Sharing section.',
                        entityType: 'profit_sharing',
                        entityId: stakeholderId,
                        relatedUserId: user?.id || user?.uid || null,
                        metadata: {
                            stakeholderId,
                            awardId: editingAwardId || newAward.id,
                            estimatedPayout,
                        },
                    })
                } catch (notifyError) {
                    console.error('Error creating profit sharing award notification:', notifyError)
                }
            }

            // Notify stakeholders list to refresh
            window.dispatchEvent(new Event('stakeholdersUpdated'))

            setShowNewAwardDrawer(false)
            setEditingAwardId(null)
            setEditingAward(null)
            setSelectedPlan(null)
            setAwardFormData({
                planId: null,
                awardDate: new Date(),
                awardStartDate: null,
                awardEndDate: null,
                triggerAmount: 0,
                sharesIssued: '',
            })
        } catch (error) {
            console.error('Error saving award:', error)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "danger", duration: 2000, title: "Error" },
                    "Failed to save award"
                )
            )
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-500">Loading...</div>
            </div>
        )
    }

    if (!stakeholder) {
        return null
    }

    const tabs = [
        { key: 'profit', label: 'Profit Awards' },
        { key: 'details', label: 'Details' },
    ]

    const allSidebarItems = [
        { key: 'overview', label: 'Overview', icon: <HiOutlineHome />, adminOnly: true },
        { key: 'plans', label: 'Plans', icon: <HiOutlineDocumentText />, adminOnly: true },
        { key: 'stakeholders', label: isAdmin ? 'Stakeholders' : effectiveIsSupervisor ? 'Awards' : 'My Awards', icon: <HiOutlineUsers />, adminOnly: false },
        { key: 'valuations', label: 'Company Profits', icon: <HiOutlineChartBar />, adminOnly: true },
        { key: 'milestones', label: 'Trigger Tracking', icon: <HiOutlineFlag />, adminOnly: true },
        { key: 'settings', label: 'Settings', icon: <HiOutlineCog />, adminOnly: true },
    ]
    
    // Filter sidebar items based on role
    // Admins see all tabs
    // Supervisors and regular users only see the stakeholders tab (but supervisors can view detail pages of their direct reports)
    const sidebarItems = isAdmin
        ? allSidebarItems 
        : allSidebarItems.filter(item => item.key === 'stakeholders').map(item => ({
            ...item,
            label: effectiveIsSupervisor ? 'Awards' : 'My Awards'
        }))

    return (
        <div className="flex min-h-screen bg-white dark:bg-gray-900">
            {/* Left Sidebar */}
            <div className="hidden lg:block w-64 bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-sm">
                <div className="p-6">
                    <Button 
                        variant="plain" 
                        icon={<HiOutlineArrowLeft />} 
                        onClick={() => navigate('/profit-sharing?tab=stakeholders')}
                        className="mb-8 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors duration-200"
                    >
                        Back to stakeholders
                    </Button>
                </div>

                <div className="px-4 space-y-1">
                    {sidebarItems.map((item) => (
                        <button
                            key={item.key}
                            onClick={() => navigate(`/profit-sharing?tab=${item.key}`)}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-300 group ${
                                item.key === 'stakeholders'
                                    ? 'bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg transform scale-[1.02]' 
                                    : 'text-gray-600 hover:bg-white/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700/80 dark:hover:text-gray-100 hover:shadow-md hover:transform hover:scale-[1.01]'
                            }`}
                        >
                            <span className={`transition-transform duration-200 ${item.key === 'stakeholders' ? 'scale-110' : 'group-hover:scale-105'}`}>{item.icon}</span>
                            <span className="font-medium tracking-wide">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden bg-white dark:bg-gray-900">
                {/* Mobile Tab Navigation */}
                <div className="lg:hidden sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex overflow-x-auto scrollbar-hide px-2 py-2">
                        {sidebarItems.map((item) => (
                            <button
                                key={item.key}
                                onClick={() => navigate(`/profit-sharing?tab=${item.key}`)}
                                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                                    item.key === 'stakeholders'
                                        ? 'bg-primary text-white shadow-md'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            >
                                <span className="text-base">{item.icon}</span>
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 px-4 lg:px-8 py-8 lg:py-12">
                    <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                    {(() => {
                        // Use saved name if it exists (prevents title from reverting)
                        const savedName = savedNameRef.current || lastSavedNameRef.current
                        const displayName = savedName || stakeholder?.name || ''
                        return isAdmin ? displayName : 'My Awards'
                    })()}
                </h2>
                {activeTab === 'profit' && isAdmin && (
                    <Button
                        variant="solid"
                        icon={<HiOutlinePlus />}
                        onClick={() => setShowNewAwardDrawer(true)}
                    >
                        New Award
                    </Button>
                )}
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-6">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-1 py-4 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === tab.key
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'profit' && (
                <div className="space-y-6">
                    {/* Plan Selector for KPIs */}
                    {(() => {
                        // Check if user belongs to 2+ companies OR if admin (admins can filter by plan too)
                        // For non-admin users, check both accessRecords AND stakeholder records (awards)
                        let userCompanyIds = []
                        if (isAdmin) {
                            // For admins, get all companies from stakeholder's awards
                            if (stakeholder?.profitAwards && stakeholder.profitAwards.length > 0) {
                                const companyIdsFromAwards = stakeholder.profitAwards
                                    .map(award => award._sourceCompanyId || stakeholder.companyId)
                                    .filter(Boolean)
                                userCompanyIds = [...new Set(companyIdsFromAwards)]
                            }
                        } else {
                            // First try accessRecords
                            const accessRecordCompanyIds = accessRecords?.map(record => record.companyId).filter(Boolean) || []
                            
                            // Also check stakeholder records/awards to see if user has awards in multiple companies
                            // This catches cases where accessRecords might not be fully populated or user has awards across companies
                            let awardCompanyIds = []
                            if (stakeholder?.profitAwards && stakeholder.profitAwards.length > 0) {
                                // Get unique company IDs from merged awards (which have _sourceCompanyId)
                                const companyIdsFromAwards = stakeholder.profitAwards
                                    .map(award => award._sourceCompanyId || stakeholder.companyId)
                                    .filter(Boolean)
                                awardCompanyIds = [...new Set(companyIdsFromAwards)]
                            }
                            
                            // Combine both sources and use the larger set
                            const allCompanyIds = [...new Set([...accessRecordCompanyIds, ...awardCompanyIds])]
                            userCompanyIds = allCompanyIds
                        }
                        
                        const hasMultipleCompanies = isAdmin ? true : userCompanyIds.length >= 2
                        const hasMultiplePlans = stakeholder?.profitAwards ? [...new Set(stakeholder.profitAwards.map(a => a.planId).filter(Boolean))].length > 1 : false
                        
                        // Show filter if user has multiple plans OR (belongs to 2+ companies AND has awards)
                        // For admins, show if there are multiple plans
                        if ((!hasMultiplePlans && !hasMultipleCompanies) || !stakeholder?.profitAwards || stakeholder.profitAwards.length === 0) {
                            return null
                        }
                        
                        // Get unique plan IDs from awards
                        // For admins, show all plans; for non-admins, show plans from all companies they belong to
                        const planIdsFromAwards = stakeholder.profitAwards
                            .filter(award => {
                                if (!award.planId) return false
                                // For admins, show all plans
                                if (isAdmin) return true
                                // For non-admins, include plans from all companies they belong to
                                const awardCompanyId = award._sourceCompanyId || stakeholder.companyId
                                return userCompanyIds.includes(awardCompanyId)
                            })
                            .map(a => a.planId)
                        
                        const uniquePlanIds = [...new Set(planIdsFromAwards)]
                        
                        // For admins, show all plans from profitPlans (which now includes all plans globally)
                        // For non-admins, show plans from awards that match their companies
                        let availablePlans = []
                        
                        if (isAdmin) {
                            // Admins: show only plans that this user (stakeholder) has awards for
                            // Filter profitPlans to only include plans from the stakeholder's awards
                            availablePlans = uniquePlanIds
                                .map(planId => {
                                    // Try to find plan in profitPlans first
                                    let plan = profitPlans.find(p => p.value === planId)
                                    
                                    if (plan) {
                                        return {
                                            value: plan.value,
                                            label: plan.label || 'Unknown Plan',
                                            companyId: plan.companyId
                                        }
                                    }
                                    
                                    // If not found in profitPlans, create entry from award data
                                    const award = stakeholder.profitAwards.find(a => a.planId === planId)
                                    if (award) {
                                        return {
                                            value: planId,
                                            label: award.planName || 'Unknown Plan',
                                            companyId: award._sourceCompanyId || stakeholder.companyId
                                        }
                                    }
                                    
                                    return null
                                })
                                .filter(Boolean)
                        } else {
                            // Non-admins: show plans from awards that match their companies
                            availablePlans = uniquePlanIds
                                .map(planId => {
                                    const award = stakeholder.profitAwards.find(a => a.planId === planId)
                                    // Try to find plan in profitPlans first
                                    let plan = profitPlans.find(p => p.value === planId)
                                    
                                    // If not found, create entry from award data
                                    if (!plan && award) {
                                        return {
                                            value: planId,
                                            label: award?.planName || 'Unknown Plan',
                                            companyId: award._sourceCompanyId || stakeholder.companyId
                                        }
                                    }
                                    
                                    if (plan) {
                                        return {
                                            value: planId,
                                            label: plan?.label || award?.planName || 'Unknown Plan',
                                            companyId: plan.companyId || selectedCompanyId
                                        }
                                    }
                                    return null
                                })
                                .filter(Boolean)
                        }
                        
                        // Show filter if there's at least 1 plan (even if only 1 plan, user should see which plan they're viewing)
                        if (availablePlans.length === 0) {
                            return null
                        }
                        
                        return (
                            <Card className="p-4">
                                <div className="flex items-center gap-4">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Select Plan to view:
                                    </label>
                                    <Select
                                        className="w-64"
                                        placeholder="Select a plan"
                                        value={selectedPlanForKPIs ? {
                                            value: selectedPlanForKPIs,
                                            label: profitPlans.find(p => p.value === selectedPlanForKPIs)?.label || 
                                                   stakeholder.profitAwards.find(a => a.planId === selectedPlanForKPIs)?.planName || 
                                                   'Unknown Plan'
                                        } : null}
                                        options={availablePlans}
                                        onChange={(option) => {
                                            const selectedOption = Array.isArray(option) ? option[0] : option
                                            setSelectedPlanForKPIs(selectedOption?.value || null)
                                        }}
                                    />
                                </div>
                            </Card>
                        )
                    })()}

                    {/* KPI Cards - Always 2x2 layout */}
                    {(() => {
                        // Check if estimated profit exists - use company fallback logic like other KPIs
                        let filteredValuations = valuations
                        if (selectedPlanForKPIs) {
                            filteredValuations = valuations.filter(v => v.planId === selectedPlanForKPIs)
                        }
                        
                        // Get relevant awards for company fallback logic
                        let relevantAwards = stakeholder?.profitAwards || []
                        if (selectedPlanForKPIs) {
                            relevantAwards = relevantAwards.filter(a => a.planId === selectedPlanForKPIs)
                        }
                        
                        // If no valuations match the selected plan, but stakeholder has an award for that plan,
                        // use company fallback logic (same as other KPIs)
                        let usingCompanyFallback = false
                        if (selectedPlanForKPIs && filteredValuations.length === 0 && relevantAwards.length > 0) {
                            const companyIdToUse = isAdmin 
                                ? selectedCompanyId 
                                : (relevantAwards[0]._sourceCompanyId || stakeholder?.companyId)
                            if (companyIdToUse) {
                                const companyValuations = valuations.filter(v => v.companyId === companyIdToUse)
                                if (companyValuations.length > 0) {
                                    filteredValuations = companyValuations
                                    usingCompanyFallback = true
                                }
                            }
                        }
                        
                        const now = new Date()
                        let futureEstimates = filteredValuations
                            .filter(v => {
                                if (v.profitType !== 'estimated') return false
                                const valDate = v.valuationDate instanceof Date ? v.valuationDate : new Date(v.valuationDate)
                                return valDate > now
                            })
                            .sort((a, b) => {
                                const aDate = a.valuationDate instanceof Date ? a.valuationDate : new Date(a.valuationDate)
                                const bDate = b.valuationDate instanceof Date ? b.valuationDate : new Date(b.valuationDate)
                                return aDate - bDate // Earliest first
                            })
                        
                        // If no estimated profits found in plan-level valuations, try company fallback
                        if (futureEstimates.length === 0 && selectedPlanForKPIs && relevantAwards.length > 0 && !usingCompanyFallback) {
                            const companyIdToUse = isAdmin 
                                ? selectedCompanyId 
                                : (relevantAwards[0]._sourceCompanyId || stakeholder?.companyId)
                            if (companyIdToUse) {
                                const companyValuations = valuations.filter(v => v.companyId === companyIdToUse)
                                futureEstimates = companyValuations
                                    .filter(v => {
                                        if (v.profitType !== 'estimated') return false
                                        const valDate = v.valuationDate instanceof Date ? v.valuationDate : new Date(v.valuationDate)
                                        return valDate > now
                                    })
                                    .sort((a, b) => {
                                        const aDate = a.valuationDate instanceof Date ? a.valuationDate : new Date(a.valuationDate)
                                        const bDate = b.valuationDate instanceof Date ? b.valuationDate : new Date(b.valuationDate)
                                        return aDate - bDate // Earliest first
                                    })
                            }
                        }
                        
                        const hasEstimatedProfit = !!futureEstimates[0]
                        const nextEstimate = futureEstimates[0]
                        
                        return (
                            <div className="space-y-6">
                                {/* First Row */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Estimated Profit - Always show */}
                                    {(() => {
                                        if (hasEstimatedProfit && nextEstimate) {
                                            const estimateDate = nextEstimate.valuationDate instanceof Date 
                                                ? nextEstimate.valuationDate 
                                                : new Date(nextEstimate.valuationDate)
                                            
                                            return (
                                                <Card className="p-6">
                                                    <div className="space-y-2">
                                                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Next Period Estimated Profit</div>
                                                        <div className="text-3xl font-bold text-gray-900 dark:text-white">
                                                            {formatCurrency(nextEstimate.profitAmount || 0)}
                                                        </div>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                                            {estimateDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                                        </div>
                                                    </div>
                                                </Card>
                                            )
                                        } else {
                                            return (
                                                <Card className="p-6">
                                                    <div className="space-y-2">
                                                        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Next Period Estimated Profit</div>
                                                        <div className="text-3xl font-bold text-gray-900 dark:text-white">
                                                            $0.00
                                                        </div>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                                            No estimated profit
                                                        </div>
                                                    </div>
                                                </Card>
                                            )
                                        }
                                    })()}

                                    {/* Estimated Payout */}
                                    <Card className="p-6">
                                        <div className="space-y-2">
                                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Next Period Estimated Payout</div>
                                            {(() => {
                                                if (!stakeholder || !stakeholder.profitAwards || stakeholder.profitAwards.length === 0) {
                                                    return (
                                                        <>
                                                            <div className="text-3xl font-bold text-gray-900 dark:text-white">$0.00</div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-400">No awards</div>
                                                        </>
                                                    )
                                                }
                                                
                                                // Filter awards by selected plan
                                                let relevantAwards = stakeholder.profitAwards
                                                if (selectedPlanForKPIs) {
                                                    relevantAwards = stakeholder.profitAwards.filter(a => a.planId === selectedPlanForKPIs)
                                                }
                                                
                                                // Filter valuations by selected plan
                                                let filteredValuations = valuations
                                                let usingCompanyFallback = false
                                                if (selectedPlanForKPIs) {
                                                    filteredValuations = valuations.filter(v => v.planId === selectedPlanForKPIs)
                                                    
                                                // If no valuations match the selected plan, but stakeholder has an award for that plan,
                                                // it likely means valuations have old plan IDs. Use all valuations for the stakeholder's company.
                                                if (filteredValuations.length === 0 && relevantAwards.length > 0) {
                                                    // For admins, use selectedCompanyId (the company they're viewing)
                                                    // For non-admins, use the award's company
                                                    const companyIdToUse = isAdmin 
                                                        ? selectedCompanyId 
                                                        : (relevantAwards[0]._sourceCompanyId || stakeholder?.companyId)
                                                    if (companyIdToUse) {
                                                        // Filter valuations by the company
                                                        const companyValuations = valuations.filter(v => v.companyId === companyIdToUse)
                                                        if (companyValuations.length > 0) {
                                                            filteredValuations = companyValuations
                                                            usingCompanyFallback = true
                                                        }
                                                    }
                                                }
                                                }
                                                
                                                // Get latest valuation for calculation
                                                const latestValuation = filteredValuations.length > 0
                                                    ? filteredValuations.sort((a, b) => {
                                                        const aDate = a.valuationDate?.getTime() || 0
                                                        const bDate = b.valuationDate?.getTime() || 0
                                                        return bDate - aDate
                                                    })[0]
                                                    : null
                                                
                                                if (!latestValuation) {
                                                    return (
                                                        <>
                                                            <div className="text-3xl font-bold text-gray-900 dark:text-white">$0.00</div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-400">No valuations</div>
                                                        </>
                                                    )
                                                }
                                                
                                                // Calculate price per share
                                                const pricePerShare = latestValuation.pricePerShare || 
                                                    (latestValuation.profitAmount && latestValuation.totalShares && latestValuation.totalShares > 0
                                                        ? latestValuation.profitAmount / latestValuation.totalShares 
                                                        : 0)
                                                
                                                // Calculate total estimated payout
                                                // If using company fallback, don't check planId matches (we know they won't match)
                                                const totalEstimatedPayout = relevantAwards.reduce((sum, award) => {
                                                    if (!award.sharesIssued || award.sharesIssued === 0) return sum
                                                    
                                                    // Only check planId match if not using company fallback
                                                    if (!usingCompanyFallback && award.planId !== latestValuation.planId) {
                                                        return sum
                                                    }
                                                    
                                                    const payout = (award.sharesIssued || 0) * pricePerShare
                                                    return sum + payout
                                                }, 0)
                                            
                                                return (
                                                    <>
                                                        <div className="text-3xl font-bold text-gray-900 dark:text-white">
                                                            {formatCurrency(totalEstimatedPayout)}
                                                        </div>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                                            Based on latest valuation
                                                        </div>
                                                    </>
                                                )
                                            })()}
                                        </div>
                                    </Card>
                                </div>

                                {/* Second Row - Always 2x2 layout */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Last Period Payout - Always show in second row */}
                                    <Card className="p-6">
                                            <div className="space-y-2">
                                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Period Payout</div>
                                                {(() => {
                                                    // Filter valuations by selected plan
                                                    let filteredValuations = valuations
                                                    if (selectedPlanForKPIs) {
                                                        filteredValuations = valuations.filter(v => v.planId === selectedPlanForKPIs)
                                                    }
                                                    
                                                    // Filter awards by selected plan (need to do this before checking actualValuations)
                                                    let relevantAwards = stakeholder?.profitAwards || []
                                                    if (selectedPlanForKPIs) {
                                                        relevantAwards = relevantAwards.filter(a => a.planId === selectedPlanForKPIs)
                                                    }
                                                    
                                                    // Find the most recent actual profit entry that:
                                                    // 1. Is in the past (not future dates)
                                                    // 2. Falls within at least one award's date range
                                                    const now = new Date()
                                                    let actualValuations = filteredValuations
                                                        .filter(v => {
                                                            if (v.profitType !== 'actual') return false
                                                            if (!v.valuationDate) return false
                                                            const valDate = v.valuationDate instanceof Date ? v.valuationDate : new Date(v.valuationDate)
                                                            if (isNaN(valDate.getTime())) return false
                                                            
                                                            // Only consider past dates
                                                            if (valDate > now) return false
                                                            
                                                            // Check if this valuation falls within any award's date range
                                                            const fallsWithinAwardRange = relevantAwards.some(award => {
                                                                if (!award.awardStartDate || !award.awardEndDate) return false
                                                                const awardStart = new Date(award.awardStartDate)
                                                                const awardEnd = new Date(award.awardEndDate)
                                                                return valDate >= awardStart && valDate <= awardEnd
                                                            })
                                                            
                                                            return fallsWithinAwardRange
                                                        })
                                                        .sort((a, b) => {
                                                            const aDate = a.valuationDate instanceof Date ? a.valuationDate : new Date(a.valuationDate)
                                                            const bDate = b.valuationDate instanceof Date ? b.valuationDate : new Date(b.valuationDate)
                                                            return bDate - aDate // Most recent first
                                                        })
                                                    
                                                    // If no actual valuations match the selected plan, but stakeholder has an award for that plan,
                                                    // it likely means valuations have old plan IDs. Use all actual valuations for the stakeholder's company.
                                                    let usingCompanyFallback = false
                                                    if (selectedPlanForKPIs && actualValuations.length === 0 && relevantAwards.length > 0) {
                                                        // For admins, use selectedCompanyId (the company they're viewing)
                                                        // For non-admins, use the award's company
                                                        const companyIdToUse = isAdmin 
                                                            ? selectedCompanyId 
                                                            : (relevantAwards[0]._sourceCompanyId || stakeholder?.companyId)
                                                        if (companyIdToUse) {
                                                            // Filter valuations by the company, past dates only, and within award ranges
                                                            const companyValuations = valuations.filter(v => {
                                                                if (v.companyId !== companyIdToUse || v.profitType !== 'actual') return false
                                                                if (!v.valuationDate) return false
                                                                const valDate = v.valuationDate instanceof Date ? v.valuationDate : new Date(v.valuationDate)
                                                                if (isNaN(valDate.getTime()) || valDate > now) return false
                                                                
                                                                // Check if this valuation falls within any award's date range
                                                                return relevantAwards.some(award => {
                                                                    if (!award.awardStartDate || !award.awardEndDate) return false
                                                                    const awardStart = new Date(award.awardStartDate)
                                                                    const awardEnd = new Date(award.awardEndDate)
                                                                    return valDate >= awardStart && valDate <= awardEnd
                                                                })
                                                            })
                                                            if (companyValuations.length > 0) {
                                                                actualValuations = companyValuations.sort((a, b) => {
                                                                    const aDate = a.valuationDate instanceof Date ? a.valuationDate : new Date(a.valuationDate)
                                                                    const bDate = b.valuationDate instanceof Date ? b.valuationDate : new Date(b.valuationDate)
                                                                    return bDate - aDate
                                                                })
                                                                usingCompanyFallback = true
                                                            }
                                                        }
                                                    }
                                                    
                                                    if (actualValuations.length === 0) {
                                                        return (
                                                            <>
                                                                <div className="text-3xl font-bold text-gray-900 dark:text-white">$0.00</div>
                                                                <div className="text-xs text-gray-500 dark:text-gray-400">No actual payouts</div>
                                                            </>
                                                        )
                                                    }
                                                    
                                                    // Get the most recent actual valuation (last entered payout)
                                                    const lastPeriodValuation = actualValuations[0]
                                                    
                                                    // Calculate payout based on the single most recent actual valuation
                                                    const pricePerShare = lastPeriodValuation.pricePerShare || 
                                                        (lastPeriodValuation.profitAmount && lastPeriodValuation.totalShares && lastPeriodValuation.totalShares > 0
                                                            ? lastPeriodValuation.profitAmount / lastPeriodValuation.totalShares 
                                                            : 0)
                                                    
                                                    let totalPayout = 0
                                                    
                                                    // Calculate for awards - only count awards that were active during this valuation date
                                                    const valuationDate = lastPeriodValuation.valuationDate instanceof Date 
                                                        ? lastPeriodValuation.valuationDate 
                                                        : new Date(lastPeriodValuation.valuationDate)
                                                    
                                                    relevantAwards.forEach(award => {
                                                        const hasShares = award.sharesIssued && award.sharesIssued > 0
                                                        if (!hasShares) return
                                                        
                                                        // Check if award was active during this valuation date
                                                        const awardStart = award.awardStartDate ? new Date(award.awardStartDate) : null
                                                        const awardEnd = award.awardEndDate ? new Date(award.awardEndDate) : null
                                                        const awardWasActive = awardStart && awardEnd && valuationDate >= awardStart && valuationDate <= awardEnd
                                                        
                                                        // Also check planId match (unless using company fallback)
                                                        const planMatches = usingCompanyFallback || award.planId === lastPeriodValuation.planId
                                                        
                                                        if (awardWasActive && planMatches) {
                                                            const payout = award.sharesIssued * pricePerShare
                                                            totalPayout += payout
                                                        }
                                                    })
                                                    
                                                    // Format the date for display
                                                    const formattedDate = valuationDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                
                                                    return (
                                                        <>
                                                            <div className="text-3xl font-bold text-gray-900 dark:text-white">
                                                                {formatCurrency(totalPayout)}
                                                            </div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                                Last period: {formattedDate}
                                                            </div>
                                                        </>
                                                    )
                                                })()}
                                            </div>
                                        </Card>

                                    {/* Total Payout */}
                                    <Card className="p-6">
                                        <div className="space-y-2">
                                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Payout to Date</div>
                                            {(() => {
                                                // Filter valuations by selected plan
                                                let filteredValuations = valuations
                                                if (selectedPlanForKPIs) {
                                                    filteredValuations = valuations.filter(v => v.planId === selectedPlanForKPIs)
                                                }
                                                
                                                // Get all actual profit entries (not estimated) that fall within award date ranges
                                                const now = new Date()
                                                let actualValuations = filteredValuations.filter(v => {
                                                    if (v.profitType !== 'actual') return false
                                                    if (!v.valuationDate) return false
                                                    const valDate = v.valuationDate instanceof Date ? v.valuationDate : new Date(v.valuationDate)
                                                    if (isNaN(valDate.getTime())) return false
                                                    
                                                    // Check if this valuation falls within any award's date range
                                                    return relevantAwards.some(award => {
                                                        if (!award.awardStartDate || !award.awardEndDate) return false
                                                        const awardStart = new Date(award.awardStartDate)
                                                        const awardEnd = new Date(award.awardEndDate)
                                                        return valDate >= awardStart && valDate <= awardEnd
                                                    })
                                                })
                                                
                                                // Filter awards by selected plan (need to do this before checking actualValuations)
                                                let relevantAwards = stakeholder?.profitAwards || []
                                                if (selectedPlanForKPIs) {
                                                    relevantAwards = relevantAwards.filter(a => a.planId === selectedPlanForKPIs)
                                                }
                                                
                                                // If no actual valuations match the selected plan, but stakeholder has an award for that plan,
                                                // it likely means valuations have old plan IDs. Use all actual valuations for the stakeholder's company.
                                                let usingCompanyFallback = false
                                                if (selectedPlanForKPIs && actualValuations.length === 0 && relevantAwards.length > 0) {
                                                    // For admins, use selectedCompanyId (the company they're viewing)
                                                    // For non-admins, use the award's company
                                                    const companyIdToUse = isAdmin 
                                                        ? selectedCompanyId 
                                                        : (relevantAwards[0]._sourceCompanyId || stakeholder?.companyId)
                                                    if (companyIdToUse) {
                                                        // Filter valuations by the company, and within award ranges
                                                        const companyValuations = valuations.filter(v => {
                                                            if (v.companyId !== companyIdToUse || v.profitType !== 'actual') return false
                                                            if (!v.valuationDate) return false
                                                            const valDate = v.valuationDate instanceof Date ? v.valuationDate : new Date(v.valuationDate)
                                                            if (isNaN(valDate.getTime())) return false
                                                            
                                                            // Check if this valuation falls within any award's date range
                                                            return relevantAwards.some(award => {
                                                                if (!award.awardStartDate || !award.awardEndDate) return false
                                                                const awardStart = new Date(award.awardStartDate)
                                                                const awardEnd = new Date(award.awardEndDate)
                                                                return valDate >= awardStart && valDate <= awardEnd
                                                            })
                                                        })
                                                        if (companyValuations.length > 0) {
                                                            actualValuations = companyValuations
                                                            usingCompanyFallback = true
                                                        }
                                                    }
                                                }
                                                
                                                if (actualValuations.length === 0) {
                                                    return (
                                                        <>
                                                            <div className="text-3xl font-bold text-gray-900 dark:text-white">$0.00</div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-400">No actual payouts</div>
                                                        </>
                                                    )
                                                }
                                                
                                                // Calculate total payout from all actual valuations
                                                // Only count payouts for awards that were active during each valuation's date
                                                let totalPayout = 0
                                                actualValuations.forEach(valuation => {
                                                    const pricePerShare = valuation.pricePerShare || 
                                                        (valuation.profitAmount && valuation.totalShares && valuation.totalShares > 0
                                                            ? valuation.profitAmount / valuation.totalShares 
                                                            : 0)
                                                    
                                                    const valuationDate = valuation.valuationDate instanceof Date 
                                                        ? valuation.valuationDate 
                                                        : new Date(valuation.valuationDate)
                                                    
                                                    relevantAwards.forEach(award => {
                                                        const hasShares = award.sharesIssued && award.sharesIssued > 0
                                                        if (!hasShares) return
                                                        
                                                        // Check if award was active during this valuation date
                                                        const awardStart = award.awardStartDate ? new Date(award.awardStartDate) : null
                                                        const awardEnd = award.awardEndDate ? new Date(award.awardEndDate) : null
                                                        const awardWasActive = awardStart && awardEnd && valuationDate >= awardStart && valuationDate <= awardEnd
                                                        
                                                        // Also check planId match (unless using company fallback)
                                                        const planMatches = usingCompanyFallback || award.planId === valuation.planId
                                                        
                                                        if (awardWasActive && planMatches) {
                                                            const payout = award.sharesIssued * pricePerShare
                                                            totalPayout += payout
                                                        }
                                                    })
                                                })
                                            
                                                return (
                                                    <>
                                                        <div className="text-3xl font-bold text-gray-900 dark:text-white">
                                                            {formatCurrency(totalPayout)}
                                                        </div>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                                            All time (actuals only)
                                                        </div>
                                                    </>
                                                )
                                            })()}
                                        </div>
                                    </Card>
                                </div>
                            </div>
                        )
                    })()}

                    {/* Profit Awards Table */}
                    {(!stakeholder.profitAwards || stakeholder.profitAwards.length === 0) ? (
                        <Card className="p-12">
                            <div className="flex flex-col items-center justify-center text-center space-y-4">
                                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                                    <HiOutlineCheckCircle className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No awards found</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {isAdmin ? 'Click below to grant an award to this stakeholder.' : 'You don\'t have any awards yet.'}
                                    </p>
                                </div>
                                {isAdmin && (
                                    <Button
                                        variant="solid"
                                        icon={<HiOutlinePlus />}
                                        onClick={() => setShowNewAwardDrawer(true)}
                                    >
                                        New Award
                                    </Button>
                                )}
                            </div>
                        </Card>
                    ) : (
                        <Card className="p-0">
                            <Table>
                                <Table.THead>
                                    <Table.Tr>
                                        <Table.Th></Table.Th>
                                        <Table.Th>Award Date</Table.Th>
                                        <Table.Th>Plan Name</Table.Th>
                                        <Table.Th>Award Start</Table.Th>
                                        <Table.Th>Award End</Table.Th>
                                        <Table.Th>Payment Schedule</Table.Th>
                                        <Table.Th>Status</Table.Th>
                                        <Table.Th>Actions</Table.Th>
                                    </Table.Tr>
                                </Table.THead>
                                <Table.TBody>
                                    {stakeholder.profitAwards.map((award) => {
                                        // For payout history, only show actual payouts (not estimated)
                                        const payouts = calculateAwardPayouts(award, false)
                                        const totalPayout = payouts.reduce((sum, p) => sum + p.payout, 0)
                                        const isExpanded = expandedAwardId === award.id
                                        
                                        return (
                                            <React.Fragment key={award.id}>
                                                <Table.Tr>
                                                    <Table.Td>
                                                        {payouts.length > 0 && (
                                                            <Button
                                                                variant="plain"
                                                                size="sm"
                                                                icon={isExpanded ? <HiOutlineChevronUp /> : <HiOutlineChevronDown />}
                                                                onClick={() => setExpandedAwardId(isExpanded ? null : award.id)}
                                                                className="text-gray-400 hover:text-primary"
                                                            />
                                                        )}
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <span className="text-sm text-gray-900 dark:text-white">
                                                            {award.awardDate 
                                                                ? (() => {
                                                                    const date = award.awardDate instanceof Date 
                                                                        ? award.awardDate 
                                                                        : new Date(award.awardDate)
                                                                    return isNaN(date.getTime()) 
                                                                        ? 'Invalid Date' 
                                                                        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                                })()
                                                                : 'Pending'}
                                                        </span>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <span className="text-sm text-gray-900 dark:text-white">{award.planName}</span>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <span className="text-sm text-gray-900 dark:text-white">
                                                            {award.awardStartDate 
                                                                ? new Date(award.awardStartDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                                                                : 'N/A'}
                                                        </span>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <span className="text-sm text-gray-900 dark:text-white">
                                                            {award.awardEndDate 
                                                                ? new Date(award.awardEndDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                                                                : 'N/A'}
                                                        </span>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <span className="text-sm text-gray-900 dark:text-white">{award.paymentSchedule || 'N/A'}</span>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <div className="flex flex-col gap-2">
                                                            {/* Issue button for draft awards - in Status column */}
                                                            {isAdmin && (award.status?.toLowerCase() === 'draft' || award.status === 'Draft' || !award.status) ? (
                                                                <Button
                                                                    variant="twoTone"
                                                                    size="sm"
                                                                    onClick={() => handleIssueAward(award.id)}
                                                                    className="w-full"
                                                                    disabled={isGeneratingAwardDocument}
                                                                    loading={isGeneratingAwardDocument}
                                                                >
                                                                    {isGeneratingAwardDocument ? 'Generating...' : 'Issue'}
                                                                </Button>
                                                            ) : (
                                                                <Tag className={`px-2 py-1 text-xs font-medium ${
                                                                    award.status === 'draft' || award.status === 'Draft' || award.status === 'Pending'
                                                                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                                                        : award.status === 'issued' || award.status === 'Issued'
                                                                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                                                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                                }`}>
                                                                    <span className="flex items-center gap-2">
                                                                        <span className={`w-2 h-2 rounded-full ${
                                                                            award.status === 'draft' || award.status === 'Draft' || award.status === 'Pending' ? 'bg-gray-500' :
                                                                            award.status === 'issued' || award.status === 'Issued' ? 'bg-blue-500' :
                                                                            'bg-green-500'
                                                                        }`}></span>
                                                                        {(() => {
                                                                            const status = award.status?.toLowerCase() || 'draft'
                                                                            if (status === 'draft') return 'Draft'
                                                                            if (status === 'issued') return 'Issued'
                                                                            if (status === 'finalized') return 'Finalized'
                                                                            return award.status || 'Draft'
                                                                        })()}
                                                                    </span>
                                                                </Tag>
                                                            )}
                                                            {/* Timestamp Status - Show issued/accepted info */}
                                                            {award.issuedAt && (
                                                                <Tag className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs mt-1">
                                                                    Issued {award.issuedBy ? `by ${award.issuedBy}` : ''} {award.issuedAt ? new Date(award.issuedAt).toLocaleDateString() : ''}
                                                                </Tag>
                                                            )}
                                                            {award.acceptedAt && (
                                                                <Tag className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs mt-1">
                                                                    Accepted {award.acceptedBy ? `by ${award.acceptedBy}` : ''} {award.acceptedAt ? new Date(award.acceptedAt).toLocaleDateString() : ''}
                                                                </Tag>
                                                            )}
                                                        </div>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {award.documentUrl && (
                                                                <Button
                                                                    variant="plain"
                                                                    size="sm"
                                                                    icon={<HiOutlineEye />}
                                                                    onClick={() => {
                                                                        setEditingAward(award)
                                                                        setEditingAwardId(award.id)
                                                                        setShowDocumentModal(true)
                                                                    }}
                                                                    className="text-gray-400 hover:text-primary"
                                                                    title="View document"
                                                                />
                                                            )}
                                                            {/* Accept button - User only, for issued awards (not supervisors viewing employee records) */}
                                                            {(() => {
                                                                const currentUserId = user?.id || user?.uid
                                                                const isOwnRecord = stakeholder?.linkedUserId === currentUserId
                                                                // Only show accept button if it's the user's own record (not a supervisor viewing an employee)
                                                                return !isAdmin && isOwnRecord && (award.status?.toLowerCase() === 'issued' || award.status === 'Issued') && (
                                                                    <Button
                                                                        variant="solid"
                                                                        size="sm"
                                                                        onClick={() => handleAcceptAward(award.id)}
                                                                    >
                                                                        Accept Award
                                                                    </Button>
                                                                )
                                                            })()}
                                                            {isAdmin && (
                                                                <>
                                                                    <Button
                                                                        variant="plain"
                                                                        size="sm"
                                                                        icon={<HiOutlinePencil />}
                                                                        onClick={() => handleEditAward(award)}
                                                                        className="text-gray-400 hover:text-primary"
                                                                        disabled={award.status?.toLowerCase() === 'finalized'}
                                                                    />
                                                                    <Button
                                                                        variant="plain"
                                                                        size="sm"
                                                                        icon={<HiOutlineTrash />}
                                                                        onClick={() => handleDeleteAward(award.id)}
                                                                        className="text-gray-400 hover:text-red-500"
                                                                    />
                                                                </>
                                                            )}
                                                        </div>
                                                    </Table.Td>
                                                </Table.Tr>
                                                {isExpanded && payouts.length > 0 && (
                                                    <Table.Tr>
                                                        <Table.Td colSpan={8} className="bg-gray-50 dark:bg-gray-800/50 p-4">
                                                            <div className="space-y-3">
                                                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Payout History</h4>
                                                                <Table>
                                                                    <Table.THead>
                                                                        <Table.Tr>
                                                                            <Table.Th>Profit Date</Table.Th>
                                                                            <Table.Th>Profit</Table.Th>
                                                                            <Table.Th>Price per Share</Table.Th>
                                                                            <Table.Th>Shares</Table.Th>
                                                                            <Table.Th>Payout</Table.Th>
                                                                        </Table.Tr>
                                                                    </Table.THead>
                                                                    <Table.TBody>
                                                                        {payouts.map((payout, idx) => (
                                                                            <Table.Tr key={idx}>
                                                                                <Table.Td>
                                                                                    <span className="text-sm text-gray-900 dark:text-white">
                                                                                        {payout.profitDate 
                                                                                            ? payout.profitDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                                                                                            : 'N/A'}
                                                                                    </span>
                                                                                </Table.Td>
                                                                                <Table.Td>
                                                                                    <span className="text-sm text-gray-900 dark:text-white">
                                                                                        {formatCurrency(payout.profitAmount)}
                                                                                    </span>
                                                                                </Table.Td>
                                                                                <Table.Td>
                                                                                    <span className="text-sm text-gray-900 dark:text-white">
                                                                                        {formatCurrency(payout.pricePerShare)}
                                                                                    </span>
                                                                                </Table.Td>
                                                                                <Table.Td>
                                                                                    <span className="text-sm text-gray-900 dark:text-white">
                                                                                        {formatNumber(payout.sharesIssued)}
                                                                                    </span>
                                                                                </Table.Td>
                                                                                <Table.Td>
                                                                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                                                        {formatCurrency(payout.payout)}
                                                                                    </span>
                                                                                </Table.Td>
                                                                            </Table.Tr>
                                                                        ))}
                                                                    </Table.TBody>
                                                                </Table>
                                                                <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
                                                                    <div className="text-sm">
                                                                        <span className="text-gray-600 dark:text-gray-400">Total payout: </span>
                                                                        <span className="font-semibold text-gray-900 dark:text-white">
                                                                            {formatCurrency(totalPayout)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </Table.Td>
                                                    </Table.Tr>
                                                )}
                                            </React.Fragment>
                                        )
                                    })}
                                </Table.TBody>
                            </Table>
                        </Card>
                    )}

                    {/* Pagination */}
                    {stakeholder.profitAwards && stakeholder.profitAwards.length > 0 && (
                        <div className="flex items-center justify-end text-sm text-gray-500 dark:text-gray-400">
                            Page 1 of 1
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'details' && (
                <div className="space-y-6">
                    <Card className="p-6">
                        <div className="space-y-8">
                            {/* Stakeholder Details Section */}
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Stakeholder Details</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Edit the general information about the stakeholder.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full name</label>
                                    <Input
                                        value={detailsFormData.name}
                                        onChange={(e) => setDetailsFormData(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="Full legal name"
                                        disabled={!isAdmin}
                                        className={!isAdmin ? 'bg-gray-50 dark:bg-gray-800 cursor-not-allowed' : ''}
                                    />
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                                    <Input
                                        type="email"
                                        value={detailsFormData.email}
                                        onChange={(e) => setDetailsFormData(prev => ({ ...prev, email: e.target.value }))}
                                        placeholder="Email address"
                                        disabled={!isAdmin}
                                        className={!isAdmin ? 'bg-gray-50 dark:bg-gray-800 cursor-not-allowed' : ''}
                                    />
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
                                    <div className="flex items-center">
                                        <div className="flex items-center gap-1 px-3 h-10 bg-gray-100 dark:bg-gray-700 rounded-l-md border border-r-0 border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                            <span>+1</span>
                                        </div>
                                        <Input
                                            type="tel"
                                            value={detailsFormData.phone ? detailsFormData.phone.replace(/^\+1/, '') : ''}
                                            onChange={(e) => {
                                                const sanitized = e.target.value.replace(/[^0-9]/g, '')
                                                setDetailsFormData(prev => ({ ...prev, phone: sanitized }))
                                            }}
                                            placeholder="Phone number"
                                            className={`rounded-l-none flex-1 ${!isAdmin ? 'bg-gray-50 dark:bg-gray-800 cursor-not-allowed' : ''}`}
                                            disabled={!isAdmin}
                                        />
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Manager</label>
                                    <Select
                                        options={availableUsers.map(u => {
                                            let displayName = ''
                                            if (u.firstName && u.lastName) {
                                                displayName = `${u.firstName} ${u.lastName}`
                                            } else if (u.firstName) {
                                                displayName = u.firstName
                                            } else if (u.name) {
                                                displayName = u.name
                                            } else if (u.userName) {
                                                displayName = u.userName
                                            } else {
                                                displayName = u.email || 'Unknown'
                                            }
                                            return {
                                                value: u.id,
                                                label: displayName,
                                            }
                                        })}
                                        value={availableUsers.find(u => u.id === detailsFormData.managerId) ? {
                                            value: detailsFormData.managerId,
                                            label: (() => {
                                                const manager = availableUsers.find(u => u.id === detailsFormData.managerId)
                                                if (!manager) return 'Unknown'
                                                if (manager.firstName && manager.lastName) {
                                                    return `${manager.firstName} ${manager.lastName}`
                                                } else if (manager.firstName) {
                                                    return manager.firstName
                                                } else if (manager.name) {
                                                    return manager.name
                                                } else if (manager.userName) {
                                                    return manager.userName
                                                } else {
                                                    return manager.email || 'Unknown'
                                                }
                                            })()
                                        } : null}
                                        onChange={(opt) => {
                                            const newManagerId = opt?.value || null
                                            setDetailsFormData(prev => ({ ...prev, managerId: newManagerId }))
                                        }}
                                        placeholder="Select a manager from Bolt users..."
                                        isSearchable
                                        isClearable
                                        isDisabled={!isAdmin}
                                    />
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Select the manager/supervisor for this stakeholder. Managers will be able to see their direct reports.
                                    </p>
                                </div>
                                </div>
                            </div>

                            {/* Separator */}
                            <div className="border-t border-gray-200 dark:border-gray-700"></div>

                            {/* Permissions Section */}
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Permissions</h3>
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                                    <Select
                                        options={[
                                            { value: 'Admin', label: 'Admin - Full access to all features' },
                                            { value: 'Supervisor', label: 'Supervisor - Can view direct reports' },
                                            { value: 'User', label: 'User - View only access' },
                                        ]}
                                        value={reinsRole ? { 
                                            value: reinsRole, 
                                            label: reinsRole === 'Admin' ? 'Admin - Full access to all features' :
                                                   reinsRole === 'Supervisor' ? 'Supervisor - Can view direct reports' :
                                                   'User - View only access'
                                        } : null}
                                        onChange={(opt) => setReinsRole(opt?.value || 'User')}
                                        placeholder="Select..."
                                        isDisabled={!isAdmin}
                                    />
                                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                        <div><strong>Admin:</strong> Full access to all tabs and features</div>
                                        <div><strong>Supervisor:</strong> Can view Overview, Valuations, and their direct reports' awards</div>
                                        <div><strong>User:</strong> Can only view Overview, Valuations, and their own awards (My Awards)</div>
                                    </div>
                                </div>
                            </div>
                            
                            {isAdmin && (
                                <div className="mt-6 flex justify-end">
                                    <Button
                                        variant="solid"
                                        onClick={async () => {
                                            await handleSaveDetails()
                                            await handleSavePermissions()
                                        }}
                                    >
                                        Save details
                                    </Button>
                                </div>
                            )}
                            {!isAdmin && (
                                <div className="mt-6 flex justify-end">
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        View only - Contact an administrator to make changes
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            )}
                    </div>
                </div>
            </div>

            {/* Grant New Profit Award Drawer */}
            <Drawer
                isOpen={showNewAwardDrawer}
                onClose={() => {
                    setShowNewAwardDrawer(false)
                    setEditingAwardId(null)
                    setEditingAward(null)
                    setAwardFormData({
                        planId: null,
                        awardDate: new Date(),
                        awardStartDate: null,
                        awardEndDate: null,
                        triggerAmount: 0,
                        sharesIssued: '',
                    })
                }}
                title={editingAwardId ? (editingAward?.planName || "Edit Profit Award") : "Grant New Profit Award"}
                width={600}
            >
                <div className="flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        {/* Status Section (only when editing) */}
                        {editingAwardId && editingAward && (
                            <div className="space-y-4">
                                <div>
                                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</div>
                                    <Tag className={`px-2 py-1 text-xs font-medium ${
                                        editingAward.status === 'Draft' || editingAward.status === 'Pending'
                                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                    }`}>
                                        {editingAward.status || 'Draft'}
                                    </Tag>
                                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                        {editingAward.status === 'Finalized' ? 'Complete' : 'Awaiting Details'}
                                    </div>
                                </div>
                                
                                {/* Progress Bar */}
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div 
                                        className={`h-2 rounded-full transition-all ${
                                            editingAward.status === 'Finalized' 
                                                ? 'bg-green-500 w-full' 
                                                : 'bg-amber-500 w-1/3'
                                        }`}
                                    />
                                </div>
                                
                                {/* Issue Award button - only show if award is draft and user is admin */}
                                {isAdmin && editingAward && (editingAward.status?.toLowerCase() === 'draft' || editingAward.status === 'Draft' || !editingAward.status) && (
                                    <Button
                                        variant="solid"
                                        icon={<HiOutlineCheckCircle />}
                                        onClick={async () => {
                                            // Save the award first, then issue it
                                            await handleSaveAward('draft')
                                            // Small delay to ensure save completes
                                            setTimeout(() => {
                                                handleIssueAward(editingAward.id)
                                            }, 500)
                                        }}
                                        disabled={isGeneratingAwardDocument}
                                        loading={isGeneratingAwardDocument}
                                    >
                                        {isGeneratingAwardDocument ? 'Generating Document...' : 'Issue Award'}
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* Documents Section (only when editing) */}
                        {editingAwardId && editingAward && (
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Documents</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">View draft and final award document.</p>
                                </div>
                                
                                {editingAward.documentUrl ? (
                                    <Card className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded flex items-center justify-center">
                                                    <span className="text-red-600 dark:text-red-400 font-semibold text-xs">PDF</span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {editingAward.documentFileName || 'award-document.pdf'}
                                                    </p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">PDF Document</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="plain"
                                                    size="sm"
                                                    icon={<HiOutlineEye />}
                                                    onClick={() => setShowDocumentModal(true)}
                                                    className="text-gray-400 hover:text-primary"
                                                />
                                                <Button
                                                    variant="plain"
                                                    size="sm"
                                                    icon={<HiOutlineDownload />}
                                                    onClick={() => {
                                                        if (editingAward.documentUrl) {
                                                            window.open(editingAward.documentUrl, '_blank')
                                                        }
                                                    }}
                                                    className="text-gray-400 hover:text-primary"
                                                />
                                                <Button
                                                    variant="plain"
                                                    size="sm"
                                                    icon={<HiOutlineTrash />}
                                                    onClick={async () => {
                                                        if (window.confirm('Are you sure you want to delete this document?')) {
                                                            await handleDeleteAwardDocument()
                                                        }
                                                    }}
                                                    className="text-gray-400 hover:text-red-500"
                                                />
                                            </div>
                                        </div>
                                    </Card>
                                ) : (
                                    <Card className="p-4">
                                        <div className="text-center py-4">
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No document uploaded</p>
                                            <Button
                                                variant="twoTone"
                                                size="sm"
                                                onClick={() => setShowDocumentModal(true)}
                                            >
                                                Upload Document
                                            </Button>
                                        </div>
                                    </Card>
                                )}
                            </div>
                        )}

                        {/* Award Details Section */}
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Award Details</h3>
                                {!editingAwardId && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Customize the features of the award this stakeholder will receive under the plan.</p>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Plan
                                    </label>
                                    <Select
                                        options={profitPlans}
                                        value={profitPlans.find(opt => opt.value === awardFormData.planId) || null}
                                        onChange={async (opt) => {
                                            handleAwardInputChange('planId', opt?.value || null)
                                            // Load plan details when plan is selected (including trigger)
                                            if (opt?.value) {
                                                try {
                                                    const planRef = doc(db, 'profitSharingPlans', opt.value)
                                                    const planSnap = await getDoc(planRef)
                                                    if (planSnap.exists()) {
                                                        const planData = planSnap.data()
                                                        setSelectedPlan(planData || null)
                                                        // Automatically pull trigger from plan
                                                        const planTrigger = planData?.triggerAmount || planData?.milestoneAmount || planData?.milestone || 0
                                                        if (planTrigger) {
                                                            setAwardFormData(prev => ({
                                                                ...prev,
                                                                triggerAmount: planTrigger,
                                                            }))
                                                        } else {
                                                            setAwardFormData(prev => ({
                                                                ...prev,
                                                                triggerAmount: 0,
                                                            }))
                                                        }
                                                    } else {
                                                        setSelectedPlan(null)
                                                        setAwardFormData(prev => ({
                                                            ...prev,
                                                            triggerAmount: 0,
                                                        }))
                                                    }
                                                } catch (error) {
                                                    console.error('Error loading plan:', error)
                                                    setSelectedPlan(null)
                                                    setAwardFormData(prev => ({
                                                        ...prev,
                                                        triggerAmount: 0,
                                                    }))
                                                }
                                            } else {
                                                setSelectedPlan(null)
                                                setAwardFormData(prev => ({
                                                    ...prev,
                                                    triggerAmount: 0,
                                                }))
                                            }
                                        }}
                                        placeholder="Select..."
                                    />
                                </div>

                                {awardFormData.planId && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Award date
                                            </label>
                                            <DatePicker
                                                inputtable
                                                value={(() => {
                                                    if (!awardFormData.awardDate) return new Date()
                                                    if (awardFormData.awardDate instanceof Date) {
                                                        return isNaN(awardFormData.awardDate.getTime()) ? new Date() : awardFormData.awardDate
                                                    }
                                                    const parsed = new Date(awardFormData.awardDate)
                                                    return isNaN(parsed.getTime()) ? new Date() : parsed
                                                })()}
                                                onChange={(date) => handleAwardInputChange('awardDate', date)}
                                                placeholder="Select a date..."
                                                inputFormat="MM/DD/YYYY"
                                            />
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                The date this award is issued/sent to the stakeholder
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    Award start date
                                                </label>
                                                <DatePicker
                                                    inputtable
                                                    value={awardFormData.awardStartDate ? (awardFormData.awardStartDate instanceof Date ? awardFormData.awardStartDate : new Date(awardFormData.awardStartDate)) : null}
                                                    onChange={(date) => {
                                                        handleAwardInputChange('awardStartDate', date)
                                                    }}
                                                    placeholder="Select a date..."
                                                    inputFormat="MM/DD/YYYY"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    Award end date
                                                </label>
                                                <DatePicker
                                                    inputtable
                                                    value={awardFormData.awardEndDate ? (awardFormData.awardEndDate instanceof Date ? awardFormData.awardEndDate : new Date(awardFormData.awardEndDate)) : null}
                                                    onChange={(date) => {
                                                        handleAwardInputChange('awardEndDate', date)
                                                    }}
                                                    placeholder="Select a date..."
                                                    inputFormat="MM/DD/YYYY"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Trigger Section */}
                        {awardFormData.planId && (
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Trigger</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Plan profit threshold (trigger)
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">
                                                $
                                            </span>
                                            <Input
                                                type="text"
                                                value={awardFormData.triggerAmount ? formatCurrencyInput(String(awardFormData.triggerAmount)) : ''}
                                                disabled
                                                placeholder="0"
                                                className="pl-8 bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Pulled from the selected profit plan.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Number of profit shares issued
                                        </label>
                                        <Input
                                            type="text"
                                            value={awardFormData.sharesIssued}
                                            onChange={(e) => handleAwardInputChange('sharesIssued', e.target.value)}
                                            placeholder="e.g. 1,000"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Buttons - Only show for admins */}
                    {isAdmin && (
                        <div className="border-t border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
                            {editingAwardId && (
                                <Button
                                    variant="solid"
                                    color="red-600"
                                    onClick={async () => {
                                        if (window.confirm('Are you sure you want to delete this draft award?')) {
                                            await handleDeleteAward(editingAwardId)
                                            setShowNewAwardDrawer(false)
                                            setEditingAwardId(null)
                                            setEditingAward(null)
                                        }
                                    }}
                                >
                                    Delete Draft
                                </Button>
                            )}
                            <div className="flex items-center gap-3 ml-auto">
                                <Button
                                    variant="plain"
                                    icon={<HiOutlineEye />}
                                    onClick={async () => {
                                        // Prepare template data for preview
                                        try {
                                            // Get plan data
                                            let planData = null
                                            if (awardFormData.planId) {
                                                const planRef = doc(db, 'profitSharingPlans', awardFormData.planId)
                                                const planSnap = await getDoc(planRef)
                                                if (planSnap.exists()) {
                                                    planData = { id: planSnap.id, ...planSnap.data() }
                                                }
                                            }

                                            // Get company data
                                            let companyData = null
                                            if (planData?.companyId) {
                                                const companyResult = await FirebaseDbService.companies.getById(planData.companyId)
                                                if (companyResult.success) {
                                                    companyData = companyResult.data
                                                }
                                            }

                                            // Get stakeholder data
                                            const stakeholderData = stakeholder

                                            if (planData && companyData && stakeholderData) {
                                                // Prepare award data for preview
                                                const previewAwardData = {
                                                    awardDate: awardFormData.awardDate,
                                                    awardStartDate: awardFormData.awardStartDate,
                                                    awardEndDate: awardFormData.awardEndDate,
                                                    sharesIssued: awardFormData.sharesIssued ? parseInt(awardFormData.sharesIssued, 10) : 0,
                                                }

                                                // Store preview data in component state (we'll pass it to modal)
                                                setAwardPreviewData({
                                                    awardData: previewAwardData,
                                                    planData,
                                                    stakeholderData,
                                                    companyData,
                                                })
                                                setShowAwardPreview(true)
                                            } else {
                                                toast.push(
                                                    React.createElement(
                                                        Notification,
                                                        { type: "warning", duration: 2000, title: "Warning" },
                                                        "Please select a plan and ensure all required data is available"
                                                    )
                                                )
                                            }
                                        } catch (error) {
                                            console.error('Error preparing preview:', error)
                                            toast.push(
                                                React.createElement(
                                                    Notification,
                                                    { type: "danger", duration: 2000, title: "Error" },
                                                    "Failed to prepare document preview"
                                                )
                                            )
                                        }
                                    }}
                                    disabled={!awardFormData.planId || !isAwardFormComplete()}
                                >
                                    View Draft
                                </Button>
                                <Button
                                    variant="twoTone"
                                    icon={<HiOutlinePencil />}
                                    onClick={() => handleSaveAward('draft')}
                                    disabled={!isAwardFormComplete()}
                                >
                                    Save Draft
                                </Button>
                                <Button
                                    variant="solid"
                                    icon={<HiOutlineCheckCircle />}
                                    onClick={async () => {
                                        // Save as draft first, then issue
                                        await handleSaveAward('draft')
                                        // Small delay to ensure save completes
                                        setTimeout(async () => {
                                            const currentData = await FirebaseDbService.stakeholders.getById(stakeholderId)
                                            if (currentData.success) {
                                                const awards = currentData.data.profitAwards || []
                                                const awardToIssue = editingAwardId 
                                                    ? awards.find(a => a.id === editingAwardId)
                                                    : awards[awards.length - 1] // Get the last one (just saved)
                                                if (awardToIssue) {
                                                    await handleIssueAward(awardToIssue.id)
                                                }
                                            }
                                        }, 500)
                                    }}
                                    disabled={!isAwardFormComplete() || isGeneratingAwardDocument}
                                    loading={isGeneratingAwardDocument}
                                >
                                    {isGeneratingAwardDocument ? 'Generating Document...' : 'Issue'}
                                </Button>
                            </div>
                        </div>
                    )}
                    {!isAdmin && (
                        <div className="border-t border-gray-200 dark:border-gray-700 p-6">
                            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                                View only - Contact an administrator to make changes
                            </div>
                        </div>
                    )}
                </div>
            </Drawer>

            {/* Award Document Preview Modal */}
            <DocumentPreviewModal
                isOpen={showAwardPreview}
                onClose={() => {
                    setShowAwardPreview(false)
                    setAwardPreviewData(null)
                }}
                templateType="AWARD"
                templateData={awardPreviewData}
                documentName={`award-preview-${stakeholder?.name || 'stakeholder'}`}
                autoGenerate={true}
            />

            {/* Document Viewer Modal */}
            <AwardDocumentModal
                isOpen={showDocumentModal}
                onClose={() => setShowDocumentModal(false)}
                award={editingAward}
                stakeholderId={stakeholderId}
                isAdmin={isAdmin}
                onDocumentUpdated={async () => {
                    // Reload stakeholder data to get updated document info
                    if (stakeholderId) {
                        const response = await FirebaseDbService.stakeholders.getById(stakeholderId)
                        if (response.success) {
                            const data = response.data
                            const updatedAward = data.profitAwards?.find(a => a.id === editingAwardId)
                            if (updatedAward) {
                                setEditingAward(updatedAward)
                            }
                        }
                    }
                }}
            />
        </div>
    )
}

export default StakeholderDetail

