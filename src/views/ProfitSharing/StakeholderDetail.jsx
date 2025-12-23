import { useState, useEffect, useCallback } from 'react'
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
    const { userRole, canEdit, loading: loadingAccess } = useProfitSharingAccess()
    const { selectedCompanyId } = useSelectedCompany()
    const isAdmin = canEdit || userRole === 'admin'
    const isRegularUser = !isAdmin
    const [activeTab, setActiveTab] = useState('profit')
    const [stakeholder, setStakeholder] = useState(null)
    const [linkedUserProfile, setLinkedUserProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [showNewAwardDrawer, setShowNewAwardDrawer] = useState(false)
    const [showAwardPreview, setShowAwardPreview] = useState(false)
    const [awardPreviewData, setAwardPreviewData] = useState(null)
    const [profitPlans, setProfitPlans] = useState([])
    const [awardFormData, setAwardFormData] = useState({
        planId: null,
        awardDate: new Date(), // Default to current date
        awardStartDate: null,
        awardEndDate: null,
        milestoneAmount: 0,
        sharesIssued: '',
    })
    const [editingAwardId, setEditingAwardId] = useState(null)
    const [detailsFormData, setDetailsFormData] = useState({
        name: '',
        title: '',
        email: '',
        phone: '',
        employmentStatus: null,
        payType: null,
        payAmount: '',
    })
    const [reinsRole, setReinsRole] = useState('User')
    const [availableUsers, setAvailableUsers] = useState([])
    const [showDocumentModal, setShowDocumentModal] = useState(false)
    const [editingAward, setEditingAward] = useState(null)
    const [selectedPlan, setSelectedPlan] = useState(null)
    const [valuations, setValuations] = useState([])
    const [expandedAwardId, setExpandedAwardId] = useState(null)

    useEffect(() => {
        // Wait for access to load before checking permissions
        if (loadingAccess) {
            return
        }
        
        const loadStakeholder = async () => {
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
                    
                    // Check if regular user is trying to access someone else's record
                    // Only check if user is NOT an admin (admins can access all records)
                    const currentIsAdmin = canEdit || userRole === 'admin'
                    if (!currentIsAdmin) {
                        const currentUserId = user?.id || user?.uid
                        if (data.linkedUserId !== currentUserId) {
                            // Regular user trying to access someone else's record - redirect
                            toast.push(
                                React.createElement(
                                    Notification,
                                    { type: "warning", duration: 2000, title: "Access Denied" },
                                    "You can only view your own stakeholder information."
                                )
                            )
                            navigate('/profit-sharing?tab=stakeholders')
                            return
                        }
                    }
                    
                    // Format the stakeholder data to match expected structure
                    setStakeholder({
                        id: data.id,
                        name: data.name || '',
                        title: data.title || '',
                        email: data.email || '',
                        phone: data.phone || '',
                        employmentStatus: data.employmentStatus || '',
                        payType: data.payType || '',
                        payAmount: data.payAmount || 0,
                        stockAwards: data.stockAwards || [],
                        profitAwards: data.profitAwards || [],
                        totalStockUnits: data.mareStock || 0,
                        estimatedFMV: 0, // Calculate this if needed
                        totalAwards: (data.stockAwards?.length || 0) + (data.profitAwards?.length || 0),
                        linkedUserId: data.linkedUserId,
                    })

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
        }

        loadStakeholder()
        loadProfitPlans()
        loadUsers()
    }, [stakeholderId, navigate, loadingAccess, canEdit, userRole, user, selectedCompanyId])

    useEffect(() => {
        if (stakeholder) {
            // Normalize employment status and pay type for the form
            const normalizeEmploymentStatus = (status) => {
                if (!status) return null
                const statusMap = {
                    'Full time': 'full-time',
                    'Part Time': 'part-time',
                    'Contract': 'contract',
                    'Intern': 'intern',
                    'Seasonal': 'seasonal',
                }
                return statusMap[status] || status.toLowerCase().replace(' ', '-')
            }

            const normalizePayType = (payType) => {
                if (!payType) return null
                return payType.toLowerCase()
            }

            // Extract phone number (remove +1 prefix if present)
            const phoneNumber = stakeholder.phone ? stakeholder.phone.replace(/^\+1/, '') : ''

            // Use Bolt profile data if available (for linked users), otherwise fall back to stakeholder data
            // Match the logic from StakeholdersTab: use firstName primarily, fallback to userName, name, or email
            const displayName = linkedUserProfile 
                ? (linkedUserProfile.firstName || linkedUserProfile.userName || linkedUserProfile.name || stakeholder.name || stakeholder.email || '')
                : (stakeholder.name || stakeholder.email || '')
            
            const displayPhone = linkedUserProfile?.phoneNumber 
                ? linkedUserProfile.phoneNumber.replace(/^\+1/, '')
                : phoneNumber

            setDetailsFormData({
                name: displayName,
                title: stakeholder.title || '',
                email: linkedUserProfile?.email || stakeholder.email || '',
                phone: displayPhone,
                employmentStatus: normalizeEmploymentStatus(stakeholder.employmentStatus),
                payType: normalizePayType(stakeholder.payType),
                payAmount: stakeholder.payAmount ? String(stakeholder.payAmount) : '',
            })
            setReinsRole(stakeholder.reinsRole || 'User')
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
            if (!selectedCompanyId) {
                setProfitPlans([])
                return
            }
            
            const plansRef = collection(db, 'profitSharingPlans')
            const querySnapshot = await getDocs(plansRef)
            const plansData = []
            querySnapshot.forEach((doc) => {
                const data = doc.data()
                // Only include plans from the selected company
                if (data.companyId === selectedCompanyId) {
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
            const valuationsRef = collection(db, 'valuations')
            const q = query(valuationsRef, orderBy('valuationDate', 'desc'))
            const querySnapshot = await getDocs(q)
            const valuationsData = []
            querySnapshot.forEach((doc) => {
                const data = doc.data()
                // Filter by companyId
                if (data.companyId === selectedCompanyId) {
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
    }, [selectedCompanyId])
    
    // Load valuations when selectedCompanyId changes
    useEffect(() => {
        if (selectedCompanyId) {
            loadValuations()
        } else {
            setValuations([])
        }
    }, [selectedCompanyId, loadValuations])

    // Calculate payouts for a specific award
    const calculateAwardPayouts = (award) => {
        if (!award || !award.planId || !award.sharesIssued) return []
        
        const awardStart = award.awardStartDate ? new Date(award.awardStartDate) : null
        const awardEnd = award.awardEndDate ? new Date(award.awardEndDate) : null
        
        if (!awardStart || !awardEnd) return []
        
        return valuations
            .filter(v => {
                if (!v.valuationDate || v.planId !== award.planId) return false
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
        if (field === 'milestoneAmount') {
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
            awardFormData.milestoneAmount > 0 &&
            awardFormData.sharesIssued && parseInt(awardFormData.sharesIssued, 10) > 0
        )
    }

    const handleSaveDetails = async () => {
        try {
            if (!stakeholderId) return

            const stakeholderRef = doc(db, 'stakeholders', stakeholderId)
            const payAmountNum = detailsFormData.payAmount ? parseFloat(detailsFormData.payAmount.replace(/,/g, '')) : 0

            // Denormalize employment status and pay type for storage
            const denormalizeEmploymentStatus = (status) => {
                if (!status) return null
                const statusMap = {
                    'full-time': 'Full time',
                    'part-time': 'Part Time',
                    'contract': 'Contract',
                    'intern': 'Intern',
                    'seasonal': 'Seasonal',
                }
                return statusMap[status] || status
            }

            const denormalizePayType = (payType) => {
                if (!payType) return null
                return payType === 'salary' ? 'Salary' : payType === 'hourly' ? 'Hourly' : payType
            }

            await updateDoc(stakeholderRef, {
                name: detailsFormData.name,
                title: detailsFormData.title,
                email: detailsFormData.email,
                phone: detailsFormData.phone ? `+1${detailsFormData.phone}` : '',
                employmentStatus: denormalizeEmploymentStatus(detailsFormData.employmentStatus),
                payType: denormalizePayType(detailsFormData.payType),
                payAmount: payAmountNum,
                updatedAt: serverTimestamp(),
            })

            toast.push(
                React.createElement(
                    Notification,
                    { type: "success", duration: 2000, title: "Success" },
                    "Stakeholder details saved successfully"
                )
            )

            // Reload stakeholder data
            const response = await FirebaseDbService.stakeholders.getById(stakeholderId)
            if (response.success) {
                const data = response.data
                setStakeholder({
                    id: data.id,
                    name: data.name || '',
                    title: data.title || '',
                    email: data.email || '',
                    phone: data.phone || '',
                    employmentStatus: data.employmentStatus || '',
                    payType: data.payType || '',
                    payAmount: data.payAmount || 0,
                    stockAwards: data.stockAwards || [],
                    profitAwards: data.profitAwards || [],
                    totalStockUnits: data.mareStock || 0,
                    estimatedFMV: 0,
                    totalAwards: (data.stockAwards?.length || 0) + (data.profitAwards?.length || 0),
                    reinsRole: data.reinsRole || 'User',
                })
            }
        } catch (error) {
            console.error('Error saving details:', error)
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

            await updateDoc(stakeholderRef, {
                reinsRole: reinsRole,
                updatedAt: serverTimestamp(),
            })

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
                setStakeholder({
                    ...stakeholder,
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
                setStakeholder({
                    id: data.id,
                    name: data.name || '',
                    title: data.title || '',
                    email: data.email || '',
                    phone: data.phone || '',
                    employmentStatus: data.employmentStatus || '',
                    payType: data.payType || '',
                    payAmount: data.payAmount || 0,
                    stockAwards: data.stockAwards || [],
                    profitAwards: data.profitAwards || [],
                    totalStockUnits: data.mareStock || 0,
                    estimatedFMV: 0,
                    totalAwards: (data.stockAwards?.length || 0) + (data.profitAwards?.length || 0),
                    reinsRole: data.reinsRole || 'User',
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

    const handleEditAward = async (award) => {
        // Regular users cannot edit awards
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
            milestoneAmount: award.milestoneAmount || 0,
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
                planMilestoneAmount: awardFormData.milestoneAmount || 0,
                awardDate: awardDateValue.toISOString(),
                awardStartDate: awardFormData.awardStartDate instanceof Date 
                    ? awardFormData.awardStartDate.toISOString() 
                    : (awardFormData.awardStartDate || null),
                awardEndDate: awardFormData.awardEndDate instanceof Date 
                    ? awardFormData.awardEndDate.toISOString() 
                    : (awardFormData.awardEndDate || null),
                milestoneAmount: awardFormData.milestoneAmount || 0,
                sharesIssued: awardFormData.sharesIssued ? parseInt(awardFormData.sharesIssued, 10) : 0,
                paymentSchedule: selectedPlan?.schedule || 'Annually',
                status: status === 'finalized' ? 'Finalized' : 'Draft',
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
                toast.push(
                    React.createElement(
                        Notification,
                        { type: "warning", duration: 2000, title: "Warning" },
                        "Award saved, but document generation failed. Please try again."
                    )
                )
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
                setStakeholder({
                    id: data.id,
                    name: data.name || '',
                    title: data.title || '',
                    email: data.email || '',
                    phone: data.phone || '',
                    employmentStatus: data.employmentStatus || '',
                    payType: data.payType || '',
                    payAmount: data.payAmount || 0,
                    stockAwards: data.stockAwards || [],
                    profitAwards: data.profitAwards || [],
                    totalStockUnits: data.mareStock || 0,
                    estimatedFMV: 0,
                    totalAwards: (data.stockAwards?.length || 0) + (data.profitAwards?.length || 0),
                    reinsRole: data.reinsRole || 'User',
                })
            }

            // If this award was finalized, notify the linked Bolt user (if any)
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
                milestoneAmount: 0,
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
        { key: 'stakeholders', label: isAdmin ? 'Stakeholders' : 'My Awards', icon: <HiOutlineUsers />, adminOnly: false },
        { key: 'valuations', label: 'Valuations', icon: <HiOutlineChartBar />, adminOnly: true },
        { key: 'milestones', label: 'Trigger Tracking', icon: <HiOutlineFlag />, adminOnly: true },
        { key: 'settings', label: 'Settings', icon: <HiOutlineCog />, adminOnly: true },
    ]
    
    // Filter sidebar items based on role - regular users should not see other tabs
    const sidebarItems = isAdmin 
        ? allSidebarItems 
        : allSidebarItems.filter(item => item.key === 'stakeholders').map(item => ({
            ...item,
            label: 'My Awards' // Ensure label is "My Awards" for non-admins
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
                    {isAdmin
                        ? stakeholder.name
                        : 'My Awards'}
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
                    {/* Next Estimated Profit Payment Card */}
                    <Card className="p-6">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Next Estimated Profit Payment</h3>
                                <div className="group relative">
                                    <HiOutlineInformationCircle className="w-4 h-4 text-gray-400 cursor-help" />
                                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10 pointer-events-none">
                                        <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 w-64 shadow-lg">
                                            This is an estimate based on previous performance and latest progress updates. Actual payment amount will vary once finalized by an administrator.
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                {(() => {
                                    if (!stakeholder.profitAwards || stakeholder.profitAwards.length === 0) {
                                        return (
                                            <>
                                                <div className="text-3xl font-bold text-gray-900 dark:text-white">$0.00</div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                    No awards available
                                                </div>
                                            </>
                                        )
                                    }
                                    
                                    // Calculate estimated payout using latest valuation's price per share
                                    // For each active award, find the latest valuation and calculate: shares × price per share
                                    let totalEstimatedPayout = 0
                                    let nextPaymentDate = null
                                    let hasActiveAwards = false
                                    let debugInfo = [] // For debugging
                                    
                                    const today = new Date()
                                    today.setHours(0, 0, 0, 0)
                                    
                                    // Get the latest/active valuation overall (fallback if plan-specific not found)
                                    const latestValuationOverall = valuations.length > 0
                                        ? valuations.sort((a, b) => {
                                            const aDate = a.valuationDate?.getTime() || 0
                                            const bDate = b.valuationDate?.getTime() || 0
                                            return bDate - aDate // Most recent first
                                          })[0]
                                        : null
                                    
                                    stakeholder.profitAwards.forEach(award => {
                                        if (!award.sharesIssued || award.sharesIssued === 0) {
                                            debugInfo.push(`Award ${award.id}: No shares issued`)
                                            return
                                        }
                                        
                                        // Try to find valuation for this specific plan first
                                        let latestValuation = null
                                        if (award.planId) {
                                            const planValuations = valuations
                                                .filter(v => v.planId === award.planId)
                                                .sort((a, b) => {
                                                    const aDate = a.valuationDate?.getTime() || 0
                                                    const bDate = b.valuationDate?.getTime() || 0
                                                    return bDate - aDate // Most recent first
                                                })
                                            
                                            if (planValuations.length > 0) {
                                                latestValuation = planValuations[0]
                                            }
                                        }
                                        
                                        // Fallback to latest valuation overall if no plan-specific one found
                                        if (!latestValuation && latestValuationOverall) {
                                            latestValuation = latestValuationOverall
                                        }
                                        
                                        if (latestValuation) {
                                            // Calculate price per share
                                            const pricePerShare = latestValuation.pricePerShare || 
                                                (latestValuation.profitAmount && latestValuation.totalShares && latestValuation.totalShares > 0
                                                    ? latestValuation.profitAmount / latestValuation.totalShares 
                                                    : 0)
                                            
                                            if (pricePerShare > 0) {
                                                const awardPayout = (award.sharesIssued || 0) * pricePerShare
                                                totalEstimatedPayout += awardPayout
                                                hasActiveAwards = true
                                                
                                                debugInfo.push(`Award ${award.id}: ${award.sharesIssued} shares × $${pricePerShare.toFixed(2)} = $${awardPayout.toFixed(2)}`)
                                                
                                                // Track the next payment date (award end date if it's upcoming)
                                                if (award.awardEndDate) {
                                                    const endDate = new Date(award.awardEndDate)
                                                    endDate.setHours(0, 0, 0, 0)
                                                    if (endDate >= today && (!nextPaymentDate || endDate < nextPaymentDate)) {
                                                        nextPaymentDate = endDate
                                                    }
                                                }
                                            } else {
                                                debugInfo.push(`Award ${award.id}: Price per share is 0 (profit: ${latestValuation.profitAmount}, shares: ${latestValuation.totalShares})`)
                                            }
                                        } else {
                                            debugInfo.push(`Award ${award.id}: No valuation found (planId: ${award.planId}, total valuations: ${valuations.length})`)
                                        }
                                    })
                                    
                                    // Log debug info to console for troubleshooting
                                    // Debug logs disabled
                                    
                                    if (!hasActiveAwards || totalEstimatedPayout === 0) {
                                        // Check if there are upcoming awards without valuations yet
                                        const upcomingAward = stakeholder.profitAwards
                                            .filter(award => {
                                                const endDate = award.awardEndDate ? new Date(award.awardEndDate) : null
                                                return endDate && endDate > today
                                            })
                                            .sort((a, b) => {
                                                const aDate = a.awardEndDate ? new Date(a.awardEndDate).getTime() : 0
                                                const bDate = b.awardEndDate ? new Date(b.awardEndDate).getTime() : 0
                                                return aDate - bDate // Earliest first
                                            })[0]
                                        
                                        if (upcomingAward) {
                                            const endDate = upcomingAward.awardEndDate ? new Date(upcomingAward.awardEndDate) : null
                                            return (
                                                <>
                                                    <div className="text-3xl font-bold text-gray-900 dark:text-white">$0.00</div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                        Pending - After {endDate ? endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                                    </div>
                                                </>
                                            )
                                        }
                                        
                                        return (
                                            <>
                                                <div className="text-3xl font-bold text-gray-900 dark:text-white">$0.00</div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                    No valuations available yet
                                                </div>
                                            </>
                                        )
                                    }
                                    
                                    return (
                                        <>
                                            <div className="text-3xl font-bold text-gray-900 dark:text-white">
                                                {formatCurrency(totalEstimatedPayout)}
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                {nextPaymentDate 
                                                    ? `Estimated - ${nextPaymentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                                                    : 'Based on latest valuation'}
                                            </div>
                                        </>
                                    )
                                })()}
                            </div>
                        </div>
                    </Card>

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
                                        const payouts = calculateAwardPayouts(award)
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
                                                            <Tag className={`px-2 py-1 text-xs font-medium ${
                                                                award.status === 'Draft' || award.status === 'Pending'
                                                                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                                                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                            }`}>
                                                                <span className="flex items-center gap-2">
                                                                    <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                                                                    {award.status || 'Draft'}
                                                                </span>
                                                            </Tag>
                                                            {/* Signature Status */}
                                                            {award.status === 'Finalized' && (
                                                                award.signatureMetadata ? (
                                                                    <Tag className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">
                                                                        <HiOutlineCheckCircle className="mr-1" />
                                                                        Signed
                                                                    </Tag>
                                                                ) : (
                                                                    <Tag className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs">
                                                                        Signature Pending
                                                                    </Tag>
                                                                )
                                                            )}
                                                        </div>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <div className="flex items-center gap-2">
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
                                                            {isAdmin && (
                                                                <>
                                                                    <Button
                                                                        variant="plain"
                                                                        size="sm"
                                                                        icon={<HiOutlineTrash />}
                                                                        onClick={() => handleDeleteAward(award.id)}
                                                                        className="text-gray-400 hover:text-red-500"
                                                                    />
                                                                    <Button
                                                                        variant="plain"
                                                                        size="sm"
                                                                        icon={<HiOutlinePencil />}
                                                                        onClick={() => handleEditAward(award)}
                                                                        className="text-gray-400 hover:text-primary"
                                                                    />
                                                                </>
                                                            )}
                                                        </div>
                                                        {!isAdmin && (
                                                            <span className="text-xs text-gray-400">View only</span>
                                                        )}
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
                                                                            <Table.Th>Estimated Payout</Table.Th>
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
                                                                        <span className="text-gray-600 dark:text-gray-400">Total estimated payout: </span>
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
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                                    <Input
                                        value={detailsFormData.title}
                                        onChange={(e) => setDetailsFormData(prev => ({ ...prev, title: e.target.value }))}
                                        placeholder="Their role in the company"
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
                                            value={detailsFormData.phone.replace(/^\+1/, '')}
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
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Employment status</label>
                                    <Select
                                        options={[
                                            { value: 'full-time', label: 'Full-time' },
                                            { value: 'part-time', label: 'Part Time' },
                                            { value: 'contract', label: 'Contract' },
                                            { value: 'intern', label: 'Intern' },
                                            { value: 'seasonal', label: 'Seasonal' },
                                        ]}
                                        value={detailsFormData.employmentStatus ? {
                                            value: detailsFormData.employmentStatus,
                                            label: detailsFormData.employmentStatus === 'full-time' ? 'Full-time' :
                                                   detailsFormData.employmentStatus === 'part-time' ? 'Part Time' :
                                                   detailsFormData.employmentStatus === 'contract' ? 'Contract' :
                                                   detailsFormData.employmentStatus === 'intern' ? 'Intern' :
                                                   detailsFormData.employmentStatus === 'seasonal' ? 'Seasonal' : detailsFormData.employmentStatus
                                        } : null}
                                        onChange={(opt) => setDetailsFormData(prev => ({ ...prev, employmentStatus: opt?.value || null }))}
                                        placeholder="Select..."
                                        isDisabled={!isAdmin}
                                    />
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Pay type</label>
                                    <Select
                                        options={[
                                            { value: 'salary', label: 'Salary' },
                                            { value: 'hourly', label: 'Hourly' },
                                        ]}
                                        value={detailsFormData.payType ? {
                                            value: detailsFormData.payType,
                                            label: detailsFormData.payType === 'salary' ? 'Salary' : 'Hourly'
                                        } : null}
                                        onChange={(opt) => setDetailsFormData(prev => ({ ...prev, payType: opt?.value || null }))}
                                        placeholder="Select..."
                                        isDisabled={!isAdmin}
                                    />
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {detailsFormData.payType === 'salary' ? 'Salary' : detailsFormData.payType === 'hourly' ? 'Hourly rate' : 'Amount'}
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">
                                            $
                                        </span>
                                        <Input
                                            type="text"
                                            value={detailsFormData.payAmount ? formatCurrencyInput(String(detailsFormData.payAmount)) : ''}
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/[^0-9.]/g, '')
                                                setDetailsFormData(prev => ({ ...prev, payAmount: value }))
                                            }}
                                            placeholder="0"
                                            className={`pl-8 ${!isAdmin ? 'bg-gray-50 dark:bg-gray-800 cursor-not-allowed' : ''}`}
                                            disabled={!isAdmin}
                                        />
                                    </div>
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
                                            { value: 'User', label: 'User' },
                                            { value: 'Admin', label: 'Admin' },
                                        ]}
                                        value={reinsRole ? { value: reinsRole, label: reinsRole } : null}
                                        onChange={(opt) => setReinsRole(opt?.value || 'User')}
                                        placeholder="Select..."
                                        isDisabled={!isAdmin}
                                    />
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
                        milestoneAmount: 0,
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
                                
                                {/* Finalize Award button - only show if plan is draft and user is admin */}
                                {isAdmin && selectedPlan && selectedPlan.status === 'draft' && editingAward.status !== 'Finalized' && (
                                    <Button
                                        variant="solid"
                                        icon={<HiOutlineCheckCircle />}
                                        onClick={() => {
                                            const planId = editingAward.planId
                                            if (planId) {
                                                navigate(`/profit-sharing/create-profit-plan?id=${planId}`)
                                            }
                                        }}
                                    >
                                        Finalize Award
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
                                            // Load plan details when plan is selected (including milestone)
                                            if (opt?.value) {
                                                try {
                                                    const planRef = doc(db, 'profitSharingPlans', opt.value)
                                                    const planSnap = await getDoc(planRef)
                                                    if (planSnap.exists()) {
                                                        const planData = planSnap.data()
                                                        setSelectedPlan(planData || null)
                                                        // Automatically pull milestone from plan
                                                        const planMilestone = planData?.milestoneAmount || planData?.milestone || 0
                                                        if (planMilestone) {
                                                            setAwardFormData(prev => ({
                                                                ...prev,
                                                                milestoneAmount: planMilestone,
                                                            }))
                                                        } else {
                                                            setAwardFormData(prev => ({
                                                                ...prev,
                                                                milestoneAmount: 0,
                                                            }))
                                                        }
                                                    } else {
                                                        setSelectedPlan(null)
                                                        setAwardFormData(prev => ({
                                                            ...prev,
                                                            milestoneAmount: 0,
                                                        }))
                                                    }
                                                } catch (error) {
                                                    console.error('Error loading plan:', error)
                                                    setSelectedPlan(null)
                                                    setAwardFormData(prev => ({
                                                        ...prev,
                                                        milestoneAmount: 0,
                                                    }))
                                                }
                                            } else {
                                                setSelectedPlan(null)
                                                setAwardFormData(prev => ({
                                                    ...prev,
                                                    milestoneAmount: 0,
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
                                                    value={awardFormData.awardStartDate ? (awardFormData.awardStartDate instanceof Date ? awardFormData.awardStartDate : new Date(awardFormData.awardStartDate)) : null}
                                                    onChange={(date) => handleAwardInputChange('awardStartDate', date)}
                                                    placeholder="Select a date..."
                                                    inputFormat="MM/DD/YYYY"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    Award end date
                                                </label>
                                                <DatePicker
                                                    value={awardFormData.awardEndDate ? (awardFormData.awardEndDate instanceof Date ? awardFormData.awardEndDate : new Date(awardFormData.awardEndDate)) : null}
                                                    onChange={(date) => handleAwardInputChange('awardEndDate', date)}
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
                                                value={awardFormData.milestoneAmount ? formatCurrencyInput(String(awardFormData.milestoneAmount)) : ''}
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
                                >
                                    Save draft
                                </Button>
                                <Button
                                    variant="solid"
                                    icon={<HiOutlineCheckCircle />}
                                    onClick={() => handleSaveAward('finalized')}
                                    disabled={!isAwardFormComplete()}
                                >
                                    Finalize
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

