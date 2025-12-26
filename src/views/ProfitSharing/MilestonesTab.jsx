import { useState, useEffect } from 'react'
import { Card, Button, Table, Tag, Select } from '@/components/ui'
import { HiOutlineFlag, HiOutlineCheckCircle, HiOutlineClock } from 'react-icons/hi'
import { db } from '@/configs/firebase.config'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { useSelectedCompany } from '@/hooks/useSelectedCompany'

const formatCurrency = (value) => {
    if (!value && value !== 0) return '$0'
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.]/g, '')) : value
    if (isNaN(numValue)) return '$0'
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(numValue)
}

const formatDate = (date) => {
    if (!date) return 'N/A'
    const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date)
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const MilestonesTab = () => {
    const { selectedCompanyId, loading: loadingCompany } = useSelectedCompany()
    const [plans, setPlans] = useState([])
    const [valuations, setValuations] = useState([])
    const [loading, setLoading] = useState(true)
    const [filterPlan, setFilterPlan] = useState(null)

    useEffect(() => {
        if (loadingCompany || !selectedCompanyId) return
        
        loadData()
    }, [selectedCompanyId, loadingCompany])

    const loadData = async () => {
        if (!selectedCompanyId) {
            setPlans([])
            setValuations([])
            setLoading(false)
            return
        }
        
        setLoading(true)
        try {
            // Load plans
            const plansRef = collection(db, 'profitSharingPlans')
            const plansSnapshot = await getDocs(plansRef)
            const plansData = []
            plansSnapshot.forEach((doc) => {
                const data = doc.data()
                // Filter by companyId
                if (data.companyId === selectedCompanyId) {
                    plansData.push({
                        id: doc.id,
                        ...data,
                    })
                }
            })
            setPlans(plansData)

            // Load valuations
            const valuationsRef = collection(db, 'valuations')
            const q = query(valuationsRef, orderBy('valuationDate', 'desc'))
            const valuationsSnapshot = await getDocs(q)
            const valuationsData = []
            valuationsSnapshot.forEach((doc) => {
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
            console.error('Error loading milestones data:', error)
        } finally {
            setLoading(false)
        }
    }

    // Get trigger tracking status for a plan (whether trigger amount has been met)
    const getMilestoneStatus = (plan) => {
        const triggerAmount = plan.triggerAmount || plan.milestoneAmount || 0
        if (!triggerAmount || triggerAmount <= 0) {
            return { status: 'no-milestone', progress: 0, latestProfit: 0 }
        }

        // Get latest profit for this plan
        const planValuations = valuations
            .filter(v => v.planId === plan.id)
            .sort((a, b) => {
                const aDate = a.valuationDate?.getTime() || 0
                const bDate = b.valuationDate?.getTime() || 0
                return bDate - aDate
            })

        const latestValuation = planValuations[0]
        const latestProfit = latestValuation?.profitAmount || latestValuation?.fmv || 0

        if (latestProfit >= triggerAmount) {
            return {
                status: 'met',
                progress: 100,
                latestProfit,
                metDate: latestValuation?.valuationDate,
            }
        } else {
            const progress = triggerAmount > 0 ? (latestProfit / triggerAmount) * 100 : 0
            return {
                status: 'pending',
                progress: Math.min(progress, 100),
                latestProfit,
            }
        }
    }

    // Get all plans with trigger amounts to track
    const milestones = plans
        .filter(plan => {
            const triggerAmount = plan.triggerAmount || plan.milestoneAmount || 0
            return triggerAmount > 0
        })
        .map(plan => {
            const status = getMilestoneStatus(plan)
            return {
                ...plan,
                ...status,
            }
        })
        .sort((a, b) => {
            // Sort by status (met first), then by trigger amount
            if (a.status === 'met' && b.status !== 'met') return 1
            if (a.status !== 'met' && b.status === 'met') return -1
            const triggerA = a.triggerAmount || a.milestoneAmount || 0
            const triggerB = b.triggerAmount || b.milestoneAmount || 0
            return triggerB - triggerA
        })

    // Filter plans by selected plan
    const filteredMilestones = filterPlan
        ? milestones.filter(m => m.id === filterPlan)
        : milestones

    const planOptions = [
        { value: null, label: 'All Plans' },
        ...plans.map(plan => ({
            value: plan.id,
            label: plan.name || 'Unnamed Plan',
        })),
    ]

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center space-x-3">
                    <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Trigger Tracking</h2>
                </div>
                <Card className="p-6">
                    <div className="text-center py-12">
                        <div className="text-gray-400 dark:text-gray-500 text-lg">Loading trigger data...</div>
                    </div>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Trigger Tracking</h2>
                </div>
                {plans.length > 0 && (
                    <div className="w-64">
                        <Select
                            options={planOptions}
                            value={planOptions.find(opt => opt.value === filterPlan) || planOptions[0]}
                            onChange={(opt) => setFilterPlan(opt?.value || null)}
                        />
                    </div>
                )}
            </div>

            {milestones.length === 0 ? (
                <Card className="p-6">
                    <div className="text-center py-12">
                        <div className="text-gray-400 dark:text-gray-500 text-lg">No triggers defined yet</div>
                        <div className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                            Create profit plans with trigger amounts to track progress and trigger payouts
                        </div>
                    </div>
                </Card>
            ) : (
                <Card className="p-0">
                    <Table>
                        <Table.THead>
                            <Table.Tr>
                                <Table.Th>Plan Name</Table.Th>
                                <Table.Th>Trigger Amount</Table.Th>
                                <Table.Th>Current Progress</Table.Th>
                                <Table.Th>Status</Table.Th>
                                <Table.Th>Met Date</Table.Th>
                            </Table.Tr>
                        </Table.THead>
                        <Table.TBody>
                            {filteredMilestones.map((milestone) => (
                                <Table.Tr key={milestone.id}>
                                    <Table.Td>
                                        <div className="flex items-center gap-2">
                                            <HiOutlineFlag className="w-5 h-5 text-primary" />
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                {milestone.name || 'Unnamed Plan'}
                                            </span>
                                        </div>
                                    </Table.Td>
                                    <Table.Td>
                                        <span className="text-sm text-gray-900 dark:text-white">
                                            {formatCurrency(milestone.triggerAmount || milestone.milestoneAmount || 0)}
                                        </span>
                                    </Table.Td>
                                    <Table.Td>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                                                <span>{formatCurrency(milestone.latestProfit)}</span>
                                                <span>{milestone.progress.toFixed(1)}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                <div
                                                    className={`h-2 rounded-full transition-all ${
                                                        milestone.status === 'met'
                                                            ? 'bg-green-500'
                                                            : 'bg-primary'
                                                    }`}
                                                    style={{ width: `${Math.min(milestone.progress, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </Table.Td>
                                    <Table.Td>
                                        <Tag
                                            className={`px-2 py-1 text-xs font-medium ${
                                                milestone.status === 'met'
                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                            }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                {milestone.status === 'met' ? (
                                                    <HiOutlineCheckCircle className="w-3 h-3" />
                                                ) : (
                                                    <HiOutlineClock className="w-3 h-3" />
                                                )}
                                                {milestone.status === 'met' ? 'Met' : 'Pending'}
                                            </span>
                                        </Tag>
                                    </Table.Td>
                                    <Table.Td>
                                        <span className="text-sm text-gray-900 dark:text-white">
                                            {milestone.metDate ? formatDate(milestone.metDate) : '—'}
                                        </span>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.TBody>
                    </Table>
                </Card>
            )}
        </div>
    )
}

export default MilestonesTab
