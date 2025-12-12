import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Card, Button, Avatar, Tag } from '@/components/ui'
import { HiOutlineLockClosed, HiOutlineUsers } from 'react-icons/hi'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { db } from '@/configs/firebase.config'
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore'

// Mock data
const mockData = {
    companyValuation: 1941000,
    outstandingAwards: 397905,
    stockPool: 10000,
    usedStockUnits: 2050,
    estimatedValuation: 1941000,
    totalStakeholders: 5,
    activeStakeholders: 0
}

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
    const [stakeholders, setStakeholders] = useState([])
    const [loadingStakeholders, setLoadingStakeholders] = useState(true)
    const [activeValuation, setActiveValuation] = useState(null)
    
    const { outstandingAwards, stockPool, usedStockUnits, estimatedValuation, totalStakeholders, activeStakeholders } = mockData
    const companyValuation = activeValuation?.fmv || mockData.companyValuation
    const remainingStockUnits = stockPool - usedStockUnits
    const usedPercentage = (usedStockUnits / stockPool) * 100
    const remainingPercentage = (remainingStockUnits / stockPool) * 100

    // Load stakeholders and valuation from Firebase
    useEffect(() => {
        loadStakeholders()
        loadActiveValuation()
        
        // Listen for stakeholder updates
        const handleStakeholdersUpdate = () => {
            loadStakeholders()
        }
        window.addEventListener('stakeholdersUpdated', handleStakeholdersUpdate)
        
        // Listen for valuation updates
        const handleValuationsUpdate = () => {
            loadActiveValuation()
        }
        window.addEventListener('valuationsUpdated', handleValuationsUpdate)
        
        return () => {
            window.removeEventListener('stakeholdersUpdated', handleStakeholdersUpdate)
            window.removeEventListener('valuationsUpdated', handleValuationsUpdate)
        }
    }, [])

    const loadStakeholders = async () => {
        setLoadingStakeholders(true)
        try {
            const response = await FirebaseDbService.stakeholders.getAll()
            if (response.success) {
                // Convert Firestore timestamps and format data
                const formattedStakeholders = response.data.map(stakeholder => ({
                    ...stakeholder,
                    // Handle Firestore Timestamp objects
                    createdAt: stakeholder.createdAt?.toDate ? stakeholder.createdAt.toDate() : stakeholder.createdAt,
                    updatedAt: stakeholder.updatedAt?.toDate ? stakeholder.updatedAt.toDate() : stakeholder.updatedAt,
                }))
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

    const loadActiveValuation = async () => {
        try {
            const valuationsRef = collection(db, 'valuations')
            // First try to get active valuation
            const activeQ = query(valuationsRef, where('status', '==', 'Active'))
            const activeSnapshot = await getDocs(activeQ)
            if (!activeSnapshot.empty) {
                // Get the most recent active valuation
                const valuations = activeSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    valuationDate: doc.data().valuationDate?.toDate ? doc.data().valuationDate.toDate() : (doc.data().valuationDate ? new Date(doc.data().valuationDate) : null),
                    updatedDate: doc.data().updatedDate?.toDate ? doc.data().updatedDate.toDate() : (doc.data().updatedDate ? new Date(doc.data().updatedDate) : null),
                }))
                // Sort by valuation date descending
                valuations.sort((a, b) => {
                    const aDate = a.valuationDate?.getTime() || 0
                    const bDate = b.valuationDate?.getTime() || 0
                    return bDate - aDate
                })
                setActiveValuation(valuations[0])
            } else {
                // If no active valuation, get the most recent one
                const allQ = query(valuationsRef, orderBy('valuationDate', 'desc'))
                const allSnapshot = await getDocs(allQ)
                if (!allSnapshot.empty) {
                    const doc = allSnapshot.docs[0]
                    const data = doc.data()
                    setActiveValuation({
                        id: doc.id,
                        ...data,
                        valuationDate: data.valuationDate?.toDate ? data.valuationDate.toDate() : (data.valuationDate ? new Date(data.valuationDate) : null),
                        updatedDate: data.updatedDate?.toDate ? data.updatedDate.toDate() : (data.updatedDate ? new Date(data.updatedDate) : null),
                    })
                } else {
                    setActiveValuation(null)
                }
            }
        } catch (error) {
            console.error('Error loading active valuation:', error)
            // If query fails (e.g., no index), try without where clause
            try {
                const valuationsRef = collection(db, 'valuations')
                const allQ = query(valuationsRef, orderBy('valuationDate', 'desc'))
                const allSnapshot = await getDocs(allQ)
                if (!allSnapshot.empty) {
                    const doc = allSnapshot.docs[0]
                    const data = doc.data()
                    setActiveValuation({
                        id: doc.id,
                        ...data,
                        valuationDate: data.valuationDate?.toDate ? data.valuationDate.toDate() : (data.valuationDate ? new Date(data.valuationDate) : null),
                        updatedDate: data.updatedDate?.toDate ? data.updatedDate.toDate() : (data.updatedDate ? new Date(data.updatedDate) : null),
                    })
                } else {
                    setActiveValuation(null)
                }
            } catch (fallbackError) {
                console.error('Error loading valuation (fallback):', fallbackError)
                setActiveValuation(null)
            }
        }
    }

    return (
        <div className="space-y-8">
            {/* Overview Header with View Plans Button */}
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Overview</h2>
                <Button 
                    variant="plain" 
                    size="sm"
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
                    {/* Company Valuation Card */}
                    <Card className="p-6">
                        <div className="space-y-2">
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Company Valuation</div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(companyValuation)}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Est. Fair Market Value</div>
                        </div>
                    </Card>

                    {/* Outstanding Awards Card */}
                    <Card className="p-6">
                        <div className="space-y-2">
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Outstanding Awards</div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(outstandingAwards)}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Total Potential Value</div>
                        </div>
                    </Card>

                    {/* Stock Pool Card */}
                    <Card className="p-6">
                        <div className="space-y-2">
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Stock Pool</div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white">{formatNumber(stockPool)}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">MARE Stock Units</div>
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
                                Used: {formatNumber(usedStockUnits)} MARE Stock Units
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-200 dark:bg-blue-400/30"></div>
                            <span className="text-gray-600 dark:text-gray-400">
                                Remaining: {formatNumber(remainingStockUnits)} MARE Stock Units
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
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Estimated Valuation</div>
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

export default OverviewTab

