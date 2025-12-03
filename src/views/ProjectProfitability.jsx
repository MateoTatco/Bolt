import React, { useMemo, useState, useEffect, useRef } from 'react'
import { Card, Input, Select, Tag, Tooltip, Button, Checkbox, Skeleton, DatePicker } from '@/components/ui'
import DataTable from '@/components/shared/DataTable'
import Chart from '@/components/shared/Chart'
import { HiOutlineCurrencyDollar, HiOutlineDownload } from 'react-icons/hi'
import { getAuth } from 'firebase/auth'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { ProcoreService } from '@/services/ProcoreService'
import { components } from 'react-select'
import { useSessionUser } from '@/store/authStore'
import { ADMIN } from '@/constants/roles.constant'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

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

// Skeleton loader component for table rows
const TableSkeleton = ({ rows = 10 }) => {
    return (
        <div className="space-y-2">
            {Array.from({ length: rows }).map((_, index) => (
                <div key={index} className="flex items-center gap-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <Skeleton className="w-48 h-4" />
                    <Skeleton className="w-32 h-4" />
                    <Skeleton className="w-40 h-4" />
                    <Skeleton className="w-24 h-4" />
                    <Skeleton className="w-32 h-4" />
                    <Skeleton className="w-28 h-4" />
                    <Skeleton className="w-36 h-4" />
                    <Skeleton className="w-32 h-4" />
                </div>
            ))}
        </div>
    )
}

// Shared helper to normalize "isActive" from different DB representations
const isProjectActive = (proj) => {
    const val = proj?.isActive
    return val === true || val === 1 || val === 'true' || val === '1'
}

// Generic helper to apply all filters to a list of projects
const applyProjectFilters = (projects, filters) => {
    const { search, project, projectStage, projectSystem, projectManager, isActive } = filters

    return projects.filter((proj) => {
        if (search) {
            const term = search.toLowerCase()
            const hay = `${proj.projectNumber || ''} ${proj.projectName || ''} ${proj.projectManager || ''}`.toLowerCase()
            if (!hay.includes(term)) return false
        }

        if (project) {
            if (Array.isArray(project)) {
                if (project.length > 0 && !project.some(p => p.value === proj.projectName)) return false
            } else if (project.value) {
                if (proj.projectName !== project.value) return false
            }
        }

        if (projectStage) {
            if (Array.isArray(projectStage)) {
                if (projectStage.length > 0 && !projectStage.some(s => s.value === proj.projectStatus)) return false
            } else if (projectStage.value) {
                if (proj.projectStatus !== projectStage.value) return false
            }
        }

        if (projectSystem) {
            if (Array.isArray(projectSystem)) {
                if (projectSystem.length > 0 && !projectSystem.some(s => s.value === proj.projectSystem)) return false
            } else if (projectSystem.value) {
                if (proj.projectSystem !== projectSystem.value) return false
            }
        }

        if (projectManager) {
            if (Array.isArray(projectManager)) {
                if (projectManager.length > 0 && !projectManager.some(pm => pm.value === proj.projectManager)) return false
            } else if (projectManager.value) {
                if (proj.projectManager !== projectManager.value) return false
            }
        }

        if (isActive !== null && isActive !== undefined) {
            const projIsActive = isProjectActive(proj)

            if (Array.isArray(isActive)) {
                if (isActive.length > 0) {
                    const activeValues = isActive.map(opt => opt.value)
                    const matches = activeValues.some(val => {
                        if (val === true || val === 'true' || val === 1 || val === '1') {
                            return projIsActive
                        }
                        if (val === false || val === 'false' || val === 0 || val === '0') {
                            return !projIsActive
                        }
                        return false
                    })
                    if (!matches) return false
                }
            } else if (isActive.value !== undefined) {
                const val = isActive.value
                if (val === true || val === 'true' || val === 1 || val === '1') {
                    if (!projIsActive) return false
                } else if (val === false || val === 'false' || val === 0 || val === '0') {
                    if (projIsActive) return false
                }
            }
        }

        return true
    })
}

