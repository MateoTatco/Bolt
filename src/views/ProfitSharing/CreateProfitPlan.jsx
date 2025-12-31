import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { Button, Card, Input, Select, DatePicker, Tag, Dialog, Switcher, Radio, Notification, toast } from '@/components/ui'
import { HiOutlineChevronRight, HiOutlineDotsVertical, HiOutlineArrowLeft, HiOutlineHome, HiOutlineDocumentText, HiOutlineUsers, HiOutlineChartBar, HiOutlineFlag, HiOutlineCog, HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi'
import { useSessionUser } from '@/store/authStore'
import { db } from '@/configs/firebase.config'
import { collection, addDoc, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { useSelectedCompany } from '@/hooks/useSelectedCompany'
import { createNotification } from '@/utils/notificationHelper'
import { NOTIFICATION_TYPES } from '@/constants/notification.constant'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { generatePlanDocument, generateDocumentPreview } from '@/services/DocumentGenerationService'
import DocumentPreviewModal from './components/DocumentPreviewModal'
import { HiOutlineEye } from 'react-icons/hi'

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
    paymentScheduleDates: [],
    // Pool Size & Distribution
    profitDescription: '',
    poolShareType: 'above-trigger', // 'above-trigger' or 'total'
    // Trigger & Payments
    triggerAmount: 0,
    milestoneAmount: 0, // Backward compatibility
    totalShares: 10000,
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
    const { selectedCompanyId, setSelectedCompany } = useSelectedCompany()
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [showCancelDialog, setShowCancelDialog] = useState(false)
    const [cancelContext, setCancelContext] = useState(null) // 'page'
    const [isGeneratingDocument, setIsGeneratingDocument] = useState(false)
    const [planId, setPlanId] = useState(null)
    const [loadingPlan, setLoadingPlan] = useState(false)
    const [existingCreatedAt, setExistingCreatedAt] = useState(null)
    const [companies, setCompanies] = useState([])
    const [loadingCompanies, setLoadingCompanies] = useState(true)
    const [showPlanPreview, setShowPlanPreview] = useState(false)
    const [planPreviewData, setPlanPreviewData] = useState(null)

    // Check authorization on mount
    useEffect(() => {
        const userEmail = user?.email?.toLowerCase() || ''
        const isAuthorized = AUTHORIZED_EMAILS.some(email => email.toLowerCase() === userEmail)
        
        if (!isAuthorized) {
            navigate('/home', { replace: true })
        }
    }, [user, navigate])

    // Load companies on mount
    useEffect(() => {
        loadCompanies()
    }, [])

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
            // Set default company to selected company
            setFormData({ ...DEFAULT_FORM_DATA, companyId: selectedCompanyId || '' })
            setHasUnsavedChanges(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search, selectedCompanyId])

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
            formData.profitDescription &&
            formData.triggerAmount > 0 &&
            formData.totalShares > 0 &&
            Array.isArray(formData.paymentScheduleDates) &&
            formData.paymentScheduleDates.length > 0 &&
            formData.paymentTerms
        )
    }

    const loadCompanies = async () => {
        setLoadingCompanies(true)
        try {
            const result = await FirebaseDbService.companies.getAll()
            if (result.success) {
                setCompanies(result.data.sort((a, b) => (a.name || '').localeCompare(b.name || '')))
            } else {
                console.error('Failed to load companies:', result.error)
                setCompanies([])
            }
        } catch (error) {
            console.error('Error loading companies:', error)
            setCompanies([])
        } finally {
            setLoadingCompanies(false)
        }
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
                paymentScheduleDates: Array.isArray(data.paymentScheduleDates)
                    ? data.paymentScheduleDates
                          .map((d) => (d?.toDate ? d.toDate() : (d ? new Date(d) : null)))
                          .filter(Boolean)
                    : [],
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
        { key: 'milestones', label: 'Trigger', icon: <HiOutlineFlag /> },
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
                       formData.profitDescription ||
                       formData.triggerAmount > 0 ||
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
        }
        setCancelContext(null)
    }


    const savePlan = async (status) => {
        if (!formData.companyId) {
            toast.push(
                <Notification type="warning" duration={2000}>
                    Please select a company for this plan
                </Notification>
            )
            return
        }
        
        try {
            const plansRef = collection(db, 'profitSharingPlans')
            const payload = {
                ...formData,
                companyId: formData.companyId,
                status,
                startDate: formData.startDate
                    ? (formData.startDate instanceof Date ? formData.startDate.toISOString() : formData.startDate)
                    : null,
                paymentScheduleDates: Array.isArray(formData.paymentScheduleDates)
                    ? formData.paymentScheduleDates.map((d) =>
                          d instanceof Date ? d.toISOString() : d
                      )
                    : [],
                totalShares: formData.totalShares || 0,
                updatedAt: serverTimestamp(),
            }

            let finalPlanId = planId
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
                finalPlanId = docRef.id
                setPlanId(finalPlanId)
            }

            setFormData(prev => ({ ...prev, status }))
            setHasUnsavedChanges(false)
            
            // If the plan's company is different from the currently selected company, switch to it
            if (formData.companyId && formData.companyId !== selectedCompanyId) {
                await setSelectedCompany(formData.companyId)
            }
            
            // Generate and upload plan document
            if (status === 'finalized') {
                setIsGeneratingDocument(true)
            }
            try {
                const companyResult = await FirebaseDbService.companies.getById(formData.companyId)
                if (companyResult.success) {
                    const documentResult = await generatePlanDocument(
                        { ...formData, id: finalPlanId },
                        companyResult.data,
                        finalPlanId
                    )
                    
                    // Update plan with document URLs (both DOCX and PDF)
                    const planRef = doc(db, 'profitSharingPlans', finalPlanId)
                    await updateDoc(planRef, {
                        planDocumentUrl: documentResult.pdfUrl || documentResult.url, // PDF URL (preferred for viewing), fallback to DOCX
                        planDocumentStoragePath: documentResult.pdfPath || documentResult.path,
                        planDocumentDocxUrl: documentResult.docxUrl, // Original DOCX
                        planDocumentDocxPath: documentResult.docxPath,
                        planDocumentPdfUrl: documentResult.pdfUrl, // PDF version
                        planDocumentPdfPath: documentResult.pdfPath,
                        planDocumentGeneratedAt: serverTimestamp(),
                    })
                }
            } catch (docError) {
                console.error('Error generating plan document:', docError)
                // Don't fail the save if document generation fails
                
                // Show specific error message for missing template
                let errorMessage = "Plan saved, but document generation failed. Please try again."
                let errorType = "warning"
                let errorDuration = 5000
                
                if (docError?.isTemplateMissing) {
                    errorType = "danger"
                    errorDuration = 8000
                    errorMessage = `The plan template file is missing from Firebase Storage. Please upload "Profit Sharing Plan Template.docx" to profitSharing/templates/ in Firebase Console.`
                    
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
                    <Notification type={errorType} duration={errorDuration} title={errorType === "danger" ? "Template Missing" : "Warning"}>
                        {errorMessage}
                    </Notification>
                )
            } finally {
                if (status === 'finalized') {
                    setIsGeneratingDocument(false)
                }
            }
            
            toast.push(
                <Notification type="success" duration={2000}>
                    {status === 'finalized' ? 'Plan finalized successfully' : 'Plan saved as draft'}
                </Notification>
            )
            
            // Notify admins when plan is finalized
            if (status === 'finalized') {
                try {
                    const planName = formData.name || 'Unnamed Plan'
                    
                    // Get all admins (super admins + profit sharing admins)
                    const allUsersResult = await FirebaseDbService.users.getAll()
                    const allUsers = allUsersResult.success ? allUsersResult.data : []
                    
                    // Get profit sharing access records to find admins
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
                    
                    // Notify all admins
                    await Promise.all(
                        Array.from(adminUserIds).map(adminId =>
                            createNotification({
                                userId: adminId,
                                type: NOTIFICATION_TYPES.PROFIT_SHARING_ADMIN,
                                title: 'Profit Plan Finalized',
                                message: `The profit plan "${planName}" has been finalized and is ready for use.`,
                                entityType: 'profit_sharing',
                                entityId: selectedCompanyId,
                                metadata: {
                                    planId: planId || (planId ? planId : null),
                                    planName,
                                    companyId: selectedCompanyId,
                                }
                            })
                        )
                    )
                } catch (notifError) {
                    console.error('Error notifying admins about finalized plan:', notifError)
                }
            }
            
            window.dispatchEvent(new Event('plansUpdated'))
            // Only navigate if status is 'finalized', otherwise stay on page
            if (status === 'finalized') {
                navigate('/profit-sharing?tab=plans')
            }
        } catch (error) {
            console.error('Error saving plan:', error)
            toast.push(
                <Notification type="danger" duration={2000}>
                    Failed to save plan
                </Notification>
            )
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
                                </div>
                                
                                <div className="max-w-2xl space-y-4">
                                    {/* Company Field */}
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Company
                                        </label>
                                        <Select
                                            options={companies.map(c => ({ value: c.id, label: c.name || 'Unnamed Company' }))}
                                            value={companies.find(c => c.id === formData.companyId) ? { value: formData.companyId, label: companies.find(c => c.id === formData.companyId)?.name || 'Unnamed Company' } : null}
                                            onChange={(opt) => handleInputChange('companyId', opt?.value || '')}
                                            placeholder="Select a company..."
                                            isLoading={loadingCompanies}
                                            isSearchable
                                        />
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Select the company this plan is associated with
                                        </p>
                                    </div>
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
                                </div>
                                
                                <div className="max-w-2xl space-y-6">
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
                                            inputtable
                                            value={formData.startDate ? (formData.startDate instanceof Date ? formData.startDate : new Date(formData.startDate)) : null}
                                            onChange={(date) => handleInputChange('startDate', date)}
                                            placeholder="Select a date..."
                                            inputFormat="MM/DD/YYYY"
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Payment dates
                                            </label>
                                            <Button
                                                size="sm"
                                                variant="twoTone"
                                                icon={<HiOutlinePlus />}
                                                onClick={() => {
                                                    const nextDate = formData.startDate ? (formData.startDate instanceof Date ? formData.startDate : new Date(formData.startDate)) : null
                                                    handleInputChange('paymentScheduleDates', [
                                                        ...(formData.paymentScheduleDates || []),
                                                        nextDate,
                                                    ])
                                                }}
                                            >
                                                Add date
                                            </Button>
                                        </div>
                                        {(!formData.paymentScheduleDates || formData.paymentScheduleDates.length === 0) && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Add the specific dates profit payments are scheduled (e.g. quarter-end dates).
                                            </p>
                                        )}
                                        <div className="space-y-3">
                                            {formData.paymentScheduleDates && formData.paymentScheduleDates.map((date, index) => (
                                                <div key={index} className="flex items-center gap-3">
                                                    <div className="flex-1">
                                                        <DatePicker
                                                            inputtable
                                                            value={date ? (date instanceof Date ? date : new Date(date)) : null}
                                                            onChange={(newDate) => {
                                                                const updated = [...formData.paymentScheduleDates]
                                                                updated[index] = newDate
                                                                handleInputChange('paymentScheduleDates', updated)
                                                            }}
                                                            placeholder="Select a date..."
                                                            inputFormat="MM/DD/YYYY"
                                                        />
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="plain"
                                                        icon={<HiOutlineTrash />}
                                                        className="text-gray-400 hover:text-red-500"
                                                        onClick={() => {
                                                            const updated = (formData.paymentScheduleDates || []).filter((_, i) => i !== index)
                                                            handleInputChange('paymentScheduleDates', updated)
                                                        }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
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
                                </div>
                                
                                <div className="max-w-2xl space-y-4">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Profit is measured as
                                        </label>
                                        <textarea
                                            value={formData.profitDescription}
                                            onChange={(e) => handleInputChange('profitDescription', e.target.value)}
                                            placeholder="eg. Earnings for tax depreciation and amortization for Tatco Construction OKC LLC"
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
                                </div>
                            </div>

                            {/* Define Distribution for Awards Subsection */}
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Define distribution for awards</h3>
                                </div>
                                
                                <div className="max-w-2xl space-y-4">
                                    <div className="text-sm text-gray-700 dark:text-gray-300">
                                        Awarded profit shares
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Separator */}
                        <div className="border-t border-gray-200 dark:border-gray-700"></div>

                        {/* Trigger Section */}
                        <div className="space-y-8">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Trigger</h2>
                            
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Select your trigger amount</h3>
                                </div>

                                {/* Trigger Amount Input */}
                                <div className="max-w-2xl space-y-4">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Trigger amount (Profit as defined by the plan)
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">
                                                $
                                            </span>
                                            <Input
                                                type="text"
                                                value={formData.triggerAmount ? formatCurrencyInput(String(formData.triggerAmount)) : ''}
                                                onChange={(e) => {
                                                    const value = e.target.value.replace(/[^0-9.]/g, '')
                                                    const numValue = value ? parseFloat(value.replace(/,/g, '')) : 0
                                                    handleInputChange('triggerAmount', numValue)
                                                    // Also update milestoneAmount for backward compatibility
                                                    handleInputChange('milestoneAmount', numValue)
                                                }}
                                                placeholder="0"
                                                className="pl-8"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Total profit shares in this plan
                                        </label>
                                        <Input
                                            type="text"
                                            value={
                                                formData.totalShares
                                                    ? String(formData.totalShares).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                                                    : ''
                                            }
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/[^0-9]/g, '')
                                                const numValue = value ? parseInt(value, 10) : 0
                                                handleInputChange('totalShares', numValue)
                                            }}
                                            placeholder="10,000"
                                        />
                                    </div>
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
                                    variant="plain"
                                    icon={<HiOutlineEye />}
                                    onClick={async () => {
                                        if (!formData.companyId) {
                                            toast.push(
                                                <Notification type="warning" duration={2000}>
                                                    Please select a company first
                                                </Notification>
                                            )
                                            return
                                        }
                                        
                                        try {
                                            const companyResult = await FirebaseDbService.companies.getById(formData.companyId)
                                            if (companyResult.success) {
                                                setPlanPreviewData({
                                                    planData: formData,
                                                    companyData: companyResult.data,
                                                })
                                                setShowPlanPreview(true)
                                            } else {
                                                toast.push(
                                                    <Notification type="warning" duration={2000}>
                                                        Failed to load company data
                                                    </Notification>
                                                )
                                            }
                                        } catch (error) {
                                            console.error('Error preparing preview:', error)
                                            toast.push(
                                                <Notification type="danger" duration={2000}>
                                                    Failed to prepare document preview
                                                </Notification>
                                            )
                                        }
                                    }}
                                    disabled={!formData.companyId || !formData.startDate}
                                >
                                    View Draft
                                </Button>
                                <Button
                                    variant="solid"
                                    size="lg"
                                    disabled={!isFormComplete()}
                                    onClick={async () => {
                                        await savePlan('draft')
                                        // Navigate after save
                                        navigate('/profit-sharing?tab=plans')
                                    }}
                                >
                                    Save and Close
                                </Button>
                                <Button
                                    variant="solid"
                                    size="lg"
                                    disabled={!isFormComplete() || isGeneratingDocument}
                                    onClick={() => savePlan('finalized')}
                                    className="bg-green-600 hover:bg-green-700"
                                    loading={isGeneratingDocument}
                                >
                                    {isGeneratingDocument ? 'Generating Document...' : 'Finalize'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            {/* Plan Document Preview Modal */}
            <DocumentPreviewModal
                isOpen={showPlanPreview}
                onClose={() => {
                    setShowPlanPreview(false)
                    setPlanPreviewData(null)
                }}
                templateType="PLAN"
                templateData={planPreviewData}
                documentName={`plan-preview-${formData.name || 'profit-plan'}`}
                autoGenerate={true}
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
