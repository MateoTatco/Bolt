import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import React from 'react'
import { Card, Button, Table, Input, Tag, Avatar, Checkbox, Notification, toast } from '@/components/ui'
import { HiOutlinePlus, HiOutlineSearch, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi'
import AddStakeholderModal from './components/AddStakeholderModal'
import { FirebaseDbService } from '@/services/FirebaseDbService'

// Mock data
const mockData = {
    companyValuation: 1941000,
    outstandingAwards: 397905,
    stockPool: 10000,
    usedStockUnits: 2050,
}

const mockStakeholders = [
    {
        id: 1,
        name: 'Simon Cox',
        title: 'Director of Business Development',
        email: 'simon@tatco.construction',
        phone: '555-0101',
        mareStock: 2000,
        marePlans: ['Profit'],
        status: 'Draft',
        employmentStatus: 'Full time',
        payType: 'Salary',
        payAmount: 120000
    },
    {
        id: 2,
        name: 'Chase Gibson',
        title: 'Controller',
        email: 'chase@tatco.construction',
        phone: '555-0102',
        mareStock: 50,
        marePlans: ['Profit'],
        status: 'Draft',
        employmentStatus: 'Full time',
        payType: 'Salary',
        payAmount: 95000
    },
    {
        id: 3,
        name: 'Jake Bogner',
        title: 'Bogner',
        email: 'jake@tatco.construction',
        phone: '555-0103',
        mareStock: null,
        marePlans: [],
        status: null,
        employmentStatus: 'Full time',
        payType: 'Hourly',
        payAmount: 45
    },
    {
        id: 4,
        name: 'Joe Lassiter',
        title: 'Lassiter',
        email: 'joe@tatco.construction',
        phone: '555-0104',
        mareStock: null,
        marePlans: [],
        status: null,
        employmentStatus: 'Part Time',
        payType: 'Hourly',
        payAmount: 35
    },
    {
        id: 5,
        name: 'Robb Billy',
        title: 'VP of Business Operations',
        email: 'robb@tatco.construction',
        phone: '555-0105',
        mareStock: null,
        marePlans: [],
        status: null,
        employmentStatus: 'Full time',
        payType: 'Salary',
        payAmount: 150000
    },
]

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

const StakeholdersTab = () => {
    const navigate = useNavigate()
    const [showAddModal, setShowAddModal] = useState(false)
    const [activeFilter, setActiveFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [stakeholders, setStakeholders] = useState([])
    const [selectedStakeholders, setSelectedStakeholders] = useState([])
    const [loading, setLoading] = useState(true)

    const { companyValuation, outstandingAwards, stockPool, usedStockUnits } = mockData
    const remainingStockUnits = stockPool - usedStockUnits
    const usedPercentage = (usedStockUnits / stockPool) * 100
    const remainingPercentage = (remainingStockUnits / stockPool) * 100

    // Load stakeholders from Firebase
    useEffect(() => {
        loadStakeholders()
    }, [])

    const loadStakeholders = async () => {
        setLoading(true)
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
                toast.push(
                    React.createElement(
                        Notification,
                        { type: "danger", duration: 2000, title: "Error" },
                        `Failed to load stakeholders: ${response.error}`
                    )
                )
                // Fallback to mock data if Firebase fails
                setStakeholders(mockStakeholders)
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
            // Fallback to mock data
            setStakeholders(mockStakeholders)
        } finally {
            setLoading(false)
        }
    }

    const filterTabs = [
        { key: 'all', label: 'All', count: stakeholders.length },
        { key: 'active', label: 'Active', count: stakeholders.filter(s => s.status === 'Active').length },
        { key: 'pending', label: 'Pending', count: stakeholders.filter(s => s.status === 'Pending').length },
        { key: 'draft', label: 'Draft', count: stakeholders.filter(s => s.status === 'Draft').length },
        { key: 'terminated', label: 'Terminated', count: stakeholders.filter(s => s.status === 'Terminated').length },
    ]

    const filteredStakeholders = stakeholders.filter(stakeholder => {
        const matchesFilter = activeFilter === 'all' || stakeholder.status === activeFilter
        const matchesSearch = !searchQuery || 
            stakeholder.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            stakeholder.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            stakeholder.email.toLowerCase().includes(searchQuery.toLowerCase())
        return matchesFilter && matchesSearch
    })

    const handleAddStakeholder = async (stakeholderData) => {
        try {
            const stakeholderPayload = {
                name: stakeholderData.fullName,
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
        try {
            const stakeholderPayload = {
                name: stakeholderData.fullName,
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
                <Button
                    variant="solid"
                    onClick={() => setShowAddModal(true)}
                >
                    Add Stakeholders
                </Button>
            </div>

            {/* Summary Metrics */}
            <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                            <div className="text-xs text-gray-500 dark:text-gray-400">Stock Units</div>
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
                                Used: {formatNumber(usedStockUnits)} Stock Units
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-200 dark:bg-blue-400/30"></div>
                            <span className="text-gray-600 dark:text-gray-400">
                                Remaining: {formatNumber(remainingStockUnits)} Stock Units
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
                                            {stakeholder.marePlans.length > 0 ? (
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
                                        </Table.Td>
                                        <Table.Td>
                                            {stakeholder.status ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                    <span className="text-sm text-gray-900 dark:text-white">{stakeholder.status}</span>
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
                                                <Button
                                                    variant="plain"
                                                    size="sm"
                                                    icon={<HiOutlineTrash />}
                                                    onClick={() => handleDeleteStakeholder(stakeholder.id)}
                                                    className="text-gray-400 hover:text-red-500"
                                                />
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
