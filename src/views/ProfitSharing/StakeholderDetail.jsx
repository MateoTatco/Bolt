import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Card, Button, Table, Tag, Drawer, Select, DatePicker, Input, Dialog } from '@/components/ui'
import { HiOutlineArrowLeft, HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineInformationCircle, HiOutlineHome, HiOutlineDocumentText, HiOutlineUsers, HiOutlineChartBar, HiOutlineFlag, HiOutlineCog, HiOutlineCheckCircle, HiOutlineEye, HiOutlineDownload } from 'react-icons/hi'
import { useSessionUser } from '@/store/authStore'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { db } from '@/configs/firebase.config'
import { collection, getDocs, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import React from 'react'
import { Notification, toast } from '@/components/ui'
import { getAllUsers } from '@/utils/userHelper'
import AwardDocumentModal from './components/AwardDocumentModal'

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
    const [activeTab, setActiveTab] = useState('profit')
    const [stakeholder, setStakeholder] = useState(null)
    const [loading, setLoading] = useState(true)
    const [showNewAwardDrawer, setShowNewAwardDrawer] = useState(false)
    const [profitPlans, setProfitPlans] = useState([])
    const [awardFormData, setAwardFormData] = useState({
        planId: null,
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

    useEffect(() => {
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
                        totalAwards: (data.stockAwards?.length || 0) + (data.profitAwards?.length || 0)
                    })
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
    }, [stakeholderId, navigate])

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

            setDetailsFormData({
                name: stakeholder.name || '',
                title: stakeholder.title || '',
                email: stakeholder.email || '',
                phone: phoneNumber,
                employmentStatus: normalizeEmploymentStatus(stakeholder.employmentStatus),
                payType: normalizePayType(stakeholder.payType),
                payAmount: stakeholder.payAmount ? String(stakeholder.payAmount) : '',
            })
            setReinsRole(stakeholder.reinsRole || 'User')
        }
    }, [stakeholder])

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
                // Include all plans (both draft and finalized) for selection
                plansData.push({ 
                    value: doc.id, 
                    label: data.name || 'Unnamed Plan',
                    status: data.status || 'draft',
                    ...data 
                })
            })
            setProfitPlans(plansData)
        } catch (error) {
            console.error('Error loading profit plans:', error)
        }
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
        setEditingAwardId(award.id)
        setEditingAward(award)
        setAwardFormData({
            planId: award.planId || null,
            awardStartDate: award.awardStartDate ? new Date(award.awardStartDate) : null,
            awardEndDate: award.awardEndDate ? new Date(award.awardEndDate) : null,
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
            const newAward = {
                id: Date.now().toString(),
                planId: awardFormData.planId,
                planName: selectedPlan?.label || 'Unknown Plan',
                planMilestoneAmount: awardFormData.milestoneAmount || 0,
                awardStartDate: awardFormData.awardStartDate instanceof Date 
                    ? awardFormData.awardStartDate.toISOString() 
                    : awardFormData.awardStartDate,
                awardEndDate: awardFormData.awardEndDate instanceof Date 
                    ? awardFormData.awardEndDate.toISOString() 
                    : awardFormData.awardEndDate,
                milestoneAmount: awardFormData.milestoneAmount,
                sharesIssued: awardFormData.sharesIssued ? parseInt(awardFormData.sharesIssued, 10) : 0,
                paymentSchedule: selectedPlan?.schedule || 'Annually',
                status: status === 'finalized' ? 'Finalized' : 'Draft',
                awardDate: 'Pending',
            }

            const existingAwards = currentData.data.profitAwards || []
            let updatedAwards
            
            if (editingAwardId) {
                // Update existing award - preserve document info if it exists
                updatedAwards = existingAwards.map(a => 
                    a.id === editingAwardId 
                        ? { 
                            ...a, 
                            ...newAward, 
                            id: editingAwardId,
                            // Preserve document info
                            documentUrl: a.documentUrl,
                            documentStoragePath: a.documentStoragePath,
                            documentFileName: a.documentFileName,
                        }
                        : a
                )
            } else {
                // Add new award
                updatedAwards = [...existingAwards, newAward]
            }

            await updateDoc(stakeholderRef, {
                profitAwards: updatedAwards,
                updatedAt: serverTimestamp(),
            })

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

            // Notify stakeholders list to refresh
            window.dispatchEvent(new Event('stakeholdersUpdated'))

            setShowNewAwardDrawer(false)
            setEditingAwardId(null)
            setEditingAward(null)
            setSelectedPlan(null)
            setAwardFormData({
                planId: null,
                awardStartDate: null,
                awardEndDate: null,
                milestoneAmount: 0,
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

    const sidebarItems = [
        { key: 'overview', label: 'Overview', icon: <HiOutlineHome /> },
        { key: 'plans', label: 'Plans', icon: <HiOutlineDocumentText /> },
        { key: 'stakeholders', label: 'Stakeholders', icon: <HiOutlineUsers /> },
        { key: 'valuations', label: 'Valuations', icon: <HiOutlineChartBar /> },
        { key: 'milestones', label: 'Milestones', icon: <HiOutlineFlag /> },
        { key: 'settings', label: 'Settings', icon: <HiOutlineCog /> },
    ]

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
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{stakeholder.name}</h2>
                {activeTab === 'profit' && (
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
                                            This is an estimate based on previous performance and latest progress updates. Actual payment amount will vary once finalized by a Reins administrator.
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
                                    
                                    const nextAward = stakeholder.profitAwards[0]
                                    const endDate = nextAward.awardEndDate ? new Date(nextAward.awardEndDate) : null
                                    
                                    // Mock award amount - replace with actual calculation when available
                                    const mockAwardAmount = 12500.00
                                    
                                    return (
                                        <>
                                            <div className="text-3xl font-bold text-gray-900 dark:text-white">
                                                {formatCurrency(mockAwardAmount)}
                                            </div>
                                            {endDate && (
                                                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                    after {endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                                </div>
                                            )}
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
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Click below to grant an award to this stakeholder.</p>
                                </div>
                                <Button
                                    variant="solid"
                                    icon={<HiOutlinePlus />}
                                    onClick={() => setShowNewAwardDrawer(true)}
                                >
                                    New Award
                                </Button>
                            </div>
                        </Card>
                    ) : (
                        <Card className="p-0">
                            <Table>
                                <Table.THead>
                                    <Table.Tr>
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
                                    {stakeholder.profitAwards.map((award) => (
                                        <Table.Tr key={award.id}>
                                            <Table.Td>
                                                <span className="text-sm text-gray-900 dark:text-white">{award.awardDate || 'Pending'}</span>
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
                                            </Table.Td>
                                            <Table.Td>
                                                <div className="flex items-center gap-2">
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
                                                </div>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
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
                                    />
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                                    <Input
                                        value={detailsFormData.title}
                                        onChange={(e) => setDetailsFormData(prev => ({ ...prev, title: e.target.value }))}
                                        placeholder="Their role in the company"
                                    />
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                                    <Input
                                        type="email"
                                        value={detailsFormData.email}
                                        onChange={(e) => setDetailsFormData(prev => ({ ...prev, email: e.target.value }))}
                                        placeholder="Email address"
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
                                            className="rounded-l-none flex-1"
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
                                            className="pl-8"
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
                                    />
                                </div>
                            </div>
                            
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
                        awardStartDate: null,
                        awardEndDate: null,
                        milestoneAmount: 0,
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
                                
                                {/* Finalize Award button - only show if plan is draft */}
                                {selectedPlan && selectedPlan.status === 'draft' && editingAward.status !== 'Finalized' && (
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

                        {/* Milestones Section */}
                        {awardFormData.planId && (
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Milestones</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Plan profit threshold (milestone)
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

                    {/* Footer Buttons */}
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
                </div>
            </Drawer>

            {/* Document Viewer Modal */}
            <AwardDocumentModal
                isOpen={showDocumentModal}
                onClose={() => setShowDocumentModal(false)}
                award={editingAward}
                stakeholderId={stakeholderId}
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

