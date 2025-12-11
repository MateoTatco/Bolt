import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Card, Button, Table, Tag } from '@/components/ui'
import { HiOutlineArrowLeft, HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineInformationCircle } from 'react-icons/hi'
import { useSessionUser } from '@/store/authStore'

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
    const [activeTab, setActiveTab] = useState('stock')
    const [stakeholder, setStakeholder] = useState(null)

    useEffect(() => {
        // In real app, fetch from Firebase/API
        const data = mockStakeholderData[stakeholderId]
        if (data) {
            setStakeholder(data)
        } else {
            // Redirect if not found
            navigate('/profit-sharing?tab=stakeholders')
        }
    }, [stakeholderId, navigate])

    if (!stakeholder) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-500">Loading...</div>
            </div>
        )
    }

    const tabs = [
        { key: 'stock', label: 'Stock Awards' },
        { key: 'profit', label: 'Profit Awards' },
        { key: 'details', label: 'Details' },
    ]

    const stockPercentage = stakeholder.totalStockUnits > 0 ? 100 : 0

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/profit-sharing?tab=stakeholders')}
                        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors flex items-center gap-2"
                    >
                        <HiOutlineArrowLeft className="w-4 h-4" />
                        <span className="text-sm">Back to stakeholders</span>
                    </button>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{stakeholder.name}</h2>
                </div>
                <Button
                    variant="solid"
                    icon={<HiOutlinePlus />}
                >
                    New Award
                </Button>
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

            {/* Content based on active tab */}
            {activeTab === 'stock' && (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Total Stock Card */}
                        <Card className="p-6">
                            <div className="space-y-4">
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Stock</div>
                                <div className="flex items-center justify-center">
                                    <div className="relative w-24 h-24">
                                        <svg className="transform -rotate-90 w-24 h-24">
                                            <circle
                                                cx="48"
                                                cy="48"
                                                r="44"
                                                stroke="currentColor"
                                                strokeWidth="8"
                                                fill="none"
                                                className="text-gray-200 dark:text-gray-700"
                                            />
                                            <circle
                                                cx="48"
                                                cy="48"
                                                r="44"
                                                stroke="currentColor"
                                                strokeWidth="8"
                                                fill="none"
                                                strokeDasharray={`${2 * Math.PI * 44}`}
                                                strokeDashoffset={`${2 * Math.PI * 44 * (1 - stockPercentage / 100)}`}
                                                className="text-green-500"
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-lg font-bold text-green-500">{stockPercentage}%</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(stakeholder.totalStockUnits)}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Stock Units</div>
                                </div>
                            </div>
                        </Card>

                        {/* Estimated Fair Market Value Card */}
                        <Card className="p-6">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Estimated Fair Market Value</div>
                                    <HiOutlineInformationCircle className="w-4 h-4 text-gray-400" />
                                </div>
                                <div className="text-3xl font-bold text-gray-900 dark:text-white">{formatCurrency(stakeholder.estimatedFMV)}</div>
                            </div>
                        </Card>

                        {/* Total Awards Card */}
                        <Card className="p-6">
                            <div className="space-y-2">
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Awards</div>
                                <div className="text-3xl font-bold text-gray-900 dark:text-white">{stakeholder.totalAwards}</div>
                            </div>
                        </Card>
                    </div>

                    {/* Awards Table */}
                    <Card className="p-0">
                        <Table>
                            <Table.THead>
                                <Table.Tr>
                                    <Table.Th>Award Date</Table.Th>
                                    <Table.Th>Plan Name</Table.Th>
                                    <Table.Th>Award Amount</Table.Th>
                                    <Table.Th>Award Date Price</Table.Th>
                                    <Table.Th>Full FMV</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th>Actions</Table.Th>
                                </Table.Tr>
                            </Table.THead>
                            <Table.TBody>
                                {stakeholder.stockAwards.length === 0 ? (
                                    <Table.Tr>
                                        <Table.Td colSpan={7} className="text-center py-12">
                                            <div className="text-gray-400 dark:text-gray-500">No stock awards found</div>
                                        </Table.Td>
                                    </Table.Tr>
                                ) : (
                                    stakeholder.stockAwards.map((award) => (
                                        <Table.Tr key={award.id}>
                                            <Table.Td>
                                                <span className="text-sm text-gray-900 dark:text-white">{award.awardDate}</span>
                                            </Table.Td>
                                            <Table.Td>
                                                <span className="text-sm text-gray-900 dark:text-white">{award.planName}</span>
                                            </Table.Td>
                                            <Table.Td>
                                                <span className="text-sm text-gray-900 dark:text-white">
                                                    {formatNumber(award.awardAmount)} Stock Units
                                                </span>
                                            </Table.Td>
                                            <Table.Td>
                                                <span className="text-sm text-gray-900 dark:text-white">
                                                    {award.awardDatePrice ? formatCurrency(award.awardDatePrice) : 'N/A'}
                                                </span>
                                            </Table.Td>
                                            <Table.Td>
                                                <span className="text-sm text-gray-900 dark:text-white">{formatCurrency(award.fullFMV)}</span>
                                            </Table.Td>
                                            <Table.Td>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                    <span className="text-sm text-gray-900 dark:text-white">{award.status}</span>
                                                </div>
                                            </Table.Td>
                                            <Table.Td>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="plain"
                                                        size="sm"
                                                        icon={<HiOutlinePencil />}
                                                        className="text-gray-400 hover:text-primary"
                                                    />
                                                    <Button
                                                        variant="plain"
                                                        size="sm"
                                                        icon={<HiOutlineTrash />}
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
                    {stakeholder.stockAwards.length > 0 && (
                        <div className="flex items-center justify-end text-sm text-gray-500 dark:text-gray-400">
                            Page 1 of 1
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'profit' && (
                <div className="space-y-6">
                    <Card className="p-0">
                        <Table>
                            <Table.THead>
                                <Table.Tr>
                                    <Table.Th>Award Date</Table.Th>
                                    <Table.Th>Plan Name</Table.Th>
                                    <Table.Th>Award Amount</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th>Actions</Table.Th>
                                </Table.Tr>
                            </Table.THead>
                            <Table.TBody>
                                <Table.Tr>
                                    <Table.Td colSpan={5} className="text-center py-12">
                                        <div className="text-gray-400 dark:text-gray-500">No profit awards found</div>
                                    </Table.Td>
                                </Table.Tr>
                            </Table.TBody>
                        </Table>
                    </Card>
                </div>
            )}

            {activeTab === 'details' && (
                <div className="space-y-6">
                    <Card className="p-6">
                        <div className="space-y-4">
                            <div>
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Full Name</div>
                                <div className="text-base text-gray-900 dark:text-white">{stakeholder.name}</div>
                            </div>
                            <div>
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Title</div>
                                <div className="text-base text-gray-900 dark:text-white">{stakeholder.title}</div>
                            </div>
                            <div>
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Email</div>
                                <div className="text-base text-gray-900 dark:text-white">{stakeholder.email}</div>
                            </div>
                            <div>
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Phone</div>
                                <div className="text-base text-gray-900 dark:text-white">{stakeholder.phone}</div>
                            </div>
                            <div>
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Employment Status</div>
                                <div className="text-base text-gray-900 dark:text-white">{stakeholder.employmentStatus}</div>
                            </div>
                            <div>
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Pay Type</div>
                                <div className="text-base text-gray-900 dark:text-white">{stakeholder.payType}</div>
                            </div>
                            <div>
                                <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Pay Amount</div>
                                <div className="text-base text-gray-900 dark:text-white">
                                    {stakeholder.payType === 'Salary' 
                                        ? formatCurrency(stakeholder.payAmount)
                                        : `$${formatNumber(stakeholder.payAmount)}/hour`
                                    }
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    )
}

export default StakeholderDetail

