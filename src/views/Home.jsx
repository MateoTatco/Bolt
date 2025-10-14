import { useMemo, useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { Button, Card, Input, Select, DatePicker, Tag, Tooltip, Dialog, Form, FormItem, FormContainer, Switcher, Checkbox } from '@/components/ui'
import DataTable from '@/components/shared/DataTable'
import { useCrmStore } from '@/store/crmStore'
import { leadStatusOptions, methodOfContactOptions, projectMarketOptions } from '@/mock/data/leadsData'
import { HiOutlineStar, HiOutlineEye, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi'

const Home = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const leads = useCrmStore((s) => s.leads)
    const clients = useCrmStore((s) => s.clients)
    const filters = useCrmStore((s) => s.filters)
    const loading = useCrmStore((s) => s.loading)
    const setFilters = useCrmStore((s) => s.setFilters)
    const toggleFavorite = useCrmStore((s) => s.toggleFavorite)
    const loadLeads = useCrmStore((s) => s.loadLeads)
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

    const [pageIndex, setPageIndex] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [sort, setSort] = useState({ key: '', order: '' })
    const [tableInstanceKey, setTableInstanceKey] = useState(0)

    // Debounce timer refs
    const searchDebounceRef = useRef(null)
    const dateDebounceRef = useRef(null)
    
    // Local search state for immediate UI updates
    const [localSearchValue, setLocalSearchValue] = useState('')

    // Column visibility & order persistence
    const defaultColumnKeys = [
        'leadName',
        'title',
        'email',
        'phone',
        'methodOfContact',
        'projectMarket',
        'dateLastContacted',
        'status',
        'responded',
        'actions',
    ]
    const [columnOrder, setColumnOrder] = useState(() => {
        try {
            const raw = localStorage.getItem('crmColumnOrder')
            const parsed = raw ? JSON.parse(raw) : null
            return Array.isArray(parsed) && parsed.length ? parsed : defaultColumnKeys
        } catch {
            return defaultColumnKeys
        }
    })
    const [visibleColumns, setVisibleColumns] = useState(() => {
        try {
            const raw = localStorage.getItem('crmVisibleColumns')
            const parsed = raw ? JSON.parse(raw) : null
            if (parsed && typeof parsed === 'object') return parsed
        } catch {}
        return defaultColumnKeys.reduce((acc, key) => ({ ...acc, [key]: true }), {})
    })
    useEffect(() => {
        try {
            localStorage.setItem('crmVisibleColumns', JSON.stringify(visibleColumns))
            localStorage.setItem('crmColumnOrder', JSON.stringify(columnOrder))
        } catch {}
    }, [visibleColumns, columnOrder])

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
        const qSize = parseInt(params.get('size') || '10', 10)
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
            setPageSize(Number.isNaN(qSize) ? 10 : qSize)
            setSort({ key: qSortKey, order: qSortOrder })

            const nextFilters = {}
            if (qSearch) nextFilters.search = qSearch
            if (qType) nextFilters.type = { value: qType, label: qType === 'lead' ? '👤 Lead' : '🏢 Client' }
            if (qStatus) nextFilters.status = { value: qStatus, label: qStatus }
            if (qMethod) nextFilters.methodOfContact = { value: qMethod, label: qMethod }
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
        if (filters.status?.value) params.set('status', filters.status.value); else params.delete('status')
        if (filters.methodOfContact?.value) params.set('method', filters.methodOfContact.value); else params.delete('method')
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
                        hay = `${item.leadName} ${item.leadContact} ${item.title} ${item.email} ${item.phone}`.toLowerCase()
                    } else {
                        hay = `${item.clientName} ${item.clientNumber} ${item.address} ${item.city} ${item.state}`.toLowerCase()
                    }
                    if (!hay.includes(term)) return false
                }
                
                // Type filter
                if (type && type.value) {
                    if (item.entityType !== type.value) return false
                }
                
                // Lead-specific filters
                if (item.entityType === 'lead') {
                if (status && status.value) {
                        if (item.status !== status.value) return false
                }
                if (methodOfContact && methodOfContact.value) {
                        if (item.methodOfContact !== methodOfContact.value) return false
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
                // Always prioritize favorite items first
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

    const allColumns = useMemo(
        () => [
            {
                header: 'Type',
                accessorKey: 'entityType',
                size: 100,
                meta: { key: 'entityType' },
                cell: (props) => {
                    const type = props.row.original.entityType
                    return (
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            type === 'lead' 
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        }`}>
                            {type === 'lead' ? '👤 Lead' : '🏢 Client'}
                        </span>
                    )
                },
            },
            {
                header: 'Name',
                accessorKey: 'name',
                size: 220,
                meta: { key: 'name' },
                cell: (props) => {
                    const item = props.row.original
                    const name = item.entityType === 'lead' ? item.leadName : item.clientName
                    return (
                    <button 
                            onClick={(e) => handleLeadNameClick(e, item.id)}
                        className="font-semibold text-left hover:text-primary transition-colors"
                    >
                            {name}
                    </button>
                    )
                },
            },
            { 
                header: 'Title/Type', 
                accessorKey: 'title', 
                size: 180, 
                meta: { key: 'title' },
                cell: (props) => {
                    const item = props.row.original
                    if (item.entityType === 'lead') {
                        return <span>{item.title || '-'}</span>
                    } else {
                        return <span>{item.clientType || '-'}</span>
                    }
                }
            },
            { 
                header: 'Email/Address', 
                accessorKey: 'email', 
                size: 220, 
                meta: { key: 'email' },
                cell: (props) => {
                    const item = props.row.original
                    if (item.entityType === 'lead') {
                        return <span>{item.email || '-'}</span>
                    } else {
                        return <span>{item.address || '-'}</span>
                    }
                }
            },
            { 
                header: 'Phone/City', 
                accessorKey: 'phone', 
                size: 160, 
                meta: { key: 'phone' },
                cell: (props) => {
                    const item = props.row.original
                    if (item.entityType === 'lead') {
                        return <span>{item.phone || '-'}</span>
                    } else {
                        return <span>{item.city || '-'}</span>
                    }
                }
            },
            {
                header: 'Method/State',
                accessorKey: 'methodOfContact',
                size: 140,
                meta: { key: 'methodOfContact' },
                cell: (props) => {
                    const item = props.row.original
                    if (item.entityType === 'lead') {
                        const val = item.methodOfContact
                    const opt = methodOfContactOptions.find((o) => o.value === val)
                    return <span>{opt ? opt.label : val}</span>
                    } else {
                        return <span>{item.state || '-'}</span>
                    }
                },
            },
            {
                header: 'Market/ZIP',
                accessorKey: 'projectMarket',
                size: 150,
                meta: { key: 'projectMarket' },
                cell: (props) => {
                    const item = props.row.original
                    if (item.entityType === 'lead') {
                        const val = item.projectMarket
                    const opt = projectMarketOptions.find((o) => o.value === val)
                    return <span>{opt ? opt.label : val}</span>
                    } else {
                        return <span>{item.zip || '-'}</span>
                    }
                },
            },
            {
                header: 'Last Contacted/Notes',
                accessorKey: 'dateLastContacted',
                size: 150,
                meta: { key: 'dateLastContacted' },
                cell: (props) => {
                    const item = props.row.original
                    if (item.entityType === 'lead') {
                        const date = item.dateLastContacted
                    if (!date) return <span>-</span>
                    const dateStr = date instanceof Date ? date.toISOString().slice(0,10) : date
                    return <span>{dateStr}</span>
                    } else {
                        return <span>{item.notes ? item.notes.substring(0, 20) + (item.notes.length > 20 ? '...' : '') : '-'}</span>
                    }
                },
            },
            {
                header: 'Status/Tags',
                accessorKey: 'status',
                size: 140,
                meta: { key: 'status' },
                cell: (props) => {
                    const item = props.row.original
                    if (item.entityType === 'lead') {
                        const val = item.status
                    const opt = leadStatusOptions.find((o) => o.value === val)
                    return <Tag className={statusColor(val)}>{opt ? opt.label : val}</Tag>
                    } else {
                        return <span>{item.tags || '-'}</span>
                    }
                },
            },
            {
                header: 'Responded/Client #',
                accessorKey: 'responded',
                size: 120,
                meta: { key: 'responded' },
                cell: (props) => {
                    const item = props.row.original
                    if (item.entityType === 'lead') {
                        return (
                            <span className={item.responded ? 'text-emerald-600' : 'text-gray-500'}>
                                {item.responded ? 'Yes' : 'No'}
                    </span>
                        )
                    } else {
                        return <span>{item.clientNumber || '-'}</span>
                    }
                },
            },
            {
                header: 'Actions',
                id: 'actions',
                size: 200,
                meta: { key: 'actions' },
                cell: (props) => {
                    const item = props.row.original
                    const isLead = item.entityType === 'lead'
                    const detailPath = isLead ? `/leads/${item.id}` : `/clients/${item.id}`
                    const editPath = isLead ? `/leads/${item.id}?tab=settings` : `/clients/${item.id}?tab=settings`
                    
                    return (
                    <div className="flex items-center gap-2">
                        <Tooltip title="View">
                                <Button 
                                    size="sm" 
                                    variant="twoTone" 
                                    icon={<HiOutlineEye />} 
                                    onClick={() => navigate(detailPath)} 
                                />
                        </Tooltip>
                        <Tooltip title="Edit">
                                <Button 
                                    size="sm" 
                                    variant="twoTone" 
                                    icon={<HiOutlinePencil />} 
                                    onClick={() => navigate(editPath)} 
                                />
                        </Tooltip>
                            <Tooltip title={item.favorite ? "Remove from favorites" : "Add to favorites"}>
                                <Button 
                                    size="sm" 
                                    variant={item.favorite ? "solid" : "twoTone"} 
                                    icon={<HiOutlineStar />} 
                                    onClick={() => {
                                        console.log('[Home] Favorite button clicked for item:', item)
                                        console.log('[Home] Current favorite state:', item.favorite)
                                        console.log('[Home] Item ID:', item.id)
                                        toggleFavorite(item.id)
                                    }}
                                    className={item.favorite ? "text-yellow-500" : ""}
                                />
                        </Tooltip>
                        <Tooltip title="Delete">
                            <Button 
                                size="sm" 
                                variant="twoTone" 
                                icon={<HiOutlineTrash />} 
                                    onClick={() => isLead ? handleDeleteLead(item.id) : handleDeleteClient(item.id)}
                                className="text-red-600 hover:text-red-700"
                            />
                        </Tooltip>
                    </div>
                    )
                },
            },
        ],
        [toggleFavorite, handleDeleteLead, handleDeleteClient]
    )

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
            return visibleColumns[key] !== false
        })
        return finalCols
    }, [allColumns, columnOrder, visibleColumns])

    // Ctrl/Cmd click handler for new tab
    const handleLeadNameClick = (e, leadId) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            // Open in new tab with the correct route
            window.open(`/leads/${leadId}`, '_blank')
        } else {
            navigate(`/leads/${leadId}`)
        }
    }

    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false)
    const [createType, setCreateType] = useState('') // 'lead' or 'client'
    
    // Multi-step wizard state
    const [wizardStep, setWizardStep] = useState(1)
    const [wizardData, setWizardData] = useState({
        // Lead fields
        leadName: '',
        leadContact: '',
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
        // Client fields
        clientNumber: '',
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
        showConfirmDialog(
            'Delete Selected Leads',
            `Delete ${selectedIds.size} selected lead(s)? This cannot be undone.`,
            async () => {
                try {
                    const ids = Array.from(selectedIds)
                    for (const id of ids) {
                        await deleteLead(id)
                    }
                    setSelectedIds(new Set())
                } catch (e) {
                    console.error('Bulk delete error:', e)
                }
            }
        )
    }

    const [newLead, setNewLead] = useState({
        leadName: '',
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
        leadName: '',
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
            leadName: '',
            leadContact: '',
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
                    leadName: wizardData.leadName,
                    leadContact: wizardData.leadContact || '',
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
                    clientNumber: wizardData.clientNumber,
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
        }
    }

    const handleCreateLead = async () => {
        if (!newLead.leadName || !newLead.title || !newLead.status) {
            return
        }
        
        try {
            const payload = {
                leadName: newLead.leadName,
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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">CRM</h1>
                <div className="flex items-center gap-2">
                <Button variant="solid" onClick={handleCreateClick}>Create</Button>
                </div>
            </div>

            <Card className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
                    <Input
                        placeholder="Search leads"
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
                        placeholder="Type"
                        isClearable
                        options={[
                            { value: 'lead', label: '👤 Lead' },
                            { value: 'client', label: '🏢 Client' }
                        ]}
                        value={filters.type}
                        onChange={(opt) => {
                            setPageIndex(1)
                            setFilters({ type: opt || null })
                        }}
                    />
                    <Select
                        placeholder="Status"
                        isClearable
                        options={leadStatusOptions}
                        value={filters.status}
                        onChange={(opt) => {
                            setPageIndex(1)
                            setFilters({ status: opt || null })
                        }}
                    />
                    <Select
                        placeholder="Method"
                        isClearable
                        options={methodOfContactOptions}
                        value={filters.methodOfContact}
                        onChange={(opt) => {
                            setPageIndex(1)
                            setFilters({ methodOfContact: opt || null })
                        }}
                    />
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
                    <DatePicker.DatePickerRange
                        placeholder={['From', 'To']}
                        value={[filters.dateFrom || null, filters.dateTo || null]}
                        onChange={(vals) => {
                            // Debounce date range updates; also reset preset to custom
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
                    <Select
                        placeholder="Date presets"
                        isClearable={false}
                        options={datePresetOptions}
                        value={datePresetOptions.find((o) => o.value === datePreset) || datePresetOptions[0]}
                        onChange={(opt) => applyDatePreset(opt?.value || 'none')}
                    />
                </div>
                {/* Quick filter chips - more mobile friendly */}
                <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500">Quick filters:</span>
                        <Button 
                            size="sm" 
                            variant="twoTone" 
                            onClick={() => setShowMoreFilters(!showMoreFilters)}
                        >
                            {showMoreFilters ? 'Less' : 'More'} Filters
                        </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 overflow-x-auto">
                        {['new','contacted','qualified','proposal','won','lost'].map((s) => (
                            <Button key={s} size="sm" variant={filters.status?.value === s ? 'solid' : 'twoTone'}                             onClick={() => {
                                setFilters({ status: { value: s, label: s } })
                                setPageIndex(1)
                            }}>{s}</Button>
                        ))}
                        {[
                            { v: true, label: 'responded' },
                            { v: false, label: 'no response' },
                        ].map((r) => (
                            <Button key={String(r.v)} size="sm" variant={filters.responded?.value === r.v ? 'solid' : 'twoTone'}                             onClick={() => {
                                setFilters({ responded: { value: r.v, label: r.label } })
                                setPageIndex(1)
                            }}>{r.label}</Button>
                        ))}
                        <Button size="sm" onClick={() => {
                            setFilters({ status: null, responded: null })
                            setPageIndex(1)
                        }}>Clear</Button>
                    </div>
                </div>

                {/* Collapsible advanced filters */}
                {showMoreFilters && (
                    <div className="mt-4 space-y-4">
                        {/* Column visibility & order controls */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card className="p-4">
                                <h6 className="font-semibold mb-3">Column Visibility</h6>
                                <div className="grid grid-cols-2 gap-2">
                                    {defaultColumnKeys.map((key) => (
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
                                <h6 className="font-semibold mb-3">Column Order</h6>
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
            </Card>

            <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                    {pageTotal} lead{pageTotal === 1 ? '' : 's'} • Page {pageIndex}
                    {sort.key && sort.order ? ` • Sorted by ${sort.key} (${sort.order})` : ''}
                </div>
                <div className="flex items-center gap-2">
                    {sort.key && sort.order && (
                        <Button 
                            size="sm" 
                            variant="twoTone"
                            onClick={handleClearSort}
                            className="text-red-600 hover:text-red-700"
                        >
                            Clear sort
                        </Button>
                    )}
                </div>
            </div>

            {/* Bulk actions bar */}
            {typeof selectedIds !== 'undefined' && selectedIds.size > 0 && (
                <Card className="p-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="text-sm">{selectedIds.size} selected</div>
                        <div className="flex items-center gap-2">
                            <Select
                                placeholder="Set status"
                                options={leadStatusOptions}
                                value={bulkStatus}
                                onChange={(opt) => setBulkStatus(opt || null)}
                            />
                            <Button size="sm" variant="solid" onClick={handleApplyBulkStatus} disabled={!bulkStatus}>Apply</Button>
                            <Button size="sm" onClick={handleBulkDelete} className="text-red-600 hover:text-red-700">Delete</Button>
                        </div>
                    </div>
                </Card>
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
                className="card"
            />

            {!loading && pageTotal === 0 && (
                <Card className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h5 className="font-semibold mb-1">No leads found</h5>
                            <p className="text-sm text-gray-600">Try adjusting filters or create your first lead.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="twoTone" onClick={() => setIsCreateOpen(true)}>Create lead</Button>
                            {/* In a future iteration, we can wire this to an import workflow */}
                            <Button>Import CSV</Button>
                        </div>
                    </div>
                </Card>
            )}


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
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
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
                    
                    {/* Step 1: Basic Information */}
                    {wizardStep === 1 && (
                    <div className="space-y-4">
                            <h6 className="text-lg font-medium text-gray-700 dark:text-gray-300">Basic Information</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {createType === 'lead' ? (
                                    <>
                            <div>
                                <label className="block text-sm font-medium mb-2">Lead name *</label>
                                <Input 
                                                value={wizardData.leadName} 
                                                onChange={(e) => setWizardData({ ...wizardData, leadName: e.target.value })} 
                                    placeholder="Enter lead name"
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
                                            <label className="block text-sm font-medium mb-2">Client # *</label>
                                            <Input 
                                                value={wizardData.clientNumber} 
                                                onChange={(e) => setWizardData({ ...wizardData, clientNumber: e.target.value })} 
                                                placeholder="Enter client number"
                                />
            </div>

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
                                            <label className="block text-sm font-medium mb-2">Company</label>
                                            <Input 
                                                value={wizardData.company} 
                                                onChange={(e) => setWizardData({ ...wizardData, company: e.target.value })} 
                                                placeholder="Enter company name"
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
                            {wizardStep < (createType === 'lead' ? 3 : 2) ? (
                            <Button 
                                variant="solid" 
                                    onClick={nextWizardStep} 
                                    disabled={
                                        createType === 'lead' 
                                            ? !wizardData.leadName.trim() 
                                            : !wizardData.clientName.trim() || !wizardData.clientNumber.trim()
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
                                            ? !wizardData.leadName.trim() 
                                            : !wizardData.clientName.trim() || !wizardData.clientNumber.trim()
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