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
        clientNumber: '',
        clientType: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        tags: ''
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
            setInfoForm({
                clientName: client.clientName || '',
                clientNumber: client.clientNumber || '',
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
        } catch (e) {}
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

                    {/* Client Information (editable) */}
                    <div className="space-y-4">
                        <Card className="p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-lg font-semibold">Client Information</h3>
                                {!isInfoEditing ? (
                                    <Button size="sm" variant="twoTone" onClick={() => setIsInfoEditing(true)}>Edit</Button>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Button size="sm" variant="plain" onClick={() => {
                                            setIsInfoEditing(false)
                                            setInfoForm({
                                                clientName: client.clientName || '',
                                                clientNumber: client.clientNumber || '',
                                                clientType: client.clientType || '',
                                                address: client.address || '',
                                                city: client.city || '',
                                                state: client.state || '',
                                                zip: client.zip || '',
                                                tags: client.tags || ''
                                            })
                                        }}>Cancel</Button>
                                        <Button size="sm" variant="solid" onClick={async () => {
                                            try {
                                                const payload = {
                                                    ...client,
                                                    clientName: infoForm.clientName,
                                                    clientNumber: infoForm.clientNumber,
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
                                            } catch (e) {}
                                        }}>Save</Button>
                                    </div>
                                )}
                            </div>

                            {!isInfoEditing ? (
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
                            ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    <div>
                                        <label className="text-sm font-medium">Company</label>
                                        <Input value={infoForm.clientName} onChange={(e)=>setInfoForm({...infoForm, clientName: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Client Number</label>
                                        <Input value={infoForm.clientNumber} onChange={(e)=>setInfoForm({...infoForm, clientNumber: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Type</label>
                                        <Select
                                            value={infoForm.clientType ? { value: infoForm.clientType, label: infoForm.clientType } : null}
                                            options={[
                                                { value: 'enterprise', label: 'enterprise' },
                                                { value: 'small_business', label: 'small_business' },
                                                { value: 'nonprofit', label: 'nonprofit' },
                                            ]}
                                            onChange={(opt)=>setInfoForm({...infoForm, clientType: opt?.value || ''})}
                                            isClearable
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Address</label>
                                        <Input value={infoForm.address} onChange={(e)=>setInfoForm({...infoForm, address: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">City</label>
                                        <Input value={infoForm.city} onChange={(e)=>setInfoForm({...infoForm, city: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">State</label>
                                        <Input value={infoForm.state} onChange={(e)=>setInfoForm({...infoForm, state: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">ZIP</label>
                                        <Input value={infoForm.zip} onChange={(e)=>setInfoForm({...infoForm, zip: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Tags</label>
                                        <Input value={infoForm.tags} onChange={(e)=>setInfoForm({...infoForm, tags: e.target.value})} />
                                    </div>
                                </div>
                            )}
                        </Card>
                        <Card className="p-4">
                            <h3 className="text-lg font-semibold mb-3">Linked Leads</h3>
                            <div className="flex flex-wrap gap-2">
                                {(client.leadIds || []).length === 0 && (
                                    <span className="text-sm text-gray-500">No linked leads</span>
                                )}
                                {(client.leadIds || []).map((id) => {
                                    const lead = leads.find((l)=>l.id===id)
                                    if (!lead) return null
                                    return (
                                        <button
                                            key={id}
                                            className="text-sm px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                                            onClick={() => navigate(`/leads/${id}`)}
                                        >
                                            {lead.leadName}
                                        </button>
                                    )
                                })}
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
