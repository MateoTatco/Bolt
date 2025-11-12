import React, { useMemo, useState, useEffect, useRef } from 'react'
import { Card, Input, Select, Tag, Tooltip, Button, Checkbox } from '@/components/ui'
import DataTable from '@/components/shared/DataTable'
import Chart from '@/components/shared/Chart'
import { HiOutlineCurrencyDollar } from 'react-icons/hi'
import { getAuth } from 'firebase/auth'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { components } from 'react-select'

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

// Mock data - will be replaced with Procore API integration
const generateMockProjects = () => {
    const projects = []
    const projectNames = [
        '7 Brew - Norman - OK',
        '7 Brew - Lawton - OK',
        '7 Brew - W. Main Street',
        '380 West Animal Hospital',
        '50th and Western - 1st Floor and LL Work',
        '50th and Western - 2nd Floor',
        '50th and Western - 3rd Floor',
        '63rd & Mac – ATM',
        '36 E 33rd - Bathroom Add',
        '3101 NE 63rd - Office/Lobby Renovation',
        '2908 Piazza Ct - Bore',
        '2800 S Telephone Rd - Site Assessment',
        '2546 N Moore Ave',
        '245 W Wilshire - Suite A',
        '241 W Wilshire',
        '2400 N 9th - Wall Infill',
        '23rd St Apartments',
        '200 NE 38th Ter',
        '1601 S Agnew - Tar & Gravel Repair',
        '13509 Railway - Suite A',
    ]
    const projectManagers = [
        'Brett Tatum',
        'Jamey Montgomery',
        'Joe Lassiter',
        'Simon Cox',
        'Trey Roberts',
        'Marc Dunham',
        'Heath Pickens',
        'Harrison McKee',
    ]
    const projectSystems = ['Red Team', 'Procore']
    const projectStatuses = [
        'Closed',
        'Not Awarded',
        'Pre-Construction',
        'Bidding',
        'Course of Construction',
    ]
    const profitCenterYears = ['2024', '2025', '2026', null]
    const contractStatuses = ['Active', 'Pending', 'Completed', 'Cancelled']

    for (let i = 0; i < 20; i++) {
        const contractValue = Math.floor(Math.random() * 5000000) + 100000
        const estCost = contractValue * (0.6 + Math.random() * 0.3)
        const initialProfit = contractValue - estCost
        const currentProfit = initialProfit * (0.8 + Math.random() * 0.4)
        const percentComplete = Math.random() * 100
        const isActive = Math.random() > 0.3

        projects.push({
            id: `proj-${i + 1}`,
            projectName: projectNames[i % projectNames.length],
            projectNumber: String(1720000 + i),
            projectManager: projectManagers[i % projectManagers.length],
            projectSystem: projectSystems[i % projectSystems.length],
            projectStatus: projectStatuses[i % projectStatuses.length],
            profitCenterYear: profitCenterYears[i % profitCenterYears.length],
            totalContractValue: contractValue,
            estCostAtCompletion: estCost,
            initialEstimatedProfit: initialProfit,
            currentProjectedProfit: currentProfit,
            estimatedDifference: currentProfit - initialProfit,
            percentProjectedProfit: (currentProfit / contractValue) * 100,
            balanceLeftOnContract: contractValue * (1 - percentComplete / 100),
            percentCompleteRevenue: percentComplete,
            percentCompleteCost: percentComplete * (0.9 + Math.random() * 0.2),
            customerRetainage: contractValue * 0.05,
            remainingCost: estCost * (1 - percentComplete / 100),
            vendorRetainage: estCost * 0.05,
            totalInvoiced: contractValue * (percentComplete / 100),
            contractStatus: contractStatuses[i % contractStatuses.length],
            contractStartDate: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
            contractEndDate: new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
            isActive: isActive,
            archiveDate: isActive ? null : new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        })
    }
    return projects
}

// Filter options
const projectStageOptions = [
    { value: 'Closed', label: 'Closed' },
    { value: 'Not Awarded', label: 'Not Awarded' },
    { value: 'Pre-Construction', label: 'Pre-Construction' },
    { value: 'Bidding', label: 'Bidding' },
    { value: 'Course of Construction', label: 'Course of Construction' },
]
const profitCenterYearOptions = [
    { value: '2024', label: '2024' },
    { value: '2025', label: '2025' },
    { value: '2026', label: '2026' },
]
const projectSystemOptions = [
    { value: 'Red Team', label: 'Red Team' },
    { value: 'Procore', label: 'Procore' },
]
const projectManagerOptions = [
    { value: 'Brett Tatum', label: 'Brett Tatum' },
    { value: 'Jamey Montgomery', label: 'Jamey Montgomery' },
    { value: 'Joe Lassiter', label: 'Joe Lassiter' },
    { value: 'Simon Cox', label: 'Simon Cox' },
    { value: 'Trey Roberts', label: 'Trey Roberts' },
    { value: 'Marc Dunham', label: 'Marc Dunham' },
    { value: 'Heath Pickens', label: 'Heath Pickens' },
    { value: 'Harrison McKee', label: 'Harrison McKee' },
]

