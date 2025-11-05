import { useMemo, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { Button, Card, Input, Select, Tag, Tooltip, Dialog, DatePicker, Checkbox } from '@/components/ui'
import DataTable from '@/components/shared/DataTable'
import { useProjectsStore } from '@/store/projectsStore'
import ProjectsBulkDataManager from '@/components/ProjectsBulkDataManager'
import { HiOutlineStar, HiOutlineEye, HiOutlinePencil, HiOutlineTrash, HiOutlineUpload, HiOutlinePlus } from 'react-icons/hi'

// Project options
const marketOptions = [
    { value: 'OKC', label: 'OKC' },
    { value: 'ORL', label: 'ORL' },
    { value: 'DFW', label: 'DFW' }
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
    { value: 'Hold', label: 'Hold' }
]

const projectProbabilityOptions = [
    { value: 'Awarded', label: 'Awarded' },
    { value: 'High', label: 'High' },
    { value: 'Low', label: 'Low' }
]

const projectStyleOptions = [
    { value: 'Ground Up', label: 'Ground Up' },
    { value: 'TI', label: 'TI' },
    { value: 'Renovation', label: 'Renovation' }
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
    { value: 'Trey Roberts', label: 'Trey Roberts' }
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
    { value: 'Tony Martin', label: 'Tony Martin' }
]

const bidTypeOptions = [
    { value: 'New Opportunity', label: 'New Opportunity' },
    { value: 'Legacy', label: 'Legacy' }
]

const ProjectsList = () => {
    const navigate = useNavigate()
    const projects = useProjectsStore((s) => s.projects)
    const filters = useProjectsStore((s) => s.filters)
    const loading = useProjectsStore((s) => s.loading)
    const setFilters = useProjectsStore((s) => s.setFilters)
    const loadProjects = useProjectsStore((s) => s.loadProjects)
    const toggleFavorite = useProjectsStore((s) => s.toggleFavorite)
    const deleteProject = useProjectsStore((s) => s.deleteProject)
    const bulkDeleteProjects = useProjectsStore((s) => s.bulkDeleteProjects)
    const addProject = useProjectsStore((s) => s.addProject)

    const [pageIndex, setPageIndex] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [sort, setSort] = useState({ key: '', order: '' })
    const [selectedIds, setSelectedIds] = useState(new Set())
    const [isBulkManagerOpen, setIsBulkManagerOpen] = useState(false)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [wizardStep, setWizardStep] = useState(1)
    
    // Debounce timer refs
    const searchDebounceRef = useRef(null)
    
    // Local search state for immediate UI updates
    const [localSearchValue, setLocalSearchValue] = useState('')
    
    // Column visibility & order persistence
    const defaultProjectKeys = [
        'ProjectNumber',
        'ProjectName',
        'city',
        'ProjectManager',
        'State',
        'Market',
        'ProjectStatus',
        'ProjectProbability',
        'BidDueDate',
        'ProjectRevisedContractAmount',
        'StartDate',
        'ProjectedFinishDate',
        'Superintendent',
        'actions',
    ]
    
    const [columnOrder, setColumnOrder] = useState(() => {
        try {
            const raw = localStorage.getItem('projectsColumnOrder')
            const parsed = raw ? JSON.parse(raw) : null
            if (Array.isArray(parsed) && parsed.length) {
                return parsed
            }
            return defaultProjectKeys
        } catch {
            return defaultProjectKeys
        }
    })
    
    const [visibleColumns, setVisibleColumns] = useState(() => {
        try {
            const raw = localStorage.getItem('projectsVisibleColumns')
            const parsed = raw ? JSON.parse(raw) : null
            if (parsed && typeof parsed === 'object') {
                return parsed
            }
        } catch {}
        return defaultProjectKeys.reduce((acc, key) => ({ ...acc, [key]: true }), {})
    })
    
    // Persist column visibility and order
    useEffect(() => {
        try {
            localStorage.setItem('projectsVisibleColumns', JSON.stringify(visibleColumns))
            localStorage.setItem('projectsColumnOrder', JSON.stringify(columnOrder))
        } catch {}
    }, [visibleColumns, columnOrder])
    
    // UI state for collapsible sections
    const [showMoreFilters, setShowMoreFilters] = useState(false)
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
        onCancel: null
    })
    const [wizardData, setWizardData] = useState({
        ProjectName: '',
        ProjectNumber: '',
        address: '',
        city: '',
        State: '',
        zip: '',
        Market: '',
        ProjectStyle: '',
        ProjectManager: '',
        ProjectStatus: '',
        ProjectProbability: '',
        Superintendent: '',
        SquareFeet: '',
        EstDuration: '',
        StartDate: null,
        CompletionDate: null,
        ProjectedFinishDate: null,
        CommunicatedStartDate: null,
        CommunicatedFinishDate: null,
        BidDueDate: null,
        ProjectRevisedContractAmount: '',
        BidType: '',
    })

    useEffect(() => {
        loadProjects()
    }, [loadProjects])
    
    // Sync local search with filters.search on mount or when filters.search changes externally
    useEffect(() => {
        setLocalSearchValue(filters.search || '')
    }, [filters.search])

    const filteredProjects = useMemo(() => {
        const { search, market, projectStatus, projectProbability, projectManager, superintendent } = filters
        
        return projects
            .filter((project) => {
                if (search) {
                    const term = search.toLowerCase()
                    const hay = `${project.ProjectNumber || ''} ${project.ProjectName || ''} ${project.city || ''} ${project.State || ''} ${project.ProjectManager || ''}`.toLowerCase()
                    if (!hay.includes(term)) return false
                }
                
                // Market filter - handle both single object and array
                if (market) {
                    if (Array.isArray(market)) {
                        if (market.length > 0 && !market.some(m => m.value === project.Market)) return false
                    } else if (market.value) {
                        if (project.Market !== market.value) return false
                    }
                }
                // Status filter - handle both single object and array
                if (projectStatus) {
                    if (Array.isArray(projectStatus)) {
                        if (projectStatus.length > 0 && !projectStatus.some(s => s.value === project.ProjectStatus)) return false
                    } else if (projectStatus.value) {
                        if (project.ProjectStatus !== projectStatus.value) return false
                    }
                }
                // Probability filter - handle both single object and array
                if (projectProbability) {
                    if (Array.isArray(projectProbability)) {
                        if (projectProbability.length > 0 && !projectProbability.some(p => p.value === project.ProjectProbability)) return false
                    } else if (projectProbability.value) {
                        if (project.ProjectProbability !== projectProbability.value) return false
                    }
                }
                // PM filter - handle both single object and array
                if (projectManager) {
                    if (Array.isArray(projectManager)) {
                        if (projectManager.length > 0 && !projectManager.some(pm => pm.value === project.ProjectManager)) return false
                    } else if (projectManager.value) {
                        if (project.ProjectManager !== projectManager.value) return false
                    }
                }
                // Super Assigned filter - handle both single object and array
                if (superintendent) {
                    if (Array.isArray(superintendent)) {
                        if (superintendent.length > 0 && !superintendent.some(s => s.value === project.Superintendent)) return false
                    } else if (superintendent.value) {
                        if (project.Superintendent !== superintendent.value) return false
                    }
                }
                
                return true
            })
            .sort((a, b) => {
                if (a.favorite && !b.favorite) return -1
                if (!a.favorite && b.favorite) return 1
                
                const { key, order } = sort
                if (!key || !order) return 0
                const dir = order === 'asc' ? 1 : -1
                const av = a[key]
                const bv = b[key]
                if (av === bv) return 0
                return av > bv ? dir : -dir
            })
    }, [projects, filters, sort])
    
    // Clear all filters function
    const handleClearAllFilters = () => {
        setPageIndex(1)
        setFilters({
            search: '',
            market: null,
            projectStatus: null,
            projectProbability: null,
            projectManager: null,
            superintendent: null,
        })
        setLocalSearchValue('')
    }

    const pageTotal = filteredProjects.length
    const pageStart = (pageIndex - 1) * pageSize
    const pageEnd = pageStart + pageSize
    const pageData = filteredProjects.slice(pageStart, pageEnd)

    const statusColor = (value) => {
        const colors = {
            'Complete': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100',
            'Course of Construction': 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-100',
            'Not Awarded': 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-100',
            'Pre-Construction': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-100',
            'Warranty': 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-100',
            'Bidding': 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-100',
            'Pending': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-100',
            'Post Construction': 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-100',
            'Hold': 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-100'
        }
        return colors[value] || 'bg-gray-100 text-gray-700'
    }

    const probabilityColor = (value) => {
        const colors = {
            'Awarded': 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-100',
            'High': 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-100',
            'Low': 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-100'
        }
        return colors[value] || 'bg-gray-100 text-gray-700'
    }

    const formatCurrency = (value) => {
        if (!value) return '-'
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value)
    }

    const formatDate = (date) => {
        if (!date) return '-'
        if (date instanceof Date) return date.toISOString().slice(0, 10)
        if (typeof date === 'string') {
            const d = new Date(date)
            return isNaN(d.getTime()) ? date : d.toISOString().slice(0, 10)
        }
        if (date?.seconds) {
            const d = new Date(date.seconds * 1000)
            return d.toISOString().slice(0, 10)
        }
        return String(date)
    }

    const showConfirmDialog = (title, message, onConfirm, onCancel = null) => {
        setConfirmDialog({
            isOpen: true,
            title,
            message,
            onConfirm: () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }))
                onConfirm()
            },
            onCancel: () => {
                setConfirmDialog(prev => ({ ...prev, isOpen: false }))
                onCancel?.()
            }
        })
    }

    const handleDeleteProject = (id) => {
        showConfirmDialog(
            'Delete Project',
            'Are you sure you want to delete this project? This action cannot be undone.',
            async () => {
                try {
                    await deleteProject(id)
                } catch (error) {
                    console.error('Error deleting project:', error)
                }
            }
        )
    }

    const handleBulkDelete = async () => {
        if (!selectedIds.size) {
            alert('No projects selected')
            return
        }
        showConfirmDialog(
            'Delete Selected Projects',
            `Delete ${selectedIds.size} selected project(s)? This cannot be undone.`,
            async () => {
                try {
                    const ids = Array.from(selectedIds)
                    console.log('Deleting projects:', ids)
                    await bulkDeleteProjects(ids)
                    setSelectedIds(new Set())
                } catch (error) {
                    console.error('Bulk delete error:', error)
                    alert('Failed to delete projects. Please try again.')
                }
            }
        )
    }

    const handleProjectNameClick = (e, projectId) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            window.open(`/projects/${projectId}?tab=settings`, '_blank')
        } else {
            navigate(`/projects/${projectId}?tab=settings`)
        }
    }

    const checkboxChecked = (row) => selectedIds.has(row.id)
    const indeterminateCheckboxChecked = (rows) => {
        // rows here are TanStack Table row objects
        if (!rows?.length) return false
        const selectedCount = rows.filter((r) => {
            const id = r.original?.id
            return id !== undefined && id !== null && selectedIds.has(id)
        }).length
        // Return true if all rows in the current page are selected
        return selectedCount === rows.length
    }

    const handleRowSelectChange = (checked, row) => {
        // row here is the original data object
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (checked) next.add(row.id)
            else next.delete(row.id)
            return next
        })
    }

    const handleSelectAllChange = (checked, rows) => {
        // rows here are TanStack Table row objects, need to extract original data
        setSelectedIds((prev) => {
            const next = new Set(prev)
            rows.forEach((r) => {
                const id = r.original?.id
                if (id === undefined || id === null) return
                if (checked) next.add(id)
                else next.delete(id)
            })
            return next
        })
    }

    // Wizard handlers
    const nextWizardStep = () => {
        if (wizardStep < 3) {
            setWizardStep(prev => prev + 1)
        }
    }
    
    const prevWizardStep = () => {
        if (wizardStep > 1) {
            setWizardStep(prev => prev - 1)
        }
    }
    
    const resetWizard = () => {
        setWizardStep(1)
        setWizardData({
            ProjectName: '',
            ProjectNumber: '',
            address: '',
            city: '',
            State: '',
            zip: '',
            Market: '',
            ProjectStyle: '',
            ProjectManager: '',
            ProjectStatus: '',
            ProjectProbability: '',
            Superintendent: '',
            SquareFeet: '',
            EstDuration: '',
            StartDate: null,
            CompletionDate: null,
            ProjectedFinishDate: null,
            CommunicatedStartDate: null,
            CommunicatedFinishDate: null,
            BidDueDate: null,
            ProjectRevisedContractAmount: '',
            BidType: '',
        })
    }

    const handleCreateProject = async () => {
        if (!wizardData.ProjectName.trim()) {
            alert('Project Name is required')
            return
        }
        
        try {
            const payload = {
                ProjectName: wizardData.ProjectName,
                ProjectNumber: wizardData.ProjectNumber ? parseFloat(wizardData.ProjectNumber) : null,
                address: wizardData.address || '',
                city: wizardData.city || '',
                State: wizardData.State || '',
                zip: wizardData.zip || '',
                Market: wizardData.Market || '',
                ProjectStyle: wizardData.ProjectStyle || '',
                ProjectManager: wizardData.ProjectManager || '',
                ProjectStatus: wizardData.ProjectStatus || '',
                ProjectProbability: wizardData.ProjectProbability || '',
                Superintendent: wizardData.Superintendent || '',
                SquareFeet: wizardData.SquareFeet ? parseFloat(wizardData.SquareFeet) : null,
                EstDuration: wizardData.EstDuration ? parseFloat(wizardData.EstDuration) : null,
                StartDate: wizardData.StartDate ? (wizardData.StartDate instanceof Date ? wizardData.StartDate.toISOString() : wizardData.StartDate) : null,
                CompletionDate: wizardData.CompletionDate ? (wizardData.CompletionDate instanceof Date ? wizardData.CompletionDate.toISOString() : wizardData.CompletionDate) : null,
                ProjectedFinishDate: wizardData.ProjectedFinishDate ? (wizardData.ProjectedFinishDate instanceof Date ? wizardData.ProjectedFinishDate.toISOString() : wizardData.ProjectedFinishDate) : null,
                CommunicatedStartDate: wizardData.CommunicatedStartDate ? (wizardData.CommunicatedStartDate instanceof Date ? wizardData.CommunicatedStartDate.toISOString() : wizardData.CommunicatedStartDate) : null,
                CommunicatedFinishDate: wizardData.CommunicatedFinishDate ? (wizardData.CommunicatedFinishDate instanceof Date ? wizardData.CommunicatedFinishDate.toISOString() : wizardData.CommunicatedFinishDate) : null,
                BidDueDate: wizardData.BidDueDate ? (wizardData.BidDueDate instanceof Date ? wizardData.BidDueDate.toISOString() : wizardData.BidDueDate) : null,
                ProjectRevisedContractAmount: wizardData.ProjectRevisedContractAmount ? parseFloat(wizardData.ProjectRevisedContractAmount.replace(/[^0-9.]/g, '')) : null,
                BidType: wizardData.BidType || '',
                favorite: false,
            }
            await addProject(payload)
            resetWizard()
            setIsCreateOpen(false)
        } catch (error) {
            console.error('Error creating project:', error)
        }
    }

    const allColumns = useMemo(() => [
        {
            header: 'Project Number',
            accessorKey: 'ProjectNumber',
            size: 120,
            meta: { key: 'ProjectNumber' },
            cell: (props) => {
                const value = props.row.original.ProjectNumber
                return <span>{value || '-'}</span>
            },
        },
        {
            header: 'Project',
            accessorKey: 'ProjectName',
            size: 250,
            meta: { key: 'ProjectName' },
            cell: (props) => {
                const item = props.row.original
                const projectName = item.ProjectName || '-'
                return (
                    <Tooltip title={projectName}>
                        <button 
                            onClick={(e) => handleProjectNameClick(e, item.id)}
                            className="font-semibold text-left hover:text-primary transition-colors block max-w-[250px] truncate"
                        >
                            {projectName}
                        </button>
                    </Tooltip>
                )
            },
        },
        {
            header: 'City',
            accessorKey: 'city',
            size: 120,
            meta: { key: 'city' },
            cell: (props) => <span>{props.row.original.city || '-'}</span>,
        },
        {
            header: 'PM',
            accessorKey: 'ProjectManager',
            size: 150,
            meta: { key: 'ProjectManager' },
            cell: (props) => {
                const value = props.row.original.ProjectManager || '-'
                return (
                    <Tooltip title={value}>
                        <span className="block max-w-[150px] truncate">{value}</span>
                    </Tooltip>
                )
            },
        },
        {
            header: 'State',
            accessorKey: 'State',
            size: 80,
            meta: { key: 'State' },
            cell: (props) => <span>{props.row.original.State || '-'}</span>,
        },
        {
            header: 'Market',
            accessorKey: 'Market',
            size: 80,
            meta: { key: 'Market' },
            cell: (props) => {
                const val = props.row.original.Market
                const opt = marketOptions.find((o) => o.value === val)
                return <span>{opt ? opt.label : val || '-'}</span>
            },
        },
        {
            header: 'Status',
            accessorKey: 'ProjectStatus',
            size: 140,
            meta: { key: 'ProjectStatus' },
            cell: (props) => {
                const val = props.row.original.ProjectStatus
                if (!val) return <span>-</span>
                return <Tag className={statusColor(val)}>{val}</Tag>
            },
        },
        {
            header: 'Project Probability',
            accessorKey: 'ProjectProbability',
            size: 110,
            meta: { key: 'ProjectProbability' },
            cell: (props) => {
                const val = props.row.original.ProjectProbability
                if (!val) return <span>-</span>
                return <Tag className={probabilityColor(val)}>{val}</Tag>
            },
        },
        {
            header: 'Bid Due Date',
            accessorKey: 'BidDueDate',
            size: 140,
            meta: { key: 'BidDueDate' },
            cell: (props) => <span className="whitespace-nowrap">{formatDate(props.row.original.BidDueDate)}</span>,
        },
        {
            header: 'Contract Amount',
            accessorKey: 'ProjectRevisedContractAmount',
            size: 130,
            meta: { key: 'ProjectRevisedContractAmount' },
            cell: (props) => <span>{formatCurrency(props.row.original.ProjectRevisedContractAmount)}</span>,
        },
        {
            header: 'Start Date',
            accessorKey: 'StartDate',
            size: 140,
            meta: { key: 'StartDate' },
            cell: (props) => <span className="whitespace-nowrap">{formatDate(props.row.original.StartDate)}</span>,
        },
        {
            header: 'Projected Completion',
            accessorKey: 'ProjectedFinishDate',
            size: 130,
            meta: { key: 'ProjectedFinishDate' },
            cell: (props) => <span>{formatDate(props.row.original.ProjectedFinishDate)}</span>,
        },
        {
            header: 'Super Assigned',
            accessorKey: 'Superintendent',
            size: 140,
            meta: { key: 'Superintendent' },
            cell: (props) => {
                const value = props.row.original.Superintendent || '-'
                return (
                    <Tooltip title={value}>
                        <span className="block max-w-[140px] truncate">{value}</span>
                    </Tooltip>
                )
            },
        },
        {
            header: 'Actions',
            id: 'actions',
            size: 160,
            meta: { key: 'actions' },
            cell: (props) => {
                const item = props.row.original
                return (
                    <div className="flex items-center gap-2">
                        <Tooltip title="View">
                            <Button size="sm" variant="twoTone" icon={<HiOutlineEye />} onClick={() => navigate(`/projects/${item.id}`)} />
                        </Tooltip>
                        <Tooltip title="Edit">
                            <Button size="sm" variant="twoTone" icon={<HiOutlinePencil />} onClick={() => navigate(`/projects/${item.id}?tab=settings`)} />
                        </Tooltip>
                        <Tooltip title={item.favorite ? 'Remove from favorites' : 'Add to favorites'}>
                            <Button size="sm" variant={item.favorite ? 'solid' : 'twoTone'} icon={<HiOutlineStar />} onClick={() => toggleFavorite(item.id)} className={item.favorite ? 'text-yellow-500' : ''} />
                        </Tooltip>
                        <Tooltip title="Delete">
                            <Button size="sm" variant="twoTone" icon={<HiOutlineTrash />} onClick={() => handleDeleteProject(item.id)} className="text-red-600 hover:text-red-700" />
                        </Tooltip>
                    </div>
                )
            },
        },
    ], [navigate, toggleFavorite])
    
    // Filter and order columns based on visibility and order settings
    const columns = useMemo(() => {
        // Create a map of all columns by their meta key
        const columnsMap = new Map()
        allColumns.forEach(col => {
            const key = col.meta?.key || col.accessorKey || col.id
            columnsMap.set(key, col)
        })
        
        // Filter visible columns and order them according to columnOrder
        const orderedColumns = columnOrder
            .filter(key => visibleColumns[key] !== false)
            .map(key => columnsMap.get(key))
            .filter(Boolean)
        
        return orderedColumns
    }, [allColumns, columnOrder, visibleColumns])

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Master Tracker</h1>
                <div className="flex items-center gap-2">
                    <Button
                        variant="twoTone"
                        icon={<HiOutlinePlus />}
                        onClick={() => {
                            resetWizard()
                            setIsCreateOpen(true)
                        }}
                    >
                        Create Project
                    </Button>
                    <Button
                        variant="solid"
                        icon={<HiOutlineUpload />}
                        onClick={() => setIsBulkManagerOpen(true)}
                    >
                        Bulk Import / Export
                    </Button>
                </div>
            </div>

            <Card>
                <div className="p-6 space-y-4">
                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                        <Input
                            placeholder="Search by Project Number, Name, City, State, PM..."
                            value={localSearchValue}
                            onChange={(e) => {
                                const value = e.target.value
                                // Update local state immediately for smooth typing
                                setLocalSearchValue(value)
                                
                                // Debounce the actual filter application
                                if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
                                searchDebounceRef.current = setTimeout(() => {
                                    setPageIndex(1)
                                    setFilters({ search: value })
                                }, 300)
                            }}
                        />
                        <Select
                            placeholder="Market"
                            isClearable
                            isMulti
                            options={marketOptions}
                            value={Array.isArray(filters.market) ? filters.market : (filters.market ? [filters.market] : null)}
                            onChange={(opt) => {
                                setPageIndex(1)
                                setFilters({ market: opt && opt.length > 0 ? opt : null })
                            }}
                        />
                        <Select
                            placeholder="Status"
                            isClearable
                            isMulti
                            options={projectStatusOptions}
                            value={Array.isArray(filters.projectStatus) ? filters.projectStatus : (filters.projectStatus ? [filters.projectStatus] : null)}
                            onChange={(opt) => {
                                setPageIndex(1)
                                setFilters({ projectStatus: opt && opt.length > 0 ? opt : null })
                            }}
                        />
                        <Select
                            placeholder="Probability"
                            isClearable
                            isMulti
                            options={projectProbabilityOptions}
                            value={Array.isArray(filters.projectProbability) ? filters.projectProbability : (filters.projectProbability ? [filters.projectProbability] : null)}
                            onChange={(opt) => {
                                setPageIndex(1)
                                setFilters({ projectProbability: opt && opt.length > 0 ? opt : null })
                            }}
                        />
                        <Select
                            placeholder="PM"
                            isClearable
                            isMulti
                            options={projectManagerOptions}
                            value={Array.isArray(filters.projectManager) ? filters.projectManager : (filters.projectManager ? [filters.projectManager] : null)}
                            onChange={(opt) => {
                                setPageIndex(1)
                                setFilters({ projectManager: opt && opt.length > 0 ? opt : null })
                            }}
                        />
                        <Select
                            placeholder="Super Assigned"
                            isClearable
                            isMulti
                            options={superintendentOptions}
                            value={Array.isArray(filters.superintendent) ? filters.superintendent : (filters.superintendent ? [filters.superintendent] : null)}
                            onChange={(opt) => {
                                setPageIndex(1)
                                setFilters({ superintendent: opt && opt.length > 0 ? opt : null })
                            }}
                        />
                    </div>
                    
                    {/* Clear All Filters Button */}
                    {(filters.search || 
                        (filters.market && (Array.isArray(filters.market) ? filters.market.length > 0 : filters.market.value)) ||
                        (filters.projectStatus && (Array.isArray(filters.projectStatus) ? filters.projectStatus.length > 0 : filters.projectStatus.value)) ||
                        (filters.projectProbability && (Array.isArray(filters.projectProbability) ? filters.projectProbability.length > 0 : filters.projectProbability.value)) ||
                        (filters.projectManager && (Array.isArray(filters.projectManager) ? filters.projectManager.length > 0 : filters.projectManager.value)) ||
                        (filters.superintendent && (Array.isArray(filters.superintendent) ? filters.superintendent.length > 0 : filters.superintendent.value))) && (
                        <div className="flex justify-end">
                            <Button 
                                size="sm" 
                                variant="twoTone"
                                onClick={handleClearAllFilters}
                            >
                                Clear All Filters
                            </Button>
                        </div>
                    )}
                    
                    {/* Collapsible advanced filters */}
                    {showMoreFilters && (
                        <div className="mt-4 space-y-4">
                            {/* Column visibility & order controls */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card className="p-4">
                                    <h6 className="font-semibold mb-3 flex items-center gap-2">
                                        Column Visibility
                                        <Tag className="text-xs">Project columns</Tag>
                                    </h6>
                                    <div className="grid grid-cols-2 gap-2">
                                        {defaultProjectKeys.map((key) => (
                                            <label key={key} className="flex items-center gap-2 text-sm">
                                                <Checkbox
                                                    checked={visibleColumns[key] !== false}
                                                    onChange={(checked) => {
                                                        setVisibleColumns((prev) => ({ ...prev, [key]: Boolean(checked) }))
                                                    }}
                                                />
                                                <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                            </label>
                                        ))}
                                    </div>
                                </Card>
                                <Card className="p-4">
                                    <h6 className="font-semibold mb-3 flex items-center gap-2">
                                        Column Order
                                        <Tag className="text-xs">Project columns</Tag>
                                    </h6>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {columnOrder.map((key, idx) => (
                                            <div key={key} className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                                <span className="capitalize flex-1">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                <div className="flex items-center gap-1">
                                                    <Button 
                                                        size="sm" 
                                                        variant="twoTone"
                                                        disabled={idx === 0}
                                                        onClick={() => {
                                                            if (idx === 0) return
                                                            const next = [...columnOrder]
                                                            ;[next[idx-1], next[idx]] = [next[idx], next[idx-1]]
                                                            setColumnOrder(next)
                                                        }}
                                                    >↑</Button>
                                                    <Button 
                                                        size="sm" 
                                                        variant="twoTone"
                                                        disabled={idx === columnOrder.length - 1}
                                                        onClick={() => {
                                                            if (idx === columnOrder.length - 1) return
                                                            const next = [...columnOrder]
                                                            ;[next[idx+1], next[idx]] = [next[idx], next[idx+1]]
                                                            setColumnOrder(next)
                                                        }}
                                                    >↓</Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}

                    {/* Bulk Actions */}
                    {selectedIds.size > 0 && (
                        <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <span className="text-sm font-medium">{selectedIds.size} selected</span>
                            <Button size="sm" variant="twoTone" onClick={handleBulkDelete} className="text-red-600">
                                Delete Selected
                            </Button>
                        </div>
                    )}

                    <DataTable
                        columns={columns}
                        data={pageData}
                        loading={loading}
                        pagingData={{ total: pageTotal, pageIndex, pageSize }}
                        onPaginationChange={(pi) => setPageIndex(pi)}
                        onSelectChange={(ps) => {
                            setPageIndex(1)
                            setPageSize(ps)
                        }}
                        onSort={({ key, order }) => setSort({ key, order })}
                        selectable
                        checkboxChecked={(row) => checkboxChecked(row)}
                        indeterminateCheckboxChecked={(rows) => indeterminateCheckboxChecked(rows)}
                        onCheckBoxChange={(checked, row) => handleRowSelectChange(checked, row)}
                        onIndeterminateCheckBoxChange={(checked, rows) => handleSelectAllChange(checked, rows)}
                        className="card"
                        rowClassName={(row) => {
                            // row here is the original data object
                            return checkboxChecked(row) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }}
                    />
                </div>
            </Card>

            {/* Bulk Data Manager */}
            <ProjectsBulkDataManager 
                isOpen={isBulkManagerOpen}
                onClose={() => setIsBulkManagerOpen(false)}
            />

            {/* Multi-Step Create Project Wizard */}
            <Dialog isOpen={isCreateOpen} onClose={() => { setIsCreateOpen(false); resetWizard(); }} width={800}>
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h5 className="text-xl font-semibold">Create Project</h5>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">Step {wizardStep} of 3</span>
                            <div className="flex gap-1">
                                {Array.from({ length: 3 }, (_, i) => i + 1).map((step) => (
                                    <div
                                        key={step}
                                        className={`w-2 h-2 rounded-full ${
                                            step <= wizardStep ? 'bg-blue-500' : 'bg-gray-300'
                                        }`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    {/* Step 1: Basic Information */}
                    {wizardStep === 1 && (
                        <div className="space-y-4">
                            <h6 className="text-lg font-medium text-gray-700 dark:text-gray-300">Basic Information</h6>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Project Name *</label>
                                    <Input 
                                        value={wizardData.ProjectName} 
                                        onChange={(e) => setWizardData({ ...wizardData, ProjectName: e.target.value })} 
                                        placeholder="Enter project name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Project Number</label>
                                    <Input 
                                        value={wizardData.ProjectNumber} 
                                        onChange={(e) => setWizardData({ ...wizardData, ProjectNumber: e.target.value.replace(/[^0-9.]/g, '') })} 
                                        placeholder="Enter project number"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Address</label>
                                    <Input 
                                        value={wizardData.address} 
                                        onChange={(e) => setWizardData({ ...wizardData, address: e.target.value })} 
                                        placeholder="Enter address"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">City</label>
                                    <Input 
                                        value={wizardData.city} 
                                        onChange={(e) => setWizardData({ ...wizardData, city: e.target.value })} 
                                        placeholder="Enter city"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">State</label>
                                    <Input 
                                        value={wizardData.State} 
                                        onChange={(e) => setWizardData({ ...wizardData, State: e.target.value })} 
                                        placeholder="Enter state"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Zip</label>
                                    <Input 
                                        value={wizardData.zip} 
                                        onChange={(e) => setWizardData({ ...wizardData, zip: e.target.value })} 
                                        placeholder="Enter ZIP code"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Market</label>
                                    <Select
                                        options={marketOptions}
                                        value={marketOptions.find((o) => o.value === wizardData.Market) || null}
                                        onChange={(opt) => setWizardData({ ...wizardData, Market: opt?.value || '' })}
                                        placeholder="Select market"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Project Style</label>
                                    <Select
                                        options={projectStyleOptions}
                                        value={projectStyleOptions.find((o) => o.value === wizardData.ProjectStyle) || null}
                                        onChange={(opt) => setWizardData({ ...wizardData, ProjectStyle: opt?.value || '' })}
                                        placeholder="Select project style"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Step 2: Project Details */}
                    {wizardStep === 2 && (
                        <div className="space-y-4">
                            <h6 className="text-lg font-medium text-gray-700 dark:text-gray-300">Project Details</h6>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Project Manager</label>
                                    <Select
                                        options={projectManagerOptions}
                                        value={projectManagerOptions.find((o) => o.value === wizardData.ProjectManager) || null}
                                        onChange={(opt) => setWizardData({ ...wizardData, ProjectManager: opt?.value || '' })}
                                        placeholder="Select project manager"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Status</label>
                                    <Select
                                        options={projectStatusOptions}
                                        value={projectStatusOptions.find((o) => o.value === wizardData.ProjectStatus) || null}
                                        onChange={(opt) => setWizardData({ ...wizardData, ProjectStatus: opt?.value || '' })}
                                        placeholder="Select status"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Probability</label>
                                    <Select
                                        options={projectProbabilityOptions}
                                        value={projectProbabilityOptions.find((o) => o.value === wizardData.ProjectProbability) || null}
                                        onChange={(opt) => setWizardData({ ...wizardData, ProjectProbability: opt?.value || '' })}
                                        placeholder="Select probability"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Super Assigned</label>
                                    <Select
                                        options={superintendentOptions}
                                        value={superintendentOptions.find((o) => o.value === wizardData.Superintendent) || null}
                                        onChange={(opt) => setWizardData({ ...wizardData, Superintendent: opt?.value || '' })}
                                        placeholder="Select superintendent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Square Footage</label>
                                    <Input 
                                        value={wizardData.SquareFeet} 
                                        onChange={(e) => setWizardData({ ...wizardData, SquareFeet: e.target.value.replace(/[^0-9.]/g, '') })} 
                                        placeholder="Enter square footage"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Estimated Duration</label>
                                    <Input 
                                        value={wizardData.EstDuration} 
                                        onChange={(e) => setWizardData({ ...wizardData, EstDuration: e.target.value.replace(/[^0-9.]/g, '') })} 
                                        placeholder="Enter duration (days)"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Step 3: Dates and Financial */}
                    {wizardStep === 3 && (
                        <div className="space-y-4">
                            <h6 className="text-lg font-medium text-gray-700 dark:text-gray-300">Dates and Financial Information</h6>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Contracted Start Date</label>
                                    <DatePicker 
                                        value={wizardData.StartDate ? (wizardData.StartDate instanceof Date ? wizardData.StartDate : new Date(wizardData.StartDate)) : null} 
                                        onChange={(d) => setWizardData({ ...wizardData, StartDate: d })} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Contracted Finish Date</label>
                                    <DatePicker 
                                        value={wizardData.CompletionDate ? (wizardData.CompletionDate instanceof Date ? wizardData.CompletionDate : new Date(wizardData.CompletionDate)) : null} 
                                        onChange={(d) => setWizardData({ ...wizardData, CompletionDate: d })} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Communicated Start Date</label>
                                    <DatePicker 
                                        value={wizardData.CommunicatedStartDate ? (wizardData.CommunicatedStartDate instanceof Date ? wizardData.CommunicatedStartDate : new Date(wizardData.CommunicatedStartDate)) : null} 
                                        onChange={(d) => setWizardData({ ...wizardData, CommunicatedStartDate: d })} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Communicated Finish Date</label>
                                    <DatePicker 
                                        value={wizardData.CommunicatedFinishDate ? (wizardData.CommunicatedFinishDate instanceof Date ? wizardData.CommunicatedFinishDate : new Date(wizardData.CommunicatedFinishDate)) : null} 
                                        onChange={(d) => setWizardData({ ...wizardData, CommunicatedFinishDate: d })} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Projected Finish Date</label>
                                    <DatePicker 
                                        value={wizardData.ProjectedFinishDate ? (wizardData.ProjectedFinishDate instanceof Date ? wizardData.ProjectedFinishDate : new Date(wizardData.ProjectedFinishDate)) : null} 
                                        onChange={(d) => setWizardData({ ...wizardData, ProjectedFinishDate: d })} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Bid Due Date</label>
                                    <DatePicker 
                                        value={wizardData.BidDueDate ? (wizardData.BidDueDate instanceof Date ? wizardData.BidDueDate : new Date(wizardData.BidDueDate)) : null} 
                                        onChange={(d) => setWizardData({ ...wizardData, BidDueDate: d })} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Contract Amount (USD)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                                        <Input 
                                            className="pl-8"
                                            value={wizardData.ProjectRevisedContractAmount} 
                                            onChange={(e) => {
                                                const value = e.target.value.replace(/[^0-9.]/g, '')
                                                setWizardData({ ...wizardData, ProjectRevisedContractAmount: value })
                                            }} 
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Bid Type</label>
                                    <Select
                                        options={bidTypeOptions}
                                        value={bidTypeOptions.find((o) => o.value === wizardData.BidType) || null}
                                        onChange={(opt) => setWizardData({ ...wizardData, BidType: opt?.value || '' })}
                                        placeholder="Select bid type"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Navigation buttons */}
                    <div className="flex justify-between mt-8">
                        <div>
                            {wizardStep > 1 && (
                                <Button variant="twoTone" onClick={prevWizardStep}>
                                    ← Previous
                                </Button>
                            )}
                        </div>
                        
                        <div className="flex gap-2">
                            <Button variant="twoTone" onClick={() => { setIsCreateOpen(false); resetWizard(); }}>
                                Cancel
                            </Button>
                            {wizardStep < 3 ? (
                                <Button 
                                    variant="solid" 
                                    onClick={nextWizardStep} 
                                    disabled={!wizardData.ProjectName.trim()}
                                >
                                    Next →
                                </Button>
                            ) : (
                                <Button 
                                    variant="solid" 
                                    onClick={handleCreateProject} 
                                    disabled={!wizardData.ProjectName.trim()}
                                >
                                    Create Project
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </Dialog>

            {/* Confirmation Dialog */}
            {confirmDialog.isOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', maxWidth: '400px', width: '100%', margin: '20px' }} className="dark:bg-gray-800">
                        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">{confirmDialog.title}</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">{confirmDialog.message}</p>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="twoTone"
                                onClick={confirmDialog.onCancel}
                            >
                                Cancel
                            </Button>
                            <Button 
                                variant="solid" 
                                onClick={confirmDialog.onConfirm}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                Confirm
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ProjectsList

