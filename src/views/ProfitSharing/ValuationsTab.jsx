import { useState, useEffect } from 'react'
import { Card, Button, Table, Tag, Drawer, Input, Select, DatePicker, Notification, toast } from '@/components/ui'
import { HiOutlinePlus, HiOutlineCheckCircle, HiOutlineEye, HiOutlinePencil, HiOutlineTrash, HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineMinus } from 'react-icons/hi'
import { db } from '@/configs/firebase.config'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp, where } from 'firebase/firestore'
import React from 'react'
import Chart from '@/components/shared/Chart'
import { useSelectedCompany } from '@/hooks/useSelectedCompany'
import { createNotification } from '@/utils/notificationHelper'
import { NOTIFICATION_TYPES } from '@/constants/notification.constant'
import { FirebaseDbService } from '@/services/FirebaseDbService'

const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value)
}

const formatCurrencyWithDecimals = (value) => {
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

const ValuationsTab = () => {
    const { selectedCompanyId, loading: loadingCompany } = useSelectedCompany()
    const [valuations, setValuations] = useState([])
    const [loading, setLoading] = useState(true)
    const [plans, setPlans] = useState([])
    const [loadingPlans, setLoadingPlans] = useState(true)
    const [showAddDrawer, setShowAddDrawer] = useState(false)
    const [editingValuation, setEditingValuation] = useState(null)
    const [formData, setFormData] = useState({
        planId: '',
        valuationDate: null,
        source: 'Manual',
        profitAmount: '',
        milestoneAmount: '',
        pricePerShare: '',
        totalShares: '',
        planPoolShareType: 'total', // Store plan's poolShareType for calculation
        notes: '',
    })

    useEffect(() => {
        if (loadingCompany || !selectedCompanyId) return
        
        loadValuations()
        loadPlans()
    }, [selectedCompanyId, loadingCompany])

    const loadPlans = async () => {
        if (!selectedCompanyId) {
            setPlans([])
            setLoadingPlans(false)
            return
        }
        
        setLoadingPlans(true)
        try {
            const plansRef = collection(db, 'profitSharingPlans')
            // Simple orderBy on name to avoid composite index requirement; filter by status client-side
            const q = query(plansRef, orderBy('name'))
            const snapshot = await getDocs(q)
            const plansData = snapshot.docs
                .map((docSnap) => {
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
                .filter(plan => plan.companyId === selectedCompanyId && ['draft', 'finalized'].includes(plan.status || 'draft'))
            setPlans(plansData)
        } catch (error) {
            console.error('Error loading plans for valuations:', error)
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2000, title: 'Error' },
                    'Failed to load profit plans for valuations'
                )
            )
        } finally {
            setLoadingPlans(false)
        }
    }

    const loadValuations = async () => {
        if (!selectedCompanyId) {
            setValuations([])
            setLoading(false)
            return
        }
        
        setLoading(true)
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
                        updatedDate: data.updatedDate?.toDate ? data.updatedDate.toDate() : (data.updatedDate ? new Date(data.updatedDate) : null),
                    })
                }
            })
            setValuations(valuationsData)
        } catch (error) {
            console.error('Error loading valuations:', error)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "danger", duration: 2000, title: "Error" },
                    "Failed to load valuations"
                )
            )
        } finally {
            setLoading(false)
        }
    }

    const getActiveValuation = () => {
        return valuations.find(v => v.status === 'Active') || valuations[0] || null
    }

    const getPreviousValuation = () => {
        const active = getActiveValuation()
        if (!active) return null
        const activeIndex = valuations.findIndex(v => v.id === active.id)
        return valuations[activeIndex + 1] || null
    }

    const calculateChange = () => {
        const active = getActiveValuation()
        const previous = getPreviousValuation()
        if (!active || !previous) return null
        const activeValue = typeof active.fmv === 'number' && active.fmv > 0 ? active.fmv : active.profitAmount || 0
        const previousValue = typeof previous.fmv === 'number' && previous.fmv > 0 ? previous.fmv : previous.profitAmount || 0
        if (!activeValue || !previousValue) return null
        return {
            amount: activeValue - previousValue,
            percentage: ((activeValue - previousValue) / previousValue) * 100
        }
    }

    const handleInputChange = (field, value) => {
        setFormData(prev => {
            const next = { ...prev, [field]: value }

            // When plan changes, pull milestone and total shares from plan
            if (field === 'planId') {
                const selectedPlan = plans.find(p => p.id === value)
                if (selectedPlan) {
                    next.milestoneAmount = selectedPlan.milestoneAmount || selectedPlan.milestone || 0
                    next.totalShares = selectedPlan.totalShares || 0
                    // Store poolShareType for calculation
                    next.planPoolShareType = selectedPlan.poolShareType || 'total'
                    // Reset date when plan changes to force re-selection from that plan's schedule
                    next.valuationDate = null
                } else {
                    next.milestoneAmount = ''
                    next.totalShares = ''
                    next.planPoolShareType = 'total'
                    next.valuationDate = null
                }
            }

            // Recalculate price per share whenever profit, totalShares, milestoneAmount, or planId changes
            if (['profitAmount', 'totalShares', 'milestoneAmount', 'planId'].includes(field)) {
                const profitRaw = next.profitAmount
                const totalSharesRaw = next.totalShares
                const milestoneRaw = next.milestoneAmount
                const poolShareType = next.planPoolShareType || 'total'

                const profit = profitRaw ? parseFloat(String(profitRaw).replace(/,/g, '')) : 0
                const total = totalSharesRaw ? parseFloat(String(totalSharesRaw).replace(/,/g, '')) : 0
                const milestone = milestoneRaw ? parseFloat(String(milestoneRaw).replace(/,/g, '')) : 0

                if (total > 0 && profit > 0) {
                    let perShare
                    if (poolShareType === 'above-trigger') {
                        // Formula: (profitAmount - milestoneAmount) / totalShares
                        const profitAboveTrigger = Math.max(0, profit - milestone)
                        perShare = profitAboveTrigger / total
                    } else {
                        // Formula: profitAmount / totalShares (default)
                        perShare = profit / total
                    }
                    next.pricePerShare = perShare.toFixed(2)
                } else {
                    next.pricePerShare = ''
                }
            }

            return next
        })
    }

    const resetForm = () => {
        setFormData({
            planId: '',
            valuationDate: null,
            source: 'Manual',
            profitAmount: '',
            milestoneAmount: '',
            pricePerShare: '',
            totalShares: '',
            planPoolShareType: 'total',
            notes: '',
        })
        setEditingValuation(null)
    }

    const handleOpenAdd = () => {
        resetForm()
        setShowAddDrawer(true)
    }

    const handleOpenEdit = (valuation) => {
        setEditingValuation(valuation)

        // Get plan's poolShareType for calculation
        const selectedPlan = plans.find(p => p.id === valuation.planId)
        const planPoolShareType = selectedPlan?.poolShareType || 'total'

        // Derive price per share if it's missing on older records
        const derivedPricePerShare =
            valuation.pricePerShare && valuation.pricePerShare > 0
                ? valuation.pricePerShare
                : (valuation.profitAmount && valuation.totalShares
                    ? valuation.profitAmount / valuation.totalShares
                    : null)

        setFormData({
            planId: valuation.planId || '',
            valuationDate: valuation.valuationDate ? (valuation.valuationDate instanceof Date ? valuation.valuationDate : new Date(valuation.valuationDate)) : null,
            source: valuation.source || 'Manual',
            profitAmount: valuation.profitAmount ? String(valuation.profitAmount) : (valuation.fmv ? String(valuation.fmv) : ''),
            milestoneAmount: valuation.milestoneAmount ? String(valuation.milestoneAmount) : '',
            pricePerShare: derivedPricePerShare ? String(derivedPricePerShare.toFixed(2)) : '',
            totalShares: valuation.totalShares ? String(valuation.totalShares) : '',
            planPoolShareType: planPoolShareType,
            notes: valuation.notes || '',
        })
        setShowAddDrawer(true)
    }

    const handleSave = async () => {
        if (!selectedCompanyId) {
            toast.push(
                React.createElement(
                    Notification,
                    { type: "warning", duration: 2000, title: "Validation" },
                    "Please select a company in Settings first"
                )
            )
            return
        }
        
        try {
            if (!formData.planId || !formData.valuationDate || !formData.source || !formData.profitAmount) {
                toast.push(
                    React.createElement(
                        Notification,
                        { type: "warning", duration: 2000, title: "Validation" },
                        "Please select a plan, profit date, source, and profit amount"
                    )
                )
                return
            }

            const profitValue = formData.profitAmount
                ? parseFloat(formData.profitAmount.replace(/,/g, ''))
                : 0
            const milestoneValue = formData.milestoneAmount
                ? parseFloat(String(formData.milestoneAmount).replace(/,/g, ''))
                : 0
            const totalSharesValue = formData.totalShares
                ? parseFloat(String(formData.totalShares).replace(/,/g, ''))
                : null

            // Compute price per share based on plan's poolShareType
            const selectedPlan = plans.find(p => p.id === formData.planId)
            const poolShareType = selectedPlan?.poolShareType || formData.planPoolShareType || 'total'
            
            let pricePerShareValue = null
            if (profitValue && totalSharesValue && totalSharesValue > 0) {
                if (poolShareType === 'above-trigger') {
                    // Formula: (profitAmount - milestoneAmount) / totalShares
                    const profitAboveTrigger = Math.max(0, profitValue - milestoneValue)
                    pricePerShareValue = profitAboveTrigger / totalSharesValue
                } else {
                    // Formula: profitAmount / totalShares (default)
                    pricePerShareValue = profitValue / totalSharesValue
                }
            }

            const valuationData = {
                companyId: selectedCompanyId,
                planId: formData.planId,
                valuationDate: formData.valuationDate instanceof Date ? formData.valuationDate : new Date(formData.valuationDate),
                source: formData.source,
                // For backwards compatibility with existing UI, store profit as FMV too
                fmv: profitValue || 0,
                profitAmount: profitValue || 0,
                milestoneAmount: milestoneValue || 0,
                pricePerShare: pricePerShareValue,
                totalShares: totalSharesValue,
                notes: formData.notes || '',
                updatedDate: serverTimestamp(),
            }

            if (editingValuation) {
                // Update existing
                const valuationRef = doc(db, 'valuations', editingValuation.id)
                
                // If setting this as Active, set all others to Historical
                if (formData.source && !editingValuation.status) {
                    // Check if we should set status
                    const shouldSetActive = true // You can add logic here
                    if (shouldSetActive) {
                        valuationData.status = 'Active'
                        // Set all other Active valuations to Historical
                        const activeValuations = valuations.filter(v => v.status === 'Active' && v.id !== editingValuation.id)
                        for (const val of activeValuations) {
                            const valRef = doc(db, 'valuations', val.id)
                            await updateDoc(valRef, { status: 'Historical' })
                        }
                    }
                }
                
                await updateDoc(valuationRef, valuationData)
                toast.push(
                    React.createElement(
                        Notification,
                        { type: "success", duration: 2000, title: "Success" },
                        "Valuation updated successfully"
                    )
                )
            } else {
                // Create new
                valuationData.status = 'Active' // New valuations are Active by default
                valuationData.createdAt = serverTimestamp()
                
                // Set all other Active valuations to Historical
                const activeValuations = valuations.filter(v => v.status === 'Active')
                for (const val of activeValuations) {
                    const valRef = doc(db, 'valuations', val.id)
                    await updateDoc(valRef, { status: 'Historical' })
                }
                
                const valuationsRef = collection(db, 'valuations')
                await addDoc(valuationsRef, valuationData)
                toast.push(
                    React.createElement(
                        Notification,
                        { type: "success", duration: 2000, title: "Success" },
                        "Valuation added successfully"
                    )
                )
                
                // Notify admins about new valuation
                try {
                    const selectedPlan = plans.find(p => p.id === formData.planId)
                    const planName = selectedPlan?.name || 'Unknown Plan'
                    const profitFormatted = new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                    }).format(profitValue)
                    
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
                                title: 'New Profit Entry Created',
                                message: `A new profit entry of ${profitFormatted} has been added for ${planName}.`,
                                entityType: 'profit_sharing',
                                entityId: selectedCompanyId,
                                metadata: {
                                    planId: formData.planId,
                                    planName,
                                    profitAmount: profitValue,
                                    valuationDate: valuationData.valuationDate,
                                }
                            })
                        )
                    )
                } catch (notifError) {
                    console.error('Error notifying admins about new valuation:', notifError)
                }
            }

            await loadValuations()
            setShowAddDrawer(false)
            resetForm()
            window.dispatchEvent(new Event('valuationsUpdated'))
        } catch (error) {
            console.error('Error saving valuation:', error)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "danger", duration: 2000, title: "Error" },
                    "Failed to save valuation"
                )
            )
        }
    }

    const handleDelete = async (valuationId) => {
        if (!window.confirm('Are you sure you want to delete this valuation?')) {
            return
        }

        try {
            const valuationRef = doc(db, 'valuations', valuationId)
            await deleteDoc(valuationRef)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "success", duration: 2000, title: "Success" },
                    "Valuation deleted successfully"
                )
            )
            await loadValuations()
            window.dispatchEvent(new Event('valuationsUpdated'))
        } catch (error) {
            console.error('Error deleting valuation:', error)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "danger", duration: 2000, title: "Error" },
                    "Failed to delete valuation"
                )
            )
        }
    }

    const activeValuation = getActiveValuation()
    const change = calculateChange()

    const activePricePerShare = activeValuation
        ? (activeValuation.pricePerShare && activeValuation.pricePerShare > 0
            ? activeValuation.pricePerShare
            : (activeValuation.profitAmount && activeValuation.totalShares
                ? activeValuation.profitAmount / activeValuation.totalShares
                : null))
        : null

    const sourceOptions = [
        { value: 'Manual', label: 'Manual' },
        { value: 'Third-party', label: 'Third-party' },
        { value: 'Calculated', label: 'Calculated' },
    ]

    const selectedPlan = plans.find(p => p.id === formData.planId)

    const profitDateOptions = selectedPlan
        ? selectedPlan.paymentScheduleDates.map((d) => ({
              value: d.toISOString(),
              label: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          }))
        : []

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Profit entries</h2>
                    <Button 
                        variant="solid" 
                        size="sm"
                        icon={<HiOutlinePlus />}
                        onClick={handleOpenAdd}
                    >
                        Add profit
                    </Button>
                </div>

                {/* Current Value Card */}
                {activeValuation ? (
                    <Card className="p-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Current value</h3>
                                    <HiOutlineCheckCircle className="w-4 h-4 text-green-500" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="space-y-1">
                                    <div className="text-4xl font-bold text-gray-900 dark:text-white">
                                        {formatCurrency(
                                            typeof activeValuation.fmv === 'number' && activeValuation.fmv > 0
                                                ? activeValuation.fmv
                                                : activeValuation.profitAmount || 0
                                        )}
                                    </div>
                                    {activePricePerShare && (
                                        <div className="text-sm text-gray-600 dark:text-gray-300">
                                            Price per share:{' '}
                                            <span className="font-semibold">
                                                {formatCurrencyWithDecimals(activePricePerShare)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {change && (
                                    <div className="flex items-center gap-2">
                                        {change.amount > 0 ? (
                                            <>
                                                <HiOutlineTrendingUp className="w-4 h-4 text-green-500" />
                                                <span className="text-sm text-green-600 dark:text-green-400">
                                                    +{formatCurrency(Math.abs(change.amount))} ({change.percentage > 0 ? '+' : ''}{change.percentage.toFixed(2)}%)
                                                </span>
                                            </>
                                        ) : change.amount < 0 ? (
                                            <>
                                                <HiOutlineTrendingDown className="w-4 h-4 text-red-500" />
                                                <span className="text-sm text-red-600 dark:text-red-400">
                                                    {formatCurrency(change.amount)} ({change.percentage.toFixed(2)}%)
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <HiOutlineMinus className="w-4 h-4 text-gray-500" />
                                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                                    No change
                                                </span>
                                            </>
                                        )}
                                    </div>
                                )}
                                {!change && (
                                    <div className="text-sm text-gray-500 dark:text-gray-400">No previous valuation</div>
                                )}
                            </div>
                            {/* Profit Trend Chart */}
                            {valuations.length > 0 ? (
                                <div className="h-64">
                                    <Chart
                                        type="line"
                                        series={[
                                            {
                                                name: 'Profit',
                                                data: valuations
                                                    .sort((a, b) => {
                                                        const aDate = a.valuationDate?.getTime() || 0
                                                        const bDate = b.valuationDate?.getTime() || 0
                                                        return aDate - bDate
                                                    })
                                                    .map(v => {
                                                        const profit = typeof v.fmv === 'number' && v.fmv > 0 ? v.fmv : v.profitAmount || 0
                                                        return profit
                                                    }),
                                            },
                                        ]}
                                        xAxis={valuations
                                            .sort((a, b) => {
                                                const aDate = a.valuationDate?.getTime() || 0
                                                const bDate = b.valuationDate?.getTime() || 0
                                                return aDate - bDate
                                            })
                                            .map(v => {
                                                if (!v.valuationDate) return 'N/A'
                                                return v.valuationDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                            })}
                                        customOptions={{
                                            legend: {
                                                show: true,
                                                position: 'top',
                                                horizontalAlign: 'right',
                                            },
                                            yaxis: {
                                                title: {
                                                    text: 'Profit ($)',
                                                    style: {
                                                        fontSize: '12px',
                                                        fontWeight: 500,
                                                    },
                                                },
                                                labels: {
                                                    formatter: function(val) {
                                                        if (val >= 1000000) {
                                                            return '$' + (val / 1000000).toFixed(1) + 'M'
                                                        } else if (val >= 1000) {
                                                            return '$' + (val / 1000).toFixed(0) + 'K'
                                                        }
                                                        return '$' + val.toFixed(0)
                                                    },
                                                },
                                            },
                                            xaxis: {
                                                title: {
                                                    text: 'Profit Date',
                                                    style: {
                                                        fontSize: '12px',
                                                        fontWeight: 500,
                                                    },
                                                },
                                            },
                                            tooltip: {
                                                y: {
                                                    formatter: function(val) {
                                                        return formatCurrency(val)
                                                    },
                                                },
                                            },
                                        }}
                                        height={256}
                                    />
                                </div>
                            ) : (
                                <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                                    <span className="text-xs text-gray-400 dark:text-gray-500">Add profit entries to see trend chart</span>
                                </div>
                            )}
                        </div>
                    </Card>
                ) : (
                    <Card className="p-6">
                        <div className="text-center py-8">
                            <div className="text-gray-400 dark:text-gray-500 text-lg">No active valuation</div>
                            <div className="text-gray-400 dark:text-gray-500 text-sm mt-2">Add your first valuation to get started</div>
                        </div>
                    </Card>
                )}

                {/* History Table */}
                <Card className="p-0">
                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="text-gray-400 dark:text-gray-500">Loading valuations...</div>
                        </div>
                    ) : valuations.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="text-gray-400 dark:text-gray-500 text-lg">No valuations recorded yet</div>
                            <div className="text-gray-400 dark:text-gray-500 text-sm mt-2">Track company valuation over time</div>
                        </div>
                    ) : (
                        <Table>
                            <Table.THead>
                                <Table.Tr>
                                    <Table.Th>Updated Date</Table.Th>
                                    <Table.Th>Profit Date</Table.Th>
                                    <Table.Th>Source</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th>Profit</Table.Th>
                                    <Table.Th>Trigger</Table.Th>
                                    <Table.Th>Price per Share</Table.Th>
                                    <Table.Th>Total Shares</Table.Th>
                                    <Table.Th>Plan</Table.Th>
                                    <Table.Th>Actions</Table.Th>
                                </Table.Tr>
                            </Table.THead>
                            <Table.TBody>
                                {valuations.map((valuation) => (
                                    <Table.Tr key={valuation.id}>
                                        <Table.Td>
                                            <span className="text-sm text-gray-900 dark:text-white">
                                                {valuation.updatedDate 
                                                    ? valuation.updatedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                                                    : 'N/A'}
                                            </span>
                                        </Table.Td>
                                        <Table.Td>
                                            <span className="text-sm text-gray-900 dark:text-white">
                                                {valuation.valuationDate 
                                                    ? valuation.valuationDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                                                    : 'N/A'}
                                            </span>
                                        </Table.Td>
                                        <Table.Td>
                                            <Tag className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                                {valuation.source || 'N/A'}
                                            </Tag>
                                        </Table.Td>
                                        <Table.Td>
                                            {valuation.status === 'Active' ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                    <span className="text-sm text-gray-900 dark:text-white">Active</span>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-500 dark:text-gray-400">Historical</span>
                                            )}
                                        </Table.Td>
                                        <Table.Td>
                                            <span className="text-sm text-gray-900 dark:text-white font-medium">
                                                {formatCurrency(
                                                    typeof valuation.fmv === 'number' && valuation.fmv > 0
                                                        ? valuation.fmv
                                                        : valuation.profitAmount || 0
                                                )}
                                            </span>
                                        </Table.Td>
                                        <Table.Td>
                                            <span className="text-sm text-gray-900 dark:text-white">
                                                {valuation.milestoneAmount
                                                    ? formatCurrency(valuation.milestoneAmount)
                                                    : '—'}
                                            </span>
                                        </Table.Td>
                                        <Table.Td>
                                            <span className="text-sm text-gray-900 dark:text-white">
                                                {(() => {
                                                    const effectivePricePerShare =
                                                        valuation.pricePerShare && valuation.pricePerShare > 0
                                                            ? valuation.pricePerShare
                                                            : (valuation.profitAmount && valuation.totalShares
                                                                ? valuation.profitAmount / valuation.totalShares
                                                                : null)

                                                    return effectivePricePerShare
                                                        ? formatCurrencyWithDecimals(effectivePricePerShare)
                                                        : '—'
                                                })()}
                                            </span>
                                        </Table.Td>
                                        <Table.Td>
                                            <span className="text-sm text-gray-900 dark:text-white">
                                                {valuation.totalShares ? formatNumber(valuation.totalShares) : '—'}
                                            </span>
                                        </Table.Td>
                                        <Table.Td>
                                            <span className="text-sm text-gray-900 dark:text-white">
                                                {valuation.planId
                                                    ? (plans.find(p => p.id === valuation.planId)?.name || '—')
                                                    : '—'}
                                            </span>
                                        </Table.Td>
                                        <Table.Td>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="plain"
                                                    size="sm"
                                                    icon={<HiOutlinePencil />}
                                                    onClick={() => handleOpenEdit(valuation)}
                                                    className="text-gray-400 hover:text-primary"
                                                />
                                                <Button
                                                    variant="plain"
                                                    size="sm"
                                                    icon={<HiOutlineTrash />}
                                                    onClick={() => handleDelete(valuation.id)}
                                                    className="text-gray-400 hover:text-red-500"
                                                />
                                            </div>
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.TBody>
                        </Table>
                    )}
                </Card>
            </div>

            {/* Add/Edit Valuation Drawer */}
            <Drawer
                isOpen={showAddDrawer}
                onClose={() => {
                    setShowAddDrawer(false)
                    resetForm()
                }}
                title={editingValuation ? "Edit profit entry" : "Add profit"}
                width={600}
            >
                <div className="flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Plan *
                            </label>
                            <Select
                                isLoading={loadingPlans}
                                options={plans.map(plan => ({
                                    value: plan.id,
                                    label: plan.name || 'Untitled plan',
                                }))}
                                value={
                                    formData.planId
                                        ? {
                                              value: formData.planId,
                                              label:
                                                  plans.find(p => p.id === formData.planId)?.name ||
                                                  'Selected plan',
                                          }
                                        : null
                                }
                                onChange={(opt) => handleInputChange('planId', opt?.value || '')}
                                placeholder="Select a profit plan..."
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Profit date *
                            </label>
                            <Select
                                isDisabled={!selectedPlan || profitDateOptions.length === 0}
                                options={profitDateOptions}
                                value={
                                    formData.valuationDate
                                        ? {
                                              value:
                                                  formData.valuationDate instanceof Date
                                                      ? formData.valuationDate.toISOString()
                                                      : new Date(formData.valuationDate).toISOString(),
                                              label: (formData.valuationDate instanceof Date
                                                  ? formData.valuationDate
                                                  : new Date(formData.valuationDate)
                                              ).toLocaleDateString('en-US', {
                                                  month: 'long',
                                                  day: 'numeric',
                                                  year: 'numeric',
                                              }),
                                          }
                                        : null
                                }
                                onChange={(opt) => {
                                    const selected = opt?.value ? new Date(opt.value) : null
                                    handleInputChange('valuationDate', selected)
                                }}
                                placeholder={
                                    !selectedPlan
                                        ? 'Select a plan first'
                                        : profitDateOptions.length === 0
                                        ? 'No payment dates configured for this plan'
                                        : 'Select a profit date...'
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Source *
                            </label>
                            <Select
                                options={sourceOptions}
                                value={sourceOptions.find(opt => opt.value === formData.source) || null}
                                onChange={(opt) => handleInputChange('source', opt?.value || null)}
                                placeholder="Select..."
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Profit amount *
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">
                                    $
                                </span>
                                <Input
                                    type="text"
                                    value={formData.profitAmount ? formData.profitAmount.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/[^0-9]/g, '')
                                        handleInputChange('profitAmount', value)
                                    }}
                                    placeholder="0"
                                    className="pl-8"
                                />
                            </div>
                        </div>

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
                                    value={formData.milestoneAmount
                                        ? String(formData.milestoneAmount).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                                        : ''}
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
                                Price per Share
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">
                                    $
                                </span>
                                <Input
                                    type="text"
                                    value={formData.pricePerShare
                                        ? String(formData.pricePerShare).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                                        : ''}
                                    disabled
                                    placeholder="0.00"
                                    className="pl-8 bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
                                />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {(() => {
                                    const selectedPlan = plans.find(p => p.id === formData.planId)
                                    const poolShareType = selectedPlan?.poolShareType || formData.planPoolShareType || 'total'
                                    if (poolShareType === 'above-trigger') {
                                        return 'Automatically calculated as (profit - trigger amount) ÷ total shares.'
                                    }
                                    return 'Automatically calculated as profit ÷ total shares.'
                                })()}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Total shares in plan
                            </label>
                            <Input
                                type="text"
                                value={formData.totalShares
                                    ? String(formData.totalShares).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                                    : ''}
                                disabled
                                placeholder="0"
                                className="bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Notes
                            </label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => handleInputChange('notes', e.target.value)}
                                placeholder="Add any additional notes..."
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
                            />
                        </div>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 p-6 flex items-center justify-end gap-3">
                        <Button
                            variant="plain"
                            onClick={() => {
                                setShowAddDrawer(false)
                                resetForm()
                            }}
                            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="solid"
                            onClick={handleSave}
                        >
                            {editingValuation ? 'Update profit' : 'Add profit'}
                        </Button>
                    </div>
                </div>
            </Drawer>
        </>
    )
}

export default ValuationsTab