const ProjectProfitability = () => {
    const [projects, setProjects] = useState([])
    const [filters, setFilters] = useState({
        search: '',
        project: null,
        projectStage: null,
        profitCenterYear: null,
        projectSystem: null,
        projectManager: null,
    })
    const [pageIndex, setPageIndex] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [sort, setSort] = useState({ key: '', order: '' })
    const [localSearchValue, setLocalSearchValue] = useState('')
    const [showFiltersMobile, setShowFiltersMobile] = useState(false)
    const [showMoreFilters, setShowMoreFilters] = useState(false)
    const [projectOptions, setProjectOptions] = useState([])
    const searchDebounceRef = useRef(null)

    // Column visibility and order (like Master Tracker) - includes all columns
    const defaultColumnKeys = [
        'projectName',
        'projectNumber',
        'projectManager',
        'projectSystem',
        'projectStatus',
        'profitCenterYear',
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
        projectSystem: false,
        projectManager: false,
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

    // Load mock data
    useEffect(() => {
        const mockData = generateMockProjects()
        setProjects(mockData)
        
        // Initialize project options from data
        const uniqueProjects = [...new Set(mockData.map(p => p.projectName))].map(name => ({
            value: name,
            label: name,
        }))
        setProjectOptions(uniqueProjects)
    }, [])

    // Filter projects
    const filteredProjects = useMemo(() => {
        const { search, project, projectStage, profitCenterYear, projectSystem, projectManager } = filters
        
        return projects
            .filter((proj) => {
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
                
                if (profitCenterYear) {
                    if (Array.isArray(profitCenterYear)) {
                        if (profitCenterYear.length > 0 && !profitCenterYear.some(y => y.value === String(proj.profitCenterYear))) return false
                    } else if (profitCenterYear.value) {
                        if (String(proj.profitCenterYear) !== profitCenterYear.value) return false
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
                
                return true
            })
            .sort((a, b) => {
                const { key, order } = sort
                if (!key || !order) return 0
                const dir = order === 'asc' ? 1 : -1
                const av = a[key]
                const bv = b[key]
                if (av === bv) return 0
                return av > bv ? dir : -dir
            })
    }, [projects, filters, sort])

    // Calculate summary values
    const summaryValues = useMemo(() => {
        return filteredProjects.reduce(
            (acc, proj) => {
                acc.totalContractValue += proj.totalContractValue || 0
                acc.totalProjectedProfit += proj.currentProjectedProfit || 0
                acc.jobToDateCost += (proj.estCostAtCompletion || 0) * ((proj.percentCompleteCost || 0) / 100)
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

    const pageTotal = filteredProjects.length
    const pageStart = (pageIndex - 1) * pageSize
    const pageEnd = pageStart + pageSize
    const pageData = filteredProjects.slice(pageStart, pageEnd)

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
                        <span className="block max-w-[300px] truncate font-semibold">{value || '-'}</span>
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
                return <span>{value || '-'}</span>
            },
        },
        {
            header: 'Project Manager',
            accessorKey: 'projectManager',
            size: 180,
            meta: { key: 'projectManager' },
            cell: (props) => {
                const value = props.row.original.projectManager
                return <span>{value || '-'}</span>
            },
        },
        {
            header: 'Project System',
            accessorKey: 'projectSystem',
            size: 140,
            meta: { key: 'projectSystem' },
            cell: (props) => {
                const value = props.row.original.projectSystem
                return <span>{value || '-'}</span>
            },
        },
        {
            header: 'Project Status',
            accessorKey: 'projectStatus',
            size: 180,
            meta: { key: 'projectStatus' },
            cell: (props) => {
                const value = props.row.original.projectStatus
                return <Tag className={statusColor(value)}>{value || '-'}</Tag>
            },
        },
        {
            header: 'Profit Center Year',
            accessorKey: 'profitCenterYear',
            size: 160,
            meta: { key: 'profitCenterYear' },
            cell: (props) => {
                const value = props.row.original.profitCenterYear
                return <span>{value || '-'}</span>
            },
        },
        {
            header: 'Total Contract Value',
            accessorKey: 'totalContractValue',
            size: 180,
            meta: { key: 'totalContractValue' },
            cell: (props) => {
                const value = props.row.original.totalContractValue
                return <span className="font-semibold">{formatCurrency(value)}</span>
            },
        },
        {
            header: 'Est. Cost At Completion',
            accessorKey: 'estCostAtCompletion',
            size: 200,
            meta: { key: 'estCostAtCompletion' },
            cell: (props) => {
                const value = props.row.original.estCostAtCompletion
                return <span>{formatCurrency(value)}</span>
            },
        },
        {
            header: 'Initial Estimated Profit',
            accessorKey: 'initialEstimatedProfit',
            size: 200,
            meta: { key: 'initialEstimatedProfit' },
            cell: (props) => {
                const value = props.row.original.initialEstimatedProfit
                return <span>{formatCurrency(value)}</span>
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
                    <span className={isPositive ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
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
                    <span className={isPositive ? 'text-emerald-600' : 'text-red-600'}>
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
                    <span className={isPositive ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
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
                return <span>{formatCurrency(value)}</span>
            },
        },
        {
            header: 'Percent Complete (Revenue)',
            accessorKey: 'percentCompleteRevenue',
            size: 220,
            meta: { key: 'percentCompleteRevenue' },
            cell: (props) => {
                const value = props.row.original.percentCompleteRevenue
                return <span>{formatPercent(value)}</span>
            },
        },
        {
            header: 'Percent Complete (Cost)',
            accessorKey: 'percentCompleteCost',
            size: 200,
            meta: { key: 'percentCompleteCost' },
            cell: (props) => {
                const value = props.row.original.percentCompleteCost
                return <span>{formatPercent(value)}</span>
            },
        },
        {
            header: 'Customer Retainage',
            accessorKey: 'customerRetainage',
            size: 180,
            meta: { key: 'customerRetainage' },
            cell: (props) => {
                const value = props.row.original.customerRetainage
                return <span>{formatCurrency(value)}</span>
            },
        },
        {
            header: 'Remaining Cost',
            accessorKey: 'remainingCost',
            size: 160,
            meta: { key: 'remainingCost' },
            cell: (props) => {
                const value = props.row.original.remainingCost
                return <span>{formatCurrency(value)}</span>
            },
        },
        {
            header: 'Vendor Retainage',
            accessorKey: 'vendorRetainage',
            size: 180,
            meta: { key: 'vendorRetainage' },
            cell: (props) => {
                const value = props.row.original.vendorRetainage
                return <span>{formatCurrency(value)}</span>
            },
        },
        {
            header: 'Total Invoiced',
            accessorKey: 'totalInvoiced',
            size: 160,
            meta: { key: 'totalInvoiced' },
            cell: (props) => {
                const value = props.row.original.totalInvoiced
                return <span>{formatCurrency(value)}</span>
            },
        },
        {
            header: 'Contract Status',
            accessorKey: 'contractStatus',
            size: 160,
            meta: { key: 'contractStatus' },
            cell: (props) => {
                const value = props.row.original.contractStatus
                return <span>{value || '-'}</span>
            },
        },
        {
            header: 'Contract Start Date',
            accessorKey: 'contractStartDate',
            size: 180,
            meta: { key: 'contractStartDate' },
            cell: (props) => {
                const value = props.row.original.contractStartDate
                return <span>{formatDate(value)}</span>
            },
        },
        {
            header: 'Contract End Date',
            accessorKey: 'contractEndDate',
            size: 180,
            meta: { key: 'contractEndDate' },
            cell: (props) => {
                const value = props.row.original.contractEndDate
                return <span>{formatDate(value)}</span>
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
                    <Tag className={value ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}>
                        {value ? 'Yes' : 'No'}
                    </Tag>
                )
            },
        },
        {
            header: 'Archive Date',
            accessorKey: 'archiveDate',
            size: 160,
            meta: { key: 'archiveDate' },
            cell: (props) => {
                const value = props.row.original.archiveDate
                return <span>{formatDate(value)}</span>
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

        // Profitability trend (by month)
        const monthlyProfit = {}
        filteredProjects.forEach(proj => {
            if (proj.contractStartDate) {
                const date = proj.contractStartDate instanceof Date 
                    ? proj.contractStartDate 
                    : new Date(proj.contractStartDate)
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                if (!monthlyProfit[monthKey]) {
                    monthlyProfit[monthKey] = 0
                }
                monthlyProfit[monthKey] += proj.currentProjectedProfit || 0
            }
        })

        // Format for donut chart
        const statusLabels = Object.keys(statusProfit)
        const statusValues = Object.values(statusProfit)

        // Format for area chart
        const sortedMonths = Object.keys(monthlyProfit).sort()
        const monthlyValues = sortedMonths.map(month => monthlyProfit[month])

        return {
            statusLabels,
            statusValues,
            monthlyLabels: sortedMonths,
            monthlyValues,
        }
    }, [filteredProjects])

    const handleClearAllFilters = () => {
        setPageIndex(1)
        setFilters({
            search: '',
            project: null,
            projectStage: null,
            profitCenterYear: null,
            projectSystem: null,
            projectManager: null,
        })
        setLocalSearchValue('')
    }


    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">Project Profitability</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        This report includes project details and projections from Procore
                    </p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                Total Contract Value (Sum)
                            </p>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                {formatCurrency(summaryValues.totalContractValue)}
                            </p>
                        </div>
                        <div className="p-3 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
                            <HiOutlineCurrencyDollar className="text-2xl text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                Total Projected Profit (Sum)
                            </p>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                {formatCurrency(summaryValues.totalProjectedProfit)}
                            </p>
                        </div>
                        <div className="p-3 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg">
                            <HiOutlineCurrencyDollar className="text-2xl text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                Job To Date Cost (Sum)
                            </p>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                {formatCurrency(summaryValues.jobToDateCost)}
                            </p>
                        </div>
                        <div className="p-3 bg-amber-100 dark:bg-amber-500/20 rounded-lg">
                            <HiOutlineCurrencyDollar className="text-2xl text-amber-600 dark:text-amber-400" />
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
                                            setPageIndex(1)
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
                                <Select
                                    placeholder="Project"
                                    isClearable
                                    isMulti
                                    options={projectOptions}
                                    menuPortalTarget={document.body}
                                    menuPosition="fixed"
                                    value={Array.isArray(filters.project) ? filters.project : (filters.project ? [filters.project] : null)}
                                    onChange={(opt) => {
                                        setPageIndex(1)
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
                                <Select
                                    placeholder="Project Stage"
                                    isClearable
                                    isMulti
                                    options={projectStageOptions}
                                    menuPortalTarget={document.body}
                                    menuPosition="fixed"
                                    value={Array.isArray(filters.projectStage) ? filters.projectStage : (filters.projectStage ? [filters.projectStage] : null)}
                                    onChange={(opt) => {
                                        setPageIndex(1)
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
                                <Select
                                    placeholder="Profit Center Year"
                                    isClearable
                                    isMulti
                                    options={profitCenterYearOptions}
                                    menuPortalTarget={document.body}
                                    menuPosition="fixed"
                                    value={Array.isArray(filters.profitCenterYear) ? filters.profitCenterYear : (filters.profitCenterYear ? [filters.profitCenterYear] : null)}
                                    onChange={(opt) => {
                                        setPageIndex(1)
                                        setFilters(prev => ({ ...prev, profitCenterYear: opt && opt.length > 0 ? opt : null }))
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
                                {filterVisibility.projectSystem && (
                                    <Select
                                        placeholder="Project System"
                                        isClearable
                                        isMulti
                                        options={projectSystemOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        value={Array.isArray(filters.projectSystem) ? filters.projectSystem : (filters.projectSystem ? [filters.projectSystem] : null)}
                                        onChange={(opt) => {
                                            setPageIndex(1)
                                            setFilters(prev => ({ ...prev, projectSystem: opt && opt.length > 0 ? opt : null }))
                                        }}
                                        components={{
                                            ValueContainer: CustomValueContainer,
                                            MultiValue: CustomMultiValue,
                                        }}
                                        controlShouldRenderValue={false}
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
                                        value={Array.isArray(filters.projectManager) ? filters.projectManager : (filters.projectManager ? [filters.projectManager] : null)}
                                        onChange={(opt) => {
                                            setPageIndex(1)
                                            setFilters(prev => ({ ...prev, projectManager: opt && opt.length > 0 ? opt : null }))
                                        }}
                                        components={{
                                            ValueContainer: CustomValueContainer,
                                            MultiValue: CustomMultiValue,
                                        }}
                                        controlShouldRenderValue={false}
                                    />
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
                                            setPageIndex(1)
                                            setFilters(prev => ({ ...prev, search: value }))
                                        }, 300)
                                    }}
                                />
                                <Select
                                    placeholder="Project"
                                    isClearable
                                    isMulti
                                    options={projectOptions}
                                    value={Array.isArray(filters.project) ? filters.project : (filters.project ? [filters.project] : null)}
                                    onChange={(opt) => {
                                        setPageIndex(1)
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
                                <Select
                                    placeholder="Project Stage"
                                    isClearable
                                    isMulti
                                    options={projectStageOptions}
                                    value={Array.isArray(filters.projectStage) ? filters.projectStage : (filters.projectStage ? [filters.projectStage] : null)}
                                    onChange={(opt) => {
                                        setPageIndex(1)
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
                                <Select
                                    placeholder="Profit Center Year"
                                    isClearable
                                    isMulti
                                    options={profitCenterYearOptions}
                                    value={Array.isArray(filters.profitCenterYear) ? filters.profitCenterYear : (filters.profitCenterYear ? [filters.profitCenterYear] : null)}
                                    onChange={(opt) => {
                                        setPageIndex(1)
                                        setFilters(prev => ({ ...prev, profitCenterYear: opt && opt.length > 0 ? opt : null }))
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
                                {filterVisibility.projectSystem && (
                                    <Select
                                        placeholder="Project System"
                                        isClearable
                                        isMulti
                                        options={projectSystemOptions}
                                        value={Array.isArray(filters.projectSystem) ? filters.projectSystem : (filters.projectSystem ? [filters.projectSystem] : null)}
                                        onChange={(opt) => {
                                            setPageIndex(1)
                                            setFilters(prev => ({ ...prev, projectSystem: opt && opt.length > 0 ? opt : null }))
                                        }}
                                        components={{
                                            ValueContainer: CustomValueContainer,
                                            MultiValue: CustomMultiValue,
                                        }}
                                        controlShouldRenderValue={false}
                                    />
                                )}
                                {filterVisibility.projectManager && (
                                    <Select
                                        placeholder="Project Manager"
                                        isClearable
                                        isMulti
                                        options={projectManagerOptions}
                                        value={Array.isArray(filters.projectManager) ? filters.projectManager : (filters.projectManager ? [filters.projectManager] : null)}
                                        onChange={(opt) => {
                                            setPageIndex(1)
                                            setFilters(prev => ({ ...prev, projectManager: opt && opt.length > 0 ? opt : null }))
                                        }}
                                        components={{
                                            ValueContainer: CustomValueContainer,
                                            MultiValue: CustomMultiValue,
                                        }}
                                        controlShouldRenderValue={false}
                                    />
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
                        (filters.profitCenterYear && (Array.isArray(filters.profitCenterYear) ? filters.profitCenterYear.length > 0 : filters.profitCenterYear.value)) ||
                        (filters.projectSystem && (Array.isArray(filters.projectSystem) ? filters.projectSystem.length > 0 : filters.projectSystem.value)) ||
                        (filters.projectManager && (Array.isArray(filters.projectManager) ? filters.projectManager.length > 0 : filters.projectManager.value))) && (
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

                    {/* Data Table */}
                    <DataTable
                        columns={visibleColumnsList}
                        data={pageData}
                        loading={false}
                        pagingData={{
                            total: pageTotal,
                            pageIndex,
                            pageSize,
                        }}
                        onPaginationChange={(pageIndex, pageSize) => {
                            setPageIndex(pageIndex)
                            setPageSize(pageSize)
                        }}
                        onSort={({ key, order }) => {
                            setSort({ key, order })
                        }}
                    />
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
                                                fontSize: '16px',
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
                    <h3 className="text-lg font-semibold mb-4">Profitability Trend</h3>
                    <Chart
                        type="area"
                        series={[
                            {
                                name: 'Projected Profit',
                                data: chartData.monthlyValues,
                            },
                        ]}
                        xAxis={chartData.monthlyLabels}
                        customOptions={{
                            yaxis: {
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
                                labels: {
                                    formatter: function(value) {
                                        // Convert "2024-06" to "01 Jun"
                                        if (typeof value !== 'string') {
                                            value = String(value)
                                        }
                                        const parts = value.split('-')
                                        if (parts.length === 2) {
                                            const year = parts[0]
                                            const month = parseInt(parts[1], 10)
                                            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                                            if (month >= 1 && month <= 12) {
                                                return `01 ${monthNames[month - 1]}`
                                            }
                                        }
                                        return value
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
            </div>
        </div>
    )
}

export default ProjectProfitability

