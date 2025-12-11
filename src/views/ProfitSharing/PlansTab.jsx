import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Button, Card, Dialog, Tag, Notification, toast } from '@/components/ui'
import { HiOutlineBadgeCheck, HiOutlineCurrencyDollar, HiOutlineDocumentText, HiOutlineUsers, HiOutlineTrash } from 'react-icons/hi'
import { useSessionUser } from '@/store/authStore'
import { db } from '@/configs/firebase.config'
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore'
import AgreementSettingsPanel from './components/AgreementSettingsPanel'
import PdfViewerModal from './components/PdfViewerModal'

// Authorized emails that can upload/delete PDFs
const ADMIN_EMAILS = [
    'admin-01@tatco.construction',
    'brett@tatco.construction'
]

const PlansTab = () => {
    const navigate = useNavigate()
    const user = useSessionUser((state) => state.user)
    const [showSettingsPanel, setShowSettingsPanel] = useState(false)
    const [showPdfModal, setShowPdfModal] = useState(false)
    const [activeFilter, setActiveFilter] = useState('profit')
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [selectedPlanType, setSelectedPlanType] = useState('profit')
    const [plans, setPlans] = useState([])
    const [loading, setLoading] = useState(true)
    const [deletingId, setDeletingId] = useState(null)

    const isAdmin = ADMIN_EMAILS.some(email => email.toLowerCase() === user?.email?.toLowerCase())

    // Load plans from Firestore
    useEffect(() => {
        loadPlans()
        
        // Listen for plan updates
        const handlePlansUpdate = () => {
            loadPlans()
        }
        window.addEventListener('plansUpdated', handlePlansUpdate)
        
        return () => {
            window.removeEventListener('plansUpdated', handlePlansUpdate)
        }
    }, [])

    const loadPlans = async () => {
        setLoading(true)
        try {
            const plansRef = collection(db, 'profitSharingPlans')
            // Load all plans (both draft and finalized)
            const querySnapshot = await getDocs(plansRef)
            const plansData = []
            querySnapshot.forEach((doc) => {
                plansData.push({ id: doc.id, ...doc.data() })
            })
            // Sort in memory by createdAt (if available)
            plansData.sort((a, b) => {
                // Handle Firestore Timestamp objects
                const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 
                             (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 
                             (typeof a.createdAt === 'number' ? a.createdAt : 0))
                const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 
                             (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 
                             (typeof b.createdAt === 'number' ? b.createdAt : 0))
                return bTime - aTime // Descending order (newest first)
            })
            setPlans(plansData)
        } catch (error) {
            console.error('Error loading plans:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDeletePlan = async (planId) => {
        const confirmed = window.confirm('Delete this plan? This cannot be undone.')
        if (!confirmed) return

        try {
            setDeletingId(planId)
            const planRef = doc(db, 'profitSharingPlans', planId)
            await deleteDoc(planRef)
            toast.push(
                <Notification type="success" duration={2000}>
                    Plan deleted
                </Notification>
            )
            window.dispatchEvent(new Event('plansUpdated'))
            await loadPlans()
        } catch (error) {
            console.error('Error deleting plan:', error)
            toast.push(
                <Notification type="danger" duration={2000}>
                    Failed to delete plan
                </Notification>
            )
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <>
            <div className="space-y-6">
                {/* Header with buttons */}
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Plans</h2>
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="plain" 
                            size="sm"
                            onClick={() => setShowSettingsPanel(true)}
                            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                        >
                            View plan settings
                        </Button>
                        <Button 
                            variant="solid" 
                            size="sm"
                            onClick={() => setShowCreateModal(true)}
                        >
                            Create
                        </Button>
                    </div>
                </div>

                {/* Filter Tabs - Only Profit */}
                <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
                    <button
                        onClick={() => setActiveFilter('profit')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                            activeFilter === 'profit'
                                ? 'text-gray-900 dark:text-white border-b-2 border-primary'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        Profit
                    </button>
                </div>

                {/* Content Area */}
                <div className="space-y-4">
                    {loading ? (
                        <Card className="p-6">
                            <div className="text-center py-12">
                                <div className="text-gray-400 dark:text-gray-500 text-lg">Loading plans...</div>
                            </div>
                        </Card>
                    ) : plans.length === 0 ? (
                        <Card className="p-6">
                            <div className="text-center py-12">
                                <div className="text-gray-400 dark:text-gray-500 text-lg">No plans created yet</div>
                                <div className="text-gray-400 dark:text-gray-500 text-sm mt-2">Create your first profit plan</div>
                            </div>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {plans.map((plan) => (
                                <Card 
                                    key={plan.id}
                                    className="p-5 border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer bg-white dark:bg-gray-800 relative"
                                    onClick={() => navigate(`/profit-sharing/create-plan?id=${plan.id}`)}
                                >
                                    <button
                                        className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleDeletePlan(plan.id)
                                        }}
                                        disabled={deletingId === plan.id}
                                        title="Delete plan"
                                    >
                                        <HiOutlineTrash className="w-4 h-4" />
                                    </button>

                                    <div className="space-y-3">
                                        {/* Tags */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {plan.status === 'draft' && (
                                                <Tag className="px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                                    Draft
                                                </Tag>
                                            )}
                                            {plan.status === 'finalized' && (
                                                <Tag className="px-2.5 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                                    Finalized
                                                </Tag>
                                            )}
                                            <Tag className="px-2.5 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center gap-1.5">
                                                <HiOutlineDocumentText className="w-3.5 h-3.5" />
                                                Profit
                                            </Tag>
                                        </div>
                                        
                                        {/* Plan Name */}
                                        <div className="min-h-[2.5rem]">
                                            <h3 className="text-base font-bold text-gray-900 dark:text-white line-clamp-2 leading-tight">
                                                {plan.name || 'Untitled Plan'}
                                            </h3>
                                        </div>
                                        
                                        {/* Avatar/None */}
                                        <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                                            <HiOutlineUsers className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                                            <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                                                None
                                            </span>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Agreement Settings Side Panel */}
            <AgreementSettingsPanel
                isOpen={showSettingsPanel}
                onClose={() => setShowSettingsPanel(false)}
                onViewAgreement={() => {
                    setShowSettingsPanel(false)
                    setShowPdfModal(true)
                }}
            />

            {/* PDF Viewer Modal */}
            <PdfViewerModal
                isOpen={showPdfModal}
                onClose={() => setShowPdfModal(false)}
                isAdmin={isAdmin}
            />

            {/* Create Plan Modal */}
            <Dialog
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                width={780}
            >
                <div className="p-6 space-y-8">
                    {/* Header */}
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                            <HiOutlineBadgeCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Select a plan type</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Get started with a plan type that matches your objective.
                            </p>
                        </div>
                    </div>

                    {/* Options */}
                    <div className="grid grid-cols-1 gap-4">
                        <button
                            onClick={() => setSelectedPlanType('profit')}
                            className={`w-full text-left border rounded-xl p-5 transition hover:shadow-md ${
                                selectedPlanType === 'profit'
                                    ? 'border-primary shadow-md bg-primary/5'
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                            }`}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                    <HiOutlineCurrencyDollar className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-base font-semibold text-gray-900 dark:text-white">Profit Sharing</div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                        Mid-term incentives to align teams with financial goals
                                    </div>
                                </div>
                            </div>
                        </button>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3">
                        <Button
                            variant="plain"
                            onClick={() => setShowCreateModal(false)}
                            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="solid"
                            disabled={!selectedPlanType}
                            onClick={() => {
                                setShowCreateModal(false)
                                navigate('/profit-sharing/create-plan')
                            }}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </Dialog>
        </>
    )
}

export default PlansTab

