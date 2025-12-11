import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { Button, Card, Input, Select, DatePicker, Tag, Dialog, Switcher, Radio, Notification, toast } from '@/components/ui'
import { HiOutlineChevronRight, HiOutlineDotsVertical, HiOutlineArrowLeft, HiOutlineHome, HiOutlineDocumentText, HiOutlineUsers, HiOutlineChartBar, HiOutlineFlag, HiOutlineCog, HiOutlinePencil, HiOutlineSearch, HiOutlinePlus, HiOutlineTrash, HiOutlineCurrencyDollar, HiOutlineCheckCircle } from 'react-icons/hi'
import { useSessionUser } from '@/store/authStore'
import { db } from '@/configs/firebase.config'
import { collection, addDoc, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import PlanTriggerPanel from './components/PlanTriggerPanel'
import CreateMilestonePanel from './components/CreateMilestonePanel'

// Authorized emails that can access Profit Sharing
const AUTHORIZED_EMAILS = [
    'admin-01@tatco.construction',
    'brett@tatco.construction'
]

const DEFAULT_FORM_DATA = {
    name: 'Profit Plan',
    description: '',
    schedule: null,
    startDate: null,
    baseBonusFormula: 'profit-based',
    planTrigger: null,
    // Pool Size & Distribution
    profitMeasuredSameAsTrigger: true,
    profitTrigger: null,
    profitDescription: '',
    poolShareType: 'above-trigger', // 'above-trigger' or 'total'
    poolPercentage: '',
    estimatedOnTargetProfit: 0,
    estimatedProfitPool: 0,
    distributionMethod: null,
    prorationBasedOn: null,
    // Milestones & Payments
    milestones: [],
    paymentTerms: null,
    initialPayment: '',
    installmentSchedule: null,
    installmentTimeframe: null,
    installmentsRequireEmployment: false,
    status: 'draft',
}

const formatCurrency = (value) => {
    if (!value && value !== 0) return ''
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.]/g, '')) : value
    if (isNaN(numValue)) return ''
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(numValue)
}