const ProjectProfitability = () => {
    // Check if user is admin
    const user = useSessionUser((state) => state.user)
    const isAdmin = user?.authority?.includes(ADMIN) || false
    
    // High z-index styles for Select dropdowns to appear above sticky headers
    // Only override z-index, preserve all other styles
    const selectMenuStyles = {
        menuPortal: (provided) => ({ ...provided, zIndex: 9999 }),
        menu: (provided) => ({ ...provided, zIndex: 9999 }),
    }
    
    const [projects, setProjects] = useState([])
    const [filters, setFilters] = useState({
        search: '',
        project: null,
        projectStage: null,
        projectSystem: null,
        projectManager: null,
        isActive: null,
    })
    const [sort, setSort] = useState({ key: '', order: '' })
    const [localSearchValue, setLocalSearchValue] = useState('')
    const [showFiltersMobile, setShowFiltersMobile] = useState(false)
    const [showMoreFilters, setShowMoreFilters] = useState(false)
    const searchDebounceRef = useRef(null)
    const tableScrollRef = useRef(null)
    const topScrollbarRef = useRef(null)
    
    // Loading and error states
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    
    // Trend chart date range - default to last 6 months
    const [trendDateRange, setTrendDateRange] = useState(() => {
        const endDate = dayjs().endOf('day').toDate()
        const startDate = dayjs().subtract(6, 'months').startOf('day').toDate()
        return [startDate, endDate]
    })
    
    // Track window size for responsive chart font
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)
    
    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth)
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])
    
    // Sync scrollbars - moved after filteredProjects and visibleColumnsList are defined

    // Fetch projects on component mount
    useEffect(() => {
        const fetchProjects = async () => {
            setIsLoading(true)
            setError(null)
            
            try {
                console.log('🔄 Fetching projects from Azure SQL Database...')
                const projectsData = await ProcoreService.getAllProjectsProfitability()
                console.log('✅ Fetched projects:', projectsData?.length || 0)
                
                if (projectsData && projectsData.length > 0) {
                    setProjects(projectsData)
                } else {
                    setError('No projects found.')
                }
            } catch (fetchError) {
                console.error('Error fetching projects:', fetchError)
                setError(`Failed to fetch projects: ${fetchError.message || 'Unknown error'}`)
            } finally {
                setIsLoading(false)
            }
        }

        fetchProjects()
    }, [])

    // Column visibility and order (like Master Tracker) - includes all columns
    const defaultColumnKeys = [
        'projectName',
        'projectNumber',
        'projectManager',
        'projectSystem',
        'projectStatus',
        'totalContractValue',
        'estCostAtCompletion',
        'initialEstimatedProfit',
        'currentProjectedProfit',
        'estimatedDifference',
        'percentProjectedProfit',
        'balanceLeftOnContract',
        'percentCompleteRevenue',
        'percentCompleteCost',
        'customerRetainage',
        'remainingCost',
        'vendorRetainage',
        'totalInvoiced',
        'contractStatus',
        'contractStartDate',
        'contractEndDate',
        'isActive',
        'archiveDate',
    ]

    const [columnOrder, setColumnOrder] = useState(() => {
        try {
            const raw = localStorage.getItem('projectProfitabilityColumnOrder')
            const parsed = raw ? JSON.parse(raw) : null
            if (Array.isArray(parsed) && parsed.length) {
                return parsed
            }
            return defaultColumnKeys
        } catch {
            return defaultColumnKeys
        }
    })

    const [visibleColumns, setVisibleColumns] = useState(() => {
        try {
            const raw = localStorage.getItem('projectProfitabilityVisibleColumns')
            const parsed = raw ? JSON.parse(raw) : null
            if (parsed && typeof parsed === 'object') {
                return parsed
            }
            return defaultColumnKeys.reduce((acc, key) => ({ ...acc, [key]: true }), {})
        } catch {
            return defaultColumnKeys.reduce((acc, key) => ({ ...acc, [key]: true }), {})
        }
    })

    // Persist column visibility and order
    useEffect(() => {
        try {
            localStorage.setItem('projectProfitabilityVisibleColumns', JSON.stringify(visibleColumns))
            localStorage.setItem('projectProfitabilityColumnOrder', JSON.stringify(columnOrder))
        } catch {}
    }, [visibleColumns, columnOrder])

    // Filter visibility preferences (per-user, stored in Firestore)
    const defaultFilterVisibility = {
        project: true,
        projectStage: true,
        projectSystem: false,
        projectManager: false,
        isActive: false,
    }
    const [filterVisibility, setFilterVisibility] = useState(defaultFilterVisibility)
    const [isLoadingFilterPrefs, setIsLoadingFilterPrefs] = useState(true)

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
                if (result.success && result.data?.filterPreferences?.projectProfitability) {
                    setFilterVisibility({
                        ...defaultFilterVisibility,
                        ...result.data.filterPreferences.projectProfitability
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
                    projectProfitability: newVisibility
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

    // All test functions and Procore connection handlers removed - no longer needed with Azure SQL

    // Filter projects (then apply sort)
    const filteredProjects = useMemo(() => {
        const baseFiltered = applyProjectFilters(projects, filters)

        return baseFiltered.sort((a, b) => {
            const { key, order } = sort
            if (!key || !order) return 0
            const dir = order === 'asc' ? 1 : -1
            const av = a[key]
            const bv = b[key]
            if (av === bv) return 0
            return av > bv ? dir : -dir
        })
    }, [projects, filters, sort])

    // Dynamic filter option datasets (each ignores its own filter but respects the others)
    const projectsForProjectOptions = useMemo(
        () => applyProjectFilters(projects, { ...filters, project: null }),
        [projects, filters]
    )
    const projectsForProjectStageOptions = useMemo(
        () => applyProjectFilters(projects, { ...filters, projectStage: null }),
        [projects, filters]
    )
    const projectsForProjectSystemOptions = useMemo(
        () => applyProjectFilters(projects, { ...filters, projectSystem: null }),
        [projects, filters]
    )
    const projectsForProjectManagerOptions = useMemo(
        () => applyProjectFilters(projects, { ...filters, projectManager: null }),
        [projects, filters]
    )

    // Dynamic filter options built from the current dataset
    const projectOptions = useMemo(() => {
        const names = new Set()
        projectsForProjectOptions.forEach(p => {
            if (p.projectName) {
                names.add(p.projectName)
            }
        })
        return Array.from(names)
            .sort((a, b) => a.localeCompare(b))
            .map(name => ({ value: name, label: name }))
    }, [projectsForProjectOptions])

    const projectStageOptions = useMemo(() => {
        const stages = new Set()
        projectsForProjectStageOptions.forEach(p => {
            if (p.projectStatus) {
                stages.add(p.projectStatus)
            }
        })
        return Array.from(stages)
            .sort((a, b) => a.localeCompare(b))
            .map(stage => ({ value: stage, label: stage }))
    }, [projectsForProjectStageOptions])

    const projectSystemOptions = useMemo(() => {
        const systems = new Set()
        projectsForProjectSystemOptions.forEach(p => {
            if (p.projectSystem) {
                systems.add(p.projectSystem)
            }
        })
        return Array.from(systems)
            .sort((a, b) => a.localeCompare(b))
            .map(system => ({ value: system, label: system }))
    }, [projectsForProjectSystemOptions])

    const projectManagerOptions = useMemo(() => {
        const managers = new Set()
        projectsForProjectManagerOptions.forEach(p => {
            if (p.projectManager) {
                managers.add(p.projectManager)
            }
        })
        return Array.from(managers)
            .sort((a, b) => a.localeCompare(b))
            .map(manager => ({ value: manager, label: manager }))
    }, [projectsForProjectManagerOptions])

    // Calculate summary values
    // Now based on the currently filtered projects (so KPIs react to filters)
    const summaryValues = useMemo(() => {
        return filteredProjects.reduce(
            (acc, proj) => {
                acc.totalContractValue += proj.totalContractValue || 0
                acc.totalProjectedProfit += proj.currentProjectedProfit || 0
                acc.jobToDateCost += proj.jobToDateCost || 0
                return acc
            },
            { totalContractValue: 0, totalProjectedProfit: 0, jobToDateCost: 0 }
        )
    }, [filteredProjects])

    const formatCurrency = (value) => {
        if (!value && value !== 0) return '-'
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value)
    }

    const formatPercent = (value) => {
        if (!value && value !== 0) return '-'
        return `${value.toFixed(1)}%`
    }

    const formatDate = (date) => {
        if (!date) return '-'
        if (date instanceof Date) return date.toISOString().slice(0, 10)
        if (typeof date === 'string') {
            const d = new Date(date)
            return isNaN(d.getTime()) ? date : d.toISOString().slice(0, 10)
        }
        return String(date)
    }

    const statusColor = (value) => {
        const colors = {
            'Closed': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100',
            'Course of Construction': 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-100',
            'Not Awarded': 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-100',
            'Pre-Construction': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-100',
            'Bidding': 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-100',
        }
        return colors[value] || 'bg-gray-100 text-gray-700'
    }

    // No pagination - show all filtered projects
    const pageData = filteredProjects

    // Column definitions
    const allColumns = useMemo(() => [
        {
            header: 'Project Name',
            accessorKey: 'projectName',
            size: 300,
            meta: { key: 'projectName' },
            cell: (props) => {
                const value = props.row.original.projectName
                return (
                    <Tooltip title={value}>
                        <span className="block max-w-[300px] truncate font-semibold text-xs">{value || '-'}</span>
                    </Tooltip>
                )
            },
        },
        {
            header: 'Project Number',
            accessorKey: 'projectNumber',
            size: 150,
            meta: { key: 'projectNumber' },
            cell: (props) => {
                const value = props.row.original.projectNumber
                return <span className="text-xs">{value || '-'}</span>
            },
        },
        {
            header: 'Project Manager',
            accessorKey: 'projectManager',
            size: 180,
            meta: { key: 'projectManager' },
            cell: (props) => {
                const value = props.row.original.projectManager
                return <span className="text-xs">{value || '-'}</span>
            },
        },
        {
            header: 'Project System',
            accessorKey: 'projectSystem',
            size: 140,
            meta: { key: 'projectSystem' },
            cell: (props) => {
                const value = props.row.original.projectSystem
                return <span className="text-xs">{value || '-'}</span>
            },
        },
        {
            header: 'Project Status',
            accessorKey: 'projectStatus',
            size: 180,
            meta: { key: 'projectStatus' },
            cell: (props) => {
                const value = props.row.original.projectStatus
                return <Tag className={`${statusColor(value)} text-xs`}>{value || '-'}</Tag>
            },
        },
        {
            header: 'Total Contract Value',
            accessorKey: 'totalContractValue',
            size: 180,
            meta: { key: 'totalContractValue' },
            cell: (props) => {
                const value = props.row.original.totalContractValue
                return <span className="font-semibold text-xs">{formatCurrency(value)}</span>
            },
        },
        {
            header: 'Est. Cost At Completion*',
            accessorKey: 'estCostAtCompletion',
            size: 200,
            meta: { key: 'estCostAtCompletion' },
            cell: (props) => {
                const value = props.row.original.estCostAtCompletion
                return <span className="text-xs">{formatCurrency(value)}</span>
            },
        },
        {
            header: 'Initial Estimated Profit*',
            accessorKey: 'initialEstimatedProfit',
            size: 200,
            meta: { key: 'initialEstimatedProfit' },
            cell: (props) => {
                const value = props.row.original.initialEstimatedProfit
                return <span className="text-xs">{formatCurrency(value)}</span>
            },
        },
        {
            header: 'Current Projected Profit',
            accessorKey: 'currentProjectedProfit',
            size: 200,
            meta: { key: 'currentProjectedProfit' },
            cell: (props) => {
                const value = props.row.original.currentProjectedProfit
                const isPositive = value >= 0
                return (
                    <span className={`text-xs ${isPositive ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}`}>
                        {formatCurrency(value)}
                    </span>
                )
            },
        },
        {
            header: 'Estimated Difference',
            accessorKey: 'estimatedDifference',
            size: 180,
            meta: { key: 'estimatedDifference' },
            cell: (props) => {
                const value = props.row.original.estimatedDifference
                const isPositive = value >= 0
                return (
                    <span className={`text-xs ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(value)}
                    </span>
                )
            },
        },
        {
            header: '% Projected Profit',
            accessorKey: 'percentProjectedProfit',
            size: 160,
            meta: { key: 'percentProjectedProfit' },
            cell: (props) => {
                const value = props.row.original.percentProjectedProfit
                const isPositive = value >= 0
                return (
                    <span className={`text-xs ${isPositive ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}`}>
                        {formatPercent(value)}
                    </span>
                )
            },
        },
        {
            header: 'Balance Left On Contract',
            accessorKey: 'balanceLeftOnContract',
            size: 200,
            meta: { key: 'balanceLeftOnContract' },
            cell: (props) => {
                const value = props.row.original.balanceLeftOnContract
                return <span className="text-xs">{formatCurrency(value)}</span>
            },
        },
        {
            header: 'Percent Complete (Revenue)',
            accessorKey: 'percentCompleteRevenue',
            size: 220,
            meta: { key: 'percentCompleteRevenue' },
            cell: (props) => {
                const value = props.row.original.percentCompleteRevenue
                return <span className="text-xs">{formatPercent(value)}</span>
            },
        },
        {
            header: 'Percent Complete (Cost)',
            accessorKey: 'percentCompleteCost',
            size: 200,
            meta: { key: 'percentCompleteCost' },
            cell: (props) => {
                const value = props.row.original.percentCompleteCost
                return <span className="text-xs">{formatPercent(value)}</span>
            },
        },
        {
            header: 'Customer Retainage',
            accessorKey: 'customerRetainage',
            size: 180,
            meta: { key: 'customerRetainage' },
            cell: (props) => {
                const value = props.row.original.customerRetainage
                return <span className="text-xs">{formatCurrency(value)}</span>
            },
        },
        {
            header: 'Remaining Cost*',
            accessorKey: 'remainingCost',
            size: 160,
            meta: { key: 'remainingCost' },
            cell: (props) => {
                const value = props.row.original.remainingCost
                return <span className="text-xs">{formatCurrency(value)}</span>
            },
        },
        {
            header: 'Vendor Retainage',
            accessorKey: 'vendorRetainage',
            size: 180,
            meta: { key: 'vendorRetainage' },
            cell: (props) => {
                const value = props.row.original.vendorRetainage
                return <span className="text-xs">{formatCurrency(value)}</span>
            },
        },
        {
            header: 'Total Invoiced',
            accessorKey: 'totalInvoiced',
            size: 160,
            meta: { key: 'totalInvoiced' },
            cell: (props) => {
                const value = props.row.original.totalInvoiced
                return <span className="text-xs">{formatCurrency(value)}</span>
            },
        },
        {
            header: 'Contract Status',
            accessorKey: 'contractStatus',
            size: 160,
            meta: { key: 'contractStatus' },
            cell: (props) => {
                const value = props.row.original.contractStatus
                return <span className="text-xs">{value || '-'}</span>
            },
        },
        {
            header: 'Contract Start Date',
            accessorKey: 'contractStartDate',
            size: 180,
            meta: { key: 'contractStartDate' },
            cell: (props) => {
                const value = props.row.original.contractStartDate
                return <span className="text-xs">{formatDate(value)}</span>
            },
        },
        {
            header: 'Contract End Date',
            accessorKey: 'contractEndDate',
            size: 180,
            meta: { key: 'contractEndDate' },
            cell: (props) => {
                const value = props.row.original.contractEndDate
                return <span className="text-xs">{formatDate(value)}</span>
            },
        },
        {
            header: 'Is Active',
            accessorKey: 'isActive',
            size: 120,
            meta: { key: 'isActive' },
            cell: (props) => {
                const value = props.row.original.isActive
                return (
                    <Tag className={`text-xs ${value ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
                        {value ? 'Yes' : 'No'}
                    </Tag>
                )
            },
        },
        {
            header: 'Archive Date*',
            accessorKey: 'archiveDate',
            size: 160,
            meta: { key: 'archiveDate' },
            cell: (props) => {
                const value = props.row.original.archiveDate
                return <span className="text-xs">{formatDate(value)}</span>
            },
        },
    ], [])

    // Filter and order visible columns (like Master Tracker)
    const visibleColumnsList = useMemo(() => {
        const byKey = {}
        allColumns.forEach((c) => {
            const key = c.meta?.key || c.accessorKey
            byKey[key] = c
        })
        const ordered = columnOrder
            .map((k) => byKey[k])
            .filter(Boolean)
        const finalCols = ordered.filter((c) => {
            const key = c.meta?.key || c.accessorKey
            return visibleColumns[key] !== false
        })
        return finalCols
    }, [allColumns, columnOrder, visibleColumns])

    // Sync top scrollbar with table scroll - runs after table content changes
    useEffect(() => {
        const tableScroll = tableScrollRef.current
        const topScrollbar = topScrollbarRef.current
        
        if (!tableScroll || !topScrollbar) return
        
        const handleTableScroll = () => {
            topScrollbar.scrollLeft = tableScroll.scrollLeft
        }
        
        const handleTopScrollbarScroll = () => {
            tableScroll.scrollLeft = topScrollbar.scrollLeft
        }
        
        tableScroll.addEventListener('scroll', handleTableScroll)
        topScrollbar.addEventListener('scroll', handleTopScrollbarScroll)
        
        // Set top scrollbar width to match table content width
        const updateScrollbarWidth = () => {
            const tableContent = tableScroll.querySelector('table')
            if (tableContent) {
                const tableWidth = tableContent.scrollWidth
                const scrollContent = topScrollbar.querySelector('#table-scroll-content')
                if (scrollContent) {
                    // Set both width and minWidth to ensure scrollbar is scrollable
                    scrollContent.style.width = `${tableWidth}px`
                    scrollContent.style.minWidth = `${tableWidth}px`
                    // Ensure the scrollbar container can scroll
                    topScrollbar.style.width = '100%'
                }
            }
        }
        
        // Initial update
        updateScrollbarWidth()
        
        // Also update on window resize and when table content changes
        window.addEventListener('resize', updateScrollbarWidth)
        
        // Use MutationObserver to detect table changes
        const observer = new MutationObserver(updateScrollbarWidth)
        if (tableScroll.querySelector('table')) {
            observer.observe(tableScroll.querySelector('table'), {
                childList: true,
                subtree: true,
                attributes: true
            })
        }
        
        // Update width after a short delay to ensure table is rendered
        const timeoutId = setTimeout(updateScrollbarWidth, 100)
        
        return () => {
            clearTimeout(timeoutId)
            window.removeEventListener('resize', updateScrollbarWidth)
            observer.disconnect()
            tableScroll.removeEventListener('scroll', handleTableScroll)
            topScrollbar.removeEventListener('scroll', handleTopScrollbarScroll)
        }
    }, [filteredProjects, visibleColumnsList])

    // Chart data
    const chartData = useMemo(() => {
        // Profitability by Project Status
        const statusProfit = {}
        filteredProjects.forEach(proj => {
            const status = proj.projectStatus || 'Unknown'
            if (!statusProfit[status]) {
                statusProfit[status] = 0
            }
            statusProfit[status] += proj.currentProjectedProfit || 0
        })

        // Profitability trend (by contract start date, filtered by date range)
        const dailyProfit = {}
        let projectsForTrend = filteredProjects
        
        // Determine date range - use provided range or default to last 6 months
        let startDate, endDate
        if (trendDateRange[0] && trendDateRange[1]) {
            startDate = dayjs(trendDateRange[0]).startOf('day')
            endDate = dayjs(trendDateRange[1]).endOf('day')
        } else {
            // Default to last 6 months
            endDate = dayjs().endOf('day')
            startDate = dayjs().subtract(6, 'months').startOf('day')
        }
        
        // Filter by date range
        projectsForTrend = filteredProjects.filter(proj => {
            if (!proj.contractStartDate) return false
            const projDate = dayjs(proj.contractStartDate).startOf('day')
            // Include projects where start date is within the range (inclusive)
            const projDateValue = projDate.valueOf()
            const startDateValue = startDate.valueOf()
            const endDateValue = endDate.valueOf()
            return projDateValue >= startDateValue && projDateValue <= endDateValue
        })
        
        projectsForTrend.forEach(proj => {
            if (proj.contractStartDate) {
                const date = proj.contractStartDate instanceof Date 
                    ? proj.contractStartDate 
                    : new Date(proj.contractStartDate)
                // Use day-level grouping for better granularity
                const dateKey = dayjs(date).format('YYYY-MM-DD')
                if (!dailyProfit[dateKey]) {
                    dailyProfit[dateKey] = 0
                }
                dailyProfit[dateKey] += proj.currentProjectedProfit || 0
            }
        })

        // Format for donut chart
        const statusLabels = Object.keys(statusProfit)
        const statusValues = Object.values(statusProfit)

        // Format for area chart - sort by date
        const sortedDates = Object.keys(dailyProfit).sort()
        const dailyValues = sortedDates.map(date => dailyProfit[date])
        // Format labels for x-axis: "1 Dec", "2 Dec", etc.
        const formattedLabels = sortedDates.map(date => {
            const d = dayjs(date)
            return `${d.date()} ${d.format('MMM')}`
        })

        return {
            statusLabels,
            statusValues,
            trendLabels: formattedLabels,
            trendValues: dailyValues,
            trendRawDates: sortedDates, // Keep raw dates for reference
        }
    }, [filteredProjects, trendDateRange])

    const handleClearAllFilters = () => {
        setFilters({
            search: '',
            project: null,
            projectStage: null,
            projectSystem: null,
            projectManager: null,
            isActive: null,
        })
        setLocalSearchValue('')
    }

    const handleExportToExcel = () => {
        try {
            // Prepare data for export - use filtered projects
            const exportData = filteredProjects.map(project => {
                const row = {}
                
                // Map all visible columns to Excel format
                visibleColumnsList.forEach(column => {
                    const key = column.meta?.key || column.accessorKey
                    const header = column.header
                    let value = project[key]
                    
                    // Format values based on column type
                    if (value === null || value === undefined) {
                        value = ''
                    } else if (key.includes('Value') || key.includes('Profit') || key.includes('Cost') || key.includes('Retainage') || key.includes('Invoiced') || key.includes('Contract')) {
                        // Currency fields
                        value = value || 0
                        value = typeof value === 'number' ? value : parseFloat(value) || 0
                    } else if (key.includes('Percent') || key.includes('Complete')) {
                        // Percentage fields
                        value = value || 0
                        value = typeof value === 'number' ? value : parseFloat(value) || 0
                        value = `${value.toFixed(1)}%`
                    } else if (key.includes('Date') || key === 'archiveDate') {
                        // Date fields
                        value = formatDate(value)
                    } else if (key === 'isActive') {
                        // Boolean fields
                        value = value ? 'Yes' : 'No'
                    } else {
                        // String fields
                        value = String(value || '')
                    }
                    
                    row[header] = value
                })
                
                return row
            })
            
            // Create workbook and worksheet
            const ws = XLSX.utils.json_to_sheet(exportData)
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'Projects')
            
            // Generate filename with current date
            const dateStr = dayjs().format('YYYY-MM-DD')
            const filename = `Project_Profitability_${dateStr}.xlsx`
            
            // Write file and trigger download
            XLSX.writeFile(wb, filename)
        } catch (error) {
            console.error('Error exporting to Excel:', error)
            alert(`Failed to export to Excel: ${error.message || 'Unknown error'}`)
        }
    }


    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">Project Profitability</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        This report includes project details and projections from Azure SQL Database
                    </p>
                </div>
                <Button
                    variant="solid"
                    icon={<HiOutlineDownload />}
                    onClick={handleExportToExcel}
                    disabled={isLoading || filteredProjects.length === 0}
                >
                    Export to Excel
                </Button>
            </div>
            
            {/* Error Message */}
            {error && (
                <Card className="p-4 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </Card>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                Total Contract Value (Sum)
                            </p>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                {formatCurrency(summaryValues.totalContractValue)}
                            </p>
                        </div>
                        <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
                            <HiOutlineCurrencyDollar className="text-xl text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                Total Projected Profit (Sum)
                            </p>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                {formatCurrency(summaryValues.totalProjectedProfit)}
                            </p>
                        </div>
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg">
                            <HiOutlineCurrencyDollar className="text-xl text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                Job To Date Cost (Sum)
                            </p>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                {formatCurrency(summaryValues.jobToDateCost)}
                            </p>
                        </div>
                        <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-lg">
                            <HiOutlineCurrencyDollar className="text-xl text-amber-600 dark:text-amber-400" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Filters and Table */}
            <Card>
                <div className="p-4 md:p-6 space-y-4">
                    {/* Filters */}
                    {/* Mobile: Search bar only with toggle */}
                    <div className="md:hidden space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="flex-1">
                                <Input
                                    placeholder="Search by Project Number, Name, Manager..."
                                    value={localSearchValue}
                                    onChange={(e) => {
                                        const value = e.target.value
                                        setLocalSearchValue(value)
                                        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
                                        searchDebounceRef.current = setTimeout(() => {
                                            setFilters(prev => ({ ...prev, search: value }))
                                        }, 300)
                                    }}
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
                                {filterVisibility.project !== false && (
                                    <Select
                                        placeholder="Project"
                                        isClearable
                                        isMulti
                                        options={projectOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={selectMenuStyles}
                                        value={Array.isArray(filters.project) ? filters.project : (filters.project ? [filters.project] : null)}
                                        onChange={(opt) => {
                                            setFilters(prev => ({ ...prev, project: opt && opt.length > 0 ? opt : null }))
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
                                {filterVisibility.projectStage !== false && (
                                    <Select
                                        placeholder="Project Stage"
                                        isClearable
                                        isMulti
                                        options={projectStageOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={selectMenuStyles}
                                        value={Array.isArray(filters.projectStage) ? filters.projectStage : (filters.projectStage ? [filters.projectStage] : null)}
                                        onChange={(opt) => {
                                            setFilters(prev => ({ ...prev, projectStage: opt && opt.length > 0 ? opt : null }))
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
                                {filterVisibility.projectSystem && (
                                    <Select
                                        placeholder="Project System"
                                        isClearable
                                        isMulti
                                        options={projectSystemOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={selectMenuStyles}
                                        value={Array.isArray(filters.projectSystem) ? filters.projectSystem : (filters.projectSystem ? [filters.projectSystem] : null)}
                                        onChange={(opt) => {
                                            setFilters(prev => ({ ...prev, projectSystem: opt && opt.length > 0 ? opt : null }))
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
                                        placeholder="Project Manager"
                                        isClearable
                                        isMulti
                                        options={projectManagerOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={selectMenuStyles}
                                        value={Array.isArray(filters.projectManager) ? filters.projectManager : (filters.projectManager ? [filters.projectManager] : null)}
                                        onChange={(opt) => {
                                            setFilters(prev => ({ ...prev, projectManager: opt && opt.length > 0 ? opt : null }))
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
                                {filterVisibility.isActive && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                            Project status
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setFilters(prev => {
                                                    const mode = !prev.isActive
                                                        ? 'all'
                                                        : prev.isActive.value === true
                                                        ? 'active'
                                                        : 'inactive'
                                                    const nextMode =
                                                        mode === 'all'
                                                            ? 'active'
                                                            : mode === 'active'
                                                            ? 'inactive'
                                                            : 'all'

                                                    let nextFilter = null
                                                    if (nextMode === 'active') {
                                                        nextFilter = { value: true, label: 'Active' }
                                                    } else if (nextMode === 'inactive') {
                                                        nextFilter = { value: false, label: 'Not Active' }
                                                    }

                                                    return {
                                                        ...prev,
                                                        isActive: nextFilter,
                                                    }
                                                })
                                            }
                                            className="inline-flex items-center gap-2"
                                        >
                                            <span
                                                className={`
                                                    relative inline-flex h-5 w-11 items-center rounded-full transition-colors duration-200
                                                    ${!filters.isActive
                                                        ? 'bg-gray-300 dark:bg-gray-600'
                                                        : filters.isActive.value === true
                                                        ? 'bg-emerald-500'
                                                        : 'bg-slate-400 dark:bg-slate-500'}
                                                `}
                                            >
                                                <span
                                                    className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
                                                    style={{
                                                        transform: !filters.isActive
                                                            ? 'translateX(0px)'       // All (left)
                                                            : filters.isActive.value === true
                                                            ? 'translateX(15px)'      // Active (center)
                                                            : 'translateX(30px)',     // Not Active (right)
                                                    }}
                                                />
                                            </span>
                                            <span className="text-xs text-gray-700 dark:text-gray-200">
                                                {!filters.isActive
                                                    ? 'All'
                                                    : filters.isActive.value === true
                                                    ? 'Active'
                                                    : 'Not Active'}
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
                                    placeholder="Search by Project Number, Name, Manager..."
                                    value={localSearchValue}
                                    onChange={(e) => {
                                        const value = e.target.value
                                        setLocalSearchValue(value)
                                        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
                                        searchDebounceRef.current = setTimeout(() => {
                                            setFilters(prev => ({ ...prev, search: value }))
                                        }, 300)
                                    }}
                                />
                                {filterVisibility.project !== false && (
                                    <Select
                                        placeholder="Project"
                                        isClearable
                                        isMulti
                                        options={projectOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={selectMenuStyles}
                                        value={Array.isArray(filters.project) ? filters.project : (filters.project ? [filters.project] : null)}
                                        onChange={(opt) => {
                                            setFilters(prev => ({ ...prev, project: opt && opt.length > 0 ? opt : null }))
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
                                {filterVisibility.projectStage !== false && (
                                    <Select
                                        placeholder="Project Stage"
                                        isClearable
                                        isMulti
                                        options={projectStageOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={selectMenuStyles}
                                        value={Array.isArray(filters.projectStage) ? filters.projectStage : (filters.projectStage ? [filters.projectStage] : null)}
                                        onChange={(opt) => {
                                            setFilters(prev => ({ ...prev, projectStage: opt && opt.length > 0 ? opt : null }))
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
                                {filterVisibility.projectSystem && (
                                    <Select
                                        placeholder="Project System"
                                        isClearable
                                        isMulti
                                        options={projectSystemOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={selectMenuStyles}
                                        value={Array.isArray(filters.projectSystem) ? filters.projectSystem : (filters.projectSystem ? [filters.projectSystem] : null)}
                                        onChange={(opt) => {
                                            setFilters(prev => ({ ...prev, projectSystem: opt && opt.length > 0 ? opt : null }))
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
                                        placeholder="Project Manager"
                                        isClearable
                                        isMulti
                                        options={projectManagerOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={selectMenuStyles}
                                        value={Array.isArray(filters.projectManager) ? filters.projectManager : (filters.projectManager ? [filters.projectManager] : null)}
                                        onChange={(opt) => {
                                            setFilters(prev => ({ ...prev, projectManager: opt && opt.length > 0 ? opt : null }))
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
                                {filterVisibility.isActive && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                            Project status
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setFilters(prev => {
                                                    const mode = !prev.isActive
                                                        ? 'all'
                                                        : prev.isActive.value === true
                                                        ? 'active'
                                                        : 'inactive'
                                                    const nextMode =
                                                        mode === 'all'
                                                            ? 'active'
                                                            : mode === 'active'
                                                            ? 'inactive'
                                                            : 'all'

                                                    let nextFilter = null
                                                    if (nextMode === 'active') {
                                                        nextFilter = { value: true, label: 'Active' }
                                                    } else if (nextMode === 'inactive') {
                                                        nextFilter = { value: false, label: 'Not Active' }
                                                    }

                                                    return {
                                                        ...prev,
                                                        isActive: nextFilter,
                                                    }
                                                })
                                            }
                                            className="inline-flex items-center gap-2"
                                        >
                                            <span
                                                className={`
                                                    relative inline-flex h-5 w-11 items-center rounded-full transition-colors duration-200
                                                    ${!filters.isActive
                                                        ? 'bg-gray-300 dark:bg-gray-600'
                                                        : filters.isActive.value === true
                                                        ? 'bg-emerald-500'
                                                        : 'bg-slate-400 dark:bg-slate-500'}
                                                `}
                                            >
                                                <span
                                                    className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
                                                    style={{
                                                        transform: !filters.isActive
                                                            ? 'translateX(0px)'       // All (left)
                                                            : filters.isActive.value === true
                                                            ? 'translateX(12px)'      // Active (center)
                                                            : 'translateX(24px)',     // Not Active (right)
                                                    }}
                                                />
                                            </span>
                                            <span className="text-xs text-gray-700 dark:text-gray-200">
                                                {!filters.isActive
                                                    ? 'All'
                                                    : filters.isActive.value === true
                                                    ? 'Active'
                                                    : 'Not Active'}
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
                        (filters.project && (Array.isArray(filters.project) ? filters.project.length > 0 : filters.project.value)) ||
                        (filters.projectStage && (Array.isArray(filters.projectStage) ? filters.projectStage.length > 0 : filters.projectStage.value)) ||
                        (filters.projectSystem && (Array.isArray(filters.projectSystem) ? filters.projectSystem.length > 0 : filters.projectSystem.value)) ||
                        (filters.projectManager && (Array.isArray(filters.projectManager) ? filters.projectManager.length > 0 : filters.projectManager.value)) ||
                        (filters.isActive && (Array.isArray(filters.isActive) ? filters.isActive.length > 0 : filters.isActive.value))) && (
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
                                            checked={filterVisibility.project !== false}
                                            onChange={(checked) => handleFilterVisibilityChange('project', checked)}
                                        />
                                        <span>Project</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={filterVisibility.projectStage !== false}
                                            onChange={(checked) => handleFilterVisibilityChange('projectStage', checked)}
                                        />
                                        <span>Project Stage</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={filterVisibility.projectSystem !== false}
                                            onChange={(checked) => handleFilterVisibilityChange('projectSystem', checked)}
                                        />
                                        <span>Project System</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={filterVisibility.projectManager !== false}
                                            onChange={(checked) => handleFilterVisibilityChange('projectManager', checked)}
                                        />
                                        <span>Project Manager</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox
                                            checked={filterVisibility.isActive !== false}
                                            onChange={(checked) => handleFilterVisibilityChange('isActive', checked)}
                                        />
                                        <span>Is Active</span>
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
                                    <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                                        {allColumns.map((col) => {
                                            const key = col.meta?.key || col.accessorKey
                                            return (
                                                <label key={key} className="flex items-center gap-2 text-sm">
                                                    <Checkbox
                                                        checked={visibleColumns[key] !== false}
                                                        onChange={(checked) => {
                                                            setVisibleColumns((prev) => ({ ...prev, [key]: Boolean(checked) }))
                                                        }}
                                                    />
                                                    <span>{col.header}</span>
                                                </label>
                                            )
                                        })}
                                    </div>
                                </Card>
                                <Card className="p-4">
                                    <h6 className="font-semibold mb-3 flex items-center gap-2">
                                        Column Order
                                        <Tag className="text-xs">Project columns</Tag>
                                    </h6>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {columnOrder.map((key, idx) => {
                                            const col = allColumns.find(c => (c.meta?.key || c.accessorKey) === key)
                                            if (!col) return null
                                            return (
                                                <div key={key} className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                                    <span className="flex-1">{col.header}</span>
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
                                            )
                                        })}
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}

                    {/* Data Table - Fixed height with sticky top scrollbar */}
                    <div className="relative">
                        {/* Sticky top horizontal scrollbar - always visible */}
                        <div 
                            ref={topScrollbarRef}
                            id="table-top-scroll"
                            className="sticky top-0 z-20 overflow-x-auto overflow-y-hidden bg-transparent"
                            style={{ 
                                height: '17px',
                                scrollbarWidth: 'auto'
                            }}
                        >
                            <div 
                                id="table-scroll-content"
                                style={{ 
                                    width: '2000px',
                                    minWidth: '2000px', 
                                    height: '1px'
                                }}
                            ></div>
                        </div>
                        
                        {/* Main table with scroll - horizontal scrollbar hidden, only vertical visible */}
                        <div 
                            ref={tableScrollRef}
                            id="table-main-scroll"
                            className="overflow-y-auto table-hide-horizontal-scrollbar"
                            style={{ 
                                maxHeight: 'calc(100vh - 500px)',
                                scrollbarGutter: 'stable',
                                overflowX: 'auto'
                            }}
                        >
                            {isLoading ? (
                                <TableSkeleton rows={10} />
                            ) : (
                    <DataTable
                        columns={visibleColumnsList}
                        data={pageData}
                                    loading={false}
                        pagingData={{
                                        total: pageData.length,
                                        pageIndex: 1,
                                        pageSize: pageData.length,
                        }}
                        onSort={({ key, order }) => {
                            setSort({ key, order })
                        }}
                        className="table-compact"
                        overflow={false}
                    />
                            )}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Charts Section - Below Table */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Profitability by Project Status</h3>
                    <Chart
                        type="donut"
                        series={chartData.statusValues}
                        xAxis={chartData.statusLabels}
                        customOptions={{
                            labels: chartData.statusLabels,
                            legend: {
                                show: true,
                                position: 'bottom',
                                fontSize: '14px',
                                fontWeight: 500,
                                formatter: function(seriesName, opts) {
                                    const value = opts.w.globals.series[opts.seriesIndex]
                                    return `${seriesName}: ${formatCurrency(value)}`
                                },
                            },
                            plotOptions: {
                                pie: {
                                    donut: {
                                        labels: {
                                            show: true,
                                            total: {
                                                show: true,
                                                showAlways: true,
                                                label: 'Total Profit',
                                                formatter: function (w) {
                                                    const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0)
                                                    return formatCurrency(total)
                                                },
                                                fontSize: windowWidth < 768 ? '11px' : windowWidth < 1024 ? '13px' : '16px',
                                                fontWeight: 600,
                                            },
                                        },
                                    },
                                },
                            },
                            tooltip: {
                                y: {
                                    formatter: function(val) {
                                        return formatCurrency(val)
                                    },
                                },
                            },
                        }}
                        height={350}
                    />
                </Card>
                <Card className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                        <h3 className="text-lg font-semibold">Profitability Trend</h3>
                        <div className="flex items-center gap-2">
                            <DatePicker.DatePickerRange
                                value={trendDateRange}
                                onChange={(range) => {
                                    if (range && range[0] && range[1]) {
                                        setTrendDateRange(range)
                                    } else {
                                        // Reset to last 6 months when cleared
                                        const endDate = dayjs().endOf('day').toDate()
                                        const startDate = dayjs().subtract(6, 'months').startOf('day').toDate()
                                        setTrendDateRange([startDate, endDate])
                                    }
                                }}
                                placeholder="Select date range (default: last 6 months)"
                                size="sm"
                                clearable
                            />
                        </div>
                    </div>
                    <Chart
                        type="area"
                        series={[
                            {
                                name: 'Projected Profit',
                                data: chartData.trendValues,
                            },
                        ]}
                        xAxis={chartData.trendLabels}
                        customOptions={{
                            legend: {
                                show: true,
                                position: 'top',
                                horizontalAlign: 'right',
                            },
                            yaxis: {
                                title: {
                                    text: 'Projected Profit ($)',
                                    style: {
                                        fontSize: '12px',
                                        fontWeight: 500,
                                    },
                                },
                                labels: {
                                    formatter: function(val) {
                                        if (val >= 1000000) {
                                            return '$' + (val / 1000000).toFixed(1) + 'M'
                                        } else if (val >= 1000) {
                                            return '$' + (val / 1000).toFixed(0) + 'K'
                                        }
                                        return '$' + val.toFixed(0)
                                    },
                                },
                            },
                            xaxis: {
                                categories: chartData.trendLabels,
                                title: {
                                    text: 'Contract Start Date',
                                    style: {
                                        fontSize: '12px',
                                        fontWeight: 500,
                                    },
                                },
                                labels: {
                                    rotate: -45,
                                    rotateAlways: chartData.trendLabels.length > 10,
                                    maxHeight: 60,
                                    formatter: function(value, timestamp, opts) {
                                        // ApexCharts passes the category index, get the actual category label
                                        const index = typeof value === 'number' ? Math.floor(value) : (opts?.dataPointIndex ?? -1)
                                        if (index >= 0 && index < chartData.trendLabels.length) {
                                            return chartData.trendLabels[index]
                                        }
                                        // If value is already a string (category), return it
                                        if (typeof value === 'string') {
                                            return value
                                        }
                                        return String(value)
                                    },
                                },
                                tickAmount: chartData.trendLabels.length > 20 ? 10 : undefined,
                            },
                            tooltip: {
                                y: {
                                    formatter: function(val) {
                                        return formatCurrency(val)
                                    },
                                },
                                x: {
                                    formatter: function(value, opts) {
                                        const index = opts.dataPointIndex
                                        if (index >= 0 && index < chartData.trendRawDates.length) {
                                            const date = dayjs(chartData.trendRawDates[index])
                                            return date.format('MMM D, YYYY')
                                        }
                                        return value
                                    },
                                },
                            },
                        }}
                        height={350}
                    />
                    {/* Axis Legends */}
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
                            <div className="flex items-center gap-2">
                                <span><strong>Contract Start Date</strong> - Shows when projects started (format: Day Month)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span><strong>Projected Profit</strong> - Total projected profit for projects starting on that date</span>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

        </div>
    )
}

export default ProjectProfitability

