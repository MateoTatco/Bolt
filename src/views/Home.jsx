import React, { useMemo, useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { Button, Card, Input, Select, DatePicker, Tag, Tooltip, Dialog, Form, FormItem, FormContainer, Switcher, Checkbox, Dropdown } from '@/components/ui'
import DataTable from '@/components/shared/DataTable'
import { useCrmStore } from '@/store/crmStore'
import { leadStatusOptions, methodOfContactOptions, projectMarketOptions } from '@/mock/data/leadsData'
import { HiOutlineStar, HiOutlineEye, HiOutlinePencil, HiOutlineTrash, HiOutlineUpload, HiOutlinePlus, HiOutlineDotsHorizontal } from 'react-icons/hi'
import FirebaseTest from '@/components/FirebaseTest'
import FirebaseAdvancedTest from '@/components/FirebaseAdvancedTest'
import BulkDataManager from '@/components/BulkDataManager'
import { migrateMarketOptions, resetAndMigrateLeads } from '@/utils/migrateMarketOptions'
import { removeClientNumberFromClients, resetAndMigrateClients } from '@/utils/removeClientNumber'
import { migrateTasksMockData, resetAndMigrateTasks, clearTasksData } from '@/utils/migrateTasksMockData'
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

const Home = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const leads = useCrmStore((s) => s.leads)
    const clients = useCrmStore((s) => s.clients)
    const filters = useCrmStore((s) => s.filters)
    const loading = useCrmStore((s) => s.loading)
    const setFilters = useCrmStore((s) => s.setFilters)
    // Favorite: remove old handler, we'll pass entityType explicitly
    const toggleFavorite = useCrmStore((s) => s.toggleFavorite)
    const loadLeads = useCrmStore((s) => s.loadLeads)
    
    // Z-index fix for Select dropdowns to appear above sticky headers
    const selectZIndexStyles = {
        menuPortal: (provided) => ({ ...provided, zIndex: 9999 }),
        menu: (provided) => ({ ...provided, zIndex: 9999 }),
    }
    const loadClients = useCrmStore((s) => s.loadClients)
    const addLead = useCrmStore((s) => s.addLead)
    const addClient = useCrmStore((s) => s.addClient)
    const deleteLead = useCrmStore((s) => s.deleteLead)
    const deleteClient = useCrmStore((s) => s.deleteClient)

    // Load data on component mount
    useEffect(() => {
        loadLeads()
        loadClients()
    }, [loadLeads, loadClients])

    // Force tatcoContact column to be visible and in order on first load
    useEffect(() => {
        const currentType = (filters.type && filters.type.value) || 'lead'
        const storageSuffix = currentType === 'client' ? 'client' : 'lead'
        
        if (currentType === 'lead') {
            // Ensure tatcoContact is visible
            setVisibleColumns(prev => {
                if (prev.tatcoContact === undefined || prev.tatcoContact === false) {
                    const updated = { ...prev, tatcoContact: true }
                    // Persist the change
                    try {
                        localStorage.setItem(`crmVisibleColumns_${storageSuffix}`, JSON.stringify(updated))
                    } catch {}
                    return updated
                }
                return prev
            })
            
            // Ensure tatcoContact is in the column order
            setColumnOrder(prev => {
                if (!prev.includes('tatcoContact')) {
                    // Insert tatcoContact after leadContact
                    const newOrder = [...prev]
                    const leadContactIndex = newOrder.indexOf('leadContact')
                    if (leadContactIndex !== -1) {
                        newOrder.splice(leadContactIndex + 1, 0, 'tatcoContact')
                    } else {
                        // If leadContact not found, add at the beginning
                        newOrder.unshift('tatcoContact')
                    }
                    // Persist the change
                    try {
                        localStorage.setItem(`crmColumnOrder_${storageSuffix}`, JSON.stringify(newOrder))
                    } catch {}
                    return newOrder
                }
                return prev
            })
        }
    }, [filters.type])

    const [pageIndex, setPageIndex] = useState(1)
    const [pageSize, setPageSize] = useState(100)
    const [sort, setSort] = useState({ key: '', order: '' })
    const [tableInstanceKey, setTableInstanceKey] = useState(0)

    // Debounce timer refs
    const searchDebounceRef = useRef(null)
    const dateDebounceRef = useRef(null)
    
    // Local search state for immediate UI updates
    const [localSearchValue, setLocalSearchValue] = useState('')

    // Column visibility & order persistence (per entity type)
    const defaultLeadKeys = [
        'companyName',
        'leadContact',
        'tatcoContact',
        'email',
        'phone',
        'methodOfContact',
        'projectMarket',
        'dateLastContacted',
        'status',
        'responded',
        'actions',
    ]
    const defaultClientKeys = [
        'clientName',
        'address',
        'city',
        'state',
        'zip',
        'tags',
        'actions',
    ]

    const currentType = (filters.type && filters.type.value) || 'lead'
    const storageSuffix = currentType === 'client' ? 'client' : 'lead'
    const getDefaultKeys = () => (currentType === 'client' ? defaultClientKeys : defaultLeadKeys)

    const [columnOrder, setColumnOrder] = useState(() => {
        try {
            const raw = localStorage.getItem(`crmColumnOrder_${storageSuffix}`)
            const parsed = raw ? JSON.parse(raw) : null
            const def = getDefaultKeys()
            if (Array.isArray(parsed) && parsed.length) {
                // Migration: replace leadName with companyName in column order
                return parsed.map(key => key === 'leadName' ? 'companyName' : key)
            }
            return def
        } catch {
            return getDefaultKeys()
        }
    })
    const [visibleColumns, setVisibleColumns] = useState(() => {
        try {
            const raw = localStorage.getItem(`crmVisibleColumns_${storageSuffix}`)
            const parsed = raw ? JSON.parse(raw) : null
            if (parsed && typeof parsed === 'object') {
                // Migration: if leadName exists, rename it to companyName
                if (parsed.leadName !== undefined) {
                    parsed.companyName = parsed.leadName
                    delete parsed.leadName
                }
                // Ensure tatcoContact is visible by default
                if (parsed.tatcoContact === undefined) {
                    parsed.tatcoContact = true
                }
                return parsed
            }
        } catch {}
        return getDefaultKeys().reduce((acc, key) => ({ ...acc, [key]: true }), {})
    })

    // When type changes, reload persisted or defaults for that type
    useEffect(() => {
        try {
            const rawOrder = localStorage.getItem(`crmColumnOrder_${storageSuffix}`)
            const parsedOrder = rawOrder ? JSON.parse(rawOrder) : null
            const def = getDefaultKeys()
            if (Array.isArray(parsedOrder) && parsedOrder.length) {
                // Migration: replace leadName with companyName in column order
                const migratedOrder = parsedOrder.map(key => key === 'leadName' ? 'companyName' : key)
                setColumnOrder(migratedOrder)
            } else {
                setColumnOrder(def)
            }

            const rawVisible = localStorage.getItem(`crmVisibleColumns_${storageSuffix}`)
            const parsedVisible = rawVisible ? JSON.parse(rawVisible) : null
            if (parsedVisible && typeof parsedVisible === 'object') {
                // Migration: if leadName exists, rename it to companyName
                if (parsedVisible.leadName !== undefined) {
                    parsedVisible.companyName = parsedVisible.leadName
                    delete parsedVisible.leadName
                }
                // Ensure tatcoContact is visible by default
                if (parsedVisible.tatcoContact === undefined) {
                    parsedVisible.tatcoContact = true
                }
                setVisibleColumns(parsedVisible)
            } else {
                setVisibleColumns(def.reduce((acc, key) => ({ ...acc, [key]: true }), {}))
            }
        } catch {
            const def = getDefaultKeys()
            setColumnOrder(def)
            setVisibleColumns(def.reduce((acc, key) => ({ ...acc, [key]: true }), {}))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storageSuffix])

    // Persist per type
    useEffect(() => {
        try {
            localStorage.setItem(`crmVisibleColumns_${storageSuffix}`, JSON.stringify(visibleColumns))
            localStorage.setItem(`crmColumnOrder_${storageSuffix}`, JSON.stringify(columnOrder))
        } catch {}
    }, [visibleColumns, columnOrder, storageSuffix])

    // Date presets
    const datePresetOptions = [
        { value: 'none', label: 'Date: Custom' },
        { value: 'last7', label: 'Date: Last 7 days' },
        { value: 'last30', label: 'Date: Last 30 days' },
        { value: 'thisMonth', label: 'Date: This month' },
        { value: 'lastMonth', label: 'Date: Last month' },
    ]
    const [datePreset, setDatePreset] = useState('none')

    // UI state for collapsible sections
    const [showMoreFilters, setShowMoreFilters] = useState(false)
    const [showFiltersMobile, setShowFiltersMobile] = useState(false)
    
    // Filter visibility preferences (per-user, stored in Firestore)
    const defaultFilterVisibility = {
        status: true,
        methodOfContact: true,
        responded: true,
        dateRange: true,
        datePreset: true
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
                if (result.success && result.data?.filterPreferences?.crm) {
                    setFilterVisibility({
                        ...defaultFilterVisibility,
                        ...result.data.filterPreferences.crm
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
                    crm: newVisibility
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
    
    // Confirmation dialog state
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
        onCancel: null
    })


    // Helper function to show confirmation dialog
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

    // Sync local search value with filters
    useEffect(() => {
        setLocalSearchValue(filters.search || '')
    }, [filters.search])

    // Sync state from URL query on first load
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const qPage = parseInt(params.get('page') || '1', 10)
        const qSize = parseInt(params.get('size') || '100', 10)
        const qSortKey = params.get('sortKey') || ''
        const qSortOrder = params.get('sortOrder') || ''
        const qSearch = params.get('search') || ''
        const qType = params.get('type') || ''
        const qStatus = params.get('status') || ''
        const qMethod = params.get('method') || ''
        const qResponded = params.get('responded') // 'true' | 'false' | null
        const qFrom = params.get('from')
        const qTo = params.get('to')

        // Only apply if any query param exists
        if ([...params.keys()].length > 0) {
            setPageIndex(Number.isNaN(qPage) ? 1 : qPage)
            setPageSize(Number.isNaN(qSize) ? 100 : qSize)
            setSort({ key: qSortKey, order: qSortOrder })

            const nextFilters = {}
            if (qSearch) nextFilters.search = qSearch
            if (qType) nextFilters.type = { value: qType, label: qType === 'lead' ? '👤 Lead' : '🏢 Client' }
            // Handle status as array (comma-separated in URL)
            if (qStatus) {
                const statusArray = qStatus.split(',').filter(Boolean)
                nextFilters.status = statusArray.map(s => ({ value: s.trim(), label: s.trim() }))
            }
            // Handle method as array (comma-separated in URL)
            if (qMethod) {
                const methodArray = qMethod.split(',').filter(Boolean)
                nextFilters.methodOfContact = methodArray.map(m => ({ value: m.trim(), label: m.trim() }))
            }
            if (qResponded === 'true' || qResponded === 'false') {
                nextFilters.responded = { value: qResponded === 'true', label: qResponded === 'true' ? 'Responded' : 'No response' }
            }
            if (qFrom || qTo) {
                // Parse to Date objects because DatePickerRange expects [Date, Date]
                nextFilters.dateFrom = qFrom ? new Date(qFrom) : null
                nextFilters.dateTo = qTo ? new Date(qTo) : null
            }

            if (Object.keys(nextFilters).length > 0) {
                setFilters(nextFilters)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Push state to URL when paging/sort/filters change
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        params.set('page', String(pageIndex))
        params.set('size', String(pageSize))
        if (sort.key && sort.order) {
            params.set('sortKey', sort.key)
            params.set('sortOrder', sort.order)
        } else {
            params.delete('sortKey')
            params.delete('sortOrder')
        }
        if (filters.search) params.set('search', filters.search); else params.delete('search')
        if (filters.type?.value) params.set('type', filters.type.value); else params.delete('type')
        // Handle status as array
        if (filters.status) {
            if (Array.isArray(filters.status) && filters.status.length > 0) {
                params.set('status', filters.status.map(s => s.value).join(','))
            } else if (!Array.isArray(filters.status) && filters.status.value) {
                params.set('status', filters.status.value)
            } else {
                params.delete('status')
            }
        } else {
            params.delete('status')
        }
        // Handle methodOfContact as array
        if (filters.methodOfContact) {
            if (Array.isArray(filters.methodOfContact) && filters.methodOfContact.length > 0) {
                params.set('method', filters.methodOfContact.map(m => m.value).join(','))
            } else if (!Array.isArray(filters.methodOfContact) && filters.methodOfContact.value) {
                params.set('method', filters.methodOfContact.value)
            } else {
                params.delete('method')
            }
        } else {
            params.delete('method')
        }
        if (typeof filters.responded === 'object' && filters.responded?.value !== undefined) {
            params.set('responded', String(filters.responded.value))
        } else if (typeof filters.responded === 'boolean') {
            params.set('responded', String(filters.responded))
        } else {
            params.delete('responded')
        }
        const serializeDate = (d) => d instanceof Date ? d.toISOString().slice(0,10) : d
        if (filters.dateFrom) params.set('from', serializeDate(filters.dateFrom)); else params.delete('from')
        if (filters.dateTo) params.set('to', serializeDate(filters.dateTo)); else params.delete('to')

        const next = `${location.pathname}?${params.toString()}`
        if (next !== `${location.pathname}${location.search ? `?${location.search.replace(/^\?/, '')}` : ''}`) {
            window.history.replaceState(null, '', next)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageIndex, pageSize, sort, filters])

    const filteredLeads = useMemo(() => {
        const { search, status, methodOfContact, responded, dateFrom, dateTo, type } = filters
        
        // Combine leads and clients with type indicators
        const combinedData = [
            ...leads.map(lead => ({ ...lead, entityType: 'lead' })),
            ...clients.map(client => ({ ...client, entityType: 'client' }))
        ]
        
        return combinedData
            .filter((item) => {
                if (search) {
                    const term = search.toLowerCase()
                    let hay = ''
                    if (item.entityType === 'lead') {
                        hay = `${item.companyName} ${item.leadContact} ${item.tatcoContact || ''} ${item.title} ${item.email} ${item.phone}`.toLowerCase()
                    } else {
                        hay = `${item.clientName} ${item.address} ${item.city} ${item.state}`.toLowerCase()
                    }
                    if (!hay.includes(term)) return false
                }
                
                // Type filter (default to 'lead' if not set)
                const currentType = type?.value || 'lead'
                if (item.entityType !== currentType) return false
                
                // Lead-specific filters
                if (item.entityType === 'lead') {
                // Status filter - handle both single object and array
                if (status) {
                    if (Array.isArray(status)) {
                        if (status.length > 0 && !status.some(s => s.value === item.status)) return false
                    } else if (status.value) {
                        if (item.status !== status.value) return false
                    }
                }
                // Method filter - handle both single object and array
                if (methodOfContact) {
                    if (Array.isArray(methodOfContact)) {
                        if (methodOfContact.length > 0 && !methodOfContact.some(m => m.value === item.methodOfContact)) return false
                    } else if (methodOfContact.value) {
                        if (item.methodOfContact !== methodOfContact.value) return false
                    }
                }
                if (responded !== null && responded !== undefined) {
                    if (typeof responded === 'object' && 'value' in responded) {
                            if (item.responded !== responded.value) return false
                    } else if (typeof responded === 'boolean') {
                            if (item.responded !== responded) return false
                    }
                }
                if (dateFrom) {
                        if (new Date(item.dateLastContacted) < new Date(dateFrom)) return false
                }
                if (dateTo) {
                        if (new Date(item.dateLastContacted) > new Date(dateTo)) return false
                }
                }
                
                return true
            })
            .sort((a, b) => {
                // Pin to top: prioritize favorites first, then regular ordering
                if (a.favorite && !b.favorite) return -1
                if (!a.favorite && b.favorite) return 1
                
                // Then apply manual sorting if specified
                const { key, order } = sort
                if (!key || !order) return 0
                const dir = order === 'asc' ? 1 : -1
                const av = a[key]
                const bv = b[key]
                if (av === bv) return 0
                return av > bv ? dir : -dir
            })
    }, [leads, clients, filters, sort])

    // Clear all filters function
    const handleClearAllFilters = () => {
        setPageIndex(1)
        setFilters({
            search: '',
            status: null,
            methodOfContact: null,
            responded: null,
            dateFrom: null,
            dateTo: null,
            // Keep type filter as is
        })
        setLocalSearchValue('')
        setDatePreset('none')
    }

    const pageTotal = filteredLeads.length
    const pageStart = (pageIndex - 1) * pageSize
    const pageEnd = pageStart + pageSize
    const pageData = filteredLeads.slice(pageStart, pageEnd)

    const statusColor = (value) => {
        switch (value) {
            case 'new':
                return 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-100'
            case 'contacted':
                return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-100'
            case 'qualified':
                return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-100'
            case 'proposal':
                return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100'
            case 'won':
                return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100'
            case 'lost':
                return 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-100'
            default:
                return 'bg-gray-100 text-gray-700'
        }
    }

    const respondedOptions = [
        { value: true, label: 'Responded' },
        { value: false, label: 'No response' },
    ]


    const handleDeleteLead = async (leadId) => {
        showConfirmDialog(
            'Delete Lead',
            'Are you sure you want to delete this lead? This action cannot be undone.',
            async () => {
            try {
                await deleteLead(leadId)
            } catch (error) {
                console.error('Error deleting lead:', error)
            }
        }
        )
    }

    const handleDeleteClient = async (clientId) => {
        showConfirmDialog(
            'Delete Client',
            'Are you sure you want to delete this client? This action cannot be undone.',
            async () => {
            try {
                await deleteClient(clientId)
            } catch (error) {
                console.error('Error deleting client:', error)
            }
        }
        )
    }

    // Dedicated column sets per entity type
    const leadColumns = useMemo(
        () => [
            {
                header: 'Company Name',
                accessorKey: 'companyName',
                size: 260,
                meta: { key: 'companyName' },
                cell: (props) => {
                    const item = props.row.original
                    return (
                    <button 
                            onClick={(e) => handleLeadNameClick(e, item.id)}
                        className="font-semibold text-left hover:text-primary transition-colors"
                    >
                            {item.companyName}
                    </button>
                    )
                },
            },
            {
                header: 'Contact',
                accessorKey: 'leadContact',
                size: 220,
                meta: { key: 'leadContact' },
                cell: (props) => {
                    const value = props.row.original.leadContact || '-'
                    return (
                        <Tooltip title={value}>
                            <span className="block max-w-[220px] truncate">{value}</span>
                        </Tooltip>
                    )
                },
            },
            {
                header: 'Tatco Contact',
                accessorKey: 'tatcoContact',
                size: 180,
                meta: { key: 'tatcoContact' },
                cell: (props) => {
                    const value = props.row.original.tatcoContact
                    return <span>{value || '-'}</span>
                },
            },
            { 
                header: 'Email', accessorKey: 'email', size: 260, meta: { key: 'email' },
                cell: (props) => {
                    const value = props.row.original.email || '-'
                    return (
                        <Tooltip title={value}>
                            <span className="block max-w-[280px] truncate">{value}</span>
                        </Tooltip>
                    )
                }
            },
            { 
                header: 'Phone', accessorKey: 'phone', size: 200, meta: { key: 'phone' },
                cell: (props) => {
                    const raw = (props.row.original.phone || '').toString().trim()
                    const digits = raw.replace(/\D/g, '')
                    let formatted = raw
                    if (digits.length === 10) {
                        formatted = `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
                    }
                    if (!formatted) formatted = '-'
                    return (
                        <Tooltip title={raw || '-'}>
                            <span className="whitespace-nowrap">{formatted}</span>
                        </Tooltip>
                    )
                }
            },
            {
                header: 'Method', accessorKey: 'methodOfContact', size: 140, meta: { key: 'methodOfContact' },
                cell: (props) => {
                    const val = props.row.original.methodOfContact
                    const opt = methodOfContactOptions.find((o) => o.value === val)
                    return <span>{opt ? opt.label : val}</span>
                },
            },
            {
                header: 'Market', accessorKey: 'projectMarket', size: 150, meta: { key: 'projectMarket' },
                cell: (props) => {
                    const val = props.row.original.projectMarket
                    const opt = projectMarketOptions.find((o) => o.value === val)
                    return <span>{opt ? opt.label : val}</span>
                },
            },
            {
                header: 'Last Contacted', accessorKey: 'dateLastContacted', size: 150, meta: { key: 'dateLastContacted' },
                cell: (props) => {
                    const date = props.row.original.dateLastContacted
                    if (!date) return <span>-</span>
                    const dateStr = date instanceof Date ? date.toISOString().slice(0,10) : date
                    return <span>{dateStr}</span>
                },
            },
            {
                header: 'Status', accessorKey: 'status', size: 140, meta: { key: 'status' },
                cell: (props) => {
                    const val = props.row.original.status
                    const opt = leadStatusOptions.find((o) => o.value === val)
                    return <Tag className={statusColor(val)}>{opt ? opt.label : val}</Tag>
                },
            },
            {
                header: 'Responded', accessorKey: 'responded', size: 120, meta: { key: 'responded' },
                cell: (props) => {
                    const v = props.row.original.responded
                    return <span className={v ? 'text-emerald-600' : 'text-gray-500'}>{v ? 'Yes' : 'No'}</span>
                },
            },
            {
                header: 'Actions', id: 'actions', size: 200, meta: { key: 'actions' },
                cell: (props) => {
                    const item = { ...props.row.original, entityType: 'lead' }
                    const detailPath = `/leads/${item.id}`
                    const editPath = `/leads/${item.id}?tab=settings`
                    return (
                    <>
                        {/* Desktop: Show all buttons */}
                        <div className="hidden md:flex items-center gap-2">
                            <Tooltip title="View">
                                <Button size="sm" variant="twoTone" icon={<HiOutlineEye />} onClick={() => navigate(detailPath)} />
                            </Tooltip>
                            <Tooltip title="Edit">
                                <Button size="sm" variant="twoTone" icon={<HiOutlinePencil />} onClick={() => navigate(editPath)} />
                            </Tooltip>
                            <Tooltip title={item.favorite ? 'Remove from favorites' : 'Add to favorites'}>
                                <Button size="sm" variant={item.favorite ? 'solid' : 'twoTone'} icon={<HiOutlineStar />} onClick={() => toggleFavorite(item.id, 'lead')} className={item.favorite ? 'text-yellow-500' : ''} />
                            </Tooltip>
                            <Tooltip title="Delete">
                                <Button size="sm" variant="twoTone" icon={<HiOutlineTrash />} onClick={() => handleDeleteLead(item.id)} className="text-red-600 hover:text-red-700" />
                            </Tooltip>
                        </div>
                        {/* Mobile: Show dropdown menu */}
                        <div className="md:hidden">
                            <Dropdown placement="bottom-end" renderTitle={<Button size="sm" variant="plain" icon={<HiOutlineDotsHorizontal />} />}>
                                <Dropdown.Item onClick={() => navigate(detailPath)}>
                                    <HiOutlineEye className="mr-2" /> View
                                </Dropdown.Item>
                                <Dropdown.Item onClick={() => navigate(editPath)}>
                                    <HiOutlinePencil className="mr-2" /> Edit
                                </Dropdown.Item>
                                <Dropdown.Item onClick={() => toggleFavorite(item.id, 'lead')}>
                                    <HiOutlineStar className={`mr-2 ${item.favorite ? 'text-yellow-500' : ''}`} /> 
                                    {item.favorite ? 'Remove from favorites' : 'Add to favorites'}
                                </Dropdown.Item>
                                <Dropdown.Item onClick={() => handleDeleteLead(item.id)} className="text-red-600">
                                    <HiOutlineTrash className="mr-2" /> Delete
                                </Dropdown.Item>
                            </Dropdown>
                        </div>
                    </>
                    )
                },
            },
        ],
        [navigate, toggleFavorite]
    )

    const clientColumns = useMemo(
        () => [
            {
                header: 'Client Name', accessorKey: 'clientName', size: 220, meta: { key: 'clientName' },
                cell: (props) => {
                    const item = props.row.original
                    const onClick = (e) => {
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault()
                            window.open(`/clients/${item.id}?tab=settings`, '_blank')
                        } else {
                            navigate(`/clients/${item.id}?tab=settings`)
                        }
                    }
                    return (
                        <button onClick={onClick} className="font-semibold text-left hover:text-primary transition-colors">{item.clientName}</button>
                    )
                },
            },
            { 
                header: 'Address', accessorKey: 'address', size: 280, meta: { key: 'address' },
                cell: (props) => {
                    const value = props.row.original.address || '-'
                    return (
                        <Tooltip title={value}>
                            <span className="block max-w-[320px] truncate">{value}</span>
                        </Tooltip>
                    )
                }
            },
            { header: 'City', accessorKey: 'city', size: 160, meta: { key: 'city' } },
            { header: 'State', accessorKey: 'state', size: 120, meta: { key: 'state' } },
            { header: 'ZIP', accessorKey: 'zip', size: 120, meta: { key: 'zip' } },
            { 
                header: 'Tags', accessorKey: 'tags', size: 200, meta: { key: 'tags' },
                cell: (props) => {
                    const value = props.row.original.tags || '-'
                    return (
                        <Tooltip title={value}>
                            <span className="block max-w-[220px] truncate">{value}</span>
                        </Tooltip>
                    )
                }
            },
            {
                header: 'Actions', id: 'actions', size: 200, meta: { key: 'actions' },
                cell: (props) => {
                    const item = { ...props.row.original, entityType: 'client' }
                    const detailPath = `/clients/${item.id}`
                    const editPath = `/clients/${item.id}?tab=settings`
                    return (
                        <>
                            {/* Desktop: Show all buttons */}
                            <div className="hidden md:flex items-center gap-2">
                                <Tooltip title="View">
                                    <Button size="sm" variant="twoTone" icon={<HiOutlineEye />} onClick={() => navigate(detailPath)} />
                                </Tooltip>
                                <Tooltip title="Edit">
                                    <Button size="sm" variant="twoTone" icon={<HiOutlinePencil />} onClick={() => navigate(editPath)} />
                                </Tooltip>
                                <Tooltip title={item.favorite ? 'Remove from favorites' : 'Add to favorites'}>
                                    <Button size="sm" variant={item.favorite ? 'solid' : 'twoTone'} icon={<HiOutlineStar />} onClick={() => toggleFavorite(item.id, 'client')} className={item.favorite ? 'text-yellow-500' : ''} />
                                </Tooltip>
                                <Tooltip title="Delete">
                                    <Button size="sm" variant="twoTone" icon={<HiOutlineTrash />} onClick={() => handleDeleteClient(item.id)} className="text-red-600 hover:text-red-700" />
                                </Tooltip>
                            </div>
                            {/* Mobile: Show dropdown menu */}
                            <div className="md:hidden">
                                <Dropdown placement="bottom-end" renderTitle={<Button size="sm" variant="plain" icon={<HiOutlineDotsHorizontal />} />}>
                                    <Dropdown.Item onClick={() => navigate(detailPath)}>
                                        <HiOutlineEye className="mr-2" /> View
                                    </Dropdown.Item>
                                    <Dropdown.Item onClick={() => navigate(editPath)}>
                                        <HiOutlinePencil className="mr-2" /> Edit
                                    </Dropdown.Item>
                                    <Dropdown.Item onClick={() => toggleFavorite(item.id, 'client')}>
                                        <HiOutlineStar className={`mr-2 ${item.favorite ? 'text-yellow-500' : ''}`} /> 
                                        {item.favorite ? 'Remove from favorites' : 'Add to favorites'}
                                    </Dropdown.Item>
                                    <Dropdown.Item onClick={() => handleDeleteClient(item.id)} className="text-red-600">
                                        <HiOutlineTrash className="mr-2" /> Delete
                                    </Dropdown.Item>
                                </Dropdown>
                            </div>
                        </>
                    )
                },
            },
        ],
        [navigate, toggleFavorite]
    )

    const allColumns = useMemo(() => {
        const currentType = filters.type?.value || 'lead'
        return currentType === 'client' ? clientColumns : leadColumns
    }, [filters.type, clientColumns, leadColumns])

    const orderedAndVisibleColumns = useMemo(() => {
        const byKey = {}
        allColumns.forEach((c) => {
            const key = c.meta?.key || c.accessorKey || c.id
            byKey[key] = c
        })
        const ordered = columnOrder
            .map((k) => byKey[k])
            .filter(Boolean)
        const finalCols = ordered.filter((c) => {
            const key = c.meta?.key || c.accessorKey || c.id
            const isVisible = visibleColumns[key] !== false
            // Debug log for tatcoContact column
            if (key === 'tatcoContact') {
                console.log('Tatco Contact column visibility:', { key, isVisible, visibleColumns: visibleColumns[key] })
            }
            return isVisible
        })
        return finalCols
    }, [allColumns, columnOrder, visibleColumns])


    // Ctrl/Cmd click handler for new tab
    const handleLeadNameClick = (e, leadId) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            // Open in new tab to Settings tab
            window.open(`/leads/${leadId}?tab=settings`, '_blank')
        } else {
            navigate(`/leads/${leadId}?tab=settings`)
        }
    }

    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false)
    const [createType, setCreateType] = useState('') // 'lead' or 'client'
    const [isBulkManagerOpen, setIsBulkManagerOpen] = useState(false)
    const [showDevTools, setShowDevTools] = useState(false)
    
    // Multi-step wizard state
    const [wizardStep, setWizardStep] = useState(1)
    const [wizardData, setWizardData] = useState({
        // Lead fields
        companyName: '',
        leadContact: '',
        tatcoContact: '',
        email: '',
        phone: '',
        title: '',
        status: 'new',
        method: 'email',
        market: 'us',
        dateLastContacted: null,
        responded: false,
        notes: '',
        source: '',
        priority: 'medium',
        // Client fields
        clientType: '',
        clientName: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        tags: ''
    })
    // Multi-select & bulk actions state
    const [selectedIds, setSelectedIds] = useState(() => new Set())
    const checkboxChecked = (row) => selectedIds.has(row.id)
    const indeterminateCheckboxChecked = (rows) => {
        if (!rows?.length) return false
        const selectedCount = rows.filter((r) => selectedIds.has(r.original.id)).length
        return selectedCount === rows.length
    }
    const handleRowSelectChange = (checked, row) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (checked) next.add(row.id)
            else next.delete(row.id)
            return next
        })
    }
    const handleSelectAllChange = (checked, rows) => {
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
    // Bulk actions: set status, delete
    const [bulkStatus, setBulkStatus] = useState(null)
    const handleApplyBulkStatus = async () => {
        if (!bulkStatus?.value) return
        try {
            const ids = Array.from(selectedIds)
            for (const id of ids) {
                const lead = leads.find((l) => l.id === id)
                if (lead) {
                    await useCrmStore.getState().updateLead(id, { ...lead, status: bulkStatus.value })
                }
            }
            setSelectedIds(new Set())
            setBulkStatus(null)
        } catch (e) {
            console.error('Bulk status update error:', e)
        }
    }
    const handleBulkDelete = async () => {
        if (!selectedIds.size) return
        const currentType = (filters.type && filters.type.value) || 'lead'
        const isClient = currentType === 'client'
        const title = isClient ? 'Delete Selected Clients' : 'Delete Selected Leads'
        const msg = isClient
            ? `Delete ${selectedIds.size} selected client(s)? This cannot be undone.`
            : `Delete ${selectedIds.size} selected lead(s)? This cannot be undone.`
        showConfirmDialog(
            title,
            msg,
            async () => {
                try {
                    const ids = Array.from(selectedIds)
                    for (const id of ids) {
                        if (isClient) await deleteClient(id)
                        else await deleteLead(id)
                    }
                    setSelectedIds(new Set())
                } catch (e) {
                    console.error('Bulk delete error:', e)
                }
            }
        )
    }

    const [newLead, setNewLead] = useState({
        companyName: '',
        leadContact: '',
        title: '',
        email: '',
        phone: '',
        methodOfContact: null,
        dateLastContacted: null,
        projectMarket: null,
        leadConception: null,
        status: null,
        responded: false,
        notes: '',
    })

    const resetNewLead = () => setNewLead({
        companyName: '',
        leadContact: '',
        title: '',
        email: '',
        phone: '',
        methodOfContact: null,
        dateLastContacted: null,
        projectMarket: null,
        leadConception: null,
        status: null,
        responded: false,
        notes: '',
    })

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
            companyName: '',
            leadContact: '',
            tatcoContact: '',
            email: '',
            phone: '',
            title: '',
            company: '',
            status: 'new',
            method: 'email',
            market: 'us',
            dateLastContacted: null,
            responded: false,
            notes: '',
            source: '',
            priority: 'medium',
            clientNumber: '',
            clientType: '',
            clientName: '',
            address: '',
            city: '',
            state: '',
            zip: '',
            tags: ''
        })
    }

    // Type selector handlers
    const handleCreateClick = () => {
        setIsTypeSelectorOpen(true)
    }

    const handleTypeSelect = (type) => {
        setCreateType(type)
        setIsTypeSelectorOpen(false)
        setIsCreateOpen(true)
        resetWizard()
    }
    
    const handleWizardSubmit = async () => {
        try {
            if (createType === 'lead') {
                const payload = {
                    companyName: wizardData.companyName,
                    leadContact: wizardData.leadContact || '',
                    tatcoContact: wizardData.tatcoContact || '',
                    title: wizardData.title,
                    email: wizardData.email || '',
                    phone: wizardData.phone || '',
                    methodOfContact: wizardData.method,
                    projectMarket: wizardData.market,
                    dateLastContacted: wizardData.dateLastContacted
                        ? (wizardData.dateLastContacted instanceof Date
                            ? wizardData.dateLastContacted.toISOString().slice(0,10)
                            : wizardData.dateLastContacted)
                        : null,
                    status: wizardData.status,
                    responded: Boolean(wizardData.responded),
                    notes: wizardData.notes || '',
                    favorite: false,
                }
                await addLead(payload)
            } else if (createType === 'client') {
                const payload = {
                    clientType: wizardData.clientType,
                    clientName: wizardData.clientName,
                    address: wizardData.address,
                    city: wizardData.city,
                    state: wizardData.state,
                    zip: wizardData.zip,
                    tags: wizardData.tags,
                    notes: wizardData.notes || '',
                }
                await addClient(payload)
            }
            
            setIsCreateOpen(false)
            resetWizard()
        } catch (error) {
            console.error('Error creating:', error)
            // Show error message to user
            alert('Error creating ' + createType + ': ' + error.message)
        }
    }

    const handleCreateLead = async () => {
        if (!newLead.companyName || !newLead.title || !newLead.status) {
            return
        }
        
        try {
            const payload = {
                companyName: newLead.companyName,
                leadContact: newLead.leadContact || '',
                title: newLead.title,
                email: newLead.email || '',
                phone: newLead.phone || '',
                methodOfContact: newLead.methodOfContact?.value || null,
                dateLastContacted: newLead.dateLastContacted ? 
                    (newLead.dateLastContacted instanceof Date ? 
                        newLead.dateLastContacted.toISOString().slice(0,10) : 
                        newLead.dateLastContacted) : null,
                projectMarket: newLead.projectMarket?.value || null,
                leadConception: null,
                status: newLead.status?.value || newLead.status,
                responded: newLead.responded || false,
                notes: newLead.notes || '',
                favorite: false,
            }
            
            await addLead(payload)
            resetNewLead()
            setIsCreateOpen(false)
        } catch (error) {
            console.error('Error creating lead:', error)
        }
    }

    const leadConceptionOptions = [
        { value: 'referral', label: 'Referral' },
        { value: 'inbound', label: 'Inbound' },
        { value: 'outbound', label: 'Outbound' },
        { value: 'event', label: 'Event' },
        { value: 'other', label: 'Other' },
    ]

    // Helper: apply a date preset into filters
    const applyDatePreset = (preset) => {
        const now = new Date()
        let from = null
        let to = null
        const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1)
        const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0)
        if (preset === 'last7') {
            const d = new Date(now)
            d.setDate(now.getDate() - 7)
            from = d
            to = now
        } else if (preset === 'last30') {
            const d = new Date(now)
            d.setDate(now.getDate() - 30)
            from = d
            to = now
        } else if (preset === 'thisMonth') {
            from = startOfMonth(now)
            to = endOfMonth(now)
        } else if (preset === 'lastMonth') {
            const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            from = startOfMonth(lastMonthDate)
            to = endOfMonth(lastMonthDate)
        } else {
            from = null
            to = null
        }
        setDatePreset(preset)
        setPageIndex(1)
        setFilters({ dateFrom: from, dateTo: to })
    }


    // Clear sort handler: reset local sort and force table remount
    const handleClearSort = () => {
        setSort({ key: '', order: '' })
        setTableInstanceKey((k) => k + 1)
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Dev Only Toggle Button */}
            <div className="flex justify-end gap-2">
                <Button 
                    onClick={() => setShowDevTools(!showDevTools)}
                    variant="twoTone"
                    size="sm"
                    className="text-xs"
                >
                    {showDevTools ? 'Hide Dev Tools' : 'Dev Only'}
                </Button>
                <Button 
                    onClick={() => {
                        // Force visibility
                        setVisibleColumns(prev => ({ ...prev, tatcoContact: true }))
                        
                        // Force column order
                        setColumnOrder(prev => {
                            if (!prev.includes('tatcoContact')) {
                                const newOrder = [...prev]
                                const leadContactIndex = newOrder.indexOf('leadContact')
                                if (leadContactIndex !== -1) {
                                    newOrder.splice(leadContactIndex + 1, 0, 'tatcoContact')
                                } else {
                                    newOrder.unshift('tatcoContact')
                                }
                                return newOrder
                            }
                            return prev
                        })
                        
                        console.log('Forced Tatco Contact column to be visible and in order')
                    }}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                >
                    Show Tatco Contact
                </Button>
            </div>

            {/* Development Tools - Hidden by default */}
            {showDevTools && (
                <>
                    {/* Column Debug Info */}
                    <Card className="p-4">
                        <h3 className="text-lg font-semibold mb-4">Column Debug Info</h3>
                        <div className="space-y-2">
                            <p><strong>Current Type:</strong> {(filters.type && filters.type.value) || 'lead'}</p>
                            <p><strong>Column Order:</strong> {JSON.stringify(columnOrder)}</p>
                            <p><strong>Visible Columns:</strong> {JSON.stringify(visibleColumns)}</p>
                            <p><strong>Tatco Contact Visible:</strong> {String(visibleColumns.tatcoContact !== false)}</p>
                            <p><strong>Total Columns:</strong> {orderedAndVisibleColumns.length}</p>
                        </div>
                        <div className="mt-4">
                            <Button 
                                onClick={() => {
                                    // Clear localStorage and reset to defaults
                                    const currentType = (filters.type && filters.type.value) || 'lead'
                                    const storageSuffix = currentType === 'client' ? 'client' : 'lead'
                                    
                                    localStorage.removeItem(`crmColumnOrder_${storageSuffix}`)
                                    localStorage.removeItem(`crmVisibleColumns_${storageSuffix}`)
                                    
                                    // Reset to default order with tatcoContact
                                    const defaultOrder = [
                                        'companyName',
                                        'leadContact',
                                        'tatcoContact',
                                        'email',
                                        'phone',
                                        'methodOfContact',
                                        'projectMarket',
                                        'dateLastContacted',
                                        'status',
                                        'responded',
                                        'actions',
                                    ]
                                    setColumnOrder(defaultOrder)
                                    
                                    // Reset visibility
                                    const defaultVisible = defaultOrder.reduce((acc, key) => ({ ...acc, [key]: true }), {})
                                    setVisibleColumns(defaultVisible)
                                    
                                    console.log('Reset column order and visibility to defaults')
                                }}
                                variant="solid"
                                size="sm"
                                className="bg-red-600 hover:bg-red-700"
                            >
                                Reset Column Order
                            </Button>
                        </div>
                    </Card>
                    
                    {/* Firebase Test Component - Remove this after testing */}
                    <FirebaseTest />
                    
                    {/* Market Options Migration */}
                    <Card className="p-4">
                        <h3 className="text-lg font-semibold mb-4">Market Options Migration</h3>
                        <div className="flex gap-2">
                            <Button 
                                onClick={async () => {
                                    const result = await migrateMarketOptions()
                                    console.log('Migration result:', result)
                                    alert(`Migration completed! Updated: ${result.updated}, Skipped: ${result.skipped}`)
                                }}
                                variant="twoTone"
                                size="sm"
                            >
                                Migrate Existing Leads
                            </Button>
                            <Button 
                                onClick={async () => {
                                    if (confirm('This will delete all existing leads and re-import with new market options. Continue?')) {
                                        const result = await resetAndMigrateLeads()
                                        console.log('Reset and migration result:', result)
                                        alert(`Reset and migration completed! Imported: ${result.imported} leads`)
                                    }
                                }}
                                variant="twoTone"
                                size="sm"
                            >
                                Reset & Re-import Leads
                            </Button>
                        </div>
                    </Card>
                    
                    {/* Firebase Advanced Test Component - Remove this after testing */}
                    <FirebaseAdvancedTest />
                    
                    {/* Client Number Removal Migration */}
                    <Card className="p-4">
                        <h3 className="text-lg font-semibold mb-4">Remove Client Number Field</h3>
                        <div className="flex gap-2">
                            <Button 
                                onClick={async () => {
                                    const result = await removeClientNumberFromClients()
                                    console.log('Client number removal result:', result)
                                    alert(`Client number removal completed! Updated: ${result.updated}, Skipped: ${result.skipped}`)
                                }}
                                variant="twoTone"
                                size="sm"
                            >
                                Remove Client Number from Existing Clients
                            </Button>
                            <Button 
                                onClick={async () => {
                                    if (confirm('This will delete all existing clients and re-import without clientNumber field. Continue?')) {
                                        const result = await resetAndMigrateClients()
                                        console.log('Reset and migration result:', result)
                                        alert(`Reset and migration completed! Imported: ${result.imported} clients`)
                                    }
                                }}
                                variant="twoTone"
                                size="sm"
                            >
                                Reset & Re-import Clients (No Client Number)
                            </Button>
                        </div>
                    </Card>
                </>
            )}
            
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
                <h1 className="text-2xl font-bold">CRM</h1>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Button
                        variant="twoTone"
                        icon={<HiOutlinePlus />}
                        onClick={handleCreateClick}
                        className="w-full sm:w-auto"
                    >
                        Create
                    </Button>
                    <Button
                        variant="solid"
                        icon={<HiOutlineUpload />}
                        onClick={() => setIsBulkManagerOpen(true)}
                        className="w-full sm:w-auto"
                    >
                        Bulk Import / Export
                    </Button>
                </div>
            </div>

            {/* Top entity toggle - above the dashboard/table */}
            <div className="flex items-center justify-start -mt-2">
                <div className="inline-flex items-center rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/60 backdrop-blur px-1 shadow-sm">
                    <Button
                        size="sm"
                        variant={(filters.type?.value || 'lead') === 'lead' ? 'solid' : 'twoTone'}
                        className={`rounded-l-full rounded-r-none !px-3 !py-1.5 transition-all duration-150 ${
                            (filters.type?.value || 'lead') === 'lead'
                                ? 'shadow-sm ring-1 ring-primary/30'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        aria-pressed={(filters.type?.value || 'lead') === 'lead'}
                        onClick={() => {
                            setPageIndex(1)
                            setFilters({ type: { value: 'lead', label: '👤 Lead' } })
                        }}
                    >
                        <span className="inline-flex items-center gap-2">
                            <span>👤</span>
                            <span className="font-medium">Leads</span>
                        </span>
                    </Button>
                    <Button
                        size="sm"
                        variant={filters.type?.value === 'client' ? 'solid' : 'twoTone'}
                        className={`rounded-r-full rounded-l-none !px-3 !py-1.5 transition-all duration-150 border-l border-gray-200 dark:border-gray-700 ${
                            filters.type?.value === 'client'
                                ? 'shadow-sm ring-1 ring-primary/30'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        aria-pressed={filters.type?.value === 'client'}
                        onClick={() => {
                            setPageIndex(1)
                            setFilters({ type: { value: 'client', label: '🏢 Client' } })
                        }}
                    >
                        <span className="inline-flex items-center gap-2">
                            <span>🏢</span>
                            <span className="font-medium">Clients</span>
                        </span>
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
                                    placeholder="Search leads"
                                    value={localSearchValue}
                                    onChange={(e) => {
                                        const value = e.target.value
                                        setLocalSearchValue(value)
                                        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
                                        searchDebounceRef.current = setTimeout(() => {
                                            setPageIndex(1)
                                            setFilters({ search: value })
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
                                {filterVisibility.status && (
                                    <Select
                                        placeholder="Status"
                                        isClearable
                                        isMulti
                                        options={leadStatusOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={selectZIndexStyles}
                                        value={Array.isArray(filters.status) ? filters.status : (filters.status ? [filters.status] : null)}
                                        onChange={(opt) => {
                                            setPageIndex(1)
                                            setFilters({ status: opt && opt.length > 0 ? opt : null })
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
                                {filterVisibility.methodOfContact && (
                                    <Select
                                        placeholder="Method"
                                        isClearable
                                        isMulti
                                        options={methodOfContactOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={selectZIndexStyles}
                                        value={Array.isArray(filters.methodOfContact) ? filters.methodOfContact : (filters.methodOfContact ? [filters.methodOfContact] : null)}
                                        onChange={(opt) => {
                                            setPageIndex(1)
                                            setFilters({ methodOfContact: opt && opt.length > 0 ? opt : null })
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
                                {filterVisibility.responded && (
                                    <Select
                                        placeholder="Responded"
                                        isClearable
                                        options={respondedOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={selectZIndexStyles}
                                        value={filters.responded}
                                        onChange={(opt) => {
                                            setPageIndex(1)
                                            setFilters({ responded: opt || null })
                                        }}
                                    />
                                )}
                                {filterVisibility.dateRange && (
                                    <div className="relative">
                                        <DatePicker.DatePickerRange
                                            placeholder={['From', 'To']}
                                            value={[filters.dateFrom || null, filters.dateTo || null]}
                                            onChange={(vals) => {
                                                if (dateDebounceRef.current) clearTimeout(dateDebounceRef.current)
                                                dateDebounceRef.current = setTimeout(() => {
                                                    const arr = Array.isArray(vals) ? vals : [null, null]
                                                    const [from, to] = arr
                                                    setDatePreset('none')
                                                    setPageIndex(1)
                                                    setFilters({
                                                        dateFrom: from || null,
                                                        dateTo: to || null,
                                                    })
                                                }, 200)
                                            }}
                                        />
                                    </div>
                                )}
                                {filterVisibility.datePreset && (
                                    <Select
                                        placeholder="Date presets"
                                        isClearable={false}
                                        options={datePresetOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={selectZIndexStyles}
                                        value={datePresetOptions.find((o) => o.value === datePreset) || datePresetOptions[0]}
                                        onChange={(opt) => applyDatePreset(opt?.value || 'none')}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* Desktop: Original grid layout */}
                    <div className="hidden md:block">
                        <div className="flex items-start gap-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 flex-1">
                                <Input
                                    placeholder="Search leads"
                                    value={localSearchValue}
                                    onChange={(e) => {
                                        const value = e.target.value
                                        setLocalSearchValue(value)
                                        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
                                        searchDebounceRef.current = setTimeout(() => {
                                            setPageIndex(1)
                                            setFilters({ search: value })
                                        }, 300)
                                    }}
                                />
                                {filterVisibility.status && (
                                    <Select
                                        placeholder="Status"
                                        isClearable
                                        isMulti
                                        options={leadStatusOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={selectZIndexStyles}
                                        value={Array.isArray(filters.status) ? filters.status : (filters.status ? [filters.status] : null)}
                                        onChange={(opt) => {
                                            setPageIndex(1)
                                            setFilters({ status: opt && opt.length > 0 ? opt : null })
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
                                {filterVisibility.methodOfContact && (
                                    <Select
                                        placeholder="Method"
                                        isClearable
                                        isMulti
                                        options={methodOfContactOptions}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={selectZIndexStyles}
                                        value={Array.isArray(filters.methodOfContact) ? filters.methodOfContact : (filters.methodOfContact ? [filters.methodOfContact] : null)}
                                        onChange={(opt) => {
                                            setPageIndex(1)
                                            setFilters({ methodOfContact: opt && opt.length > 0 ? opt : null })
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
                                {filterVisibility.responded && (
                                    <Select
                                        placeholder="Responded"
                                        isClearable
                                        options={respondedOptions}
                                        value={filters.responded}
                                        onChange={(opt) => {
                                            setPageIndex(1)
                                            setFilters({ responded: opt || null })
                                        }}
                                    />
                                )}
                                {filterVisibility.dateRange && (
                                    <div className="relative">
                                        <DatePicker.DatePickerRange
                                            placeholder={['From', 'To']}
                                            value={[filters.dateFrom || null, filters.dateTo || null]}
                                            onChange={(vals) => {
                                                if (dateDebounceRef.current) clearTimeout(dateDebounceRef.current)
                                                dateDebounceRef.current = setTimeout(() => {
                                                    const arr = Array.isArray(vals) ? vals : [null, null]
                                                    const [from, to] = arr
                                                    setDatePreset('none')
                                                    setPageIndex(1)
                                                    setFilters({
                                                        dateFrom: from || null,
                                                        dateTo: to || null,
                                                    })
                                                }, 200)
                                            }}
                                        />
                                    </div>
                                )}
                                {filterVisibility.datePreset && (
                                    <Select
                                        placeholder="Date presets"
                                        isClearable={false}
                                        options={datePresetOptions}
                                        value={datePresetOptions.find((o) => o.value === datePreset) || datePresetOptions[0]}
                                        onChange={(opt) => applyDatePreset(opt?.value || 'none')}
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
                        (filters.status && (Array.isArray(filters.status) ? filters.status.length > 0 : filters.status.value)) ||
                        (filters.methodOfContact && (Array.isArray(filters.methodOfContact) ? filters.methodOfContact.length > 0 : filters.methodOfContact.value)) ||
                        (filters.responded !== null && filters.responded !== undefined) ||
                        filters.dateFrom ||
                        filters.dateTo) && (
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
                                <Tag className="text-xs">
                                    {currentType === 'client' ? 'Client filters' : 'Lead filters'}
                                </Tag>
                            </h6>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                <label className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                        checked={filterVisibility.status !== false}
                                        onChange={(checked) => handleFilterVisibilityChange('status', checked)}
                                    />
                                    <span>Status</span>
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                        checked={filterVisibility.methodOfContact !== false}
                                        onChange={(checked) => handleFilterVisibilityChange('methodOfContact', checked)}
                                    />
                                    <span>Method of Contact</span>
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                        checked={filterVisibility.responded !== false}
                                        onChange={(checked) => handleFilterVisibilityChange('responded', checked)}
                                    />
                                    <span>Responded</span>
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                        checked={filterVisibility.dateRange !== false}
                                        onChange={(checked) => handleFilterVisibilityChange('dateRange', checked)}
                                    />
                                    <span>Date Range</span>
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                        checked={filterVisibility.datePreset !== false}
                                        onChange={(checked) => handleFilterVisibilityChange('datePreset', checked)}
                                    />
                                    <span>Date Presets</span>
                                </label>
                            </div>
                        </Card>
                        {/* Column visibility & order controls */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card className="p-4">
                                <h6 className="font-semibold mb-3 flex items-center gap-2">
                                    Column Visibility
                                    <Tag className="text-xs">
                                        {currentType === 'client' ? 'Client columns' : 'Lead columns'}
                                    </Tag>
                                </h6>
                                <div className="grid grid-cols-2 gap-2">
                                    {(currentType === 'client' ? defaultClientKeys : defaultLeadKeys).map((key) => (
                                        <label key={key} className="flex items-center gap-2 text-sm">
                                            <Checkbox
                                                checked={visibleColumns[key] !== false}
                                                onChange={(checked) => {
                                                    setVisibleColumns((prev) => ({ ...prev, [key]: Boolean(checked) }))
                                                }}
                                            />
                                            <span className="capitalize">{key}</span>
                                        </label>
                                    ))}
                            </div>
                            </Card>
                            <Card className="p-4">
                                <h6 className="font-semibold mb-3 flex items-center gap-2">
                                    Column Order
                                    <Tag className="text-xs">
                                        {currentType === 'client' ? 'Client columns' : 'Lead columns'}
                                    </Tag>
                                </h6>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {columnOrder.map((key, idx) => (
                                        <div key={key} className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                                            <span className="capitalize flex-1">{key}</span>
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
                {typeof selectedIds !== 'undefined' && selectedIds.size > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <span className="text-sm font-medium">{selectedIds.size} selected</span>
                        <div className="flex items-center gap-2">
                            <Select
                                placeholder="Set status"
                                options={leadStatusOptions}
                                value={bulkStatus}
                                onChange={(opt) => setBulkStatus(opt || null)}
                            />
                            <Button size="sm" variant="solid" onClick={handleApplyBulkStatus} disabled={!bulkStatus}>Apply</Button>
                            <Button size="sm" variant="twoTone" onClick={handleBulkDelete} className="text-red-600">
                                Delete Selected
                            </Button>
                        </div>
                    </div>
                )}

                <DataTable
                    key={tableInstanceKey}
                    columns={orderedAndVisibleColumns}
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
            <BulkDataManager 
                isOpen={isBulkManagerOpen}
                onClose={() => setIsBulkManagerOpen(false)}
                entityType={filters.type?.value || 'leads'}
            />

            {/* Type Selector Dialog */}
            <Dialog isOpen={isTypeSelectorOpen} onClose={() => setIsTypeSelectorOpen(false)} width={500}>
                <div className="p-6">
                    <h5 className="text-xl font-semibold mb-4">What would you like to create?</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card 
                            className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-500"
                            onClick={() => handleTypeSelect('lead')}
                        >
                            <div className="text-center">
                                <div className="text-3xl mb-3">👤</div>
                                <h6 className="font-semibold text-lg mb-2">Lead</h6>
                                <p className="text-sm text-gray-600">Create a new lead for an individual contact</p>
                            </div>
                        </Card>
                        <Card 
                            className="p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-500"
                            onClick={() => handleTypeSelect('client')}
                        >
                            <div className="text-center">
                                <div className="text-3xl mb-3">🏢</div>
                                <h6 className="font-semibold text-lg mb-2">Client</h6>
                                <p className="text-sm text-gray-600">Create a new client company</p>
                            </div>
                        </Card>
                    </div>
                </div>
            </Dialog>

            {/* Multi-Step Create Wizard */}
            <Dialog isOpen={isCreateOpen} onClose={() => { setIsCreateOpen(false); resetWizard(); }} width={800}>
                <div className="p-6 flex flex-col max-h-[90vh] md:max-h-none md:block">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0 mb-6">
                        <h5 className="text-xl font-semibold">Create {createType === 'lead' ? 'Lead' : 'Client'}</h5>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">Step {wizardStep} of {createType === 'lead' ? '3' : '2'}</span>
                            <div className="flex gap-1">
                                {Array.from({ length: createType === 'lead' ? 3 : 2 }, (_, i) => i + 1).map((step) => (
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
                                {createType === 'lead' ? (
                                    <>
                            <div>
                                <label className="block text-sm font-medium mb-2">Company Name *</label>
                                <Input 
                                                value={wizardData.companyName} 
                                                onChange={(e) => setWizardData({ ...wizardData, companyName: e.target.value })} 
                                    placeholder="Enter company name"
                                />
                            </div>
                            
                            <div>
                                            <label className="block text-sm font-medium mb-2">Contact person</label>
                                <Input 
                                                value={wizardData.leadContact} 
                                                onChange={(e) => setWizardData({ ...wizardData, leadContact: e.target.value })} 
                                                placeholder="Enter contact name"
                                />
        </div>
                            
                            <div>
                                            <label className="block text-sm font-medium mb-2">Tatco Contact</label>
                                <Input 
                                                value={wizardData.tatcoContact} 
                                                onChange={(e) => setWizardData({ ...wizardData, tatcoContact: e.target.value })} 
                                                placeholder="Enter Tatco contact name"
                                />
        </div>
                            
                            <div>
                                            <label className="block text-sm font-medium mb-2">Email</label>
                                <Input 
                                                value={wizardData.email} 
                                                onChange={(e) => setWizardData({ ...wizardData, email: e.target.value })} 
                                                placeholder="Enter email address"
                                />
            </div>

            <div>
                                            <label className="block text-sm font-medium mb-2">Phone</label>
                                <Input 
                                                value={wizardData.phone} 
                                                onChange={(e) => setWizardData({ ...wizardData, phone: e.target.value })} 
                                                placeholder="Enter phone number"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>

            <div>
                                            <label className="block text-sm font-medium mb-2">Client Type</label>
                                            <Select
                                                options={[
                                                    { value: 'enterprise', label: 'Enterprise' },
                                                    { value: 'small_business', label: 'Small Business' },
                                                    { value: 'startup', label: 'Startup' },
                                                    { value: 'nonprofit', label: 'Nonprofit' },
                                                    { value: 'government', label: 'Government' }
                                                ]}
                                                value={wizardData.clientType ? { value: wizardData.clientType, label: wizardData.clientType } : null}
                                                onChange={(opt) => setWizardData({ ...wizardData, clientType: opt?.value || '' })}
                                            />
                                        </div>
                                        
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Client Name *</label>
                                <Input 
                                                value={wizardData.clientName} 
                                                onChange={(e) => setWizardData({ ...wizardData, clientName: e.target.value })} 
                                                placeholder="Enter client name"
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
                                                value={wizardData.state} 
                                                onChange={(e) => setWizardData({ ...wizardData, state: e.target.value })} 
                                                placeholder="Enter state"
                                            />
                                        </div>
                                        
                                        <div>
                                            <label className="block text-sm font-medium mb-2">ZIP</label>
                                            <Input 
                                                value={wizardData.zip} 
                                                onChange={(e) => setWizardData({ ...wizardData, zip: e.target.value })} 
                                                placeholder="Enter ZIP code"
                                            />
                                        </div>
                                        
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Tags</label>
                                            <Input 
                                                value={wizardData.tags} 
                                                onChange={(e) => setWizardData({ ...wizardData, tags: e.target.value })} 
                                                placeholder="Enter tags (comma separated)"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {/* Step 2: Details */}
                    {wizardStep === 2 && (
                        <div className="space-y-4">
                            <h6 className="text-lg font-medium text-gray-700 dark:text-gray-300">
                                {createType === 'lead' ? 'Lead Details' : 'Additional Information'}
                            </h6>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {createType === 'lead' ? (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Job title</label>
                                            <Input 
                                                value={wizardData.title} 
                                                onChange={(e) => setWizardData({ ...wizardData, title: e.target.value })} 
                                                placeholder="Enter job title"
                                            />
                                        </div>
                                        
                                        
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Status</label>
                                <Select
                                    options={leadStatusOptions}
                                                value={leadStatusOptions.find(o => o.value === wizardData.status) || null}
                                                onChange={(opt) => setWizardData({ ...wizardData, status: opt?.value || 'new' })}
                                />
                        </div>
                        
                            <div>
                                <label className="block text-sm font-medium mb-2">Method of contact</label>
                                <Select
                                    options={methodOfContactOptions}
                                                value={methodOfContactOptions.find(o => o.value === wizardData.method) || null}
                                                onChange={(opt) => setWizardData({ ...wizardData, method: opt?.value || 'email' })}
                                />
                            </div>

                            <div>
                                            <label className="block text-sm font-medium mb-2">Market</label>
                                <Select
                                    options={projectMarketOptions}
                                                value={projectMarketOptions.find(o => o.value === wizardData.market) || null}
                                                onChange={(opt) => setWizardData({ ...wizardData, market: opt?.value || 'us' })}
                                />
                            </div>

                            <div>
                                            <label className="block text-sm font-medium mb-2">Last contacted</label>
                                <DatePicker
                                                value={wizardData.dateLastContacted}
                                                onChange={(date) => setWizardData({ ...wizardData, dateLastContacted: date })}
                                />
                            </div>
                                        
                                        <div className="flex items-center gap-3">
                                            <label className="text-sm font-medium mb-0">Responded</label>
                                            <Switcher
                                                checked={wizardData.responded}
                                                onChange={(checked) => setWizardData({ ...wizardData, responded: checked })}
                                            />
                        </div>

                            <div>
                                            <label className="block text-sm font-medium mb-2">Priority</label>
                                            <Select
                                                options={[
                                                    { value: 'low', label: 'Low' },
                                                    { value: 'medium', label: 'Medium' },
                                                    { value: 'high', label: 'High' }
                                                ]}
                                                value={{ value: wizardData.priority, label: wizardData.priority.charAt(0).toUpperCase() + wizardData.priority.slice(1) }}
                                                onChange={(opt) => setWizardData({ ...wizardData, priority: opt?.value || 'medium' })}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <div className="col-span-2">
                            <label className="block text-sm font-medium mb-2">Notes</label>
                                        <textarea
                                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            rows={4}
                                            value={wizardData.notes}
                                            onChange={(e) => setWizardData({ ...wizardData, notes: e.target.value })}
                                            placeholder="Enter any additional notes about this client..."
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {/* Step 3: Additional Information (Leads only) */}
                    {wizardStep === 3 && createType === 'lead' && (
                        <div className="space-y-4">
                            <h6 className="text-lg font-medium text-gray-700 dark:text-gray-300">Additional Information</h6>
                            <div className="space-y-4">
                            <div>
                            <label className="block text-sm font-medium mb-2">Notes</label>
                                    <textarea
                                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        rows={4}
                                        value={wizardData.notes}
                                        onChange={(e) => setWizardData({ ...wizardData, notes: e.target.value })}
                                        placeholder="Enter any additional notes about this lead..."
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium mb-2">Lead source</label>
                                <Input 
                                        value={wizardData.source} 
                                        onChange={(e) => setWizardData({ ...wizardData, source: e.target.value })} 
                                        placeholder="e.g., Website, Referral, Cold call"
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
                            {wizardStep < (createType === 'lead' ? 3 : 2) ? (
                            <Button 
                                variant="solid" 
                                    onClick={nextWizardStep} 
                                    disabled={
                                        createType === 'lead' 
                                            ? !wizardData.companyName.trim() 
                                            : !wizardData.clientName.trim()
                                    }
                                >
                                    Next →
                            </Button>
                            ) : (
                                <Button 
                                    variant="solid" 
                                    onClick={handleWizardSubmit} 
                                    disabled={
                                        createType === 'lead' 
                                            ? !wizardData.companyName.trim() 
                                            : !wizardData.clientName.trim()
                                    }
                                >
                                    Create {createType === 'lead' ? 'Lead' : 'Client'}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </Dialog>

            {/* Confirmation Dialog */}
            {confirmDialog.isOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', maxWidth: '400px', width: '100%', margin: '20px' }}>
                        <h3 className="text-lg font-semibold mb-4">{confirmDialog.title}</h3>
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


export default Home