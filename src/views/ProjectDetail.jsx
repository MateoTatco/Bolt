import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router'
import { Card, Button, Input, Select, DatePicker, Alert, Tag, Dialog } from '@/components/ui'
import { RichTextEditor } from '@/components/shared'
import { HiOutlineArrowLeft, HiOutlineClipboardList, HiOutlinePaperClip, HiOutlineClock, HiOutlineCog, HiOutlineUser } from 'react-icons/hi'
import TasksManager from '@/components/TasksManager'
import AttachmentsManager from '@/components/Attachments/AttachmentsManager'
import ActivitiesTimeline from '@/components/Activities/ActivitiesTimeline'
import { useProjectsStore } from '@/store/projectsStore'
import logActivity from '@/utils/activityLogger'
import EntityMembersManager from '@/components/shared/EntityMembersManager'
import EntityMembersDisplay from '@/components/shared/EntityMembersDisplay'

const marketOptions = [
    { value: 'OKC', label: 'OKC' },
    { value: 'ORL', label: 'ORL' },
    { value: 'DFW', label: 'DFW' },
]
const projectStatusOptions = [
    { value: 'Complete', label: 'Complete' },
    { value: 'Course of Construction', label: 'Course of Construction' },
    { value: 'Not Awarded', label: 'Not Awarded' },
    { value: 'Pre-Construction', label: 'Pre-Construction' },
    { value: 'Warranty', label: 'Warranty' },
    { value: 'Bidding', label: 'Bidding' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Post Construction', label: 'Post Construction' },
    { value: 'Hold', label: 'Hold' },
]
const projectProbabilityOptions = [
    { value: 'Awarded', label: 'Awarded' },
    { value: 'High', label: 'High' },
    { value: 'Low', label: 'Low' },
]
const projectStyleOptions = [
    { value: 'Ground Up', label: 'Ground Up' },
    { value: 'TI', label: 'TI' },
    { value: 'Renovation', label: 'Renovation' },
]
const projectManagerOptions = [
    { value: 'Admin', label: 'Admin' },
    { value: 'Brett Tatum', label: 'Brett Tatum' },
    { value: 'Cindy Smith-Frawner', label: 'Cindy Smith-Frawner' },
    { value: 'Harrison McKee', label: 'Harrison McKee' },
    { value: 'Heath Pickens', label: 'Heath Pickens' },
    { value: 'Jamey Montgomery', label: 'Jamey Montgomery' },
    { value: 'Joe Lassiter', label: 'Joe Lassiter' },
    { value: 'Kaitlyn Divilbiss', label: 'Kaitlyn Divilbiss' },
    { value: 'Kenny Beaird', label: 'Kenny Beaird' },
    { value: 'Marc Dunham', label: 'Marc Dunham' },
    { value: 'Melissa Keene', label: 'Melissa Keene' },
    { value: 'Nathaniel Viera', label: 'Nathaniel Viera' },
    { value: 'Sam McKee', label: 'Sam McKee' },
    { value: 'Sarah Barr', label: 'Sarah Barr' },
    { value: 'Simon Cox', label: 'Simon Cox' },
    { value: 'Standards IT', label: 'Standards IT' },
    { value: 'Trey Roberts', label: 'Trey Roberts' },
]
const superintendentOptions = [
    { value: 'Aaron Rodriguez', label: 'Aaron Rodriguez' },
    { value: 'Bart Vanpool', label: 'Bart Vanpool' },
    { value: 'Braulio Nieto', label: 'Braulio Nieto' },
    { value: 'Chase Albro', label: 'Chase Albro' },
    { value: 'Christopher Venable', label: 'Christopher Venable' },
    { value: 'Corey Dolezel', label: 'Corey Dolezel' },
    { value: 'Daniel Mitchell', label: 'Daniel Mitchell' },
    { value: 'David Harrison', label: 'David Harrison' },
    { value: 'Dominic Hastings', label: 'Dominic Hastings' },
    { value: 'Gerardo Medina', label: 'Gerardo Medina' },
    { value: 'Jared Prince', label: 'Jared Prince' },
    { value: 'Jeremy Christian', label: 'Jeremy Christian' },
    { value: 'Jesse Torrez', label: 'Jesse Torrez' },
    { value: 'Joey McClanahan', label: 'Joey McClanahan' },
    { value: 'Josh Finch', label: 'Josh Finch' },
    { value: 'Kevin Bagshaw', label: 'Kevin Bagshaw' },
    { value: 'Mark Rummel', label: 'Mark Rummel' },
    { value: 'Nathaniel Viera', label: 'Nathaniel Viera' },
    { value: 'TBD', label: 'TBD' },
    { value: 'Tony Martin', label: 'Tony Martin' },
]
const bidTypeOptions = [
    { value: 'New Opportunity', label: 'New Opportunity' },
    { value: 'Legacy', label: 'Legacy' },
]

const ProjectDetail = () => {
    const { projectId } = useParams()
    const navigate = useNavigate()
    const location = useLocation()

    const projects = useProjectsStore((s) => s.projects)
    const loading = useProjectsStore((s) => s.loading)
    const loadProjects = useProjectsStore((s) => s.loadProjects)
    const updateProject = useProjectsStore((s) => s.updateProject)

    const project = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId])

    const [activeTab, setActiveTab] = useState('overview')
    const [alertBanner, setAlertBanner] = useState({ visible: false, kind: 'saved' })
    const [showCancelDialog, setShowCancelDialog] = useState(false)

    // Overview (uses Notes)
    const [overviewHtml, setOverviewHtml] = useState('')
    const [overviewOriginal, setOverviewOriginal] = useState('')

    // Settings form covering all specified fields
    const emptyForm = {
        ProjectNumber: '',
        address: '',
        city: '',
        CompletionDate: null,
        CreatedAt: null,
        EstimatedValue: '',
        ProjectName: '',
        StartDate: null,
        State: '',
        EstimatedCostAtCompletion: '',
        ClientReferenceId: '',
        ProjectRevisedContractAmount: '',
        Notes: '',
        ProjectProbability: '',
        ProjectManager: '',
        CommunicatedStartDate: null,
        CommunicatedFinishDate: null,
        ProjectedFinishDate: null,
        EstStart: null,
        EstFinish: null,
        EstDuration: '',
        ActualFinishDate: null,
        ActualDuration: '',
        SuperId: '',
        Superintendent: '',
        BidDueDate: null,
        ProjectReviewDate: null,
        ProjectConceptionYear: '',
        BidType: '',
        Market: '',
        ProjectStatus: '',
        ProjectStyle: '',
        EstimatedProjectProfit: '',
        ProfitCenterYear: '',
        SquareFeet: '',
        Archived: false,
        zip: '',
    }
    const [form, setForm] = useState(emptyForm)

    useEffect(() => {
        if (projects.length === 0 && !loading) {
            loadProjects()
        }
    }, [projects.length, loading, loadProjects])

    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const tab = params.get('tab')
        if (tab && ['overview', 'tasks', 'attachments', 'activities', 'settings'].includes(tab)) {
            setActiveTab(tab)
        }
    }, [location.search])

    useEffect(() => {
        if (project) {
            const defaultContent = '<p class="text-gray-500">Describe your project or add notes here</p>'
            // Ensure Notes is a string, not an object
            let content = defaultContent
            if (project.Notes) {
                if (typeof project.Notes === 'string' && project.Notes.trim() !== '') {
                    // Check if it's just the default placeholder
                    const defaultPlaceholder = '<p class="text-gray-500">Describe your project or add notes here</p>'
                    if (project.Notes === defaultPlaceholder || project.Notes.trim() === defaultPlaceholder) {
                        content = defaultContent
                    } else {
                        content = project.Notes
                    }
                } else if (typeof project.Notes === 'object') {
                    // If it's an object, ignore it and use default
                    content = defaultContent
                }
            }
            setOverviewHtml(content)
            setOverviewOriginal(content)

            setForm((prev) => ({
                ...emptyForm,
                ...project,
            }))
        }
    }, [project])

    if (!project && !loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="text-lg font-semibold text-gray-500">Project not found</div>
                    <Button onClick={() => navigate('/projects')} className="mt-4">Back to Master Tracker</Button>
                </div>
            </div>
        )
    }

    const handleCancel = () => {
        if (!project) return
        
        // Check if there are unsaved changes
        const defaultContent = '<p class="text-gray-500">Describe your project or add notes here</p>'
        let originalNotes = defaultContent
        if (project.Notes) {
            if (typeof project.Notes === 'string' && project.Notes.trim() !== '') {
                originalNotes = project.Notes
            }
        }
        
        const hasOverviewChanges = overviewHtml !== overviewOriginal
        const hasInfoChanges = JSON.stringify(form) !== JSON.stringify({
            ...emptyForm,
            ...project,
        })
        
        if (hasOverviewChanges || hasInfoChanges) {
            setShowCancelDialog(true)
        } else {
            // No changes, just navigate to overview
            setActiveTab('overview')
        }
    }

    const handleConfirmCancel = () => {
        if (!project) return
        
        const defaultContent = '<p class="text-gray-500">Describe your project or add notes here</p>'
        let originalNotes = defaultContent
        if (project.Notes) {
            if (typeof project.Notes === 'string' && project.Notes.trim() !== '') {
                originalNotes = project.Notes
            }
        }
        
        setForm({ ...emptyForm, ...project })
        setOverviewHtml(originalNotes)
        setOverviewOriginal(originalNotes)
        setShowCancelDialog(false)
        setActiveTab('overview')
        
        // Show alert after cancellation
        setAlertBanner({ visible: true, kind: 'cancel' })
        setTimeout(() => setAlertBanner((b) => ({ ...b, visible: false })), 3000)
    }

    const handleCancelDialogClose = () => {
        setShowCancelDialog(false)
    }

    const saveSettings = async () => {
        if (!project) return
        try {
            const payload = { ...project, ...form, Notes: overviewHtml }
            await updateProject(project.id, payload)
            setOverviewOriginal(overviewHtml)
            setAlertBanner({ visible: true, kind: 'saved' })
            setTimeout(() => setAlertBanner((b) => ({ ...b, visible: false })), 3000)
            const strip = (html) => (html || '').replace(/<[^>]+>/g, '').replace(/\s+/g,' ').trim()
            await logActivity('project', project.id, {
                type: 'update',
                message: 'updated project information',
                metadata: { 
                    section: 'settings',
                    changes: overviewOriginal !== overviewHtml ? { overview: [strip(overviewOriginal), strip(overviewHtml)] } : {}
                }
            })
        } catch (e) {
            console.error('Save settings failed:', e)
        }
    }

    const formatDateOut = (d) => (d instanceof Date ? d.toISOString() : d)
    const parseDateIn = (v) => (v ? new Date(v) : null)

    const fieldInput = (label, key, placeholder = '', className = '') => (
        <div className={className}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
            <Input value={form[key] ?? ''} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} />
        </div>
    )

    const fieldNumber = (label, key, className = '') => (
        <div className={className}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
            <Input value={form[key] ?? ''} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value.replace(/[^0-9.]/g, '') }))} />
        </div>
    )

    const fieldCurrency = (label, key, className = '') => (
        <div className={className}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
            {key === 'ProjectRevisedContractAmount' ? (
                <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                    <Input 
                        className="pl-8"
                        value={form[key] ?? ''} 
                        onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.]/g, '')
                            setForm((f) => ({ ...f, [key]: value }))
                        }} 
                    />
                </div>
            ) : (
                <Input 
                    value={form[key] ?? ''} 
                    onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9.]/g, '')
                        setForm((f) => ({ ...f, [key]: value }))
                    }} 
                />
            )}
        </div>
    )

    const fieldDate = (label, key, className = '') => (
        <div className={className}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
            <DatePicker value={parseDateIn(form[key])} onChange={(d) => setForm((f) => ({ ...f, [key]: formatDateOut(d) }))} />
        </div>
    )

    const fieldSelect = (label, key, options, className = '') => (
        <div className={className}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
            <Select options={options} value={options.find((o) => o.value === form[key]) || null} onChange={(opt) => setForm((f) => ({ ...f, [key]: opt?.value || '' }))} />
        </div>
    )

    const fieldBool = (label, key, className = '') => (
        <div className={`flex items-center gap-2 ${className}`}>
            <input id={key} type="checkbox" checked={Boolean(form[key])} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))} />
            <label htmlFor={key} className="text-sm text-gray-700 dark:text-gray-300">{label}</label>
        </div>
    )

    const sidebarItems = [
        { key: 'overview', label: 'Overview', icon: <HiOutlineUser /> },
        { key: 'tasks', label: 'Tasks', icon: <HiOutlineClipboardList /> },
        { key: 'attachments', label: 'Attachments', icon: <HiOutlinePaperClip /> },
        { key: 'activities', label: 'Activities', icon: <HiOutlineClock /> },
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
                        onClick={() => navigate('/projects')}
                        className="mb-8 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors duration-200"
                    >
                        Back to Master Tracker
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
                            <span className={`transition-transform duration-200 ${activeTab === item.key ? 'scale-110' : 'group-hover:scale-105'}`}>{item.icon}</span>
                            <span className="font-medium tracking-wide">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-screen">
                {/* Header hidden on content-heavy tabs */}
                {activeTab !== 'tasks' && activeTab !== 'settings' && activeTab !== 'attachments' && activeTab !== 'activities' && (
                    <div className="bg-gradient-to-r from-white via-gray-50/30 to-white dark:from-gray-900 dark:via-gray-800/30 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700/50">
                        <div className="px-4 lg:px-8 py-6 lg:py-8">
                            <div className="lg:hidden mb-6">
                                <Button 
                                    variant="plain" 
                                    icon={<HiOutlineArrowLeft />} 
                                    onClick={() => navigate('/projects')}
                                    className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors duration-200"
                                >
                                    Back to Master Tracker
                                </Button>
                            </div>

                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-6 lg:space-y-0">
                                <div>
                                    <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">{project?.ProjectName || 'Project'}</h1>
                                    <p className="text-lg text-gray-600 dark:text-gray-400 mt-2 font-medium">
                                        {project?.city || '-'} • {project?.State || '-'} • {project?.ProjectManager || '-'}
                                    </p>
                                </div>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                                    <Tag className="px-5 py-2.5 text-sm font-semibold rounded-full shadow-sm">
                                        {project?.ProjectStatus || '—'}
                                    </Tag>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex-1 px-4 lg:px-8 py-8 lg:py-12">
                    {alertBanner.visible && (
                        <Alert
                            type={alertBanner.kind === 'saved' ? 'success' : 'info'}
                            showIcon
                            closable
                            onClose={() => setAlertBanner((b) => ({ ...b, visible: false }))}
                            className="mb-8 rounded-xl shadow-sm border-0"
                        >
                            {alertBanner.kind === 'saved' ? 'Changes saved successfully.' : 'Changes have been cancelled and discarded.'}
                        </Alert>
                    )}

                    {activeTab === 'overview' && project && (
                        <div className="space-y-12">
                            {/* Project Overview (read-only) */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                    <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Project Overview</h2>
                                </div>
                                {project && (
                                    <EntityMembersManager
                                        entityType="project"
                                        entityId={project.id}
                                        entityName={project.ProjectName || project.projectName || 'Project'}
                                    />
                                )}
                                </div>
                                {project && (
                                    <div className="mb-4">
                                        <EntityMembersDisplay
                                            entityType="project"
                                            entityId={project.id}
                                        />
                                    </div>
                                )}
                                <Card>
                                    <div className="p-6 prose prose-lg max-w-none dark:prose-invert">
                                        {(() => {
                                            const defaultContent = '<p class="text-gray-500">Describe your project or add notes here</p>'
                                            let notesContent = defaultContent
                                            if (project?.Notes) {
                                                if (typeof project.Notes === 'string' && project.Notes.trim() !== '') {
                                                    // Only use actual content if it's not empty or just whitespace
                                                    const trimmed = project.Notes.trim()
                                                    if (trimmed && trimmed !== '<p></p>' && trimmed !== '<p><br></p>') {
                                                        notesContent = project.Notes
                                                    }
                                                }
                                            }
                                            return <div dangerouslySetInnerHTML={{ __html: notesContent }} />
                                        })()}
                                    </div>
                                </Card>
                            </div>

                            {/* Project Information (read-only) */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Project Information</h2>
                                    </div>
                                    <Button size="sm" variant="twoTone" onClick={() => setActiveTab('settings')}>Edit Information</Button>
                                </div>
                                <Card>
                                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Project Number</div>
                                            <div className="font-medium">{project?.ProjectNumber || 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Project Name</div>
                                            <div className="font-medium">{project?.ProjectName || 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Address</div>
                                            <div className="font-medium">{project?.address || 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">City</div>
                                            <div className="font-medium">{project?.city || 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">State</div>
                                            <div className="font-medium">{project?.State || 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">ZIP</div>
                                            <div className="font-medium">{project?.zip || 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Market</div>
                                            <div className="font-medium">{project?.Market || 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Status</div>
                                            <div className="font-medium">{project?.ProjectStatus || 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Probability</div>
                                            <div className="font-medium">{project?.ProjectProbability || 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Project Manager</div>
                                            <div className="font-medium">{project?.ProjectManager || 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Superintendent</div>
                                            <div className="font-medium">{project?.Superintendent || 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Super Id</div>
                                            <div className="font-medium">{project?.SuperId || 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Bid Type</div>
                                            <div className="font-medium">{project?.BidType || 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Project Style</div>
                                            <div className="font-medium">{project?.ProjectStyle || 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Start Date</div>
                                            <div className="font-medium">{project?.StartDate ? new Date(project.StartDate).toLocaleDateString() : 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Projected Completion</div>
                                            <div className="font-medium">{project?.ProjectedFinishDate ? new Date(project.ProjectedFinishDate).toLocaleDateString() : 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Completion Date</div>
                                            <div className="font-medium">{project?.CompletionDate ? new Date(project.CompletionDate).toLocaleDateString() : 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Created At</div>
                                            <div className="font-medium">{project?.CreatedAt ? new Date(project.CreatedAt).toLocaleDateString() : 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Bid Due Date</div>
                                            <div className="font-medium">{project?.BidDueDate ? new Date(project.BidDueDate).toLocaleDateString() : 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Communicated Start Date</div>
                                            <div className="font-medium">{project?.CommunicatedStartDate ? new Date(project.CommunicatedStartDate).toLocaleDateString() : 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Communicated Finish Date</div>
                                            <div className="font-medium">{project?.CommunicatedFinishDate ? new Date(project.CommunicatedFinishDate).toLocaleDateString() : 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Est Start</div>
                                            <div className="font-medium">{project?.EstStart ? new Date(project.EstStart).toLocaleDateString() : 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Est Finish</div>
                                            <div className="font-medium">{project?.EstFinish ? new Date(project.EstFinish).toLocaleDateString() : 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Actual Finish Date</div>
                                            <div className="font-medium">{project?.ActualFinishDate ? new Date(project.ActualFinishDate).toLocaleDateString() : 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Project Review Date</div>
                                            <div className="font-medium">{project?.ProjectReviewDate ? new Date(project.ProjectReviewDate).toLocaleDateString() : 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Estimated Value (USD)</div>
                                            <div className="font-medium">{project?.EstimatedValue ? `$${Number(project.EstimatedValue).toLocaleString()}` : 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Estimated Cost at Completion (USD)</div>
                                            <div className="font-medium">{project?.EstimatedCostAtCompletion ? `$${Number(project.EstimatedCostAtCompletion).toLocaleString()}` : 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Revised Contract Amount (USD)</div>
                                            <div className="font-medium">{project?.ProjectRevisedContractAmount ? `$${Number(project.ProjectRevisedContractAmount).toLocaleString()}` : 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Estimated Project Profit (USD)</div>
                                            <div className="font-medium">{project?.EstimatedProjectProfit ? `$${Number(project.EstimatedProjectProfit).toLocaleString()}` : 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Client Reference Id</div>
                                            <div className="font-medium">{project?.ClientReferenceId || 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Est Duration (days)</div>
                                            <div className="font-medium">{project?.EstDuration || 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Actual Duration (days)</div>
                                            <div className="font-medium">{project?.ActualDuration || 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Profit Center Year</div>
                                            <div className="font-medium">{project?.ProfitCenterYear || 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Square Feet</div>
                                            <div className="font-medium">{project?.SquareFeet ? Number(project.SquareFeet).toLocaleString() : 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Project Conception Year</div>
                                            <div className="font-medium">{project?.ProjectConceptionYear || 'NA'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 dark:text-gray-400">Archived</div>
                                            <div className="font-medium">{project?.Archived ? 'Yes' : 'No'}</div>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}

                    {activeTab === 'tasks' && project && (
                        <div className="space-y-8">
                            <TasksManager entityType="project" entityId={project.id} />
                        </div>
                    )}

                    {activeTab === 'attachments' && project && (
                        <AttachmentsManager entityType="project" entityId={project.id} />
                    )}

                    {activeTab === 'activities' && project && (
                        <ActivitiesTimeline entityType="project" entityId={project.id} />
                    )}

                    {activeTab === 'settings' && project && (
                        <div className="space-y-8">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Settings</h2>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button size="sm" variant="plain" onClick={handleCancel}>Cancel</Button>
                                    <Button size="sm" variant="solid" onClick={saveSettings}>Save Changes</Button>
                                </div>
                            </div>

                            {/* Project Overview Editor */}
                            <Card>
                                <div className="p-6 space-y-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-1 h-6 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Project Overview</h3>
                                    </div>
                                    <div className="prose prose-lg max-w-none dark:prose-invert">
                                        <RichTextEditor 
                                            content={overviewHtml || '<p class="text-gray-500">Describe your project or add notes here</p>'} 
                                            onChange={(content) => {
                                                if (content && content.html) {
                                                    setOverviewHtml(content.html)
                                                } else if (typeof content === 'string') {
                                                    setOverviewHtml(content)
                                                }
                                            }}
                                            editorContentClass="min-h-[400px]"
                                        />
                                    </div>
                                </div>
                            </Card>

                            <Card>
                                <div className="p-6 space-y-6">
                                    {/* Primary */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {fieldNumber('Project Number', 'ProjectNumber')}
                                        {fieldInput('Project Name', 'ProjectName')}
                                        {fieldInput('Address', 'address')}
                                        {fieldInput('City', 'city')}
                                        {fieldInput('State', 'State')}
                                        {fieldInput('ZIP', 'zip')}
                                        {fieldSelect('Market', 'Market', marketOptions)}
                                        {fieldSelect('Project Style', 'ProjectStyle', projectStyleOptions)}
                                        {fieldSelect('Project Manager', 'ProjectManager', projectManagerOptions)}
                                        {fieldSelect('Status', 'ProjectStatus', projectStatusOptions)}
                                        {fieldSelect('Probability', 'ProjectProbability', projectProbabilityOptions)}
                                        {fieldSelect('Super Assigned', 'Superintendent', superintendentOptions)}
                                        {fieldSelect('Bid Type', 'BidType', bidTypeOptions)}
                                        {fieldNumber('Super Id', 'SuperId')}
                                    </div>

                                    {/* Dates */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {fieldDate('Start Date', 'StartDate')}
                                        {fieldDate('Projected Finish', 'ProjectedFinishDate')}
                                        {fieldDate('Completion Date', 'CompletionDate')}
                                        {fieldDate('Created At', 'CreatedAt')}
                                        {fieldDate('Communicated Start', 'CommunicatedStartDate')}
                                        {fieldDate('Communicated Finish', 'CommunicatedFinishDate')}
                                        {fieldDate('Est Start', 'EstStart')}
                                        {fieldDate('Est Finish', 'EstFinish')}
                                        {fieldDate('Actual Finish', 'ActualFinishDate')}
                                        {fieldDate('Bid Due Date', 'BidDueDate')}
                                        {fieldDate('Project Review Date', 'ProjectReviewDate')}
                                    </div>

                                    {/* Numbers / Currency */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {fieldCurrency('Estimated Value (USD)', 'EstimatedValue')}
                                        {fieldCurrency('Estimated Cost at Completion (USD)', 'EstimatedCostAtCompletion')}
                                        {fieldCurrency('Revised Contract Amount (USD)', 'ProjectRevisedContractAmount')}
                                        {fieldCurrency('Estimated Project Profit (USD)', 'EstimatedProjectProfit')}
                                        {fieldNumber('Client Reference Id', 'ClientReferenceId')}
                                        {fieldNumber('Est Duration (days)', 'EstDuration')}
                                        {fieldNumber('Actual Duration (days)', 'ActualDuration')}
                                        {fieldNumber('Profit Center Year', 'ProfitCenterYear')}
                                        {fieldNumber('Square Feet', 'SquareFeet')}
                                    </div>

                                    {/* Misc */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {fieldBool('Archived', 'Archived')}
                                    </div>
                                </div>
                            </Card>
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

export default ProjectDetail
