import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router'
import { Card, Button, Input, Select, DatePicker, Tag, Avatar, Alert, Switcher, Dialog } from '@/components/ui'
import { RichTextEditor } from '@/components/shared'
import { useCrmStore } from '@/store/crmStore'
import { leadStatusOptions, methodOfContactOptions, projectMarketOptions } from '@/mock/data/leadsData'
import TasksManager from '@/components/TasksManager'
import AttachmentsManager from '@/components/Attachments/AttachmentsManager'
import { HiOutlineArrowLeft, HiOutlineUser, HiOutlineCalendar, HiOutlineClipboardList, HiOutlinePaperClip, HiOutlineClock, HiOutlineCog } from 'react-icons/hi'
import ActivitiesTimeline from '@/components/Activities/ActivitiesTimeline'
import { APP_NAME } from '@/constants/app.constant'
import logActivity from '@/utils/activityLogger'

const LeadDetail = () => {
    const { leadId } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const leads = useCrmStore((s) => s.leads)
    const loading = useCrmStore((s) => s.loading)
    const loadLeads = useCrmStore((s) => s.loadLeads)
    
    const [activeTab, setActiveTab] = useState('overview')
    const [isEditing, setIsEditing] = useState(false)
    const [editedContent, setEditedContent] = useState('')
    const [showAlert, setShowAlert] = useState(false)
    const [originalContent, setOriginalContent] = useState('')
    const updateLead = useCrmStore((s) => s.updateLead)
    const [isInfoEditing, setIsInfoEditing] = useState(false)
    const [infoForm, setInfoForm] = useState({
        companyName: '',
        leadContact: '',
        tatcoContact: '',
        title: '',
        email: '',
        phone: '',
        projectMarket: '',
        status: '',
        responded: false,
        methodOfContact: '',
        dateLastContacted: null,
    })
    const clients = useCrmStore((s) => s.clients)
    const linkLeadToClients = useCrmStore((s) => s.linkLeadToClients)
    const [linkedClientIds, setLinkedClientIds] = useState([])
    const [showCancelDialog, setShowCancelDialog] = useState(false)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [filters, setFilters] = useState({
        dateFrom: null,
        dateTo: null,
        status: null
    })

    const lead = leads.find(l => l.id === leadId)

    // Load leads if not available (for new tab scenarios)
    useEffect(() => {
        if (leads.length === 0 && !loading) {
            loadLeads()
        }
    }, [leads.length, loading, loadLeads])

    // Handle tab query parameter
    useEffect(() => {
        const urlParams = new URLSearchParams(location.search)
        const tabParam = urlParams.get('tab')
        if (tabParam && ['overview', 'settings', 'activities', 'files'].includes(tabParam)) {
            setActiveTab(tabParam)
        }
    }, [location.search])

    useEffect(() => {
        if (!lead && !loading && leads.length > 0) {
            navigate('/home')
        }
    }, [lead, loading, leads.length, navigate])

    useEffect(() => {
        if (lead) {
            const defaultContent = `
<h3>Project Description</h3>
<p>Asked for case studies</p>

<h3>Project Goals</h3>
<ul>
<li>Increase lead conversion rates by 25%</li>
<li>Improve customer relationship management</li>
<li>Streamline sales pipeline processes</li>
<li>Enhance data-driven decision making</li>
</ul>

<h3>Key Metrics</h3>
<p><strong>$125K</strong> - Potential Value</p>
<p><strong>85%</strong> - Probability</p>

<h3>Next Steps</h3>
<ul>
<li>Schedule follow-up meeting</li>
<li>Prepare proposal document</li>
<li>Review contract terms</li>
</ul>
            `
            const content = lead.notes || defaultContent
            setEditedContent(content)
            setOriginalContent(content)
            setInfoForm({
                companyName: lead.companyName || '',
                leadContact: lead.leadContact || '',
                tatcoContact: lead.tatcoContact || '',
                title: lead.title || '',
                email: lead.email || '',
                phone: lead.phone || '',
                projectMarket: lead.projectMarket || '',
                status: lead.status || '',
                responded: Boolean(lead.responded),
                methodOfContact: lead.methodOfContact || '',
                dateLastContacted: lead.dateLastContacted ? new Date(lead.dateLastContacted) : null,
            })
            setLinkedClientIds(Array.isArray(lead.clientIds) ? lead.clientIds : [])
        }
    }, [lead])

    const handleEditLead = () => {
        setIsEditing(true)
        setActiveTab('settings')
    }

    const handleSaveChanges = async () => {
        try {
            await updateLead(lead.id, { ...lead, notes: editedContent })
            setOriginalContent(editedContent)
            setShowAlert(true)
            const strip = (html) => (html || '').replace(/<[^>]+>/g, '').replace(/\s+/g,' ').trim()
            const prevText = strip(originalContent)
            const nextText = strip(editedContent)
            await logActivity('lead', lead.id, { type: 'update', message: 'updated project overview', metadata: { section: 'overview', changes: { overview: [prevText, nextText] } } })
        } catch (e) {
            console.error('Error saving changes:', e)
        }
    }

    const handleCancelEdit = () => {
        // Check if there are unsaved changes
        const hasContentChanges = editedContent !== originalContent
        const hasInfoChanges = isInfoEditing && JSON.stringify(infoForm) !== JSON.stringify({
            companyName: lead.companyName || '',
            leadContact: lead.leadContact || '',
            tatcoContact: lead.tatcoContact || '',
            title: lead.title || '',
            email: lead.email || '',
            phone: lead.phone || '',
            projectMarket: lead.projectMarket || '',
            status: lead.status || '',
            responded: Boolean(lead.responded),
            methodOfContact: lead.methodOfContact || '',
            dateLastContacted: lead.dateLastContacted ? new Date(lead.dateLastContacted) : null,
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

    // Show loading state while leads are being loaded
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="text-lg font-semibold text-gray-500">Loading lead...</div>
                </div>
            </div>
        )
    }

    if (!lead) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="text-lg font-semibold text-gray-500">Lead not found</div>
                    <Button onClick={() => navigate('/home')} className="mt-4">
                        Back to CRM
                    </Button>
                </div>
            </div>
        )
    }

    const statusColor = (value) => {
        switch (value) {
            case 'new': return 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-100'
            case 'contacted': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-100'
            case 'qualified': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-100'
            case 'proposal': return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100'
            case 'won': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100'
            case 'lost': return 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-100'
            default: return 'bg-gray-100 text-gray-700'
        }
    }

    const getInitials = (name) => {
        if (!name) return '??'
        return name.split(' ').map(n => n[0]).join('').toUpperCase()
    }

    const getAvatarColor = (name) => {
        if (!name) return 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-100'
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
                {activeTab !== 'tasks' && activeTab !== 'settings' && activeTab !== 'attachments' && activeTab !== 'activities' && (
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
                                            className={`${getAvatarColor(lead.companyName)} ring-4 ring-white/50 dark:ring-gray-800/50 shadow-lg`}
                                            size="lg"
                                        >
                                            {getInitials(lead.companyName)}
                                        </Avatar>
                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white dark:border-gray-900"></div>
                                    </div>
                                    <div>
                                        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
                                            {lead.companyName}
                                        </h1>
                                        <p className="text-lg text-gray-600 dark:text-gray-400 mt-2 font-medium">
                                            {lead.leadContact} • {lead.email}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                                    <Tag className={`${statusColor(lead.status)} px-5 py-2.5 text-sm font-semibold rounded-full shadow-sm`}>
                                        {leadStatusOptions.find(opt => opt.value === lead.status)?.label || lead.status}
                                    </Tag>
                                    <Button 
                                        variant="solid" 
                                        onClick={handleEditLead}
                                        className="px-8 py-3 w-full sm:w-auto bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                                    >
                                        Edit Lead
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
                            {/* Lead Overview - Seamless */}
                            <div className="space-y-6">
                                <div className="flex items-center space-x-3">
                                    <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                                        Lead Overview
                                    </h2>
                                </div>
                                <div className="prose prose-lg max-w-none dark:prose-invert leading-relaxed text-gray-700 dark:text-gray-300">
                                    <div 
                                        key={editedContent}
                                        className="min-h-[400px] p-6 rounded-2xl bg-gray-50/50 dark:bg-gray-800/30 backdrop-blur-sm"
                                        dangerouslySetInnerHTML={{ 
                                            __html: editedContent || '<p class="text-gray-500 italic text-center py-12">No description provided for this project.</p>' 
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

                            {/* Lead Information - Seamless */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                                            Lead Information
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
                                                        companyName: lead.companyName || '',
                                                        leadContact: lead.leadContact || '',
                                                        tatcoContact: lead.tatcoContact || '',
                                                        title: lead.title || '',
                                                        email: lead.email || '',
                                                        phone: lead.phone || '',
                                                        projectMarket: lead.projectMarket || '',
                                                        status: lead.status || '',
                                                        responded: Boolean(lead.responded),
                                                        methodOfContact: lead.methodOfContact || '',
                                                        dateLastContacted: lead.dateLastContacted ? new Date(lead.dateLastContacted) : null,
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
                                                            ...lead,
                                                            companyName: infoForm.companyName,
                                                            leadContact: infoForm.leadContact,
                                                            tatcoContact: infoForm.tatcoContact,
                                                            title: infoForm.title,
                                                            email: infoForm.email,
                                                            phone: infoForm.phone,
                                                            projectMarket: infoForm.projectMarket,
                                                            status: infoForm.status,
                                                            responded: infoForm.responded,
                                                            methodOfContact: infoForm.methodOfContact,
                                                            dateLastContacted: infoForm.dateLastContacted ? infoForm.dateLastContacted.toISOString().slice(0,10) : null,
                                                        }
                                                        await updateLead(lead.id, payload)
                                                        setIsInfoEditing(false)
                                                        setShowAlert(true)
                                                        const prev = {
                                                            companyName: lead.companyName || '',
                                                            leadContact: lead.leadContact || '',
                                                            tatcoContact: lead.tatcoContact || '',
                                                            title: lead.title || '',
                                                            email: lead.email || '',
                                                            phone: lead.phone || '',
                                                            projectMarket: lead.projectMarket || '',
                                                            status: lead.status || '',
                                                            responded: Boolean(lead.responded),
                                                            methodOfContact: lead.methodOfContact || '',
                                                            dateLastContacted: lead.dateLastContacted || null,
                                                        }
                                                        const next = {
                                                            companyName: infoForm.companyName,
                                                            leadContact: infoForm.leadContact,
                                                            tatcoContact: infoForm.tatcoContact,
                                                            title: infoForm.title,
                                                            email: infoForm.email,
                                                            phone: infoForm.phone,
                                                            projectMarket: infoForm.projectMarket,
                                                            status: infoForm.status,
                                                            responded: infoForm.responded,
                                                            methodOfContact: infoForm.methodOfContact,
                                                            dateLastContacted: infoForm.dateLastContacted ? infoForm.dateLastContacted.toISOString().slice(0,10) : null,
                                                        }
                                                        const changes = {}
                                                        Object.keys(next).forEach((k)=>{
                                                            if (String(prev[k]) !== String(next[k])) changes[k] = [prev[k], next[k]]
                                                        })
                                                        await logActivity('lead', lead.id, { type: 'update', message: 'updated lead information', metadata: { changes } })
                                                    } catch (error) {
                                                        console.error('Error updating lead:', error)
                                                        setShowAlert(true)
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
                                            <p className="text-xl text-gray-900 dark:text-white font-semibold group-hover:text-primary transition-colors duration-200">{lead.companyName}</p>
                                        </div>
                                        <div className="space-y-2 group">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Contact Person</label>
                                            <p className="text-xl text-gray-900 dark:text-white group-hover:text-primary transition-colors duration-200">{lead.leadContact || 'N/A'}</p>
                                        </div>
                                        <div className="space-y-2 group">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Tatco Contact</label>
                                            <p className="text-xl text-gray-900 dark:text-white group-hover:text-primary transition-colors duration-200">{lead.tatcoContact || 'N/A'}</p>
                                        </div>
                                        <div className="space-y-2 group">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Title</label>
                                            <p className="text-xl text-gray-900 dark:text-white group-hover:text-primary transition-colors duration-200">{lead.title || 'N/A'}</p>
                                        </div>
                                        <div className="space-y-2 group">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Email</label>
                                            <p className="text-xl text-gray-900 dark:text-white group-hover:text-primary transition-colors duration-200">{lead.email || 'N/A'}</p>
                                        </div>
                                        <div className="space-y-2 group">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Phone</label>
                                            <p className="text-xl text-gray-900 dark:text-white group-hover:text-primary transition-colors duration-200">{lead.phone || 'N/A'}</p>
                                        </div>
                                        <div className="space-y-2 group">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Market</label>
                                            <p className="text-xl text-gray-900 dark:text-white group-hover:text-primary transition-colors duration-200">{projectMarketOptions.find(opt => opt.value === lead.projectMarket)?.label || lead.projectMarket || 'N/A'}</p>
                                        </div>
                                        <div className="space-y-2 group">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Status</label>
                                            <Tag className={`${statusColor(lead.status)} px-4 py-2 text-sm font-semibold rounded-full shadow-sm`}>
                                                {leadStatusOptions.find(opt => opt.value === lead.status)?.label || lead.status}
                                            </Tag>
                                        </div>
                                        <div className="space-y-2 group">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Responded</label>
                                            <p className={`text-xl font-semibold ${lead.responded ? 'text-green-600' : 'text-gray-500'}`}>
                                                {lead.responded ? 'Yes' : 'No'}
                                            </p>
                                        </div>
                                        <div className="space-y-2 group">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Method</label>
                                            <p className="text-xl text-gray-900 dark:text-white group-hover:text-primary transition-colors duration-200">{methodOfContactOptions.find(o=>o.value===lead.methodOfContact)?.label || lead.methodOfContact || 'N/A'}</p>
                                        </div>
                                        <div className="space-y-2 group">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Last Contacted</label>
                                            <p className="text-xl text-gray-900 dark:text-white group-hover:text-primary transition-colors duration-200">{lead.dateLastContacted || 'N/A'}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Company</label>
                                            <Input value={infoForm.companyName} onChange={(e)=>setInfoForm({...infoForm, companyName: e.target.value})} className="rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20" />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Contact Person</label>
                                            <Input value={infoForm.leadContact} onChange={(e)=>setInfoForm({...infoForm, leadContact: e.target.value})} className="rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20" />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Tatco Contact</label>
                                            <Input value={infoForm.tatcoContact} onChange={(e)=>setInfoForm({...infoForm, tatcoContact: e.target.value})} className="rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20" />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Title</label>
                                            <Input value={infoForm.title} onChange={(e)=>setInfoForm({...infoForm, title: e.target.value})} className="rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20" />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Email</label>
                                            <Input value={infoForm.email} onChange={(e)=>setInfoForm({...infoForm, email: e.target.value})} className="rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20" />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Phone</label>
                                            <Input value={infoForm.phone} onChange={(e)=>setInfoForm({...infoForm, phone: e.target.value})} className="rounded-xl border-gray-200 focus:border-primary focus:ring-primary/20" />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Market</label>
                                            <Select value={infoForm.projectMarket ? {value: infoForm.projectMarket, label: projectMarketOptions.find(o=>o.value===infoForm.projectMarket)?.label || infoForm.projectMarket } : null}
                                                options={projectMarketOptions}
                                                onChange={(opt)=>setInfoForm({...infoForm, projectMarket: opt?.value || ''})}
                                                isClearable
                                                className="rounded-xl"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Status</label>
                                            <Select value={infoForm.status ? {value: infoForm.status, label: leadStatusOptions.find(o=>o.value===infoForm.status)?.label || infoForm.status } : null}
                                                options={leadStatusOptions}
                                                onChange={(opt)=>setInfoForm({...infoForm, status: opt?.value || ''})}
                                                isClearable
                                                className="rounded-xl"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Responded</label>
                                            <div className="flex items-center space-x-3">
                                                <Switcher checked={infoForm.responded} onChange={(val)=>setInfoForm({...infoForm, responded: Boolean(val)})} />
                                                <span className="text-lg font-medium text-gray-600 dark:text-gray-400">
                                                    {infoForm.responded ? 'Yes' : 'No'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Method</label>
                                            <Select value={infoForm.methodOfContact ? {value: infoForm.methodOfContact, label: methodOfContactOptions.find(o=>o.value===infoForm.methodOfContact)?.label || infoForm.methodOfContact } : null}
                                                options={methodOfContactOptions}
                                                onChange={(opt)=>setInfoForm({...infoForm, methodOfContact: opt?.value || ''})}
                                                isClearable
                                                className="rounded-xl"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Last Contacted</label>
                                            <DatePicker
                                                value={infoForm.dateLastContacted}
                                                onChange={(d)=>setInfoForm({...infoForm, dateLastContacted: d || null})}
                                                placeholder="Select date"
                                                className="rounded-xl"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'tasks' && (
                        <TasksManager entityType="lead" entityId={leadId} />
                    )}

                    {activeTab === 'attachments' && (
                        <AttachmentsManager entityType="lead" entityId={leadId} />
                    )}

                    {activeTab === 'activities' && (
                        <div className="space-y-6">
                            <div className="flex items-center space-x-3">
                                <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                                <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Activities</h2>
                            </div>
                            <ActivitiesTimeline entityType="lead" entityId={leadId} />
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
                                        Project Overview
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
                                        Linked Clients
                                    </h3>
                                    <div className="space-y-4">
                                        <Select
                                            isMulti
                                            placeholder="Select clients to link with this lead"
                                            options={clients.map((c)=>({ value: c.id, label: c.clientName }))}
                                            value={linkedClientIds.map((id)=>{
                                                const c = clients.find((x)=>x.id===id)
                                                return c ? { value: c.id, label: c.clientName } : null
                                            }).filter(Boolean)}
                                            onChange={(opts)=>{
                                                const ids = Array.isArray(opts) ? opts.map((o)=>o.value) : []
                                                setLinkedClientIds(ids)
                                            }}
                                            className="rounded-xl"
                                        />
                                        <Button 
                                            size="sm" 
                                            variant="twoTone" 
                                            onClick={async()=>{
                                                try {
                                                    await linkLeadToClients(lead.id, linkedClientIds)
                                                    setShowAlert(true)
                                                } catch (error) {
                                                    console.error('Error linking clients:', error)
                                                }
                                            }}
                                            className="px-6 py-2.5 rounded-xl font-medium shadow-sm hover:shadow-md transition-all duration-200"
                                        >
                                            Save Client Links
                                        </Button>
                                    </div>
                                </div>
                                
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight">
                                        Lead Information
                                    </h3>
                                    <div className="rounded-2xl bg-gray-50/50 dark:bg-gray-800/30 backdrop-blur-sm p-6">
                                        <p className="text-gray-600 dark:text-gray-400 text-lg">
                                            Additional lead settings and preferences will be managed here.
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

export default LeadDetail
