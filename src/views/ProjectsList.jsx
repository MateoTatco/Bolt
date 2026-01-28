import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Button, Card, Input, Select, Tag, Tooltip, Dialog, DatePicker, Checkbox, Dropdown } from '@/components/ui'
import DataTable from '@/components/shared/DataTable'
import { useProjectsStore } from '@/store/projectsStore'
import ProjectsBulkDataManager from '@/components/ProjectsBulkDataManager'
import { HiOutlineStar, HiOutlineEye, HiOutlinePencil, HiOutlineTrash, HiOutlineUpload, HiOutlinePlus, HiOutlineDotsHorizontal, HiOutlineRefresh } from 'react-icons/hi'
import { getAuth } from 'firebase/auth'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { components } from 'react-select'
import { generateUniqueProjectNumber } from '@/utils/projectNumberGenerator'

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

const archivedOptions = [
    { value: false, label: 'Not Archived' },
    { value: true, label: 'Archived' }
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

// Custom ValueContainer to show selected value or count badge
const CustomValueContainer = ({ children, ...props }) => {
    const { getValue, selectProps } = props
    const selected = getValue()
    const hasValue = selected && selected.length > 0
    
    // Filter out placeholder when there's a value
    const childrenArray = React.Children.toArray(children)
    const filteredChildren = hasValue 
        ? childrenArray.filter(child => {
            // Remove placeholder element when value exists
            if (React.isValidElement(child) && child.props && child.props.className) {
                return !child.props.className.includes('select-placeholder')
            }
            return true
        })
        : childrenArray
    
    if (selectProps.isMulti && hasValue) {
        // Get input and indicators (usually the last 2 children)
        const input = filteredChildren[filteredChildren.length - 2]
        const indicators = filteredChildren[filteredChildren.length - 1]
        
        if (selected.length === 1) {
            // Single selection - show the value name
            return (
                <div className="select-value-container" style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', overflow: 'hidden', minHeight: '38px', maxHeight: '38px' }}>
                    <div className="select-single-value" style={{ 
                        flex: '1 1 auto',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        paddingRight: '8px'
                    }}>
                        {selected[0].label}
                    </div>
                    {input}
                    {indicators}
                </div>
            )
        } else {
            // Multiple selections - show count badge
            return (
                <div className="select-value-container" style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', overflow: 'hidden', minHeight: '38px', maxHeight: '38px' }}>
                    <div className="select-single-value" style={{ 
                        flex: '1 1 auto',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        paddingRight: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}>
                        <span>{selected.length} selected</span>
                        <span className="px-1.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 rounded">
                            {selected.length}
                        </span>
                    </div>
                    {input}
                    {indicators}
                </div>
            )
        }
    }
    
    // Default behavior for no selection
    return <div className="select-value-container">{filteredChildren}</div>
}

// Custom MultiValue component to hide multi-value tags
const CustomMultiValue = () => {
    return null
}

// Custom MenuList to pin selected items to top
const CustomMenuList = (props) => {
    const { children, selectProps, ...rest } = props
    const selected = selectProps.value || []
    const selectedValues = Array.isArray(selected) ? selected.map(s => s.value) : []
    
    // Separate selected and unselected options
    const childrenArray = React.Children.toArray(children)
    const selectedOptions = []
    const unselectedOptions = []
    
    childrenArray.forEach((child) => {
        if (React.isValidElement(child) && child.props) {
            const optionValue = child.props.data?.value
            if (optionValue && selectedValues.includes(optionValue)) {
                selectedOptions.push(child)
            } else {
                unselectedOptions.push(child)
            }
        } else {
            unselectedOptions.push(child)
        }
    })
    
    // Use default MenuList component but with sorted children
    if (selectedOptions.length > 0 && unselectedOptions.length > 0) {
        // Add separator between selected and unselected
        const separator = (
            <div 
                key="separator" 
                className="border-t border-gray-200 dark:border-gray-700 my-1"
            />
        )
        const sortedChildren = [
            ...selectedOptions,
            separator,
            ...unselectedOptions
        ]
        return <components.MenuList {...rest} selectProps={selectProps}>{sortedChildren}</components.MenuList>
    }
    
    return <components.MenuList {...rest} selectProps={selectProps}>{children}</components.MenuList>
}

// Custom Option with checkmark
const CustomOption = (props) => {
    const { innerProps, label, isSelected, isDisabled, data } = props
    
    return (
        <div
            className={`
                select-option
                ${!isDisabled && !isSelected && 'hover:text-gray-800 dark:hover:text-gray-100'}
                ${isSelected && 'text-primary bg-primary-subtle'}
                ${isDisabled && 'opacity-50 cursor-not-allowed'}
            `}
            {...innerProps}
        >
            <span className="ml-2 flex-1">{label}</span>
            {isSelected && (
                <span className="text-primary text-lg">✓</span>
            )}
        </div>
    )
}

// Custom Placeholder that hides when there's a value
const CustomPlaceholder = (props) => {
    const { selectProps } = props
    const hasValue = selectProps.value && (Array.isArray(selectProps.value) ? selectProps.value.length > 0 : true)
    
    if (hasValue) {
        return null
    }
    
    return <components.Placeholder {...props} />
}

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
    const syncAllFromProcore = useProjectsStore((s) => s.syncAllFromProcore)
    
    // Z-index fix for Select dropdowns to appear above sticky headers
    const selectZIndexStyles = {
        menuPortal: (provided) => ({ ...provided, zIndex: 9999 }),
        menu: (provided) => ({ ...provided, zIndex: 9999 }),
    }

    const [pageIndex, setPageIndex] = useState(1)
    const [pageSize, setPageSize] = useState(100)
    const [sort, setSort] = useState({ key: '', order: '' })
    const [selectedIds, setSelectedIds] = useState(new Set())
    const [isBulkManagerOpen, setIsBulkManagerOpen] = useState(false)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [wizardStep, setWizardStep] = useState(1)
    
    // Debounce timer refs
    const searchDebounceRef = useRef(null)
    const tableScrollRef = useRef(null)
    const topScrollbarRef = useRef(null)
    const filtersCardRef = useRef(null)
    
    // Local search state for immediate UI updates
    const [localSearchValue, setLocalSearchValue] = useState('')
    
    // Optimized search handler with useCallback to prevent re-renders
    const handleSearchChange = useCallback((e) => {
        const value = e.target.value
        // Update UI immediately for responsive feel
        setLocalSearchValue(value)
        // Debounce the actual filter update
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
        searchDebounceRef.current = setTimeout(() => {
            setPageIndex(1)
            setFilters({ search: value })
        }, 150)
    }, [setFilters])
    
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
    const [showFiltersMobile, setShowFiltersMobile] = useState(false)
    
    // Filter visibility preferences (per-user, stored in Firestore)
    const defaultFilterVisibility = {
        market: true,
        projectStatus: true,
        projectProbability: true,
        projectManager: true,
        superintendent: true,
        archived: true
    }
    const [filterVisibility, setFilterVisibility] = useState(defaultFilterVisibility)
    const [isLoadingFilterPrefs, setIsLoadingFilterPrefs] = useState(true)
    const [isCreatingProject, setIsCreatingProject] = useState(false)

    // Load filter visibility preferences from Firestore
    useEffect(() => {
        const loadFilterPreferences = async () => {
            try {
                const auth = getAuth()
                const currentUser = auth.currentUser
                if (!currentUser) {
                    setIsLoadingFilterPrefs(false)
                    return
                }

                const result = await FirebaseDbService.users.getById(currentUser.uid)
                if (result.success && result.data?.filterPreferences?.masterTracker) {
                    setFilterVisibility({
                        ...defaultFilterVisibility,
                        ...result.data.filterPreferences.masterTracker
                    })
                }
            } catch (error) {
                console.error('Error loading filter preferences:', error)
            } finally {
                setIsLoadingFilterPrefs(false)
            }
        }

        loadFilterPreferences()
    }, [])

    // Save filter visibility preferences to Firestore
    const saveFilterPreferences = async (newVisibility) => {
        try {
            const auth = getAuth()
            const currentUser = auth.currentUser
            if (!currentUser) return

            const result = await FirebaseDbService.users.getById(currentUser.uid)
            const existingPrefs = result.success && result.data?.filterPreferences ? result.data.filterPreferences : {}
            
            await FirebaseDbService.users.update(currentUser.uid, {
                filterPreferences: {
                    ...existingPrefs,
                    masterTracker: newVisibility
                }
            })
        } catch (error) {
            console.error('Error saving filter preferences:', error)
        }
    }

    // Update filter visibility and save
    const handleFilterVisibilityChange = (filterKey, isVisible) => {
        const newVisibility = { ...filterVisibility, [filterKey]: isVisible }
        setFilterVisibility(newVisibility)
        saveFilterPreferences(newVisibility)
    }
    
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
        onCancel: null
    })
    const [procoreErrorDialog, setProcoreErrorDialog] = useState({
        isOpen: false,
        projectId: null,
        projectData: null,
        error: null
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
    const [isGeneratingProjectNumber, setIsGeneratingProjectNumber] = useState(false)

    useEffect(() => {
        loadProjects()
    }, [loadProjects])
    
    // Sync local search with filters.search on mount or when filters.search changes externally
    useEffect(() => {
        setLocalSearchValue(filters.search || '')
    }, [filters.search])

    const filteredProjects = useMemo(() => {
        const { search, market, projectStatus, projectProbability, projectManager, superintendent, archived } = filters
        
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
                // Archived filter - toggle between Archived (true), Not Archived (false), and All (null)
                if (archived !== null && archived !== undefined) {
                    const projectArchived = project.Archived === true || project.Archived === 'true' || project.Archived === 1 || project.Archived === '1'
                    // If archived filter is true, show only archived projects
                    // If archived filter is false, show only non-archived projects
                    if (archived === true) {
                        if (!projectArchived) return false
                    } else if (archived === false) {
                        if (projectArchived) return false
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
            archived: null, // Reset to default "All"
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
    
    const resetWizard = async () => {
        setWizardStep(1)
        setIsGeneratingProjectNumber(true)
        console.log('🔢 Generating unique project number for new project...')
        try {
            const newProjectNumber = await generateUniqueProjectNumber(projects)
            console.log('✅ Generated project number:', newProjectNumber)
            setWizardData({
                ProjectName: '',
                ProjectNumber: String(newProjectNumber),
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
        } catch (error) {
            console.error('❌ Error generating project number:', error)
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
        } finally {
            setIsGeneratingProjectNumber(false)
        }
    }

    const handleCreateProject = async () => {
        if (!wizardData.ProjectName.trim()) {
            alert('Project Name is required')
            return
        }

        // Strict requirement: Project Number must be present before creating/syncing
        if (!wizardData.ProjectNumber || !String(wizardData.ProjectNumber).trim()) {
            alert('Project Number is required and is auto-generated. Please wait for it to finish generating before creating the project.')
            return
        }
        
        // Prevent duplicate submissions
        if (isCreatingProject) {
            return
        }
        
        setIsCreatingProject(true)
        
        try {
            console.log('🚀 Creating project with ProjectNumber:', wizardData.ProjectNumber)
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
            
            const result = await addProject(payload, {
                onProcoreError: (error, project) => {
                    // Show error dialog with retry option
                    setProcoreErrorDialog({
                        isOpen: true,
                        projectId: project.id,
                        projectData: payload,
                        error: error
                    })
                }
            })
            
            resetWizard()
            setIsCreateOpen(false)
        } catch (error) {
            console.error('Error creating project:', error)
        } finally {
            setIsCreatingProject(false)
        }
    }

    const handleRetryProcoreSync = async () => {
        if (!procoreErrorDialog.projectId || !procoreErrorDialog.projectData) {
            setProcoreErrorDialog({ isOpen: false, projectId: null, projectData: null, error: null })
            return
        }
        
        try {
            // Get the project from Firebase to get current data
            const projectResponse = await FirebaseDbService.projects.getById(procoreErrorDialog.projectId)
            if (!projectResponse.success) {
                throw new Error('Project not found')
            }
            
            const project = projectResponse.data

            // Strict requirement: ensure ProjectNumber exists before retrying Procore sync
            if (!project.ProjectNumber || !String(project.ProjectNumber).trim()) {
                console.error('Cannot retry Procore sync: project is missing ProjectNumber', {
                    projectId: procoreErrorDialog.projectId,
                })
                alert('Cannot retry Procore sync because the project is missing a Project Number. Please delete this project and create a new one with a valid Project Number.')
                return
            }
            
            // Try to sync with Procore again
            const { ProcoreService } = await import('@/services/ProcoreService')
            const { mapBoltToProcore, validateProcoreProject } = await import('@/configs/procoreFieldMapping')
            
            const procoreProjectData = mapBoltToProcore(project)
            const validation = validateProcoreProject(procoreProjectData)
            
            if (!validation.isValid) {
                throw new Error(`Missing required fields for Procore: ${validation.missingFields.join(', ')}`)
            }
            
            console.log('🔁 Retrying Procore project creation for project:', {
                projectId: procoreErrorDialog.projectId,
                projectNumber: project.ProjectNumber,
            })
            const procoreResult = await ProcoreService.createProject(procoreProjectData)
            
            if (procoreResult.success && procoreResult.procoreProjectId) {
                // Update project with Procore ID
                await FirebaseDbService.projects.update(procoreErrorDialog.projectId, {
                    procoreProjectId: procoreResult.procoreProjectId,
                    procoreSyncStatus: 'synced',
                    procoreSyncedAt: new Date().toISOString()
                })
                
                // Reload projects to update UI
                await loadProjects()
                
                // Close dialog and show success
                setProcoreErrorDialog({ isOpen: false, projectId: null, projectData: null, error: null })
                alert('Project successfully synced with Procore!')
            }
        } catch (error) {
            console.error('Error retrying Procore sync:', error)
            alert(`Failed to sync with Procore: ${error.message}`)
        }
    }

    const allColumns = useMemo(() => [
        {
            header: 'Project Number',
            accessorKey: 'ProjectNumber',
            size: 140,
            meta: { key: 'ProjectNumber' },
            cell: (props) => {
                const value = props.row.original.ProjectNumber
                return <span>{value || '-'}</span>
            },
        },
        {
            header: 'Project',
            accessorKey: 'ProjectName',
            size: 300,
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
            size: 140,
            meta: { key: 'city' },
            cell: (props) => <span>{props.row.original.city || '-'}</span>,
        },
        {
            header: 'PM',
            accessorKey: 'ProjectManager',
            size: 170,
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
                    <>
                        {/* Desktop: Show all buttons */}
                        <div className="hidden md:flex items-center gap-2">
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
                        {/* Mobile: Show dropdown menu */}
                        <div className="md:hidden">
                            <Dropdown placement="bottom-end" renderTitle={<Button size="sm" variant="plain" icon={<HiOutlineDotsHorizontal />} />}>
                                <Dropdown.Item onClick={() => navigate(`/projects/${item.id}`)}>
                                    <HiOutlineEye className="mr-2" /> View
                                </Dropdown.Item>
                                <Dropdown.Item onClick={() => navigate(`/projects/${item.id}?tab=settings`)}>
                                    <HiOutlinePencil className="mr-2" /> Edit
                                </Dropdown.Item>
                                <Dropdown.Item onClick={() => toggleFavorite(item.id)}>
                                    <HiOutlineStar className={`mr-2 ${item.favorite ? 'text-yellow-500' : ''}`} /> 
                                    {item.favorite ? 'Remove from favorites' : 'Add to favorites'}
                                </Dropdown.Item>
                                <Dropdown.Item onClick={() => handleDeleteProject(item.id)} className="text-red-600">
                                    <HiOutlineTrash className="mr-2" /> Delete
                                </Dropdown.Item>
                            </Dropdown>
                        </div>
                    </>
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
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
                <h1 className="text-2xl font-bold">Master Tracker</h1>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Button
                        variant="twoTone"
                        icon={<HiOutlinePlus />}
                        onClick={async () => {
                            if (isGeneratingProjectNumber) return
                            await resetWizard()
                            setIsCreateOpen(true)
                        }}
                        className="w-full sm:w-auto"
                        loading={isGeneratingProjectNumber}
                        disabled={isGeneratingProjectNumber}
                    >
                        {isGeneratingProjectNumber ? 'Preparing...' : 'Create Project'}
                    </Button>
                    <Button
                        variant="solid"
                        icon={<HiOutlineUpload />}
                        onClick={() => setIsBulkManagerOpen(true)}
                        className="w-full sm:w-auto"
                    >
                        Bulk Import / Export
                    </Button>
                    <Button
                        variant="twoTone"
                        icon={<HiOutlineRefresh />}
                        onClick={async () => {
                            try {
                                await syncAllFromProcore()
                            } catch (error) {
                                console.error('Sync failed:', error)
                            }
                        }}
                        className="w-full sm:w-auto"
                        loading={loading}
                    >
                        Sync All from Procore
                    </Button>
                </div>
            </div>

            <Card>
                <div className="p-4 md:p-6 space-y-4">
                    {/* Filters */}
                    {/* Mobile: Search bar only with toggle */}
                    <div className="md:hidden space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="flex-1">
                                <Input
                                    placeholder="Search by Project Number, Name, City, State, PM..."
                                    value={localSearchValue}
                                    onChange={handleSearchChange}
                                />
                            </div>
                            <Button 
                                size="sm" 
                                variant="twoTone" 
                                onClick={() => setShowFiltersMobile(!showFiltersMobile)}
                            >
                                {showFiltersMobile ? 'Hide' : 'Show'} Filters
                            </Button>
                        </div>
                        {/* Additional filters - collapsible on mobile */}
                        <div 
                            className={`
                                ${showFiltersMobile ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'} 
                                transition-all duration-300 ease-in-out
                            `}
                            style={{ overflow: showFiltersMobile ? 'visible' : 'hidden' }}
                        >
                            <div className="grid grid-cols-1 gap-4 pt-2">
                                {filterVisibility.market && (
                                    <Select
                                        placeholder="Market"
                                        isClearable
                                        isMulti
                                        options={marketOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={selectZIndexStyles}
                                        value={Array.isArray(filters.market) ? filters.market : (filters.market ? [filters.market] : null)}
                                        onChange={(opt) => {
                                            setPageIndex(1)
                                            setFilters({ market: opt && opt.length > 0 ? opt : null })
                                        }}
                                        components={{
                                            ValueContainer: CustomValueContainer,
                                            MultiValue: CustomMultiValue,
                                            MenuList: CustomMenuList,
                                            Option: CustomOption,
                                            Placeholder: CustomPlaceholder,
                                        }}
                                        controlShouldRenderValue={false}
                                        hideSelectedOptions={false}
                                    />
                                )}
                                {filterVisibility.projectStatus && (
                                    <Select
                                        placeholder="Status"
                                        isClearable
                                        isMulti
                                        options={projectStatusOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={selectZIndexStyles}
                                        value={Array.isArray(filters.projectStatus) ? filters.projectStatus : (filters.projectStatus ? [filters.projectStatus] : null)}
                                        onChange={(opt) => {
                                            setPageIndex(1)
                                            setFilters({ projectStatus: opt && opt.length > 0 ? opt : null })
                                        }}
                                        components={{
                                            ValueContainer: CustomValueContainer,
                                            MultiValue: CustomMultiValue,
                                            MenuList: CustomMenuList,
                                            Option: CustomOption,
                                            Placeholder: CustomPlaceholder,
                                        }}
                                        controlShouldRenderValue={false}
                                        hideSelectedOptions={false}
                                    />
                                )}
                                {filterVisibility.projectProbability && (
                                    <Select
                                        placeholder="Probability"
                                        isClearable
                                        isMulti
                                        options={projectProbabilityOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={selectZIndexStyles}
                                        value={Array.isArray(filters.projectProbability) ? filters.projectProbability : (filters.projectProbability ? [filters.projectProbability] : null)}
                                        onChange={(opt) => {
                                            setPageIndex(1)
                                            setFilters({ projectProbability: opt && opt.length > 0 ? opt : null })
                                        }}
                                        components={{
                                            ValueContainer: CustomValueContainer,
                                            MultiValue: CustomMultiValue,
                                            MenuList: CustomMenuList,
                                            Option: CustomOption,
                                            Placeholder: CustomPlaceholder,
                                        }}
                                        controlShouldRenderValue={false}
                                        hideSelectedOptions={false}
                                    />
                                )}
                                {filterVisibility.projectManager && (
                                    <Select
                                        placeholder="PM"
                                        isClearable
                                        isMulti
                                        options={projectManagerOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={selectZIndexStyles}
                                        value={Array.isArray(filters.projectManager) ? filters.projectManager : (filters.projectManager ? [filters.projectManager] : null)}
                                        onChange={(opt) => {
                                            setPageIndex(1)
                                            setFilters({ projectManager: opt && opt.length > 0 ? opt : null })
                                        }}
                                        components={{
                                            ValueContainer: CustomValueContainer,
                                            MultiValue: CustomMultiValue,
                                            MenuList: CustomMenuList,
                                            Option: CustomOption,
                                            Placeholder: CustomPlaceholder,
                                        }}
                                        controlShouldRenderValue={false}
                                        hideSelectedOptions={false}
                                    />
                                )}
                                {filterVisibility.superintendent && (
                                    <Select
                                        placeholder="Super Assigned"
                                        isClearable
                                        isMulti
                                        options={superintendentOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={selectZIndexStyles}
                                        value={Array.isArray(filters.superintendent) ? filters.superintendent : (filters.superintendent ? [filters.superintendent] : null)}
                                        onChange={(opt) => {
                                            setPageIndex(1)
                                            setFilters({ superintendent: opt && opt.length > 0 ? opt : null })
                                        }}
                                        components={{
                                            ValueContainer: CustomValueContainer,
                                            MultiValue: CustomMultiValue,
                                            MenuList: CustomMenuList,
                                            Option: CustomOption,
                                            Placeholder: CustomPlaceholder,
                                        }}
                                        controlShouldRenderValue={false}
                                        hideSelectedOptions={false}
                                    />
                                )}
                                {filterVisibility.archived && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                            Show Archived
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPageIndex(1)
                                                
                                                // Toggle between All (null), Archived (true), and Not Archived (false)
                                                let newArchived
                                                if (filters.archived === true) {
                                                    // Currently showing archived, switch to not archived
                                                    newArchived = false
                                                } else if (filters.archived === false) {
                                                    // Currently showing not archived, switch to all (null)
                                                    newArchived = null
                                                } else {
                                                    // Currently showing all, switch to archived
                                                    newArchived = true
                                                }
                                                
                                                // setFilters expects an object, not a function
                                                setFilters({ archived: newArchived })
                                            }}
                                            className="inline-flex items-center gap-2"
                                        >
                                            <span
                                                className={`
                                                    relative inline-flex h-5 w-11 items-center rounded-full transition-colors duration-200
                                                    ${filters.archived === true
                                                        ? 'bg-emerald-500'
                                                        : filters.archived === false
                                                        ? 'bg-orange-500'
                                                        : 'bg-gray-300 dark:bg-gray-600'}
                                                `}
                                            >
                                                <span
                                                    className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
                                                    style={{
                                                        transform: filters.archived === true
                                                            ? 'translateX(24px)'      // Archived (right)
                                                            : filters.archived === false
                                                            ? 'translateX(13px)'     // Not Archived (middle)
                                                            : 'translateX(2px)',     // All (left)
                                                    }}
                                                />
                                            </span>
                                            <span className="text-xs text-gray-700 dark:text-gray-200">
                                                {filters.archived === true ? 'Archived' : filters.archived === false ? 'Not Archived' : 'All'}
                                            </span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* Desktop: Original grid layout */}
                    <div className="hidden md:block">
                        <div className="flex items-start gap-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 flex-1">
                                <Input
                                    placeholder="Search by Project Number, Name, City, State, PM..."
                                    value={localSearchValue}
                                    onChange={handleSearchChange}
                                />
                                {filterVisibility.market && (
                                    <Select
                                        placeholder="Market"
                                        isClearable
                                        isMulti
                                        options={marketOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={selectZIndexStyles}
                                        value={Array.isArray(filters.market) ? filters.market : (filters.market ? [filters.market] : null)}
                                        onChange={(opt) => {
                                            setPageIndex(1)
                                            setFilters({ market: opt && opt.length > 0 ? opt : null })
                                        }}
                                        components={{
                                            ValueContainer: CustomValueContainer,
                                            MultiValue: CustomMultiValue,
                                            MenuList: CustomMenuList,
                                            Option: CustomOption,
                                            Placeholder: CustomPlaceholder,
                                        }}
                                        controlShouldRenderValue={false}
                                        hideSelectedOptions={false}
                                    />
                                )}
                                {filterVisibility.projectStatus && (
                                    <Select
                                        placeholder="Status"
                                        isClearable
                                        isMulti
                                        options={projectStatusOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={selectZIndexStyles}
                                        value={Array.isArray(filters.projectStatus) ? filters.projectStatus : (filters.projectStatus ? [filters.projectStatus] : null)}
                                        onChange={(opt) => {
                                            setPageIndex(1)
                                            setFilters({ projectStatus: opt && opt.length > 0 ? opt : null })
                                        }}
                                        components={{
                                            ValueContainer: CustomValueContainer,
                                            MultiValue: CustomMultiValue,
                                            MenuList: CustomMenuList,
                                            Option: CustomOption,
                                            Placeholder: CustomPlaceholder,
                                        }}
                                        controlShouldRenderValue={false}
                                        hideSelectedOptions={false}
                                    />
                                )}
                                {filterVisibility.projectProbability && (
                                    <Select
                                        placeholder="Probability"
                                        isClearable
                                        isMulti
                                        options={projectProbabilityOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={selectZIndexStyles}
                                        value={Array.isArray(filters.projectProbability) ? filters.projectProbability : (filters.projectProbability ? [filters.projectProbability] : null)}
                                        onChange={(opt) => {
                                            setPageIndex(1)
                                            setFilters({ projectProbability: opt && opt.length > 0 ? opt : null })
                                        }}
                                        components={{
                                            ValueContainer: CustomValueContainer,
                                            MultiValue: CustomMultiValue,
                                            MenuList: CustomMenuList,
                                            Option: CustomOption,
                                            Placeholder: CustomPlaceholder,
                                        }}
                                        controlShouldRenderValue={false}
                                        hideSelectedOptions={false}
                                    />
                                )}
                                {filterVisibility.projectManager && (
                                    <Select
                                        placeholder="PM"
                                        isClearable
                                        isMulti
                                        options={projectManagerOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={selectZIndexStyles}
                                        value={Array.isArray(filters.projectManager) ? filters.projectManager : (filters.projectManager ? [filters.projectManager] : null)}
                                        onChange={(opt) => {
                                            setPageIndex(1)
                                            setFilters({ projectManager: opt && opt.length > 0 ? opt : null })
                                        }}
                                        components={{
                                            ValueContainer: CustomValueContainer,
                                            MultiValue: CustomMultiValue,
                                            MenuList: CustomMenuList,
                                            Option: CustomOption,
                                            Placeholder: CustomPlaceholder,
                                        }}
                                        controlShouldRenderValue={false}
                                        hideSelectedOptions={false}
                                    />
                                )}
                                {filterVisibility.superintendent && (
                                    <Select
                                        placeholder="Super Assigned"
                                        isClearable
                                        isMulti
                                        options={superintendentOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={selectZIndexStyles}
                                        value={Array.isArray(filters.superintendent) ? filters.superintendent : (filters.superintendent ? [filters.superintendent] : null)}
                                        onChange={(opt) => {
                                            setPageIndex(1)
                                            setFilters({ superintendent: opt && opt.length > 0 ? opt : null })
                                        }}
                                        components={{
                                            ValueContainer: CustomValueContainer,
                                            MultiValue: CustomMultiValue,
                                            MenuList: CustomMenuList,
                                            Option: CustomOption,
                                            Placeholder: CustomPlaceholder,
                                        }}
                                        controlShouldRenderValue={false}
                                        hideSelectedOptions={false}
                                    />
                                )}
                                {filterVisibility.archived && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                            Show Archived
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPageIndex(1)
                                                
                                                // Toggle between All (null), Archived (true), and Not Archived (false)
                                                let newArchived
                                                if (filters.archived === true) {
                                                    // Currently showing archived, switch to not archived
                                                    newArchived = false
                                                } else if (filters.archived === false) {
                                                    // Currently showing not archived, switch to all (null)
                                                    newArchived = null
                                                } else {
                                                    // Currently showing all, switch to archived
                                                    newArchived = true
                                                }
                                                
                                                // setFilters expects an object, not a function
                                                setFilters({ archived: newArchived })
                                            }}
                                            className="inline-flex items-center gap-2"
                                        >
                                            <span
                                                className={`
                                                    relative inline-flex h-5 w-11 items-center rounded-full transition-colors duration-200
                                                    ${filters.archived === true
                                                        ? 'bg-emerald-500'
                                                        : filters.archived === false
                                                        ? 'bg-orange-500'
                                                        : 'bg-gray-300 dark:bg-gray-600'}
                                                `}
                                            >
                                                <span
                                                    className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
                                                    style={{
                                                        transform: filters.archived === true
                                                            ? 'translateX(24px)'      // Archived (right)
                                                            : filters.archived === false
                                                            ? 'translateX(13px)'     // Not Archived (middle)
                                                            : 'translateX(2px)',     // All (left)
                                                    }}
                                                />
                                            </span>
                                            <span className="text-xs text-gray-700 dark:text-gray-200">
                                                {filters.archived === true ? 'Archived' : filters.archived === false ? 'Not Archived' : 'All'}
                                            </span>
                                        </button>
                                    </div>
                                )}
                            </div>
                            {/* More Filters Toggle Button - desktop only */}
                            <div className="flex items-center pt-0">
                                <Button 
                                    size="sm" 
                                    variant="twoTone" 
                                    onClick={() => setShowMoreFilters(!showMoreFilters)}
                                >
                                    {showMoreFilters ? 'Less' : 'More'} Filters
                                </Button>
                            </div>
                        </div>
                    </div>
                    
                    {/* Clear All Filters Button */}
                    {(filters.search || 
                        (filters.market && (Array.isArray(filters.market) ? filters.market.length > 0 : filters.market.value)) ||
                        (filters.projectStatus && (Array.isArray(filters.projectStatus) ? filters.projectStatus.length > 0 : filters.projectStatus.value)) ||
                        (filters.projectProbability && (Array.isArray(filters.projectProbability) ? filters.projectProbability.length > 0 : filters.projectProbability.value)) ||
                        (filters.projectManager && (Array.isArray(filters.projectManager) ? filters.projectManager.length > 0 : filters.projectManager.value)) ||
                        (filters.superintendent && (Array.isArray(filters.superintendent) ? filters.superintendent.length > 0 : filters.superintendent.value)) ||
                        (filters.archived !== null && filters.archived !== undefined)) && (
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
                            {/* Filter Visibility Controls */}
                            <Card className="p-4">
                                <h6 className="font-semibold mb-3 flex items-center gap-2">
                                    Filter Visibility
                                    <Tag className="text-xs">Project filters</Tag>
                                </h6>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={filterVisibility.market !== false}
                                            onChange={(checked) => handleFilterVisibilityChange('market', checked)}
                                        />
                                        <span>Market</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={filterVisibility.projectStatus !== false}
                                            onChange={(checked) => handleFilterVisibilityChange('projectStatus', checked)}
                                        />
                                        <span>Status</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={filterVisibility.projectProbability !== false}
                                            onChange={(checked) => handleFilterVisibilityChange('projectProbability', checked)}
                                        />
                                        <span>Probability</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={filterVisibility.projectManager !== false}
                                            onChange={(checked) => handleFilterVisibilityChange('projectManager', checked)}
                                        />
                                        <span>PM</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={filterVisibility.superintendent !== false}
                                            onChange={(checked) => handleFilterVisibilityChange('superintendent', checked)}
                                        />
                                        <span>Super Assigned</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={filterVisibility.archived !== false}
                                            onChange={(checked) => handleFilterVisibilityChange('archived', checked)}
                                        />
                                        <span>Archived</span>
                                    </label>
                                </div>
                            </Card>
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
                        className="table-compact"
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
                <div className="p-6 flex flex-col max-h-[90vh] md:max-h-none md:block">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0 mb-6">
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
                    
                    <div className="flex-1 overflow-y-auto md:overflow-visible md:flex-none">
                    
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
                                    <label className="block text-sm font-medium mb-2">
                                        Project Number
                                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(Auto-generated)</span>
                                    </label>
                                    <div className="space-y-1">
                                        <Input 
                                            value={wizardData.ProjectNumber} 
                                            readOnly
                                            className="bg-gray-50 dark:bg-gray-700 cursor-not-allowed"
                                            placeholder="Auto-generated project number"
                                        />
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {wizardData.ProjectNumber
                                                ? 'Ready – this number will be used for Procore sync.'
                                                : 'Generating project number... please wait before creating the project.'}
                                        </p>
                                    </div>
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
                    
                    </div>
                    
                    {/* Navigation buttons */}
                    <div className="flex justify-between mt-8 md:mt-8 border-t border-gray-200 dark:border-gray-700 md:border-t-0 pt-4 md:pt-0 flex-shrink-0 md:flex-none">
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
                                    disabled={!wizardData.ProjectName.trim() || isCreatingProject}
                                    loading={isCreatingProject}
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

            {/* Procore Sync Error Dialog */}
            <Dialog 
                isOpen={procoreErrorDialog.isOpen} 
                onClose={() => setProcoreErrorDialog({ isOpen: false, projectId: null, projectData: null, error: null })}
                width={600}
            >
                <div className="p-6">
                    <h5 className="text-xl font-semibold mb-4">Procore Sync Failed</h5>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                        The project was created successfully in Bolt, but failed to sync with Procore.
                    </p>
                    {procoreErrorDialog.error && (
                        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                                <strong>Error:</strong>{' '}
                                {(() => {
                                    const error = procoreErrorDialog.error
                                    if (!error) return 'Unknown Procore sync error'
                                    if (typeof error === 'string') return error
                                    if (error?.details) return error.details
                                    if (error?.message) return error.message
                                    if (error?.originalError?.details) return error.originalError.details
                                    if (error?.originalError?.message) return error.originalError.message
                                    if (error?.code) return `Error ${error.code}: ${error.message || 'Unknown error'}`
                                    return 'Unknown Procore sync error'
                                })()}
                            </p>
                            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
                                Please review the error details above, ensure your Procore configuration is correct, and try again.
                            </p>
                        </div>
                    )}
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                        <p className="text-sm text-blue-800 dark:text-blue-200 font-semibold mb-2">Next Steps:</p>
                        <ol className="text-xs text-blue-700 dark:text-blue-300 list-decimal list-inside space-y-1">
                            <li>Confirm the project details in Bolt, especially the Project Number: <strong>{procoreErrorDialog.projectData?.ProjectNumber || 'N/A'}</strong></li>
                            <li>Check your Procore permissions and required fields for project creation.</li>
                            <li>
                                Use the Retry Sync button below to attempt syncing the project again once any issues are resolved.
                                Note: Retry will only work if the project has a valid Project Number.
                            </li>
                        </ol>
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <Button 
                            variant="twoTone" 
                            onClick={handleRetryProcoreSync}
                        >
                            Retry Sync
                        </Button>
                        <Button 
                            variant="twoTone" 
                            onClick={() => setProcoreErrorDialog({ isOpen: false, projectId: null, projectData: null, error: null })}
                        >
                            Close
                        </Button>
                    </div>
                </div>
            </Dialog>
        </div>
    )
}

export default ProjectsList