const formatCurrencyInput = (value) => {
    // Remove all non-numeric characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, '')
    if (!numericValue) return ''
    const num = parseFloat(numericValue)
    if (isNaN(num)) return ''
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const CreateProfitPlan = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const user = useSessionUser((state) => state.user)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [showCancelDialog, setShowCancelDialog] = useState(false)
    const [showPlanTriggerPanel, setShowPlanTriggerPanel] = useState(false)
    const [showProfitTriggerPanel, setShowProfitTriggerPanel] = useState(false)
    const [showAddMilestoneModal, setShowAddMilestoneModal] = useState(false)
    const [showCreateMilestonePanel, setShowCreateMilestonePanel] = useState(false)
    const [milestoneSearchQuery, setMilestoneSearchQuery] = useState('')
    const [editingMilestone, setEditingMilestone] = useState(null)
    const [cancelContext, setCancelContext] = useState(null) // 'page' or 'milestone-panel' or 'milestone-modal'
    const [planId, setPlanId] = useState(null)
    const [loadingPlan, setLoadingPlan] = useState(false)
    const [existingCreatedAt, setExistingCreatedAt] = useState(null)

    // Check authorization on mount
    useEffect(() => {
        const userEmail = user?.email?.toLowerCase() || ''
        const isAuthorized = AUTHORIZED_EMAILS.some(email => email.toLowerCase() === userEmail)
        
        if (!isAuthorized) {
            navigate('/home', { replace: true })
        }
    }, [user, navigate])

    // Load plan when id changes
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const id = params.get('id')
        if (id) {
            setPlanId(id)
            loadPlan(id)
        } else {
            setPlanId(null)
            setExistingCreatedAt(null)
            setFormData({ ...DEFAULT_FORM_DATA })
            setHasUnsavedChanges(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search])

    // Don't render if unauthorized
    const userEmail = user?.email?.toLowerCase() || ''
    const isAuthorized = AUTHORIZED_EMAILS.some(email => email.toLowerCase() === userEmail)
    
    if (!isAuthorized) {
        return null
    }
    
    // Form state
    const [formData, setFormData] = useState(() => ({ ...DEFAULT_FORM_DATA }))

    const scheduleOptions = [
        { value: 'quarterly', label: 'Quarterly' },
        { value: 'bi-annually', label: 'Bi-Annually' },
        { value: 'annually', label: 'Annually' }
    ]

    const baseBonusFormulaOptions = [
        { value: 'profit-based', label: 'Profit Based' }
    ]

    const distributionMethodOptions = [
        { value: 'pro-rata', label: 'Pro Rata' },
        { value: 'equal', label: 'Equal Distribution' },
        { value: 'custom', label: 'Assign custom percentages' }
    ]

    const prorationBasedOnOptions = [
        { value: 'relative-salaries', label: 'Relative Salaries' }
    ]

    const paymentTermsOptions = [
        { value: 'within-30-days', label: 'Within 30 days' },
        { value: 'within-60-days', label: 'Within 60 days' },
        { value: 'installment-payments', label: 'Installment payments' }
    ]

    const installmentScheduleOptions = [
        { value: 'monthly', label: 'Monthly' },
        { value: 'annually', label: 'Annually' },
        { value: 'remainder-paid', label: 'Remainder Paid' }
    ]

    const getInstallmentTimeframeOptions = () => {
        if (formData.installmentSchedule === 'monthly') {
            return [
                { value: '6-months', label: 'For 6 Months' },
                { value: '12-months', label: 'For 12 Months' },
                { value: '24-months', label: 'For 24 Months' },
                { value: '36-months', label: 'For 36 Months' },
                { value: '48-months', label: 'For 48 Months' }
            ]
        } else if (formData.installmentSchedule === 'annually') {
            return [
                { value: '2-years', label: 'For 2 years' },
                { value: '3-years', label: 'For 3 years' },
                { value: '4-years', label: 'For 4 years' }
            ]
        } else if (formData.installmentSchedule === 'remainder-paid') {
            return [
                { value: '6-months-after', label: '6 months after the period ends' },
                { value: '12-months-after', label: '12 months after the period ends' },
                { value: '24-months-after', label: '24 months after the period ends' },
                { value: '36-months-after', label: '36 months after the period ends' },
                { value: '48-months-after', label: '48 months after the period ends' }
            ]
        }
        return []
    }

    const isFormComplete = () => {
        // Check all required fields are filled
        return (
            formData.name &&
            formData.schedule &&
            formData.startDate &&
            formData.baseBonusFormula &&
            formData.planTrigger &&
            formData.paymentTerms
        )
    }

    const loadPlan = async (id) => {
        setLoadingPlan(true)
        try {
            const planRef = doc(db, 'profitSharingPlans', id)
            const snap = await getDoc(planRef)
            if (!snap.exists()) {
                toast.push(
                    <Notification type="warning" duration={2500}>
                        Plan not found
                    </Notification>
                )
                navigate('/profit-sharing?tab=plans', { replace: true })
                return
            }
            const data = snap.data()
            setExistingCreatedAt(data.createdAt || null)
            setFormData({
                ...DEFAULT_FORM_DATA,
                ...data,
                startDate: data.startDate
                    ? (data.startDate.toDate ? data.startDate.toDate() : new Date(data.startDate))
                    : null,
            })
            setHasUnsavedChanges(false)
        } catch (error) {
            console.error('Error loading plan:', error)
            toast.push(
                <Notification type="danger" duration={2500}>
                    Failed to load plan
                </Notification>
            )
            navigate('/profit-sharing?tab=plans', { replace: true })
        } finally {
            setLoadingPlan(false)
        }
    }

    const sidebarItems = [
        { key: 'overview', label: 'Overview', icon: <HiOutlineHome /> },
        { key: 'plans', label: 'Plans', icon: <HiOutlineDocumentText /> },
        { key: 'stakeholders', label: 'Stakeholders', icon: <HiOutlineUsers /> },
        { key: 'valuations', label: 'Valuations', icon: <HiOutlineChartBar /> },
        { key: 'milestones', label: 'Milestones', icon: <HiOutlineFlag /> },
        { key: 'settings', label: 'Settings', icon: <HiOutlineCog /> },
    ]

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        setHasUnsavedChanges(true)
    }

    const handleBack = () => {
        // Check if there's any data entered
        const hasData = formData.name !== 'Profit Plan' || 
                       formData.description || 
                       formData.schedule || 
                       formData.startDate || 
                       formData.planTrigger || 
                       formData.milestones.length > 0 ||
                       formData.paymentTerms ||
                       formData.initialPayment ||
                       formData.installmentSchedule
        
        if (hasUnsavedChanges || (!planId && hasData)) {
            setCancelContext('page')
            setShowCancelDialog(true)
        } else {
            navigate('/profit-sharing?tab=plans')
        }
    }

    const handleConfirmCancel = () => {
        setShowCancelDialog(false)
        
        if (cancelContext === 'page') {
            setHasUnsavedChanges(false)
            navigate('/profit-sharing?tab=plans')
        } else if (cancelContext === 'milestone-panel') {
            setMilestoneSearchQuery('')
            setEditingMilestone(null)
            setShowCreateMilestonePanel(false)
        } else if (cancelContext === 'milestone-modal') {
            setMilestoneSearchQuery('')
            setShowAddMilestoneModal(false)
        }
        setCancelContext(null)
    }

    const handleSetPlanTrigger = (triggerData) => {
        setFormData(prev => ({ ...prev, planTrigger: triggerData }))
        setShowPlanTriggerPanel(false)
        setHasUnsavedChanges(true)
    }

    const handleEditPlanTrigger = () => {
        setShowPlanTriggerPanel(true)
    }

    const handleSetProfitTrigger = (triggerData) => {
        setFormData(prev => ({ ...prev, profitTrigger: triggerData }))
        setShowProfitTriggerPanel(false)
        setHasUnsavedChanges(true)
    }

    const handleEditProfitTrigger = () => {
        setShowProfitTriggerPanel(true)
    }

    const formatPercentage = (value) => {
        if (!value && value !== 0) return ''
        const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.]/g, '')) : value
        if (isNaN(numValue)) return ''
        return `${numValue}%`
    }

    const handlePercentageChange = (e) => {
        const value = e.target.value.replace(/[^0-9.]/g, '')
        handleInputChange('poolPercentage', value)
    }

    const savePlan = async (status) => {
        try {
            const plansRef = collection(db, 'profitSharingPlans')
            const payload = {
                ...formData,
                status,
                startDate: formData.startDate
                    ? (formData.startDate instanceof Date ? formData.startDate.toISOString() : formData.startDate)
                    : null,
                updatedAt: serverTimestamp(),
            }

            if (planId) {
                const planRef = doc(db, 'profitSharingPlans', planId)
                await updateDoc(planRef, {
                    ...payload,
                    createdAt: existingCreatedAt || serverTimestamp(),
                })
            } else {
                const docRef = await addDoc(plansRef, {
                    ...payload,
                    createdAt: serverTimestamp(),
                })
                setPlanId(docRef.id)
            }

            setFormData(prev => ({ ...prev, status }))
            setHasUnsavedChanges(false)
            toast.push(
                <Notification type="success" duration={2000}>
                    {status === 'finalized' ? 'Plan finalized successfully' : 'Plan saved as draft'}
                </Notification>
            )
            window.dispatchEvent(new Event('plansUpdated'))
            navigate('/profit-sharing?tab=plans')
        } catch (error) {
            console.error('Error saving plan:', error)
            toast.push(
                <Notification type="danger" duration={2000}>
                    Failed to save plan
                </Notification>
            )
        }
    }

    const handleAddMilestone = (milestoneData) => {
        if (editingMilestone !== null) {
            // Edit existing milestone
            const updatedMilestones = [...formData.milestones]
            updatedMilestones[editingMilestone] = {
                ...milestoneData,
                id: formData.milestones[editingMilestone].id || Date.now()
            }
            setFormData(prev => ({ ...prev, milestones: updatedMilestones }))
            setEditingMilestone(null)
        } else {
            // Add new milestone
            setFormData(prev => ({
                ...prev,
                milestones: [...prev.milestones, { ...milestoneData, id: Date.now() }]
            }))
        }
        setShowCreateMilestonePanel(false)
        setShowAddMilestoneModal(false)
        setHasUnsavedChanges(true)
    }

    const handleDeleteMilestone = (index) => {
        const updatedMilestones = formData.milestones.filter((_, i) => i !== index)
        setFormData(prev => ({ ...prev, milestones: updatedMilestones }))
        setHasUnsavedChanges(true)
    }

    const handleEditMilestone = (index) => {
        setEditingMilestone(index)
        setShowCreateMilestonePanel(true)
    }

    const getMilestoneIcon = (milestone) => {
        if (milestone.type === 'financial') {
            return <HiOutlineCurrencyDollar className="w-5 h-5" />
        } else {
            // Custom milestone - check track as type
            if (milestone.customMilestoneType === 'value' && milestone.customTrackAs) {
                if (milestone.customTrackAs === 'Percent') {
                    return <HiOutlineCheckCircle className="w-5 h-5" />
                } else if (milestone.customTrackAs === 'Dollars') {
                    return <HiOutlineCurrencyDollar className="w-5 h-5" />
                } else {
                    return <HiOutlineCheckCircle className="w-5 h-5" />
                }
            }
            return <HiOutlineCheckCircle className="w-5 h-5" />
        }
    }

    return (
        <div className="flex min-h-screen bg-white dark:bg-gray-900">
            {/* Left Sidebar */}
            <div className="hidden lg:block w-64 bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-sm">
                <div className="p-6">
                    <Button 
                        variant="plain" 
                        icon={<HiOutlineArrowLeft />} 
                        onClick={() => navigate('/home')}
                        className="mb-8 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors duration-200"
                    >
                        Back to Home
                    </Button>
                </div>

                <div className="px-4 space-y-1">
                    {sidebarItems.map((item) => (
                        <button
                            key={item.key}
                            onClick={() => {
                                if (hasUnsavedChanges) {
                                    setShowCancelDialog(true)
                                } else {
                                    navigate(`/profit-sharing?tab=${item.key}`)
                                }
                            }}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-300 group ${
                                item.key === 'plans'
                                    ? 'bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg transform scale-[1.02]' 
                                    : 'text-gray-600 hover:bg-white/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700/80 dark:hover:text-gray-100 hover:shadow-md hover:transform hover:scale-[1.01]'
                            }`}
                        >
                            <span className={`transition-transform duration-200 ${item.key === 'plans' ? 'scale-110' : 'group-hover:scale-105'}`}>{item.icon}</span>
                            <span className="font-medium tracking-wide">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
                {/* Mobile Tab Navigation */}
                <div className="lg:hidden sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex overflow-x-auto scrollbar-hide px-2 py-2">
                        {sidebarItems.map((item) => (
                            <button
                                key={item.key}
                                onClick={() => navigate(`/profit-sharing?tab=${item.key}`)}
                                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                                    item.key === 'plans'
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
                    <div className="max-w-5xl mx-auto space-y-8">
                        {/* Breadcrumb */}
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <button
                                onClick={handleBack}
                                className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                            >
                                Plans
                            </button>
                            <HiOutlineChevronRight className="w-4 h-4" />
                            <span className="text-gray-900 dark:text-white font-medium">Profit Plan</span>
                        </div>

                        {/* Tags and Title */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Tag className="px-3 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                    {formData.status === 'finalized' ? 'Finalized' : 'Draft'}
                                </Tag>
                                <Tag className="px-3 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                    Profit
                                </Tag>
                            </div>
                            <div className="flex items-center justify-between">
                                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                    {formData.name || 'Profit Plan'}
                                </h1>
                                <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                    <HiOutlineDotsVertical className="w-5 h-5" />
                                </button>
                            </div>
                            {loadingPlan && (
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                    Loading plan...
                                </div>
                            )}
                        </div>

                        {/* Separator */}
                        <div className="border-t border-gray-200 dark:border-gray-700"></div>

                        {/* Specifics Section */}
                        <div className="space-y-8">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Specifics</h2>
                            
                            {/* General Subsection */}
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">General</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        What's this plan's name and description?
                                    </p>
                                </div>
                                
                                <div className="max-w-2xl space-y-4">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Name
                                        </label>
                                        <Input
                                            value={formData.name}
                                            onChange={(e) => handleInputChange('name', e.target.value)}
                                            placeholder="Enter plan name"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Description
                                        </label>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => handleInputChange('description', e.target.value)}
                                            placeholder="Enter plan description"
                                            rows={4}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Payment Schedule Section */}
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Payment schedule</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Choose the schedule to track and distribute profits.
                                    </p>
                                </div>
                                
                                <div className="max-w-2xl space-y-4">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Schedule
                                        </label>
                                        <Select
                                            options={scheduleOptions}
                                            value={scheduleOptions.find(opt => opt.value === formData.schedule) || null}
                                            onChange={(opt) => handleInputChange('schedule', opt?.value || null)}
                                            placeholder="Select..."
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Start date
                                        </label>
                                        <DatePicker
                                            value={formData.startDate ? (formData.startDate instanceof Date ? formData.startDate : new Date(formData.startDate)) : null}
                                            onChange={(date) => handleInputChange('startDate', date)}
                                            placeholder="Select a date..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Formula Section */}
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
                                        What should the formula for the plan be based on?
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Choose from available options.
                                    </p>
                                </div>
                                
                                <div className="max-w-2xl space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Base bonus formula
                                    </label>
                                    <Select
                                        options={baseBonusFormulaOptions}
                                        value={baseBonusFormulaOptions.find(opt => opt.value === formData.baseBonusFormula) || null}
                                        onChange={(opt) => handleInputChange('baseBonusFormula', opt?.value || null)}
                                        placeholder="Select..."
                                    />
                                </div>
                            </div>

                            {/* Plan Trigger Section */}
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Plan trigger</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                        The number one financial goal for the period.
                                    </p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Your profit share isn't triggered until this has been met.
                                    </p>
                                </div>
                                
                                <div className="max-w-2xl">
                                    {formData.planTrigger ? (
                                        <Card 
                                            className="p-0 border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all"
                                            onClick={handleEditPlanTrigger}
                                        >
                                            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                                                    <div className="text-base font-bold text-gray-900 dark:text-white text-center">
                                                        {formData.planTrigger.type}
                                                    </div>
                                                </div>
                                                <div className="px-6 py-4 flex items-center justify-between group">
                                                    <div className="space-y-1">
                                                        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Targets</div>
                                                        <div className="text-xl font-bold text-gray-900 dark:text-white">
                                                            {formatCurrency(formData.planTrigger.amount)}
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="plain"
                                                        size="sm"
                                                        icon={<HiOutlinePencil />}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleEditPlanTrigger()
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-primary transition-opacity"
                                                    >
                                                        Edit
                                                    </Button>
                                                </div>
                                            </div>
                                        </Card>
                                    ) : (
                                        <Button
                                            variant="twoTone"
                                            onClick={() => setShowPlanTriggerPanel(true)}
                                        >
                                            Add Plan Trigger
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Separator */}
                        <div className="border-t border-gray-200 dark:border-gray-700"></div>

                        {/* Pool Size & Distribution Section */}
                        <div className="space-y-8">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Pool Size & Distribution</h2>
                            
                            {/* Profit Definition Subsection */}
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Profit definition</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Describe how you want to define profit for stakeholder awards.
                                    </p>
                                </div>
                                
                                <div className="max-w-2xl space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Switcher
                                            checked={formData.profitMeasuredSameAsTrigger}
                                            onChange={(checked) => handleInputChange('profitMeasuredSameAsTrigger', checked)}
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">
                                            Profit is measured the same as the plan trigger.
                                        </span>
                                    </div>

                                    {!formData.profitMeasuredSameAsTrigger && (
                                        <div className="space-y-4">
                                            {formData.profitTrigger ? (
                                                <Card 
                                                    className="p-0 border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all"
                                                    onClick={handleEditProfitTrigger}
                                                >
                                                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                                        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                                                            <div className="text-base font-bold text-gray-900 dark:text-white text-center">
                                                                {formData.profitTrigger.type}
                                                            </div>
                                                        </div>
                                                        <div className="px-6 py-4 flex items-center justify-between group">
                                                            <div className="space-y-1">
                                                                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Targets</div>
                                                                <div className="text-xl font-bold text-gray-900 dark:text-white">
                                                                    {formatCurrency(formData.profitTrigger.amount)}
                                                                </div>
                                                            </div>
                                                            <Button
                                                                variant="plain"
                                                                size="sm"
                                                                icon={<HiOutlinePencil />}
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleEditProfitTrigger()
                                                                }}
                                                                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-primary transition-opacity"
                                                            >
                                                                Edit
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </Card>
                                            ) : (
                                                <Button
                                                    variant="twoTone"
                                                    onClick={() => setShowProfitTriggerPanel(true)}
                                                >
                                                    Add profit trigger
                                                </Button>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Describe how you measure profit
                                        </label>
                                        <textarea
                                            value={formData.profitDescription}
                                            onChange={(e) => handleInputChange('profitDescription', e.target.value)}
                                            placeholder="eg. Gross Revenue - COGS"
                                            rows={3}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Pool Percentage Subsection */}
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Pool percentage</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                        Set how much of the profits are allocated to Reins stakeholders.
                                    </p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Input an on-target profit estimate to preview size of the pool.
                                    </p>
                                </div>
                                
                                <div className="max-w-2xl space-y-4">
                                    <div className="space-y-3">
                                        <Radio.Group
                                            value={formData.poolShareType}
                                            onChange={(value) => handleInputChange('poolShareType', value)}
                                        >
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-3">
                                                    <Radio value="above-trigger" />
                                                    <span>Share profits <span className="font-bold">above</span> trigger</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Radio value="total" />
                                                    <span>Share <span className="font-bold">total</span> profits</span>
                                                </div>
                                            </div>
                                        </Radio.Group>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            {formData.poolShareType === 'above-trigger' 
                                                ? 'How much of profits over the trigger should go to the stakeholders?'
                                                : 'How much of total profits should go to the stakeholders?'}
                                        </label>
                                        <div className="relative">
                                            <Input
                                                type="text"
                                                value={formData.poolPercentage}
                                                onChange={handlePercentageChange}
                                                placeholder="0"
                                                className="pr-8"
                                            />
                                            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none">
                                                %
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Est. on-target profit
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">
                                                    $
                                                </span>
                                                <Input
                                                    type="text"
                                                    value={formData.estimatedOnTargetProfit ? formatCurrencyInput(String(formData.estimatedOnTargetProfit)) : ''}
                                                    onChange={(e) => {
                                                        const value = e.target.value.replace(/[^0-9.]/g, '')
                                                        const numValue = value ? parseFloat(value.replace(/,/g, '')) : 0
                                                        handleInputChange('estimatedOnTargetProfit', numValue)
                                                    }}
                                                    placeholder="0"
                                                    className="pl-8"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-sm text-gray-600 dark:text-gray-400">Est. Profit Pool</div>
                                            <div className="text-lg font-semibold text-gray-900 dark:text-white">
                                                {formatCurrency(formData.estimatedProfitPool)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Define Distribution for Awards Subsection */}
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Define distribution for awards</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Choose how profits should be shared.
                                    </p>
                                </div>
                                
                                <div className="max-w-2xl space-y-4">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Distribution method
                                        </label>
                                        <Select
                                            options={distributionMethodOptions}
                                            value={distributionMethodOptions.find(opt => opt.value === formData.distributionMethod) || null}
                                            onChange={(opt) => handleInputChange('distributionMethod', opt?.value || null)}
                                            placeholder="Select..."
                                        />
                                    </div>

                                    {formData.distributionMethod === 'pro-rata' && (
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                What do you want your proration based on?
                                            </label>
                                            <Select
                                                options={prorationBasedOnOptions}
                                                value={prorationBasedOnOptions.find(opt => opt.value === formData.prorationBasedOn) || null}
                                                onChange={(opt) => handleInputChange('prorationBasedOn', opt?.value || null)}
                                                placeholder="Select..."
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Separator */}
                        <div className="border-t border-gray-200 dark:border-gray-700"></div>

                        {/* Milestones Section */}
                        <div className="space-y-8">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Milestones</h2>
                            
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Select your milestones</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Choose the milestones that will determine whether a stakeholder is granted a share of profits in their award.
                                    </p>
                                </div>

                                {/* Milestones Table */}
                                {formData.milestones.length > 0 && (
                                    <div className="max-w-2xl space-y-3">
                                        {formData.milestones.map((milestone, index) => (
                                            <Card 
                                                key={milestone.id || index}
                                                className="p-0 border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all"
                                                onClick={() => handleEditMilestone(index)}
                                            >
                                                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                                                        <div className="text-base font-bold text-gray-900 dark:text-white text-center">
                                                            {milestone.name}
                                                        </div>
                                                    </div>
                                                    <div className="px-6 py-4 flex items-center justify-between group">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400">
                                                                {getMilestoneIcon(milestone)}
                                                            </div>
                                                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                                                {milestone.type === 'financial' ? milestone.trackAs : (milestone.customTrackAs || 'Custom')}
                                                            </span>
                                                        </div>
                                                        <Button
                                                            variant="plain"
                                                            size="sm"
                                                            icon={<HiOutlinePencil />}
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleEditMilestone(index)
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-primary transition-opacity"
                                                        >
                                                            Edit
                                                        </Button>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                )}

                                <div className="max-w-2xl">
                                    <Button
                                        variant="twoTone"
                                        onClick={() => setShowAddMilestoneModal(true)}
                                    >
                                        Add milestone
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Separator */}
                        <div className="border-t border-gray-200 dark:border-gray-700"></div>

                        {/* Payments Section */}
                        <div className="space-y-8">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Payments</h2>
                            
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Time and form of payment</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        The conditions for paying out an award after a payment trigger.
                                    </p>
                                </div>

                                <div className="max-w-2xl space-y-4">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Payment terms
                                        </label>
                                        <Select
                                            options={paymentTermsOptions}
                                            value={paymentTermsOptions.find(opt => opt.value === formData.paymentTerms) || null}
                                            onChange={(opt) => {
                                                handleInputChange('paymentTerms', opt?.value || null)
                                                // Reset installment fields if not installment payments
                                                if (opt?.value !== 'installment-payments') {
                                                    handleInputChange('initialPayment', '')
                                                    handleInputChange('installmentSchedule', null)
                                                    handleInputChange('installmentTimeframe', null)
                                                }
                                            }}
                                            placeholder="Select..."
                                        />
                                    </div>

                                    {formData.paymentTerms === 'installment-payments' && (
                                        <>
                                            <div className="space-y-2">
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    Initial payment
                                                </label>
                                                <div className="relative">
                                                    <Input
                                                        type="text"
                                                        value={formData.initialPayment}
                                                        onChange={(e) => {
                                                            const value = e.target.value.replace(/[^0-9.]/g, '')
                                                            handleInputChange('initialPayment', value)
                                                        }}
                                                        placeholder="0"
                                                        className="pr-8"
                                                    />
                                                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none">
                                                        %
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    Percentage paid 30 days after the period ends
                                                </p>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    Installment schedule
                                                </label>
                                                <Select
                                                    options={installmentScheduleOptions}
                                                    value={installmentScheduleOptions.find(opt => opt.value === formData.installmentSchedule) || null}
                                                    onChange={(opt) => {
                                                        handleInputChange('installmentSchedule', opt?.value || null)
                                                        handleInputChange('installmentTimeframe', null) // Reset timeframe when schedule changes
                                                    }}
                                                    placeholder="Select..."
                                                />
                                            </div>

                                            {formData.installmentSchedule && (
                                                <div className="space-y-2">
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                        Installment timeframe
                                                    </label>
                                                    <Select
                                                        options={getInstallmentTimeframeOptions()}
                                                        value={getInstallmentTimeframeOptions().find(opt => opt.value === formData.installmentTimeframe) || null}
                                                        onChange={(opt) => handleInputChange('installmentTimeframe', opt?.value || null)}
                                                        placeholder="Select..."
                                                    />
                                                    {formData.installmentSchedule === 'remainder-paid' && (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                                            Remainder paid
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex items-center gap-3 pt-2">
                                                <Switcher
                                                    checked={formData.installmentsRequireEmployment}
                                                    onChange={(checked) => handleInputChange('installmentsRequireEmployment', checked)}
                                                />
                                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                                    Installments require employment
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
                            <Button
                                variant="plain"
                                onClick={handleBack}
                                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                            >
                                Cancel
                            </Button>
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="twoTone"
                                    onClick={() => savePlan('draft')}
                                >
                                    Save
                                </Button>
                                <Button
                                    variant="solid"
                                    size="lg"
                                    disabled={!isFormComplete()}
                                    onClick={() => savePlan('finalized')}
                                >
                                    Finalize
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Plan Trigger Side Panel */}
            <PlanTriggerPanel
                isOpen={showPlanTriggerPanel}
                onClose={() => setShowPlanTriggerPanel(false)}
                onSetTrigger={handleSetPlanTrigger}
                initialData={formData.planTrigger}
                title="Plan Trigger"
                buttonText="Set Plan Trigger"
            />

            {/* Profit Trigger Side Panel */}
            <PlanTriggerPanel
                isOpen={showProfitTriggerPanel}
                onClose={() => setShowProfitTriggerPanel(false)}
                onSetTrigger={handleSetProfitTrigger}
                initialData={formData.profitTrigger}
                title="Profit Trigger"
                buttonText="Set Profit Trigger"
            />

            {/* Add Milestone Modal */}
            <Dialog
                isOpen={showAddMilestoneModal}
                onClose={() => {
                    if (milestoneSearchQuery) {
                        setCancelContext('milestone-modal')
                        setShowCancelDialog(true)
                    } else {
                        setShowAddMilestoneModal(false)
                    }
                }}
                width={500}
            >
                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                                <HiOutlineSearch className="w-5 h-5" />
                            </span>
                            <Input
                                value={milestoneSearchQuery}
                                onChange={(e) => setMilestoneSearchQuery(e.target.value)}
                                placeholder="Search..."
                                className="pl-10"
                            />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Type to search for milestones.
                        </p>
                    </div>

                    <Button
                        variant="twoTone"
                        icon={<HiOutlinePlus />}
                        onClick={() => {
                            setShowAddMilestoneModal(false)
                            setShowCreateMilestonePanel(true)
                        }}
                        className="w-full"
                    >
                        Create new milestone
                    </Button>
                </div>
            </Dialog>

            {/* Create Milestone Side Panel */}
            <CreateMilestonePanel
                isOpen={showCreateMilestonePanel}
                onClose={() => {
                    // Check if there are unsaved changes in the panel
                    const hasChanges = editingMilestone !== null || milestoneSearchQuery
                    if (hasChanges) {
                        setCancelContext('milestone-panel')
                        setShowCancelDialog(true)
                    } else {
                        setShowCreateMilestonePanel(false)
                        setEditingMilestone(null)
                    }
                }}
                onAddMilestone={handleAddMilestone}
                initialData={editingMilestone !== null ? formData.milestones[editingMilestone] : null}
            />

            {/* Cancel Confirmation Dialog */}
            <Dialog
                isOpen={showCancelDialog}
                onClose={() => setShowCancelDialog(false)}
                width={400}
            >
                <div className="p-6">
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            {cancelContext === 'page' ? 'Discard Changes?' : 'Unsaved Changes'}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            {cancelContext === 'page' 
                                ? 'All changes will be lost. Are you sure you want to leave this page?'
                                : 'You have unsaved changes. Are you sure you want to cancel without saving?'}
                        </p>
                    </div>
                    
                    <div className="flex justify-end space-x-3">
                        <Button
                            variant="twoTone"
                            onClick={() => setShowCancelDialog(false)}
                        >
                            Keep Editing
                        </Button>
                        <Button
                            variant="solid"
                            onClick={handleConfirmCancel}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {cancelContext === 'page' ? 'Discard' : 'Cancel'}
                        </Button>
                    </div>
                </div>
            </Dialog>
        </div>
    )
}

export default CreateProfitPlan
