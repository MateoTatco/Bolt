import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router'
import { Card, Button, Input, Select, DatePicker, Tag, Avatar, Alert, Dialog } from '@/components/ui'
import { RichTextEditor } from '@/components/shared'
import { useCrmStore } from '@/store/crmStore'
import TasksManager from '@/components/TasksManager'
import AttachmentsManager from '@/components/Attachments/AttachmentsManager'
import { HiOutlineArrowLeft, HiOutlineUser, HiOutlineCalendar, HiOutlineClipboardList, HiOutlinePaperClip, HiOutlineClock, HiOutlineCog } from 'react-icons/hi'
import { APP_NAME } from '@/constants/app.constant'

const ClientDetail = () => {
    const { clientId } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const { clients, loadClients, deleteClient } = useCrmStore()
    const leads = useCrmStore((s) => s.leads)
    const updateClient = useCrmStore((s) => s.updateClient)
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
    const [isInfoEditing, setIsInfoEditing] = useState(false)
    const [infoForm, setInfoForm] = useState({
        clientName: '',
        clientType: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        tags: ''
    })
    const [showCancelDialog, setShowCancelDialog] = useState(false)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

    const client = clients.find(c => c.id === clientId)

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
<p><strong>${client.id}</strong> - Client ID</p>
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
            setInfoForm({
                clientName: client.clientName || '',
                clientType: client.clientType || '',
                address: client.address || '',
                city: client.city || '',
                state: client.state || '',
                zip: client.zip || '',
                tags: client.tags || ''
            })
        }
    }, [client])

    const handleEditClient = () => {
        setIsEditing(true)
        setActiveTab('settings')
    }

    const handleSaveChanges = async () => {
        try {
            // Persist the HTML content as notes
            await updateClient(client.id, { ...client, notes: editedContent })
            setOriginalContent(editedContent)
            setShowAlert(true)
        } catch (e) {
            console.error('Error saving changes:', e)
        }
    }

    const handleCancelEdit = () => {
        // Check if there are unsaved changes
        const hasContentChanges = editedContent !== originalContent
        const hasInfoChanges = isInfoEditing && JSON.stringify(infoForm) !== JSON.stringify({
            clientName: client.clientName || '',
            clientType: client.clientType || '',
            address: client.address || '',
            city: client.city || '',
            state: client.state || '',
            zip: client.zip || '',
            tags: client.tags || ''
        })
        
        if (hasContentChanges || hasInfoChanges) {
            setShowCancelDialog(true)
        } else {
            // No changes, cancel immediately
            setIsEditing(false)
            setIsInfoEditing(false)
            setActiveTab('overview')
        }
    }

    const handleConfirmCancel = () => {
        setIsEditing(false)
        setIsInfoEditing(false)
        setEditedContent(originalContent)
        setShowCancelDialog(false)
        setActiveTab('overview')
        
        // Show alert after cancellation
        setShowAlert(true)
        setTimeout(() => setShowAlert(false), 3000) // Auto-hide after 3 seconds
    }

    const handleCancelDialogClose = () => {
        setShowCancelDialog(false)
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
        <div className="flex min-h-screen bg-white dark:bg-gray-900">
            {/* Left Sidebar - Seamless */}
            <div className="hidden lg:block w-64 bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-sm">
                <div className="p-6">
                    <Button 
                        variant="plain" 
                        icon={<HiOutlineArrowLeft />} 
                        onClick={() => navigate('/home')}
                        className="mb-8 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors duration-200"
                    >
                        Back to CRM
                    </Button>
                </div>

                <div className="px-4 space-y-1">
                    {sidebarItems.map((item) => (
                        <button
                            key={item.key}
                            onClick={() => setActiveTab(item.key)}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-300 group ${
                                activeTab === item.key 
                                    ? 'bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg transform scale-[1.02]' 
                                    : 'text-gray-600 hover:bg-white/80 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700/80 dark:hover:text-gray-100 hover:shadow-md hover:transform hover:scale-[1.01]'
                            }`}
                        >
                            <span className={`transition-transform duration-200 ${activeTab === item.key ? 'scale-110' : 'group-hover:scale-105'}`}>
                                {item.icon}
                            </span>
                            <span className="font-medium tracking-wide">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-screen">
                {/* Seamless Header */}
                {activeTab !== 'tasks' && activeTab !== 'settings' && (
                    <div className="bg-gradient-to-r from-white via-gray-50/30 to-white dark:from-gray-900 dark:via-gray-800/30 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700/50">
                    <div className="px-4 lg:px-8 py-6 lg:py-8">
                        {/* Mobile Navigation */}
                        <div className="lg:hidden mb-6">
                            <Button 
                                variant="plain" 
                                icon={<HiOutlineArrowLeft />} 
                                onClick={() => navigate('/home')}
                                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors duration-200"
                            >
                                Back to CRM
                            </Button>
                        </div>
                        
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-6 lg:space-y-0">
                            <div className="flex items-center space-x-5">
                                <div className="relative">
                                    <Avatar 
                                        className={`${getAvatarColor(client.clientName)} ring-4 ring-white/50 dark:ring-gray-800/50 shadow-lg`}
                                        size="lg"
                                    >
                                        {getInitials(client.clientName)}
                                    </Avatar>
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-400 rounded-full border-2 border-white dark:border-gray-900"></div>
                                </div>
                                <div>
                                    <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
                                        {client.clientName}
                                    </h1>
                                    <p className="text-lg text-gray-600 dark:text-gray-400 mt-2 font-medium">
                                        {client.clientType || 'Business Client'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                                <Tag className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-100 px-5 py-2.5 text-sm font-semibold rounded-full shadow-sm">
                                    {client.clientType || 'Client'}
                                </Tag>
                                <Button 
                                    variant="solid" 
                                    onClick={handleEditClient}
                                    className="px-8 py-3 w-full sm:w-auto bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                                >
                                    Edit Client
                                </Button>
                            </div>
                        </div>
                        
                        {/* Mobile Navigation Tabs */}
                        <div className="lg:hidden mt-6">
                            <div className="flex space-x-2 overflow-x-auto pb-2">
                                {sidebarItems.map((item) => (
                                    <button
                                        key={item.key}
                                        onClick={() => setActiveTab(item.key)}
                                        className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                                            activeTab === item.key 
                                                ? 'bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg' 
                                                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 hover:shadow-md'
                                        }`}
                                    >
                                        {item.icon}
                                        <span>{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                )}

                {/* Content Area - Seamless */}
                <div className="flex-1 px-4 lg:px-8 py-8 lg:py-12">
                    {showAlert && (
                        <Alert
                            type="info"
                            showIcon
                            closable
                            onClose={() => setShowAlert(false)}
                            className="mb-8 rounded-xl shadow-sm border-0"
                        >
                            Changes have been cancelled and discarded.
                        </Alert>
                    )}
                    
                    {activeTab === 'overview' && (
                        <div className="space-y-12">
                            {/* Client Overview - Seamless */}
                            <div className="space-y-6">
                                <div className="flex items-center space-x-3">
                                    <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                                        Client Overview
                                    </h2>
                                </div>
                                <div className="prose prose-lg max-w-none dark:prose-invert leading-relaxed text-gray-700 dark:text-gray-300">
                                    <div 
                                        key={editedContent}
                                        className="min-h-[400px] p-6 rounded-2xl bg-gray-50/50 dark:bg-gray-800/30 backdrop-blur-sm"
                                        dangerouslySetInnerHTML={{ 
                                            __html: editedContent || '<p class="text-gray-500 italic text-center py-12">No description provided for this client.</p>' 
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Subtle Separator */}
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200 dark:border-gray-700/50"></div>
                                </div>
                                <div className="relative flex justify-center">
                                    <div className="bg-white dark:bg-gray-900 px-4">
                                        <div className="w-2 h-2 bg-primary/20 rounded-full"></div>
                                    </div>
                                </div>
                            </div>

                            {/* Client Information - Seamless */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                                            Client Information
                                        </h2>
                                    </div>
                                    {!isInfoEditing ? (
                                        <Button 
                                            size="sm" 
                                            variant="twoTone" 
                                            onClick={() => setIsInfoEditing(true)}
                                            className="px-6 py-2.5 rounded-xl font-medium shadow-sm hover:shadow-md transition-all duration-200"
                                        >
                                            Edit Information
                                        </Button>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <Button 
                                                size="sm" 
                                                variant="plain" 
                                                onClick={() => {
                                                    setIsInfoEditing(false)
                                                    setInfoForm({
                                                        clientName: client.clientName || '',
                                                        clientType: client.clientType || '',
                                                        address: client.address || '',
                                                        city: client.city || '',
                                                        state: client.state || '',
                                                        zip: client.zip || '',
                                                        tags: client.tags || ''
                                                    })
                                                }}
                                                className="px-6 py-2.5 rounded-xl font-medium"
                                            >
                                                Cancel
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                variant="solid" 
                                                onClick={async () => {
                                                    try {
                                                        const payload = {
                                                            ...client,
                                                            clientName: infoForm.clientName,
                                                            clientType: infoForm.clientType,
                                                            address: infoForm.address,
                                                            city: infoForm.city,
                                                            state: infoForm.state,
                                                            zip: infoForm.zip,
                                                            tags: infoForm.tags,
                                                            // Preserve existing notes
                                                            notes: client.notes ?? editedContent,
                                                        }
                                                        await updateClient(client.id, payload)
                                                        setIsInfoEditing(false)
                                                        setShowAlert(true)
                                                    } catch (e) {
                                                        console.error('Error updating client:', e)
                                                    }
                                                }}
                                                className="px-6 py-2.5 rounded-xl font-medium bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200"
                                            >
                                                Save Changes
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                
                                {!isInfoEditing ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                        <div className="space-y-2 group">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Company</label>
                                            <p className="text-xl text-gray-900 dark:text-white font-semibold group-hover:text-primary transition-colors duration-200">{client.clientName}</p>
                                        </div>
                                        <div className="space-y-2 group">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Type</label>
                                            <p className="text-xl text-gray-900 dark:text-white group-hover:text-primary transition-colors duration-200">{client.clientType || 'N/A'}</p>
                                        </div>
                                        <div className="space-y-2 group">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Address</label>
                                            <p className="text-xl text-gray-900 dark:text-white group-hover:text-primary transition-colors duration-200">{client.address || 'N/A'}</p>
                                        </div>
                                        <div className="space-y-2 group">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">City</label>
                                            <p className="text-xl text-gray-900 dark:text-white group-hover:text-primary transition-colors duration-200">{client.city || 'N/A'}</p>
                                        </div>
                                        <div className="space-y-2 group">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">State</label>
                                            <p className="text-xl text-gray-900 dark:text-white group-hover:text-primary transition-colors duration-200">{client.state || 'N/A'}</p>
                                        </div>
                                        <div className="space-y-2 group">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">ZIP</label>
                                            <p className="text-xl text-gray-900 dark:text-white group-hover:text-primary transition-colors duration-200">{client.zip || 'N/A'}</p>
                                        </div>
                                        <div className="space-y-2 group">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Tags</label>
                                            <p className="text-xl text-gray-900 dark:text-white group-hover:text-primary transition-colors duration-200">{client.tags || 'N/A'}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Company</label>
                                            <Input value={infoForm.clientName} onChange={(e)=>setInfoForm({...infoForm, clientName: e.target.value})} className="rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20" />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Type</label>
                                            <Select
                                                value={infoForm.clientType ? { value: infoForm.clientType, label: infoForm.clientType } : null}
                                                options={[
                                                    { value: 'enterprise', label: 'Enterprise' },
                                                    { value: 'small_business', label: 'Small Business' },
                                                    { value: 'nonprofit', label: 'Nonprofit' },
                                                ]}
                                                onChange={(opt)=>setInfoForm({...infoForm, clientType: opt?.value || ''})}
                                                isClearable
                                                className="rounded-xl"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Address</label>
                                            <Input value={infoForm.address} onChange={(e)=>setInfoForm({...infoForm, address: e.target.value})} className="rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20" />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">City</label>
                                            <Input value={infoForm.city} onChange={(e)=>setInfoForm({...infoForm, city: e.target.value})} className="rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20" />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">State</label>
                                            <Input value={infoForm.state} onChange={(e)=>setInfoForm({...infoForm, state: e.target.value})} className="rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20" />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">ZIP</label>
                                            <Input value={infoForm.zip} onChange={(e)=>setInfoForm({...infoForm, zip: e.target.value})} className="rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20" />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Tags</label>
                                            <Input value={infoForm.tags} onChange={(e)=>setInfoForm({...infoForm, tags: e.target.value})} className="rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Subtle Separator */}
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200 dark:border-gray-700/50"></div>
                                </div>
                                <div className="relative flex justify-center">
                                    <div className="bg-white dark:bg-gray-900 px-4">
                                        <div className="w-2 h-2 bg-primary/20 rounded-full"></div>
                                    </div>
                                </div>
                            </div>

                            {/* Linked Leads - Seamless */}
                            <div className="space-y-6">
                                <div className="flex items-center space-x-3">
                                    <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Linked Leads</h2>
                                </div>
                                <div className="rounded-2xl bg-gray-50/50 dark:bg-gray-800/30 backdrop-blur-sm p-8">
                                    {(client.leadIds || []).length === 0 ? (
                                        <div className="text-center py-12">
                                            <div className="text-gray-400 mb-6">
                                                <HiOutlineUser size={64} />
                                            </div>
                                            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">No Linked Leads</h3>
                                            <p className="text-lg text-gray-500 dark:text-gray-500">This client doesn't have any linked leads yet.</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-4">
                                            {(client.leadIds || []).map((id) => {
                                                const lead = leads.find((l)=>l.id===id)
                                                if (!lead) return null
                                                return (
                                                    <button
                                                        key={id}
                                                        className="px-6 py-3 rounded-xl bg-white/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium transition-all duration-200 shadow-sm hover:shadow-md hover:transform hover:scale-105"
                                                        onClick={() => navigate(`/leads/${id}`)}
                                                    >
                                                        {lead.companyName}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'tasks' && (
                        <TasksManager entityType="client" entityId={clientId} />
                    )}

                    {activeTab === 'attachments' && (
                        <AttachmentsManager entityType="client" entityId={clientId} />
                    )}

                    {activeTab === 'activities' && (
                        <div className="space-y-6">
                            <div className="flex items-center space-x-3">
                                <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                                <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Activities</h2>
                            </div>
                            <div className="text-center py-16 rounded-2xl bg-gray-50/50 dark:bg-gray-800/30 backdrop-blur-sm">
                                <div className="text-gray-400 mb-6">
                                    <HiOutlineClock size={64} />
                                </div>
                                <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">Activity Timeline</h3>
                                <p className="text-lg text-gray-500 dark:text-gray-500">Activity timeline will be displayed here.</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="space-y-8">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Settings</h2>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <Button 
                                        variant="plain" 
                                        onClick={handleCancelEdit}
                                        className="px-6 py-2.5 rounded-xl font-medium"
                                    >
                                        Cancel
                                    </Button>
                                    <Button 
                                        variant="solid" 
                                        onClick={handleSaveChanges}
                                        className="px-6 py-2.5 rounded-xl font-medium bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200"
                                    >
                                        Save Changes
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="space-y-12">
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight">
                                        Client Overview
                                    </h3>
                                    <div className="rounded-2xl bg-gray-50/50 dark:bg-gray-800/30 backdrop-blur-sm p-6">
                                        <RichTextEditor
                                            content={editedContent}
                                            onChange={(content) => {
                                                if (typeof content === 'string') {
                                                    setEditedContent(content)
                                                } else if (content && content.html) {
                                                    setEditedContent(content.html)
                                                }
                                            }}
                                            editorContentClass="min-h-[400px]"
                                        />
                                    </div>
                                </div>
                                
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight">
                                        Client Information
                                    </h3>
                                    <div className="rounded-2xl bg-gray-50/50 dark:bg-gray-800/30 backdrop-blur-sm p-6">
                                        <p className="text-gray-600 dark:text-gray-400 text-lg">
                                            Additional client settings and preferences will be managed here.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Cancel Confirmation Dialog */}
            <Dialog isOpen={showCancelDialog} onClose={handleCancelDialogClose} width={400}>
                <div className="p-6">
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            Unsaved Changes
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            You have unsaved changes. Are you sure you want to cancel and lose these changes?
                        </p>
                    </div>
                    
                    <div className="flex justify-end space-x-3">
                        <Button
                            variant="twoTone"
                            onClick={handleCancelDialogClose}
                        >
                            Keep Editing
                        </Button>
                        <Button
                            variant="solid"
                            onClick={handleConfirmCancel}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Cancel Changes
                        </Button>
                    </div>
                </div>
            </Dialog>
        </div>
    )
}

export default ClientDetail
