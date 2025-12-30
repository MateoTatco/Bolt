import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { Card, Button, Avatar, Tag, Table } from '@/components/ui'
import { HiOutlineLockClosed, HiOutlineUsers, HiOutlineEye, HiOutlineDocumentText } from 'react-icons/hi'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { useProfitSharingAccess } from '@/hooks/useProfitSharingAccess'
import { useSessionUser } from '@/store/authStore'
import { db } from '@/configs/firebase.config'
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore'
import { useSelectedCompany } from '@/hooks/useSelectedCompany'
import { createNotification } from '@/utils/notificationHelper'
import { NOTIFICATION_TYPES } from '@/constants/notification.constant'
import PdfViewerModal from './components/PdfViewerModal'
import AwardDocumentModal from './components/AwardDocumentModal'

const getInitials = (name) => {
    if (!name) return ''
    const parts = name.split(' ')
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name[0].toUpperCase()
}

const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value)
}

const formatNumber = (value) => {
    return new Intl.NumberFormat('en-US').format(value)
}

const OverviewTab = () => {
    const navigate = useNavigate()
    const user = useSessionUser((state) => state.user)
    const { selectedCompanyId, loading: loadingCompany } = useSelectedCompany()
    const { userRole, accessRecords, isSupervisor } = useProfitSharingAccess()
    const isAdmin = userRole === 'admin'
    const [stakeholders, setStakeholders] = useState([])
    const [loadingStakeholders, setLoadingStakeholders] = useState(true)
    const [activeValuation, setActiveValuation] = useState(null)
    const [plans, setPlans] = useState([])
    const [loadingPlans, setLoadingPlans] = useState(true)
    const [companies, setCompanies] = useState([])
    // For non-admin: their own stakeholder data across all companies
    const [myStakeholderData, setMyStakeholderData] = useState([])
    const [loadingMyData, setLoadingMyData] = useState(true)
    // Document viewing modals
    const [showPlanDocumentModal, setShowPlanDocumentModal] = useState(false)
    const [selectedPlanDocumentUrl, setSelectedPlanDocumentUrl] = useState(null)
    const [showAwardDocumentModal, setShowAwardDocumentModal] = useState(false)
    const [selectedAward, setSelectedAward] = useState(null)
    const [selectedStakeholderId, setSelectedStakeholderId] = useState(null)

    // Derived aggregates (company-wide, for admins)
    const companyValuation = activeValuation
        ? (typeof activeValuation.fmv === 'number' && activeValuation.fmv > 0
            ? activeValuation.fmv
            : activeValuation.profitAmount || 0)
        : 0

    // Total profit shares across all plans
    const totalProfitShares = plans.reduce((sum, plan) => sum + (plan.totalShares || 0), 0)

    // Total shares issued across all stakeholder awards
    const usedProfitShares = stakeholders.reduce((outerSum, stakeholder) => {
        const awards = stakeholder.profitAwards || []
        const stakeholderShares = awards.reduce((innerSum, award) => innerSum + (award.sharesIssued || 0), 0)
        return outerSum + stakeholderShares
    }, 0)

    const profitSharePool = totalProfitShares
    const usedStockUnits = usedProfitShares
    const stockPool = profitSharePool

    const remainingStockUnits = Math.max(stockPool - usedStockUnits, 0)
    const usedPercentage = stockPool > 0 ? (usedStockUnits / stockPool) * 100 : 0
    const remainingPercentage = stockPool > 0 ? (remainingStockUnits / stockPool) * 100 : 0

    const totalStakeholders = stakeholders.length

    // Number of profit awards granted (all statuses)
    const outstandingAwards = stakeholders.reduce((sum, stakeholder) => {
        const awards = stakeholder.profitAwards || []
        return sum + awards.length
    }, 0)

    const estimatedValuation = companyValuation

    // Track which payment date reminders have been sent (to avoid duplicates)
    const paymentRemindersSentRef = useRef(new Set())

    // Load stakeholders and valuation from Firebase
    useEffect(() => {
        if (loadingCompany) return
        
        // Load companies first (needed for both admin and non-admin)
        loadCompanies()
        
        if (isAdmin) {
            // Admin: load company-specific data
            if (!selectedCompanyId) return
            loadStakeholders()
            loadActiveValuation()
            loadPlans()
        } else {
            // Non-admin: load their own data across all companies they have access to
            loadMyStakeholderData()
            loadMyPlans()
        }
        
        // Listen for stakeholder updates
        const handleStakeholdersUpdate = () => {
            if (isAdmin) {
                loadStakeholders()
            } else {
                loadMyStakeholderData()
            }
        }
        window.addEventListener('stakeholdersUpdated', handleStakeholdersUpdate)
        
        // Listen for valuation updates
        const handleValuationsUpdate = () => {
            if (isAdmin) {
                loadActiveValuation()
            }
        }
        window.addEventListener('valuationsUpdated', handleValuationsUpdate)
        
        const handlePlansUpdate = () => {
            if (isAdmin) {
                loadPlans()
            } else {
                loadMyPlans()
            }
        }
        window.addEventListener('plansUpdated', handlePlansUpdate)

        return () => {
            window.removeEventListener('stakeholdersUpdated', handleStakeholdersUpdate)
            window.removeEventListener('valuationsUpdated', handleValuationsUpdate)
            window.removeEventListener('plansUpdated', handlePlansUpdate)
        }
    }, [selectedCompanyId, loadingCompany, isAdmin])

    const loadCompanies = async () => {
        try {
            const result = await FirebaseDbService.companies.getAll()
            if (result.success) {
                setCompanies(result.data)
            }
        } catch (error) {
            console.error('Error loading companies:', error)
        }
    }

    const loadStakeholders = async () => {
        if (!selectedCompanyId) {
            setStakeholders([])
            setLoadingStakeholders(false)
            return
        }
        
        setLoadingStakeholders(true)
        try {
            const response = await FirebaseDbService.stakeholders.getAll()
            if (response.success) {
                // Filter by companyId and convert Firestore timestamps
                let formattedStakeholders = response.data
                    .filter(stakeholder => stakeholder.companyId === selectedCompanyId)
                    .map(stakeholder => ({
                        ...stakeholder,
                        // Handle Firestore Timestamp objects
                        createdAt: stakeholder.createdAt?.toDate ? stakeholder.createdAt.toDate() : stakeholder.createdAt,
                        updatedAt: stakeholder.updatedAt?.toDate ? stakeholder.updatedAt.toDate() : stakeholder.updatedAt,
                    }))
                
                // For supervisors, filter to show only their direct reports (people who have them as manager)
                const effectiveIsSupervisor = isSupervisor || userRole === 'supervisor'
                if (effectiveIsSupervisor && !isAdmin) {
                    const currentUserId = user?.id || user?.uid
                    formattedStakeholders = formattedStakeholders.filter(
                        stakeholder => stakeholder.managerId === currentUserId
                    )
                }
                
                setStakeholders(formattedStakeholders)
            } else {
                console.error('Error loading stakeholders:', response.error)
                setStakeholders([])
            }
        } catch (error) {
            console.error('Error loading stakeholders:', error)
            setStakeholders([])
        } finally {
            setLoadingStakeholders(false)
        }
    }

    // Load current user's stakeholder data across all companies they have access to
    const loadMyStakeholderData = async () => {
        setLoadingMyData(true)
        try {
            const currentUserId = user?.id || user?.uid
            if (!currentUserId) {
                setMyStakeholderData([])
                setLoadingMyData(false)
                return
            }

            // Get all companies the user has access to
            const userCompanyIds = accessRecords.map(record => record.companyId).filter(Boolean)
            
            if (userCompanyIds.length === 0) {
                setMyStakeholderData([])
                setLoadingMyData(false)
                return
            }

            const response = await FirebaseDbService.stakeholders.getAll()
            if (response.success) {
                // Filter to only this user's stakeholder records across their accessible companies
                const myData = response.data
                    .filter(stakeholder => 
                        stakeholder.linkedUserId === currentUserId && 
                        userCompanyIds.includes(stakeholder.companyId)
                    )
                    .map(stakeholder => ({
                        ...stakeholder,
                        createdAt: stakeholder.createdAt?.toDate ? stakeholder.createdAt.toDate() : stakeholder.createdAt,
                        updatedAt: stakeholder.updatedAt?.toDate ? stakeholder.updatedAt.toDate() : stakeholder.updatedAt,
                    }))
                
                setMyStakeholderData(myData)
            } else {
                console.error('Error loading my stakeholder data:', response.error)
                setMyStakeholderData([])
            }
        } catch (error) {
            console.error('Error loading my stakeholder data:', error)
            setMyStakeholderData([])
        } finally {
            setLoadingMyData(false)
        }
    }

    // Load plans for companies the user has access to (for non-admins)
    const loadMyPlans = async () => {
        setLoadingPlans(true)
        try {
            const userCompanyIds = accessRecords.map(record => record.companyId).filter(Boolean)
            
            if (userCompanyIds.length === 0) {
                setPlans([])
                setLoadingPlans(false)
                return
            }

            const plansRef = collection(db, 'profitSharingPlans')
            const snapshot = await getDocs(plansRef)
            const plansData = snapshot.docs
                .map(docSnap => {
                    const data = docSnap.data()
                    const paymentScheduleDates = Array.isArray(data.paymentScheduleDates)
                        ? data.paymentScheduleDates
                              .map((d) => (d?.toDate ? d.toDate() : (d ? new Date(d) : null)))
                              .filter(Boolean)
                        : []
                    return {
                        id: docSnap.id,
                        ...data,
                        paymentScheduleDates,
                    }
                })
                .filter(plan => userCompanyIds.includes(plan.companyId) && plan.status === 'finalized')
            setPlans(plansData)
        } catch (error) {
            console.error('Error loading my plans:', error)
            setPlans([])
        } finally {
            setLoadingPlans(false)
        }
    }

    const loadActiveValuation = async () => {
        if (!selectedCompanyId) {
            setActiveValuation(null)
            return
        }
        
        try {
            const valuationsRef = collection(db, 'valuations')
            // First try to get active valuation for this company
            const activeQ = query(valuationsRef, where('status', '==', 'Active'))
            const activeSnapshot = await getDocs(activeQ)
            let valuations = []
            
            if (!activeSnapshot.empty) {
                // Filter by companyId and get the most recent active valuation
                valuations = activeSnapshot.docs
                    .map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        valuationDate: doc.data().valuationDate?.toDate ? doc.data().valuationDate.toDate() : (doc.data().valuationDate ? new Date(doc.data().valuationDate) : null),
                        updatedDate: doc.data().updatedDate?.toDate ? doc.data().updatedDate.toDate() : (doc.data().updatedDate ? new Date(doc.data().updatedDate) : null),
                    }))
                    .filter(v => v.companyId === selectedCompanyId)
                // Sort by valuation date descending
                valuations.sort((a, b) => {
                    const aDate = a.valuationDate?.getTime() || 0
                    const bDate = b.valuationDate?.getTime() || 0
                    return bDate - aDate
                })
                if (valuations.length > 0) {
                    setActiveValuation(valuations[0])
                    return
                }
            }
            
            // If no active valuation, get the most recent one for this company
            const allQ = query(valuationsRef, orderBy('valuationDate', 'desc'))
            const allSnapshot = await getDocs(allQ)
            if (!allSnapshot.empty) {
                const filtered = allSnapshot.docs
                    .map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        valuationDate: doc.data().valuationDate?.toDate ? doc.data().valuationDate.toDate() : (doc.data().valuationDate ? new Date(doc.data().valuationDate) : null),
                        updatedDate: doc.data().updatedDate?.toDate ? doc.data().updatedDate.toDate() : (doc.data().updatedDate ? new Date(doc.data().updatedDate) : null),
                    }))
                    .filter(v => v.companyId === selectedCompanyId)
                
                if (filtered.length > 0) {
                    setActiveValuation(filtered[0])
                } else {
                    setActiveValuation(null)
                }
            } else {
                setActiveValuation(null)
            }
        } catch (error) {
            console.error('Error loading active valuation:', error)
            // If query fails (e.g., no index), try without where clause
            try {
                const valuationsRef = collection(db, 'valuations')
                const allQ = query(valuationsRef, orderBy('valuationDate', 'desc'))
                const allSnapshot = await getDocs(allQ)
                if (!allSnapshot.empty) {
                    const filtered = allSnapshot.docs
                        .map(doc => ({
                            id: doc.id,
                            ...doc.data(),
                            valuationDate: doc.data().valuationDate?.toDate ? doc.data().valuationDate.toDate() : (doc.data().valuationDate ? new Date(doc.data().valuationDate) : null),
                            updatedDate: doc.data().updatedDate?.toDate ? doc.data().updatedDate.toDate() : (doc.data().updatedDate ? new Date(doc.data().updatedDate) : null),
                        }))
                        .filter(v => v.companyId === selectedCompanyId)
                    
                    if (filtered.length > 0) {
                        setActiveValuation(filtered[0])
                    } else {
                        setActiveValuation(null)
                    }
                } else {
                    setActiveValuation(null)
                }
            } catch (fallbackError) {
                console.error('Error loading valuation (fallback):', fallbackError)
                setActiveValuation(null)
            }
        }
    }

    const loadPlans = async () => {
        if (!selectedCompanyId) {
            setPlans([])
            setLoadingPlans(false)
            return
        }
        
        setLoadingPlans(true)
        try {
            const plansRef = collection(db, 'profitSharingPlans')
            const q = query(plansRef, orderBy('name'))
            const snapshot = await getDocs(q)
            const plansData = snapshot.docs
                .map(docSnap => {
                    const data = docSnap.data()
                    // Convert payment schedule dates
                    const paymentScheduleDates = Array.isArray(data.paymentScheduleDates)
                        ? data.paymentScheduleDates
                              .map((d) => (d?.toDate ? d.toDate() : (d ? new Date(d) : null)))
                              .filter(Boolean)
                        : []
                    return {
                        id: docSnap.id,
                        ...data,
                        paymentScheduleDates,
                    }
                })
                .filter(plan => plan.companyId === selectedCompanyId)
            setPlans(plansData)
        } catch (error) {
            console.error('Error loading plans for overview:', error)
            setPlans([])
        } finally {
            setLoadingPlans(false)
        }
    }

    // Check for upcoming payment dates and notify admins
    useEffect(() => {
        if (!selectedCompanyId || plans.length === 0) return

        const checkPaymentDates = async () => {
            try {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                
                // Check dates 14 days and 3 days in advance
                const reminderDays = [14, 3]
                const upcomingDates = []
                
                plans.forEach(plan => {
                    if (!plan.paymentScheduleDates || plan.paymentScheduleDates.length === 0) return
                    
                    plan.paymentScheduleDates.forEach(paymentDate => {
                        if (!paymentDate) return
                        const date = paymentDate instanceof Date ? paymentDate : new Date(paymentDate)
                        date.setHours(0, 0, 0, 0)
                        
                        reminderDays.forEach(days => {
                            const reminderDate = new Date(today)
                            reminderDate.setDate(reminderDate.getDate() + days)
                            
                            // Check if this payment date matches the reminder date
                            if (date.getTime() === reminderDate.getTime()) {
                                const reminderKey = `${plan.id}-${date.toISOString()}-${days}`
                                if (!paymentRemindersSentRef.current.has(reminderKey)) {
                                    upcomingDates.push({
                                        planId: plan.id,
                                        planName: plan.name || 'Unnamed Plan',
                                        paymentDate: date,
                                        daysUntil: days,
                                        reminderKey,
                                    })
                                }
                            }
                        })
                    })
                })
                
                if (upcomingDates.length === 0) return
                
                // Get all admins
                const allUsersResult = await FirebaseDbService.users.getAll()
                const allUsers = allUsersResult.success ? allUsersResult.data : []
                
                const accessResult = await FirebaseDbService.profitSharingAccess.getAll()
                const accessRecords = accessResult.success ? accessResult.data : []
                
                // Find admin user IDs
                const adminUserIds = new Set()
                allUsers.forEach(u => {
                    const email = u.email?.toLowerCase()
                    if (email === 'admin-01@tatco.construction' || email === 'brett@tatco.construction') {
                        adminUserIds.add(u.id)
                    }
                })
                accessRecords.forEach(access => {
                    if (access.role === 'admin' && access.companyId === selectedCompanyId) {
                        adminUserIds.add(access.userId)
                    }
                })
                
                // Notify admins about each upcoming payment date
                await Promise.all(
                    upcomingDates.flatMap(upcoming =>
                        Array.from(adminUserIds).map(adminId =>
                            createNotification({
                                userId: adminId,
                                type: NOTIFICATION_TYPES.PROFIT_SHARING_ADMIN,
                                title: 'Payment Date Approaching',
                                message: `Payment date for "${upcoming.planName}" is in ${upcoming.daysUntil} day${upcoming.daysUntil > 1 ? 's' : ''}. Set the profit entry and prepare payouts.`,
                                entityType: 'profit_sharing',
                                entityId: selectedCompanyId,
                                metadata: {
                                    planId: upcoming.planId,
                                    planName: upcoming.planName,
                                    paymentDate: upcoming.paymentDate.toISOString(),
                                    daysUntil: upcoming.daysUntil,
                                }
                            }).then(() => {
                                // Mark as sent
                                paymentRemindersSentRef.current.add(upcoming.reminderKey)
                            })
                        )
                    )
                )
            } catch (error) {
                console.error('Error checking payment dates:', error)
            }
        }
        
        // Check immediately and then every hour
        checkPaymentDates()
        const interval = setInterval(checkPaymentDates, 60 * 60 * 1000) // 1 hour
        
        return () => clearInterval(interval)
    }, [plans, selectedCompanyId])

    // Show message if no company is selected
    if (!loadingCompany && !selectedCompanyId) {
        return (
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Overview</h2>
                </div>
                <Card className="p-8">
                    <div className="flex flex-col items-center justify-center text-center space-y-4">
                        <div className="text-gray-400 dark:text-gray-500 text-lg">No company selected</div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
                            Please go to Settings and select a company to view profit sharing data.
                        </p>
                        <Button 
                            variant="solid" 
                            size="sm"
                            onClick={() => navigate('/profit-sharing?tab=settings')}
                            className="mt-4"
                        >
                            Go to Settings
                        </Button>
                    </div>
                </Card>
            </div>
        )
    }

    if (isAdmin) {
        return (
            <div className="space-y-8">
                {/* Overview Header with View Plans Button */}
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Overview</h2>
                    <Button 
                        variant="plain" 
                        size="sm"
                        onClick={() => navigate('/profit-sharing?tab=plans')}
                        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                        View plans
                    </Button>
                </div>

                {/* Summary Section */}
                <div className="space-y-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Summary</h3>
                    
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Latest Profit Card */}
                        <Card className="p-6">
                            <div className="space-y-2">
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Latest Profit</div>
                                <div className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(companyValuation)}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">From latest profit entry</div>
                            </div>
                        </Card>

                        {/* Outstanding Awards Card */}
                        <Card className="p-6">
                            <div className="space-y-2">
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Outstanding Awards</div>
                                <div className="text-3xl font-bold text-gray-900 dark:text-white">{formatNumber(outstandingAwards)}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Total profit awards granted</div>
                            </div>
                        </Card>

                        {/* Profit Share Pool Card */}
                        <Card className="p-6">
                            <div className="space-y-2">
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Profit Share Pool</div>
                                <div className="text-3xl font-bold text-gray-900 dark:text-white">{formatNumber(stockPool)}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Total profit shares across all plans</div>
                            </div>
                        </Card>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-3">
                        <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            {/* Used portion */}
                            <div 
                                className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all duration-300"
                                style={{ width: `${usedPercentage}%` }}
                            />
                            {/* Remaining portion */}
                            <div 
                                className="absolute left-0 top-0 h-full bg-blue-200 dark:bg-blue-400/30 rounded-full transition-all duration-300"
                                style={{ width: `${remainingPercentage}%`, left: `${usedPercentage}%` }}
                            />
                        </div>
                        
                        {/* Legends */}
                        <div className="flex items-center gap-6 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-primary"></div>
                                <span className="text-gray-600 dark:text-gray-400">
                                    Used: {formatNumber(usedStockUnits)} profit shares
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-blue-200 dark:bg-blue-400/30"></div>
                                <span className="text-gray-600 dark:text-gray-400">
                                    Remaining: {formatNumber(remainingStockUnits)} profit shares
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Key Metrics Section */}
                <div className="space-y-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Key Metrics</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Estimated Valuation Card */}
                        <Card className="p-6">
                            <div className="space-y-2">
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Estimated Profit</div>
                                <div className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(estimatedValuation)}</div>
                            </div>
                        </Card>

                        {/* Total Stakeholders Card */}
                        <Card className="p-6">
                            <div className="space-y-2">
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Stakeholders</div>
                                <div className="text-3xl font-bold text-gray-900 dark:text-white">{totalStakeholders}</div>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Active Stakeholders Section */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Active Stakeholders</h3>
                        <Button 
                            variant="plain" 
                            size="sm"
                            onClick={() => navigate('/profit-sharing?tab=stakeholders')}
                            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                        >
                            View stakeholders
                        </Button>
                    </div>
                    
                    {loadingStakeholders ? (
                        <Card className="p-8">
                            <div className="flex flex-col items-center justify-center text-center space-y-4">
                                <div className="text-gray-400 dark:text-gray-500">Loading stakeholders...</div>
                            </div>
                        </Card>
                    ) : stakeholders.length === 0 ? (
                        <Card className="p-8">
                            <div className="flex flex-col items-center justify-center text-center space-y-4">
                                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                    <HiOutlineLockClosed className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">No active stakeholders</h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
                                        No active stakeholders added. Let's get started by adding your first team member to a plan.
                                    </p>
                                </div>
                                <Button 
                                    variant="solid" 
                                    size="sm"
                                    onClick={() => navigate('/profit-sharing?tab=stakeholders')}
                                    className="mt-4"
                                >
                                    View stakeholders
                                </Button>
                            </div>
                        </Card>
                    ) : (
                        <Card className="p-0">
                            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                {stakeholders.slice(0, 5).map((stakeholder) => (
                                    <div
                                        key={stakeholder.id}
                                        className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                                        onClick={() => navigate(`/profit-sharing/stakeholders/${stakeholder.id}`)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Avatar
                                                    size={40}
                                                    className="flex-shrink-0"
                                                    icon={<span className="text-sm font-semibold">{getInitials(stakeholder.name)}</span>}
                                                />
                                                <div>
                                                    <div className="font-medium text-gray-900 dark:text-white">{stakeholder.name}</div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">{stakeholder.title || '—'}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {stakeholder.marePlans && stakeholder.marePlans.length > 0 ? (
                                                    <div className="flex items-center gap-2">
                                                        {stakeholder.marePlans.filter(plan => plan === 'Profit').map((plan, idx) => (
                                                            <Tag
                                                                key={idx}
                                                                className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                                            >
                                                                {plan}
                                                            </Tag>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                                                )}
                                                {stakeholder.status && (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                        <span className="text-sm text-gray-600 dark:text-gray-400">{stakeholder.status}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {stakeholders.length > 5 && (
                                <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-center">
                                    <Button
                                        variant="plain"
                                        size="sm"
                                        onClick={() => navigate('/profit-sharing?tab=stakeholders')}
                                        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                                    >
                                        View all {stakeholders.length} stakeholders
                                    </Button>
                                </div>
                            )}
                        </Card>
                    )}
                </div>
            </div>
        )
    }

    // Non-admin Overview: Show only their awards and documents
    // Calculate personal metrics
    const myTotalAwards = myStakeholderData.reduce((sum, sh) => sum + (sh.profitAwards?.length || 0), 0)
    const myTotalShares = myStakeholderData.reduce((sum, sh) => {
        const awards = sh.profitAwards || []
        return sum + awards.reduce((awardSum, award) => awardSum + (award.sharesIssued || 0), 0)
    }, 0)
    
    // Get all awards across all companies
    const allMyAwards = myStakeholderData.flatMap(sh => 
        (sh.profitAwards || []).map(award => ({
            ...award,
            stakeholderId: sh.id,
            companyId: sh.companyId,
            companyName: companies.find(c => c.id === sh.companyId)?.name || 'Unknown Company'
        }))
    )

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">My Awards</h2>
            </div>

            {/* My Awards Section - Show first */}
            {allMyAwards.length > 0 && (
                <div className="space-y-6">
                    <Card className="p-0">
                        <Table>
                            <Table.THead>
                                <Table.Tr>
                                    <Table.Th>Plan Name</Table.Th>
                                    <Table.Th>Company</Table.Th>
                                    <Table.Th>Shares</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th>Actions</Table.Th>
                                </Table.Tr>
                            </Table.THead>
                            <Table.TBody>
                                {allMyAwards.map((award, idx) => (
                                    <Table.Tr key={`${award.stakeholderId}-${award.id || idx}`}>
                                        <Table.Td className="font-medium">{award.planName || '—'}</Table.Td>
                                        <Table.Td>{award.companyName}</Table.Td>
                                        <Table.Td>{formatNumber(award.sharesIssued || 0)}</Table.Td>
                                        <Table.Td>
                                            <Tag className={
                                                award.status === 'Finalized' 
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                                            }>
                                                {award.status || 'Draft'}
                                            </Tag>
                                        </Table.Td>
                                        <Table.Td>
                                            {(award.documentUrl || award.signedDocumentUrl || award.signedDocumentPdfUrl || award.signedDocumentDocxUrl) && (
                                                <Button
                                                    variant="plain"
                                                    size="sm"
                                                    icon={<HiOutlineEye />}
                                                    onClick={() => {
                                                        setSelectedAward(award)
                                                        setSelectedStakeholderId(award.stakeholderId)
                                                        setShowAwardDocumentModal(true)
                                                    }}
                                                >
                                                    View Document
                                                </Button>
                                            )}
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.TBody>
                        </Table>
                    </Card>
                </div>
            )}

            {/* Plan Agreements Section - Show below awards */}
            {plans.length > 0 && (
                <div className="space-y-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Plan Agreements</h3>
                    <Card className="p-0">
                        <Table>
                            <Table.THead>
                                <Table.Tr>
                                    <Table.Th>Plan Name</Table.Th>
                                    <Table.Th>Company</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th>Actions</Table.Th>
                                </Table.Tr>
                            </Table.THead>
                            <Table.TBody>
                                {plans.map((plan) => (
                                    <Table.Tr key={plan.id}>
                                        <Table.Td className="font-medium">{plan.name || 'Unnamed Plan'}</Table.Td>
                                        <Table.Td>{companies.find(c => c.id === plan.companyId)?.name || 'Unknown'}</Table.Td>
                                        <Table.Td>
                                            <Tag className={plan.status === 'finalized' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}>
                                                {plan.status || 'Draft'}
                                            </Tag>
                                        </Table.Td>
                                        <Table.Td>
                                            {plan.planDocumentUrl && (
                                                <Button
                                                    variant="plain"
                                                    size="sm"
                                                    icon={<HiOutlineEye />}
                                                    onClick={() => {
                                                        setSelectedPlanDocumentUrl(plan.planDocumentUrl)
                                                        setShowPlanDocumentModal(true)
                                                    }}
                                                >
                                                    View Agreement
                                                </Button>
                                            )}
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.TBody>
                        </Table>
                    </Card>
                </div>
            )}

            {loadingMyData && (
                <Card className="p-8">
                    <div className="text-center text-gray-500 dark:text-gray-400">Loading your awards...</div>
                </Card>
            )}

            {!loadingMyData && allMyAwards.length === 0 && plans.length === 0 && (
                <Card className="p-8">
                    <div className="text-center text-gray-500 dark:text-gray-400">
                        You don't have any awards or plan agreements yet.
                    </div>
                </Card>
            )}

            {/* Plan Document Modal */}
            <PdfViewerModal
                isOpen={showPlanDocumentModal}
                onClose={() => {
                    setShowPlanDocumentModal(false)
                    setSelectedPlanDocumentUrl(null)
                }}
                isAdmin={false}
                planDocumentUrl={selectedPlanDocumentUrl}
            />

            {/* Award Document Modal */}
            <AwardDocumentModal
                isOpen={showAwardDocumentModal && !!selectedAward && !!selectedStakeholderId}
                onClose={() => {
                    setShowAwardDocumentModal(false)
                    setSelectedAward(null)
                    setSelectedStakeholderId(null)
                }}
                award={selectedAward}
                stakeholderId={selectedStakeholderId}
                onDocumentUpdated={() => {
                    loadMyStakeholderData()
                }}
            />
        </div>
    )
}

export default OverviewTab

