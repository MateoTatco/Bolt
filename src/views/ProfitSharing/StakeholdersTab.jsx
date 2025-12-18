import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import React from 'react'
import { Card, Button, Table, Input, Tag, Avatar, Checkbox, Notification, toast } from '@/components/ui'
import { HiOutlinePlus, HiOutlineSearch, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi'
import AddStakeholderModal from './components/AddStakeholderModal'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { db } from '@/configs/firebase.config'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { useSelectedCompany } from '@/hooks/useSelectedCompany'
import { useSessionUser } from '@/store/authStore'

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

const getInitials = (name) => {
    if (!name) return ''
    const parts = name.split(' ')
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name[0].toUpperCase()
}

const StakeholdersTab = ({ isAdmin = true }) => {
    const navigate = useNavigate()
    const user = useSessionUser((state) => state.user)
    const { selectedCompanyId, loading: loadingCompany } = useSelectedCompany()
    const [showAddModal, setShowAddModal] = useState(false)
    const [activeFilter, setActiveFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [stakeholders, setStakeholders] = useState([])
    const [selectedStakeholders, setSelectedStakeholders] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeValuation, setActiveValuation] = useState(null)
    const [plans, setPlans] = useState([])
    const [loadingPlans, setLoadingPlans] = useState(true)

    // Derived aggregates
    const companyValuation = activeValuation
        ? (typeof activeValuation.fmv === 'number' && activeValuation.fmv > 0
            ? activeValuation.fmv
            : activeValuation.profitAmount || 0)
        : 0

    const totalProfitShares = plans.reduce((sum, plan) => sum + (plan.totalShares || 0), 0)

    const usedProfitShares = stakeholders.reduce((outerSum, stakeholder) => {
        const awards = stakeholder.profitAwards || []
        const stakeholderShares = awards.reduce((innerSum, award) => innerSum + (award.sharesIssued || 0), 0)
        return outerSum + stakeholderShares
    }, 0)

    const stockPool = totalProfitShares
    const usedStockUnits = usedProfitShares

    const remainingStockUnits = Math.max(stockPool - usedStockUnits, 0)
    const usedPercentage = stockPool > 0 ? (usedStockUnits / stockPool) * 100 : 0
    const remainingPercentage = stockPool > 0 ? (remainingStockUnits / stockPool) * 100 : 0

    const outstandingAwards = stakeholders.reduce((sum, stakeholder) => {
        const awards = stakeholder.profitAwards || []
        return sum + awards.length
    }, 0)

    // Load stakeholders from Firebase
    useEffect(() => {
        if (loadingCompany || !selectedCompanyId) return
        
        loadStakeholders()
        loadActiveValuation()
        loadPlans()
        
        // Listen for stakeholder updates (when awards are added/updated in detail page)
        const handleStakeholdersUpdate = () => {
            loadStakeholders()
        }
        window.addEventListener('stakeholdersUpdated', handleStakeholdersUpdate)
        
        return () => {
            window.removeEventListener('stakeholdersUpdated', handleStakeholdersUpdate)
        }
    }, [selectedCompanyId, loadingCompany])

    const loadStakeholders = async () => {
        setLoading(true)
        try {
            const response = await FirebaseDbService.stakeholders.getAll()
            if (response.success) {
                // Convert Firestore timestamps and format data
                let formattedStakeholders = response.data.map(stakeholder => ({
                    ...stakeholder,
                    // Handle Firestore Timestamp objects
                    createdAt: stakeholder.createdAt?.toDate ? stakeholder.createdAt.toDate() : stakeholder.createdAt,
                    updatedAt: stakeholder.updatedAt?.toDate ? stakeholder.updatedAt.toDate() : stakeholder.updatedAt,
                }))
                
                // Filter by companyId
                formattedStakeholders = formattedStakeholders.filter(
                    stakeholder => stakeholder.companyId === selectedCompanyId
                )
                
                // For regular users, only show their own stakeholder record
                if (!isAdmin) {
                    const currentUserId = user?.id || user?.uid
                    formattedStakeholders = formattedStakeholders.filter(
                        stakeholder => stakeholder.linkedUserId === currentUserId
                    )
                }
                
                setStakeholders(formattedStakeholders)
            } else {
                console.error('Error loading stakeholders:', response.error)
                toast.push(
                    React.createElement(
                        Notification,
                        { type: "danger", duration: 2000, title: "Error" },
                        `Failed to load stakeholders: ${response.error}`
                    )
                )
                setStakeholders([])
            }
        } catch (error) {
            console.error('Error loading stakeholders:', error)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "danger", duration: 2000, title: "Error" },
                    "Failed to load stakeholders"
                )
            )
            setStakeholders([])
        } finally {
            setLoading(false)
        }
    }

    const loadActiveValuation = async () => {
        if (!selectedCompanyId) {
            setActiveValuation(null)
            return
        }
        
        try {
            const valuationsRef = collection(db, 'valuations')
            const allQ = query(valuationsRef, orderBy('valuationDate', 'desc'))
            const allSnapshot = await getDocs(allQ)
            if (!allSnapshot.empty) {
                // Filter by companyId
                const filtered = allSnapshot.docs
                    .map(docSnap => ({
                        id: docSnap.id,
                        ...docSnap.data(),
                        valuationDate: docSnap.data().valuationDate?.toDate ? docSnap.data().valuationDate.toDate() : (docSnap.data().valuationDate ? new Date(docSnap.data().valuationDate) : null),
                        updatedDate: docSnap.data().updatedDate?.toDate ? docSnap.data().updatedDate.toDate() : (docSnap.data().updatedDate ? new Date(docSnap.data().updatedDate) : null),
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
            console.error('Error loading active valuation for stakeholders:', error)
            setActiveValuation(null)
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
                .map(docSnap => ({
                    id: docSnap.id,
                    ...docSnap.data(),
                }))
                .filter(plan => plan.companyId === selectedCompanyId)
            setPlans(plansData)
        } catch (error) {
            console.error('Error loading plans for stakeholders overview:', error)
            setPlans([])
        } finally {
            setLoadingPlans(false)
        }
    }

    // Helper function to calculate stakeholder status based on awards
    const calculateStakeholderStatus = (stakeholder) => {
        // Check if terminated (could be based on employment status or a separate field)
        if (stakeholder.employmentStatus === 'Terminated' || stakeholder.status === 'Terminated') {
            return 'Terminated'
        }

        const profitAwards = stakeholder.profitAwards || []
        
        // If no awards at all, consider them as Pending (waiting for awards)
        if (profitAwards.length === 0) {
            return 'Pending'
        }

        // Normalize status for comparison (case-insensitive)
        const normalizeStatus = (status) => {
            if (!status) return ''
            return String(status).toLowerCase().trim()
        }

        // Check if has any Finalized awards (case-insensitive)
        const hasFinalized = profitAwards.some(award => {
            const status = normalizeStatus(award.status)
            return status === 'finalized'
        })
        
        if (hasFinalized) {
            return 'Active'
        }

        // Check if has Draft awards (case-insensitive)
        const hasDraft = profitAwards.some(award => {
            const status = normalizeStatus(award.status)
            return status === 'draft' || status === 'pending'
        })
        
        if (hasDraft) {
            // If all awards are Draft, return Draft
            const allDraft = profitAwards.every(award => {
                const status = normalizeStatus(award.status)
                return status === 'draft' || status === 'pending'
            })
            return allDraft ? 'Draft' : 'Pending'
        }

        return 'Pending'
    }

    // Helper function to get unique plan names from awards
    const getStakeholderPlans = (stakeholder) => {
        const profitAwards = stakeholder.profitAwards || []
        const planNames = profitAwards
            .map(award => award.planName)
            .filter((name, index, self) => name && self.indexOf(name) === index) // Get unique names
        
        return planNames
    }

    // Calculate status for all stakeholders
    const stakeholdersWithStatus = stakeholders.map(stakeholder => ({
        ...stakeholder,
        calculatedStatus: calculateStakeholderStatus(stakeholder),
        planNames: getStakeholderPlans(stakeholder)
    }))

    const filterTabs = [
        { key: 'all', label: 'All', count: stakeholdersWithStatus.length },
        { key: 'active', label: 'Active', count: stakeholdersWithStatus.filter(s => s.calculatedStatus === 'Active').length },
        { key: 'pending', label: 'Pending', count: stakeholdersWithStatus.filter(s => s.calculatedStatus === 'Pending').length },
        { key: 'draft', label: 'Draft', count: stakeholdersWithStatus.filter(s => s.calculatedStatus === 'Draft').length },
        { key: 'terminated', label: 'Terminated', count: stakeholdersWithStatus.filter(s => s.calculatedStatus === 'Terminated').length },
    ]

    const filteredStakeholders = stakeholdersWithStatus.filter(stakeholder => {
        // Case-insensitive comparison for filter
        const matchesFilter = activeFilter === 'all' || 
            stakeholder.calculatedStatus?.toLowerCase() === activeFilter.toLowerCase()
        const matchesSearch = !searchQuery || 
            stakeholder.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            stakeholder.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            stakeholder.email.toLowerCase().includes(searchQuery.toLowerCase())
        
        return matchesFilter && matchesSearch
    })

    const handleAddStakeholder = async (stakeholderData) => {
        if (!selectedCompanyId) {
            toast.push(
                React.createElement(
                    Notification,
                    { type: "warning", duration: 2000, title: "Validation" },
                    "Please select a company in Settings first"
                )
            )
            return false
        }
        
        try {
            const stakeholderPayload = {
                companyId: selectedCompanyId,
                name: stakeholderData.fullName,
                linkedUserId: stakeholderData.linkedUserId || null,
                title: stakeholderData.title,
                email: stakeholderData.email,
                phone: stakeholderData.phone ? `+1${stakeholderData.phone}` : '',
                employmentStatus: stakeholderData.employmentStatus,
                payType: stakeholderData.payType,
                payAmount: stakeholderData.payAmount || 0,
                mareStock: null,
                marePlans: [],
                status: null,
            }

            const response = await FirebaseDbService.stakeholders.create(stakeholderPayload)
            if (response.success) {
                toast.push(
                    React.createElement(
                        Notification,
                        { type: "success", duration: 2000, title: "Success" },
                        "Stakeholder added successfully"
                    )
                )
                // Reload stakeholders from Firebase
                await loadStakeholders()
                window.dispatchEvent(new Event('stakeholdersUpdated'))
                setShowAddModal(false)
                return true
            } else {
                toast.push(
                    React.createElement(
                        Notification,
                        { type: "danger", duration: 2000, title: "Error" },
                        `Failed to add stakeholder: ${response.error}`
                    )
                )
                return false
            }
        } catch (error) {
            console.error('Error adding stakeholder:', error)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "danger", duration: 2000, title: "Error" },
                    "Failed to add stakeholder"
                )
            )
            return false
        }
    }

    const handleSaveAndAddAnother = async (stakeholderData) => {
        if (!selectedCompanyId) {
            toast.push(
                React.createElement(
                    Notification,
                    { type: "warning", duration: 2000, title: "Validation" },
                    "Please select a company in Settings first"
                )
            )
            return false
        }
        
        try {
            const stakeholderPayload = {
                companyId: selectedCompanyId,
                name: stakeholderData.fullName,
                linkedUserId: stakeholderData.linkedUserId || null,
                title: stakeholderData.title,
                email: stakeholderData.email,
                phone: stakeholderData.phone ? `+1${stakeholderData.phone}` : '',
                employmentStatus: stakeholderData.employmentStatus,
                payType: stakeholderData.payType,
                payAmount: stakeholderData.payAmount || 0,
                mareStock: null,
                marePlans: [],
                status: null,
            }

            const response = await FirebaseDbService.stakeholders.create(stakeholderPayload)
            if (response.success) {
                toast.push(
                    React.createElement(
                        Notification,
                        { type: "success", duration: 2000, title: "Success" },
                        "Stakeholder added successfully"
                    )
                )
                // Reload stakeholders from Firebase
                await loadStakeholders()
                window.dispatchEvent(new Event('stakeholdersUpdated'))
                // Keep modal open (it will reset form automatically)
                return true
            } else {
                toast.push(
                    React.createElement(
                        Notification,
                        { type: "danger", duration: 2000, title: "Error" },
                        `Failed to add stakeholder: ${response.error}`
                    )
                )
                return false
            }
        } catch (error) {
            console.error('Error adding stakeholder:', error)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "danger", duration: 2000, title: "Error" },
                    "Failed to add stakeholder"
                )
            )
            return false
        }
    }

    const handleDeleteStakeholder = async (id) => {
        if (!window.confirm('Are you sure you want to delete this stakeholder?')) {
            return
        }

        try {
            const response = await FirebaseDbService.stakeholders.delete(id)
            if (response.success) {
                toast.push(
                    React.createElement(
                        Notification,
                        { type: "success", duration: 2000, title: "Success" },
                        "Stakeholder deleted successfully"
                    )
                )
                // Reload stakeholders from Firebase
                await loadStakeholders()
                window.dispatchEvent(new Event('stakeholdersUpdated'))
            } else {
                toast.push(
                    React.createElement(
                        Notification,
                        { type: "danger", duration: 2000, title: "Error" },
                        `Failed to delete stakeholder: ${response.error}`
                    )
                )
            }
        } catch (error) {
            console.error('Error deleting stakeholder:', error)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "danger", duration: 2000, title: "Error" },
                    "Failed to delete stakeholder"
                )
            )
        }
    }

    const handleSelectAll = (checked) => {
        if (checked) {
            setSelectedStakeholders(filteredStakeholders.map(s => s.id))
        } else {
            setSelectedStakeholders([])
        }
    }

    const handleSelectStakeholder = (id, checked) => {
        if (checked) {
            setSelectedStakeholders([...selectedStakeholders, id])
        } else {
            setSelectedStakeholders(selectedStakeholders.filter(sid => sid !== id))
        }
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Stakeholders</h2>
                {isAdmin && (
                    <Button
                        variant="solid"
                        onClick={() => setShowAddModal(true)}
                    >
                        Add Stakeholders
                    </Button>
                )}
            </div>

            {/* Summary Metrics */}
            <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Company Valuation Card */}
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

                    {/* Estimated Upcoming Payment Card */}
                    <Card className="p-6">
                        <div className="space-y-2">
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Estimated Upcoming Payment</div>
                            <div className="text-lg font-semibold text-gray-900 dark:text-white">No upcoming payments scheduled.</div>
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

            {/* Stakeholders Section */}
            <div className="space-y-6">

                {/* Filter Tabs and Search */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
                        {filterTabs.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveFilter(tab.key)}
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                    activeFilter === tab.key
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                            >
                                {tab.label} ({tab.count})
                            </button>
                        ))}
                    </div>
                    <div className="relative flex-1 max-w-xs">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                            <HiOutlineSearch className="w-5 h-5" />
                        </span>
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search stakeholders..."
                            className="pl-10"
                        />
                    </div>
                </div>

                {/* Stakeholders Table */}
                <Card className="p-0">
                    <Table>
                        <Table.THead>
                            <Table.Tr>
                                <Table.Th>
                                    <Checkbox
                                        checked={selectedStakeholders.length === filteredStakeholders.length && filteredStakeholders.length > 0}
                                        indeterminate={selectedStakeholders.length > 0 && selectedStakeholders.length < filteredStakeholders.length}
                                        onChange={(_, e) => handleSelectAll(e.target.checked)}
                                    />
                                </Table.Th>
                                <Table.Th>Stakeholders</Table.Th>
                                <Table.Th>Plans</Table.Th>
                                <Table.Th>Status</Table.Th>
                                <Table.Th>Actions</Table.Th>
                            </Table.Tr>
                        </Table.THead>
                        <Table.TBody>
                            {loading ? (
                                <Table.Tr>
                                    <Table.Td colSpan={6} className="text-center py-12">
                                        <div className="text-gray-400 dark:text-gray-500">Loading stakeholders...</div>
                                    </Table.Td>
                                </Table.Tr>
                            ) : filteredStakeholders.length === 0 ? (
                                <Table.Tr>
                                    <Table.Td colSpan={6} className="text-center py-12">
                                        <div className="text-gray-400 dark:text-gray-500">No stakeholders found</div>
                                    </Table.Td>
                                </Table.Tr>
                            ) : (
                                filteredStakeholders.map((stakeholder) => (
                                    <Table.Tr key={stakeholder.id}>
                                        <Table.Td>
                                            <Checkbox
                                                checked={selectedStakeholders.includes(stakeholder.id)}
                                                onChange={(_, e) => handleSelectStakeholder(stakeholder.id, e.target.checked)}
                                            />
                                        </Table.Td>
                                        <Table.Td>
                                            <div className="flex items-center gap-3">
                                                <Avatar
                                                    size={40}
                                                    className="flex-shrink-0"
                                                    icon={<span className="text-sm font-semibold">{getInitials(stakeholder.name)}</span>}
                                                />
                                                <div>
                                                    <div className="font-medium text-gray-900 dark:text-white">{stakeholder.name}</div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">{stakeholder.title}</div>
                                                </div>
                                            </div>
                                        </Table.Td>
                                        <Table.Td>
                                            {stakeholder.planNames && stakeholder.planNames.length > 0 ? (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {stakeholder.planNames.map((planName, idx) => (
                                                        <Tag
                                                            key={idx}
                                                            className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                                        >
                                                            {planName}
                                                        </Tag>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                                            )}
                                        </Table.Td>
                                        <Table.Td>
                                            {stakeholder.calculatedStatus ? (
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${
                                                        stakeholder.calculatedStatus === 'Active' ? 'bg-green-500' :
                                                        stakeholder.calculatedStatus === 'Pending' ? 'bg-yellow-500' :
                                                        stakeholder.calculatedStatus === 'Draft' ? 'bg-gray-500' :
                                                        stakeholder.calculatedStatus === 'Terminated' ? 'bg-red-500' :
                                                        'bg-gray-400'
                                                    }`}></div>
                                                    <span className="text-sm text-gray-900 dark:text-white">{stakeholder.calculatedStatus}</span>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                                            )}
                                        </Table.Td>
                                        <Table.Td>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="plain"
                                                    size="sm"
                                                    icon={<HiOutlinePencil />}
                                                    onClick={() => navigate(`/profit-sharing/stakeholders/${stakeholder.id}`)}
                                                    className="text-gray-400 hover:text-primary"
                                                />
                                                {isAdmin && (
                                                    <Button
                                                        variant="plain"
                                                        size="sm"
                                                        icon={<HiOutlineTrash />}
                                                        onClick={() => handleDeleteStakeholder(stakeholder.id)}
                                                        className="text-gray-400 hover:text-red-500"
                                                    />
                                                )}
                                            </div>
                                        </Table.Td>
                                    </Table.Tr>
                                ))
                            )}
                        </Table.TBody>
                    </Table>
                </Card>

                {/* Pagination */}
                {filteredStakeholders.length > 0 && (
                    <div className="flex items-center justify-end text-sm text-gray-500 dark:text-gray-400">
                        Page 1 of 1
                    </div>
                )}
            </div>

            {/* Add Stakeholder Modal */}
            <AddStakeholderModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSave={handleAddStakeholder}
                onSaveAndAddAnother={handleSaveAndAddAnother}
            />
        </div>
    )
}

export default StakeholdersTab
