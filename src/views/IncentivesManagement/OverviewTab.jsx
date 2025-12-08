import { Card, Button, Avatar } from '@/components/ui'
import { HiOutlineDocumentText, HiOutlineUsers, HiOutlineLockClosed } from 'react-icons/hi'

// Mock data
const mockData = {
    companyValuation: 1941000,
    outstandingAwards: 397905,
    stockPool: 10000,
    usedStockUnits: 2050,
    estimatedValuation: 1941000,
    totalStakeholders: 5,
    activeStakeholders: 0,
    activities: [
        {
            id: 1,
            type: 'signature',
            name: 'Simon Cox',
            message: 'has an award in draft mode. Please review and send for signature in order to finalize the award.',
            timestamp: 'November 20, 2025 @ 10:44pm',
            status: 'pending'
        },
        {
            id: 2,
            type: 'signature',
            name: 'Simon Cox',
            message: 'has an award in draft mode. Please review and send for signature in order to finalize the award.',
            timestamp: 'November 17, 2025 @ 4:18pm',
            status: 'pending'
        },
        {
            id: 3,
            type: 'signature',
            name: 'Simon Cox',
            message: 'has an award in draft mode. Please review and send for signature in order to finalize the award.',
            timestamp: 'November 17, 2025 @ 4:17pm',
            status: 'pending'
        },
        {
            id: 4,
            type: 'signature',
            name: 'Robb Billy',
            message: 'has an award in draft mode. Please review and send for signature in order to finalize the award.',
            timestamp: 'February 17, 2025 @ 4:13pm',
            status: 'pending'
        },
        {
            id: 5,
            type: 'signature',
            name: 'Robb Billy',
            message: 'has an award in draft mode. Please review and send for signature in order to finalize the award.',
            timestamp: 'February 17, 2025 @ 4:12pm',
            status: 'pending'
        },
    ]
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
    const { companyValuation, outstandingAwards, stockPool, usedStockUnits, estimatedValuation, totalStakeholders, activeStakeholders, activities } = mockData
    const remainingStockUnits = stockPool - usedStockUnits
    const usedPercentage = (usedStockUnits / stockPool) * 100
    const remainingPercentage = (remainingStockUnits / stockPool) * 100

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
                        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                        View stakeholders
                    </Button>
                </div>
                
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
                            className="mt-4"
                        >
                            View stakeholders
                        </Button>
                    </div>
                </Card>
            </div>

            {/* Activity Section */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Activity</h3>
                    <Button 
                        variant="plain" 
                        size="sm"
                        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                        View all
                    </Button>
                </div>
                
                <Card className="p-6">
                    <div className="space-y-4">
                        {activities.map((activity) => (
                            <div 
                                key={activity.id} 
                                className="flex items-start gap-4 pb-4 border-b border-gray-200 dark:border-gray-700 last:border-0 last:pb-0"
                            >
                                <Avatar 
                                    size={40} 
                                    className="flex-shrink-0"
                                    icon={<span className="text-sm font-semibold">{activity.name.charAt(0)}</span>}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                                    Send for signature
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                                <span className="font-medium">{activity.name}</span> {activity.message}
                                            </p>
                                            <div className="text-xs text-gray-500 dark:text-gray-500">
                                                {activity.timestamp}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-3">
                                        <Button 
                                            variant="plain" 
                                            size="sm"
                                            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                                        >
                                            Dismiss
                                        </Button>
                                        <Button 
                                            variant="solid" 
                                            size="sm"
                                        >
                                            View award
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    )
}

export default OverviewTab
