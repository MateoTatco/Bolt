import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router'
import { Card, Button, Input, Select, DatePicker, Tag, Avatar, Alert } from '@/components/ui'
import { RichTextEditor } from '@/components/shared'
import { useCrmStore } from '@/store/crmStore'
import { HiOutlineArrowLeft, HiOutlineUser, HiOutlineCalendar, HiOutlineClipboardList, HiOutlinePaperClip, HiOutlineClock, HiOutlineCog } from 'react-icons/hi'
import { APP_NAME } from '@/constants/app.constant'

const ClientDetail = () => {
    const { clientId } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const { clients, loadClients, deleteClient } = useCrmStore()
    const loading = useCrmStore((s) => s.loading)
    
    const [activeTab, setActiveTab] = useState('overview')
    const [isEditing, setIsEditing] = useState(false)
    const [editedContent, setEditedContent] = useState('')
    const [showAlert, setShowAlert] = useState(false)
    const [originalContent, setOriginalContent] = useState('')
    const [filters, setFilters] = useState({
        dateFrom: null,
        dateTo: null,
        status: null
    })

    const client = clients.find(c => c.id === parseInt(clientId))

    // Load clients if not available (for new tab scenarios)
    useEffect(() => {
        if (clients.length === 0 && !loading) {
            loadClients()
        }
    }, [clients.length, loading, loadClients])

    // Handle tab query parameter
    useEffect(() => {
        const urlParams = new URLSearchParams(location.search)
        const tabParam = urlParams.get('tab')
        if (tabParam && ['overview', 'settings', 'activities', 'files'].includes(tabParam)) {
            setActiveTab(tabParam)
        }
    }, [location.search])

    useEffect(() => {
        if (!client && !loading && clients.length > 0) {
            navigate('/home')
        }
    }, [client, loading, clients.length, navigate])

    useEffect(() => {
        if (client) {
            const defaultContent = `
<h3>Company Overview</h3>
<p>${client.clientName} is a ${client.clientType || 'business'} client with significant potential for growth and collaboration.</p>

<h3>Business Goals</h3>
<ul>
<li>Strengthen client relationship and satisfaction</li>
<li>Expand service offerings and capabilities</li>
<li>Increase project portfolio and revenue</li>
<li>Build long-term strategic partnership</li>
</ul>

<h3>Key Metrics</h3>
<p><strong>${client.clientNumber}</strong> - Client ID</p>
<p><strong>${client.clientType || 'N/A'}</strong> - Business Type</p>

<h3>Next Steps</h3>
<ul>
<li>Schedule quarterly business review</li>
<li>Assess service expansion opportunities</li>
<li>Plan strategic initiatives</li>
</ul>
            `
            const content = client.notes || defaultContent
            setEditedContent(content)
            setOriginalContent(content)
        }
    }, [client])

    const handleEditClient = () => {
        setIsEditing(true)
        setActiveTab('settings')
    }

    const handleSaveChanges = () => {
        // Here you would typically update the client data in your store
        // For now, we'll just show a success message
        setShowAlert(true)
        // TODO: Implement actual save functionality to update the client data
        // The content will automatically update in the overview section since it uses editedContent
    }

    const handleCancelEdit = () => {
        setIsEditing(false)
        setEditedContent(originalContent)
    }

    const handleDelete = async () => {
        if (window.confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
            try {
                await deleteClient(client.id)
                navigate('/home')
            } catch (error) {
                console.error('Error deleting client:', error)
            }
        }
    }

    // Show loading state while clients are being loaded
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="text-lg font-semibold text-gray-500">Loading client...</div>
                </div>
            </div>
        )
    }

    if (!client) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="text-lg font-semibold text-gray-500">Client not found</div>
                    <Button onClick={() => navigate('/home')} className="mt-4">
                        Back to CRM
                    </Button>
                </div>
            </div>
        )
    }

    const getInitials = (name) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase()
    }

    const getAvatarColor = (name) => {
        const colors = [
            'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-100',
            'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-100',
            'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-100',
            'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-100',
            'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-100',
            'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-100'
        ]
        const index = name.length % colors.length
        return colors[index]
    }

    const sidebarItems = [
        { key: 'overview', label: 'Overview', icon: <HiOutlineUser /> },
        { key: 'tasks', label: 'Tasks', icon: <HiOutlineClipboardList /> },
        { key: 'attachments', label: 'Attachments', icon: <HiOutlinePaperClip /> },
        { key: 'activities', label: 'Activities', icon: <HiOutlineClock /> },
        { key: 'settings', label: 'Settings', icon: <HiOutlineCog /> },
    ]

    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Left Sidebar */}
            <div className="w-64 bg-white dark:bg-gray-800 shadow-sm border-r border-gray-200 dark:border-gray-700">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <Button 
                        variant="plain" 
                        icon={<HiOutlineArrowLeft />} 
                        onClick={() => navigate('/home')}
                        className="mb-4"
                    >
                        Back to CRM
                    </Button>
                    <div className="flex items-center space-x-3">
                        <Avatar 
                            className={getAvatarColor(client.clientName)}
                            size="lg"
                        >
                            {getInitials(client.clientName)}
                        </Avatar>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {client.clientName}
                            </h2>
                            <p className="text-sm text-gray-500">Client #{client.clientNumber}</p>
                        </div>
                    </div>
                </div>

                <div className="p-2 space-y-1">
                    {sidebarItems.map((item) => (
                        <button
                            key={item.key}
                            onClick={() => setActiveTab(item.key)}
                            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                                activeTab === item.key 
                                    ? 'bg-primary text-white' 
                                    : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-screen">
                {/* Header */}
                <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                {client.clientName}
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400">
                                {client.clientNumber} • {client.clientType || 'Business'}
                            </p>
                        </div>
                        <div className="flex items-center space-x-3">
                            <Tag className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-100">
                                {client.clientType || 'Client'}
                            </Tag>
                            <Button variant="solid" onClick={handleEditClient}>Edit Client</Button>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-6">
                    {showAlert && (
                        <Alert
                            type="success"
                            showIcon
                            closable
                            onClose={() => setShowAlert(false)}
                            className="mb-4"
                        >
                            Changes saved successfully!
                        </Alert>
                    )}
                    
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Client Overview */}
                            <div className="lg:col-span-2">
                                <Card className="p-6">
                                    <h3 className="text-lg font-semibold mb-4">Client Overview</h3>
                                    <div className="space-y-4">
                                        <div 
                                            key={editedContent} // Force re-render when content changes
                                            className="prose prose-sm max-w-none dark:prose-invert"
                                            dangerouslySetInnerHTML={{ 
                                                __html: editedContent || '<p>No description provided for this client.</p>' 
                                            }}
                                        />
                                    </div>
                                </Card>
                            </div>

                            {/* Client Information & Schedule */}
                            <div className="space-y-4">
                                {/* Client Information */}
                                <Card className="p-4">
                                    <h3 className="text-lg font-semibold mb-3">Client Information</h3>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        <div>
                                            <label className="text-sm font-medium text-gray-500">Company</label>
                                            <p className="text-gray-900 dark:text-white text-sm">{client.clientName}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-500">Client Number</label>
                                            <p className="text-gray-900 dark:text-white text-sm">{client.clientNumber}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-500">Type</label>
                                            <p className="text-gray-900 dark:text-white text-sm">{client.clientType || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-500">Address</label>
                                            <p className="text-gray-900 dark:text-white text-sm">{client.address || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-500">City</label>
                                            <p className="text-gray-900 dark:text-white text-sm">{client.city || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-500">State</label>
                                            <p className="text-gray-900 dark:text-white text-sm">{client.state || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-500">ZIP</label>
                                            <p className="text-gray-900 dark:text-white text-sm">{client.zip || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-500">Tags</label>
                                            <p className="text-gray-900 dark:text-white text-sm">{client.tags || 'N/A'}</p>
                                        </div>
                                    </div>
                                </Card>

                                {/* Schedule */}
                                <Card className="p-4">
                                    <h3 className="text-lg font-semibold mb-3">Schedule</h3>
                                    <div className="space-y-3 max-h-64 overflow-y-auto">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Date Range
                                            </label>
                                            <DatePicker.DatePickerRange
                                                placeholder={['From', 'To']}
                                                value={filters.dateFrom && filters.dateTo ? [filters.dateFrom, filters.dateTo] : null}
                                                onChange={(vals) => {
                                                    const [from, to] = vals || []
                                                    setFilters({ ...filters, dateFrom: from, dateTo: to })
                                                }}
                                            />
                                        </div>
                                        
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Status Filter
                                            </label>
                                            <Select
                                                placeholder="All Statuses"
                                                isClearable
                                                options={[
                                                    { value: 'active', label: 'Active' },
                                                    { value: 'inactive', label: 'Inactive' },
                                                    { value: 'prospect', label: 'Prospect' }
                                                ]}
                                                value={filters.status}
                                                onChange={(opt) => setFilters({ ...filters, status: opt })}
                                            />
                                        </div>

                                        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                                            <h4 className="font-medium text-gray-900 dark:text-white mb-2 text-sm">Upcoming Events</h4>
                                            <div className="space-y-2">
                                                <div className="flex items-center space-x-2">
                                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-900 dark:text-white">Client Review</p>
                                                        <p className="text-xs text-gray-500">Tomorrow, 2:00 PM</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-900 dark:text-white">Contract Renewal</p>
                                                        <p className="text-xs text-gray-500">Friday, 10:00 AM</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-900 dark:text-white">Strategy Meeting</p>
                                                        <p className="text-xs text-gray-500">Next Monday, 3:00 PM</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}

                    {activeTab === 'tasks' && (
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold mb-4">Tasks</h3>
                            <p className="text-gray-600 dark:text-gray-400">Task management will be implemented here.</p>
                        </Card>
                    )}

                    {activeTab === 'attachments' && (
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold mb-4">Attachments</h3>
                            <p className="text-gray-600 dark:text-gray-400">File attachments will be managed here.</p>
                        </Card>
                    )}

                    {activeTab === 'activities' && (
                        <Card className="p-6">
                            <h3 className="text-lg font-semibold mb-4">Activities</h3>
                            <p className="text-gray-600 dark:text-gray-400">Activity timeline will be displayed here.</p>
                        </Card>
                    )}

                    {activeTab === 'settings' && (
                        <Card className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold">Settings</h3>
                                <div className="flex items-center space-x-2">
                                    <Button 
                                        variant="plain" 
                                        onClick={handleCancelEdit}
                                    >
                                        Cancel
                                    </Button>
                                    <Button 
                                        variant="solid" 
                                        onClick={handleSaveChanges}
                                    >
                                        Save Changes
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                                        Client Overview
                                    </h4>
                                    <RichTextEditor
                                        content={editedContent}
                                        onChange={(content) => {
                                            if (typeof content === 'string') {
                                                setEditedContent(content)
                                            } else if (content && content.html) {
                                                setEditedContent(content.html)
                                            }
                                        }}
                                        editorContentClass="min-h-[300px]"
                                    />
                                </div>
                                
                                <div>
                                    <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                                        Client Information
                                    </h4>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        Additional client settings and preferences will be managed here.
                                    </p>
                                </div>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}

export default ClientDetail
