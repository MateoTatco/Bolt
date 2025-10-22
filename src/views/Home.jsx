import { useMemo, useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { Button, Card, Input, Select, DatePicker, Tag, Tooltip, Dialog, Form, FormItem, FormContainer, Switcher, Checkbox } from '@/components/ui'
import DataTable from '@/components/shared/DataTable'
import { useCrmStore } from '@/store/crmStore'
import { leadStatusOptions, methodOfContactOptions, projectMarketOptions } from '@/mock/data/leadsData'
import { HiOutlineStar, HiOutlineEye, HiOutlinePencil, HiOutlineTrash, HiOutlineUpload } from 'react-icons/hi'
import FirebaseTest from '@/components/FirebaseTest'
import FirebaseAdvancedTest from '@/components/FirebaseAdvancedTest'
import BulkDataManager from '@/components/BulkDataManager'

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

    // Column visibility & order persistence (per entity type)
    const defaultLeadKeys = [
        'companyName',
        'leadContact',
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
        'clientNumber',
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
                        hay = `${item.companyName} ${item.leadContact} ${item.title} ${item.email} ${item.phone}`.toLowerCase()
                    } else {
                        hay = `${item.clientName} ${item.clientNumber} ${item.address} ${item.city} ${item.state}`.toLowerCase()
                    }
                    if (!hay.includes(term)) return false
                }
                
                // Type filter (default to 'lead' if not set)
                const currentType = type?.value || 'lead'
                if (item.entityType !== currentType) return false
                
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
                size: 220,
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
                size: 180,
                meta: { key: 'leadContact' },
            },
            { header: 'Email', accessorKey: 'email', size: 220, meta: { key: 'email' } },
            { header: 'Phone', accessorKey: 'phone', size: 160, meta: { key: 'phone' } },
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
                    <div className="flex items-center gap-2">
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
                            window.open(`/clients/${item.id}`, '_blank')
                        } else {
                            navigate(`/clients/${item.id}`)
                        }
                    }
                    return (
                        <button onClick={onClick} className="font-semibold text-left hover:text-primary transition-colors">{item.clientName}</button>
                    )
                },
            },
            { header: 'Client #', accessorKey: 'clientNumber', size: 140, meta: { key: 'clientNumber' } },
            { header: 'Address', accessorKey: 'address', size: 220, meta: { key: 'address' } },
            { header: 'City', accessorKey: 'city', size: 140, meta: { key: 'city' } },
            { header: 'State', accessorKey: 'state', size: 100, meta: { key: 'state' } },
            { header: 'ZIP', accessorKey: 'zip', size: 100, meta: { key: 'zip' } },
            { header: 'Tags', accessorKey: 'tags', size: 180, meta: { key: 'tags' } },
            {
                header: 'Actions', id: 'actions', size: 200, meta: { key: 'actions' },
                cell: (props) => {
                    const item = { ...props.row.original, entityType: 'client' }
                    const detailPath = `/clients/${item.id}`
                    const editPath = `/clients/${item.id}?tab=settings`
                    return (
                        <div className="flex items-center gap-2">
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
    const [isBulkManagerOpen, setIsBulkManagerOpen] = useState(false)
    
    // Multi-step wizard state
    const [wizardStep, setWizardStep] = useState(1)
    const [wizardData, setWizardData] = useState({
        // Lead fields
        companyName: '',
        leadContact: '',
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
        <div className="space-y-6">
            {/* Firebase Test Component - Remove this after testing */}
            <FirebaseTest />
            
            {/* Firebase Advanced Test Component - Remove this after testing */}
            <FirebaseAdvancedTest />
            
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">CRM</h1>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        onClick={() => setIsBulkManagerOpen(true)}
                        className="flex items-center gap-2"
                    >
                        <HiOutlineUpload className="w-4 h-4" />
                        Bulk Import/Export
                    </Button>
                    <Button variant="solid" onClick={handleCreateClick}>Create</Button>
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
                    {/* Type Select removed; replaced by top toggle */}
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
                            <Button onClick={() => setIsBulkManagerOpen(true)}>Import Data</Button>
                        </div>
                    </div>
                </Card>
            )}


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
                                            ? !wizardData.companyName.trim() 
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
                                            ? !wizardData.companyName.trim() 
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