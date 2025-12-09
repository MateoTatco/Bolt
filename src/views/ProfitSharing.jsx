import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { Button, Card } from '@/components/ui'
import { HiOutlineArrowLeft, HiOutlineHome, HiOutlineDocumentText, HiOutlineUsers, HiOutlineChartBar, HiOutlineFlag, HiOutlineCog } from 'react-icons/hi'
import { useSessionUser } from '@/store/authStore'
import OverviewTab from './ProfitSharing/OverviewTab'
import PlansTab from './ProfitSharing/PlansTab'
import StakeholdersTab from './ProfitSharing/StakeholdersTab'
import ValuationsTab from './ProfitSharing/ValuationsTab'
import MilestonesTab from './ProfitSharing/MilestonesTab'
import SettingsTab from './ProfitSharing/SettingsTab'

// Authorized emails that can access Profit Sharing
const AUTHORIZED_EMAILS = [
    'admin-01@tatco.construction',
    'brett@tatco.construction'
]

const ProfitSharing = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const user = useSessionUser((state) => state.user)

    // Initialize tab from URL params or default to 'overview'
    const getInitialTab = () => {
        const params = new URLSearchParams(location.search)
        const tab = params.get('tab')
        if (tab && ['overview', 'plans', 'stakeholders', 'valuations', 'milestones', 'settings'].includes(tab)) {
            return tab
        }
        return 'overview'
    }

    const [activeTab, setActiveTab] = useState(getInitialTab)

    // Check authorization on mount
    useEffect(() => {
        const userEmail = user?.email?.toLowerCase() || ''
        const isAuthorized = AUTHORIZED_EMAILS.some(email => email.toLowerCase() === userEmail)
        
        if (!isAuthorized) {
            // Redirect unauthorized users to home page
            navigate('/home', { replace: true })
        }
    }, [user, navigate])

    // Handle tab from URL query params (only update if different)
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const tab = params.get('tab')
        if (tab && ['overview', 'plans', 'stakeholders', 'valuations', 'milestones', 'settings'].includes(tab)) {
            if (tab !== activeTab) {
                setActiveTab(tab)
            }
        } else if (!tab && activeTab !== 'overview') {
            // If no tab in URL, default to overview
            setActiveTab('overview')
        }
    }, [location.search, activeTab])

    // Update URL when tab changes
    const handleTabChange = (tab) => {
        if (tab !== activeTab) {
            setActiveTab(tab)
            navigate(`/profit-sharing?tab=${tab}`, { replace: true })
        }
    }

    // Don't render anything if unauthorized (will redirect)
    const userEmail = user?.email?.toLowerCase() || ''
    const isAuthorized = AUTHORIZED_EMAILS.some(email => email.toLowerCase() === userEmail)
    
    if (!isAuthorized) {
        return null
    }

    const sidebarItems = [
        { key: 'overview', label: 'Overview', icon: <HiOutlineHome /> },
        { key: 'plans', label: 'Plans', icon: <HiOutlineDocumentText /> },
        { key: 'stakeholders', label: 'Stakeholders', icon: <HiOutlineUsers /> },
        { key: 'valuations', label: 'Valuations', icon: <HiOutlineChartBar /> },
        { key: 'milestones', label: 'Milestones', icon: <HiOutlineFlag /> },
        { key: 'settings', label: 'Settings', icon: <HiOutlineCog /> },
    ]

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
                            onClick={() => handleTabChange(item.key)}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-300 group ${
                                activeTab === item.key 
                                    ? 'bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg transform scale-[1.02]' 
                                    : 'text-gray-600 hover:bg-white/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700/80 dark:hover:text-gray-100 hover:shadow-md hover:transform hover:scale-[1.01]'
                            }`}
                        >
                            <span className={`transition-transform duration-200 ${activeTab === item.key ? 'scale-110' : 'group-hover:scale-105'}`}>{item.icon}</span>
                            <span className="font-medium tracking-wide">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
                {/* Mobile Tab Navigation - Only visible on mobile */}
                <div className="lg:hidden sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex overflow-x-auto scrollbar-hide px-2 py-2">
                        {sidebarItems.map((item) => (
                            <button
                                key={item.key}
                                onClick={() => handleTabChange(item.key)}
                                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                                    activeTab === item.key
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

                {/* Header - Only show on Overview tab */}
                {activeTab === 'overview' && (
                    <div className="bg-gradient-to-r from-white via-gray-50/30 to-white dark:from-gray-900 dark:via-gray-800/30 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700/50">
                        <div className="px-4 lg:px-8 py-6 lg:py-8">
                            <div className="lg:hidden mb-6">
                                <Button 
                                    variant="plain" 
                                    icon={<HiOutlineArrowLeft />} 
                                    onClick={() => navigate('/home')}
                                    className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors duration-200"
                                >
                                    Back to Home
                                </Button>
                            </div>

                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-6 lg:space-y-0">
                                <div>
                                    <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">Profit Sharing</h1>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab Content */}
                <div className="flex-1 px-4 lg:px-8 py-8 lg:py-12">
                    {activeTab === 'overview' && <OverviewTab />}
                    {activeTab === 'plans' && <PlansTab />}
                    {activeTab === 'stakeholders' && <StakeholdersTab />}
                    {activeTab === 'valuations' && <ValuationsTab />}
                    {activeTab === 'milestones' && <MilestonesTab />}
                    {activeTab === 'settings' && <SettingsTab />}
                </div>
            </div>
        </div>
    )
}

export default ProfitSharing

