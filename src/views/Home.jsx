import { useMemo, useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { Button, Card, Input, Select, DatePicker, Tag, Tooltip, Dialog, Form, FormItem, FormContainer, Switcher, Drawer, Timeline, Checkbox } from '@/components/ui'
import DataTable from '@/components/shared/DataTable'
import { useCrmStore } from '@/store/crmStore'
import { leadStatusOptions, methodOfContactOptions, projectMarketOptions } from '@/mock/data/leadsData'
import { HiOutlineStar, HiOutlineEye, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi'

const Home = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const leads = useCrmStore((s) => s.leads)
    const filters = useCrmStore((s) => s.filters)
    const loading = useCrmStore((s) => s.loading)
    const setFilters = useCrmStore((s) => s.setFilters)
    const toggleFavorite = useCrmStore((s) => s.toggleFavorite)
    const loadLeads = useCrmStore((s) => s.loadLeads)
    const addLead = useCrmStore((s) => s.addLead)
    const deleteLead = useCrmStore((s) => s.deleteLead)

    // Load leads on component mount
    useEffect(() => {
        loadLeads()
    }, [loadLeads])

    const [pageIndex, setPageIndex] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [sort, setSort] = useState({ key: '', order: '' })
    const [tableInstanceKey, setTableInstanceKey] = useState(0)

    // Debounce timer refs
    const searchDebounceRef = useRef(null)
    const dateDebounceRef = useRef(null)

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
        console.log('[Home] showConfirmDialog called with:', { title, message })
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
        console.log('[Home] confirmDialog state set to open')
    }

    // Debug dialog state changes
    useEffect(() => {
        console.log('[Home] confirmDialog state changed:', confirmDialog)
    }, [confirmDialog])

    // Sync state from URL query on first load
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const qPage = parseInt(params.get('page') || '1', 10)
        const qSize = parseInt(params.get('size') || '10', 10)
        const qSortKey = params.get('sortKey') || ''
        const qSortOrder = params.get('sortOrder') || ''
        const qSearch = params.get('search') || ''
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
        const { search, status, methodOfContact, responded, dateFrom, dateTo } = filters
        return leads
            .filter((l) => {
                if (search) {
                    const term = search.toLowerCase()
                    const hay = `${l.leadName} ${l.leadContact} ${l.title} ${l.email} ${l.phone}`.toLowerCase()
                    if (!hay.includes(term)) return false
                }
                if (status && status.value) {
                    if (l.status !== status.value) return false
                }
                if (methodOfContact && methodOfContact.value) {
                    if (l.methodOfContact !== methodOfContact.value) return false
                }
                if (responded !== null && responded !== undefined) {
                    if (typeof responded === 'object' && 'value' in responded) {
                        if (l.responded !== responded.value) return false
                    } else if (typeof responded === 'boolean') {
                        if (l.responded !== responded) return false
                    }
                }
                if (dateFrom) {
                    if (new Date(l.dateLastContacted) < new Date(dateFrom)) return false
                }
                if (dateTo) {
                    if (new Date(l.dateLastContacted) > new Date(dateTo)) return false
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
    }, [leads, filters, sort])

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

    const setSelectedLeadId = useCrmStore((s) => s.setSelectedLeadId)
    const selectedLeadId = useCrmStore((s) => s.selectedLeadId)
    const selectedLead = useMemo(() => leads.find(l => l.id === selectedLeadId) || null, [leads, selectedLeadId])

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

    const allColumns = useMemo(
        () => [
            {
                header: 'Lead Name',
                accessorKey: 'leadName',
                size: 220,
                meta: { key: 'leadName' },
                cell: (props) => (
                    <button 
                        onClick={(e) => handleLeadNameClick(e, props.row.original.id)}
                        className="font-semibold text-left hover:text-primary transition-colors"
                    >
                        {props.row.original.leadName}
                    </button>
                ),
            },
            { header: 'Title', accessorKey: 'title', size: 180, meta: { key: 'title' } },
            { header: 'Email', accessorKey: 'email', size: 220, meta: { key: 'email' } },
            { header: 'Phone', accessorKey: 'phone', size: 160, meta: { key: 'phone' } },
            {
                header: 'Method',
                accessorKey: 'methodOfContact',
                size: 140,
                meta: { key: 'methodOfContact' },
                cell: (props) => {
                    const val = props.row.original.methodOfContact
                    const opt = methodOfContactOptions.find((o) => o.value === val)
                    return <span>{opt ? opt.label : val}</span>
                },
            },
            {
                header: 'Market',
                accessorKey: 'projectMarket',
                size: 150,
                meta: { key: 'projectMarket' },
                cell: (props) => {
                    const val = props.row.original.projectMarket
                    const opt = projectMarketOptions.find((o) => o.value === val)
                    return <span>{opt ? opt.label : val}</span>
                },
            },
            {
                header: 'Last Contacted',
                accessorKey: 'dateLastContacted',
                size: 150,
                meta: { key: 'dateLastContacted' },
                cell: (props) => {
                    const date = props.row.original.dateLastContacted
                    if (!date) return <span>-</span>
                    // Handle both Date objects and string dates
                    const dateStr = date instanceof Date ? date.toISOString().slice(0,10) : date
                    return <span>{dateStr}</span>
                },
            },
            {
                header: 'Status',
                accessorKey: 'status',
                size: 140,
                meta: { key: 'status' },
                cell: (props) => {
                    const val = props.row.original.status
                    const opt = leadStatusOptions.find((o) => o.value === val)
                    return <Tag className={statusColor(val)}>{opt ? opt.label : val}</Tag>
                },
            },
            {
                header: 'Responded',
                accessorKey: 'responded',
                size: 120,
                meta: { key: 'responded' },
                cell: (props) => (
                    <span className={props.row.original.responded ? 'text-emerald-600' : 'text-gray-500'}>
                        {props.row.original.responded ? 'Yes' : 'No'}
                    </span>
                ),
            },
            {
                header: 'Actions',
                id: 'actions',
                size: 200,
                meta: { key: 'actions' },
                cell: (props) => (
                    <div className="flex items-center gap-2">
                        <Tooltip title="View">
                            <Button size="sm" variant="twoTone" icon={<HiOutlineEye />} onClick={() => setSelectedLeadId(props.row.original.id)} />
                        </Tooltip>
                        <Tooltip title="Edit">
                            <Button size="sm" variant="twoTone" icon={<HiOutlinePencil />} />
                        </Tooltip>
                        <Tooltip title="Star">
                            <Button size="sm" variant="twoTone" icon={<HiOutlineStar />} onClick={() => toggleFavorite(props.row.original.id)} />
                        </Tooltip>
                        <Tooltip title="Delete">
                            <Button 
                                size="sm" 
                                variant="twoTone" 
                                icon={<HiOutlineTrash />} 
                                onClick={() => handleDeleteLead(props.row.original.id)}
                                className="text-red-600 hover:text-red-700"
                            />
                        </Tooltip>
                    </div>
                ),
            },
        ],
        [toggleFavorite, setSelectedLeadId, handleDeleteLead]
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
            console.log('[Home] opened lead in new tab', leadId)
        } else {
            navigate(`/leads/${leadId}`)
        }
    }

    const [isCreateOpen, setIsCreateOpen] = useState(false)
    
    // Multi-step wizard state
    const [wizardStep, setWizardStep] = useState(1)
    const [wizardData, setWizardData] = useState({
        // Step 1: Basic Info
        leadName: '',
        leadContact: '',
        email: '',
        phone: '',
        // Step 2: Details
        title: '',
        company: '',
        status: 'new',
        method: 'email',
        market: 'us',
        dateLastContacted: null,
        responded: false,
        // Step 3: Additional Info
        notes: '',
        source: '',
        priority: 'medium'
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
        console.log('[Home] bulk status apply', bulkStatus.value, Array.from(selectedIds))
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
            console.log('[Home] bulk status error', e)
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
                    console.log('[Home] bulk delete error', e)
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
            priority: 'medium'
        })
    }
    
    const handleWizardSubmit = async () => {
        try {
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
            setIsCreateOpen(false)
            resetWizard()
        } catch (error) {
            console.error('Error creating lead:', error)
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
        console.log('[Home] applyDatePreset', { preset, from, to })
    }


    // Clear sort handler: reset local sort and force table remount
    const handleClearSort = () => {
        setSort({ key: '', order: '' })
        setTableInstanceKey((k) => k + 1)
        console.log('[Home] clear sort - reset to default')
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">CRM</h1>
                <div className="flex items-center gap-2">
                <Button variant="solid" onClick={() => setIsCreateOpen(true)}>Create lead</Button>
                </div>
            </div>

            <Card className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
                    <Input
                        placeholder="Search leads"
                        value={filters.search}
                        onChange={(e) => {
                            // Debounce search input updates to reduce filter churn
                            const value = e.target.value
                            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
                            searchDebounceRef.current = setTimeout(() => {
                            setPageIndex(1)
                                setFilters({ search: value })
                                console.log('[Home] search updated', value)
                            }, 250)
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
                                console.log('[Home] date range updated', { from, to })
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
                            <Button key={s} size="sm" variant={filters.status?.value === s ? 'solid' : 'twoTone'} onClick={() => {
                                setFilters({ status: { value: s, label: s } })
                                setPageIndex(1)
                                console.log('[Home] quick status filter', s)
                            }}>{s}</Button>
                        ))}
                        {[
                            { v: true, label: 'responded' },
                            { v: false, label: 'no response' },
                        ].map((r) => (
                            <Button key={String(r.v)} size="sm" variant={filters.responded?.value === r.v ? 'solid' : 'twoTone'} onClick={() => {
                                setFilters({ responded: { value: r.v, label: r.label } })
                                setPageIndex(1)
                                console.log('[Home] quick responded filter', r)
                            }}>{r.label}</Button>
                        ))}
                        <Button size="sm" onClick={() => {
                            setFilters({ status: null, responded: null })
                            setPageIndex(1)
                            console.log('[Home] quick filters cleared')
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
                                                    console.log('[Home] column visibility', key, checked)
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
                                                        console.log('[Home] column move up', key)
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
                                                        console.log('[Home] column move down', key)
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
            {selectedLead /* noop to appease reference before declaration lints */}
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

            {/* Guard against duplicate modal registration by unmounting drawer on large state transitions */}
            {selectedLead && (
            <LeadDetail lead={selectedLead} onClose={() => setSelectedLeadId(null)} />
            )}

            {/* Multi-Step Create Lead Wizard */}
            <Dialog isOpen={isCreateOpen} onClose={() => { setIsCreateOpen(false); resetWizard(); }} width={800}>
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h5 className="text-xl font-semibold">Create Lead</h5>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">Step {wizardStep} of 3</span>
                            <div className="flex gap-1">
                                {[1, 2, 3].map((step) => (
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
                            </div>
                        </div>
                    )}
                    
                    {/* Step 2: Lead Details */}
                    {wizardStep === 2 && (
                        <div className="space-y-4">
                            <h6 className="text-lg font-medium text-gray-700 dark:text-gray-300">Lead Details</h6>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            </div>
                        </div>
                    )}
                    
                    {/* Step 3: Additional Information */}
                    {wizardStep === 3 && (
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
                            {wizardStep < 3 ? (
                                <Button variant="solid" onClick={nextWizardStep} disabled={!wizardData.leadName.trim()}>
                                    Next →
                                </Button>
                            ) : (
                                <Button variant="solid" onClick={handleWizardSubmit} disabled={!wizardData.leadName.trim()}>
                                    Create Lead
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </Dialog>
        </div>
    )
}

const LeadDetail = ({ lead, onClose }) => {
    if (!lead) return null
    return (
        <Drawer isOpen={Boolean(lead)} onClose={onClose} width={520} title={`Lead: ${lead.leadName}`}>
            <div className="space-y-4">
                <Card className="p-4">
                    <div className="grid grid-cols-1 gap-2 text-sm">
                        <div><span className="text-gray-500">Contact:</span> {lead.leadContact || '-'}</div>
                        <div><span className="text-gray-500">Title:</span> {lead.title || '-'}</div>
                        <div><span className="text-gray-500">Email:</span> {lead.email || '-'}</div>
                        <div><span className="text-gray-500">Phone:</span> {lead.phone || '-'}</div>
                        <div><span className="text-gray-500">Method:</span> {lead.methodOfContact}</div>
                        <div><span className="text-gray-500">Market:</span> {lead.projectMarket}</div>
                        <div><span className="text-gray-500">Status:</span> {lead.status}</div>
                        <div><span className="text-gray-500">Responded:</span> {lead.responded ? 'Yes' : 'No'}</div>
                        <div><span className="text-gray-500">Last Contacted:</span> {lead.dateLastContacted ? 
                            (lead.dateLastContacted instanceof Date ? 
                                lead.dateLastContacted.toISOString().slice(0,10) : 
                                lead.dateLastContacted) : '-'}</div>
                    </div>
                </Card>
                <Card className="p-4">
                    <h6 className="font-semibold mb-2">Notes</h6>
                    <div className="text-sm whitespace-pre-wrap">{lead.notes || '—'}</div>
                </Card>
                <Card className="p-4">
                    <h6 className="font-semibold mb-2">Activity</h6>
                    <Timeline>
                        <li className="timeline-item">
                            <div className="timeline-item-point"></div>
                            <div className="timeline-item-content">
                                <div className="timeline-item-title">Lead created</div>
                                <span className="timeline-item-description">{lead.createdAt}</span>
                            </div>
                        </li>
                        <li className="timeline-item">
                            <div className="timeline-item-point"></div>
                            <div className="timeline-item-content">
                                <div className="timeline-item-title">Last updated</div>
                                <span className="timeline-item-description">{lead.updatedAt}</span>
                            </div>
                        </li>
                    </Timeline>
                </Card>
            </div>
        </Drawer>
    )

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">CRM</h1>
                <div className="flex items-center gap-2">
                <Button variant="solid" onClick={() => setIsCreateOpen(true)}>Create lead</Button>
                </div>
            </div>

            <Card className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
                    <Input
                        placeholder="Search leads"
                        value={filters.search}
                        onChange={(e) => {
                            const val = e.target.value
                            setFilters({ search: val })
                            setPageIndex(1)
                            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
                            searchDebounceRef.current = setTimeout(() => {
                                console.log('[Home] search debounced', val)
                            }, 300)
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
                        placeholder="Date range"
                        value={[filters.dateFrom || null, filters.dateTo || null]}
                        onChange={(dates) => {
                            const [from, to] = dates || [null, null]
                            setFilters({ dateFrom: from, dateTo: to })
                            setPageIndex(1)
                            if (dateDebounceRef.current) clearTimeout(dateDebounceRef.current)
                            dateDebounceRef.current = setTimeout(() => {
                                console.log('[Home] date range debounced', { from, to })
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
                                                    console.log('[Home] column visibility', key, checked)
                                                }}
                                            />
                                            <span className="capitalize">{key}</span>
                                        </label>
                                    ))}
                                </div>
                            </Card>
                            <Card className="p-4">
                                <h6 className="font-semibold mb-3">Column Order</h6>
                                <div className="space-y-2">
                                    {columnOrder.map((key, index) => (
                                        <div key={key} className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="plain"
                                                icon={<span>↑</span>}
                                                onClick={() => {
                                                    if (index > 0) {
                                                        const newOrder = [...columnOrder]
                                                        ;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
                                                        setColumnOrder(newOrder)
                                                        localStorage.setItem('crmColumnOrder', JSON.stringify(newOrder))
                                                    }
                                                }}
                                                disabled={index === 0}
                                            />
                                            <Button
                                                size="sm"
                                                variant="plain"
                                                icon={<span>↓</span>}
                                                onClick={() => {
                                                    if (index < columnOrder.length - 1) {
                                                        const newOrder = [...columnOrder]
                                                        ;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
                                                        setColumnOrder(newOrder)
                                                        localStorage.setItem('crmColumnOrder', JSON.stringify(newOrder))
                                                    }
                                                }}
                                                disabled={index === columnOrder.length - 1}
                                            />
                                            <span className="text-sm capitalize">{key}</span>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>

                        {/* Quick filter chips */}
                        <div className="space-y-2">
                            <h6 className="font-semibold">Quick Filters</h6>
                            <div className="flex flex-wrap gap-2">
                                {leadStatusOptions.map((option) => (
                                    <Button
                                        key={option.value}
                                        size="sm"
                                        variant={filters.status?.value === option.value ? 'solid' : 'twoTone'}
                                        onClick={() => {
                                            setPageIndex(1)
                                            setFilters({ status: filters.status?.value === option.value ? null : option })
                                        }}
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                                {respondedOptions.map((option) => (
                                    <Button
                                        key={option.value}
                                        size="sm"
                                        variant={filters.responded?.value === option.value ? 'solid' : 'twoTone'}
                                        onClick={() => {
                                            setPageIndex(1)
                                            setFilters({ responded: filters.responded?.value === option.value ? null : option })
                                        }}
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                                <Button
                                    size="sm"
                                    variant="twoTone"
                                    onClick={() => {
                                        setFilters({ status: null, responded: null })
                                        setPageIndex(1)
                                    }}
                                >
                                    Clear
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-4 flex items-center justify-between">
                    <Button
                        variant="twoTone"
                        onClick={() => setShowMoreFilters(!showMoreFilters)}
                    >
                        {showMoreFilters ? 'Less Filters' : 'More Filters'}
                    </Button>
                </div>
            </Card>

            {/* Table summary and controls */}
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
            {selectedLead /* noop to appease reference before declaration lints */}
            {typeof selectedIds !== 'undefined' && selectedIds.size > 0 && (
                <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className="font-medium text-blue-900 dark:text-blue-100">
                                {selectedIds.size} lead{selectedIds.size === 1 ? '' : 's'} selected
                            </span>
                            <Select
                                placeholder="Bulk status update"
                                options={leadStatusOptions}
                                value={bulkStatus}
                                onChange={setBulkStatus}
                                className="min-w-[200px]"
                            />
                            <Button
                                size="sm"
                                onClick={handleApplyBulkStatus}
                                disabled={!bulkStatus}
                            >
                                Apply
                            </Button>
                        </div>
                        <Button
                            size="sm"
                            variant="twoTone"
                            onClick={handleBulkDelete}
                            className="text-red-600 hover:text-red-700"
                        >
                            Delete Selected
                        </Button>
                    </div>
                </Card>
            )}

            {loading && (
                <Card className="p-6">
                    <div className="flex items-center justify-center">
                        <div className="text-center">
                            <div className="text-lg font-semibold text-gray-500">Loading leads...</div>
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
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No leads found</h3>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">
                                {Object.values(filters).some(v => v !== null && v !== '') 
                                    ? 'Try adjusting your filters to see more results.' 
                                    : 'Get started by creating your first lead.'
                                }
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="solid" onClick={() => setIsCreateOpen(true)}>
                                Create lead
                            </Button>
                            <Button variant="twoTone" onClick={() => window.open('/import', '_blank')}>
                                Import CSV
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {/* Create Lead Dialog */}
            <Dialog
                isOpen={isCreateOpen}
                onClose={() => {
                    setIsCreateOpen(false)
                    resetNewLead()
                }}
                width={800}
            >
                <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Create New Lead</h3>
                    <Form>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormItem label="Lead Name" required>
                                <Input
                                    value={newLead.leadName}
                                    onChange={(e) => setNewLead({ ...newLead, leadName: e.target.value })}
                                    placeholder="Enter lead name"
                                />
                            </FormItem>
                            <FormItem label="Contact Person">
                                <Input
                                    value={newLead.leadContact}
                                    onChange={(e) => setNewLead({ ...newLead, leadContact: e.target.value })}
                                    placeholder="Enter contact person"
                                />
                            </FormItem>
                            <FormItem label="Title" required>
                                <Input
                                    value={newLead.title}
                                    onChange={(e) => setNewLead({ ...newLead, title: e.target.value })}
                                    placeholder="Enter title"
                                />
                            </FormItem>
                            <FormItem label="Email">
                                <Input
                                    value={newLead.email}
                                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                                    placeholder="Enter email"
                                />
                            </FormItem>
                            <FormItem label="Phone">
                                <Input
                                    value={newLead.phone}
                                    onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                                    placeholder="Enter phone"
                                />
                            </FormItem>
                            <FormItem label="Status" required>
                                <Select
                                    placeholder="Select status"
                                    options={leadStatusOptions}
                                    value={newLead.status}
                                    onChange={(opt) => setNewLead({ ...newLead, status: opt })}
                                />
                            </FormItem>
                            <FormItem label="Method of contact">
                                <Select
                                    placeholder="Select method"
                                    options={methodOfContactOptions}
                                    value={newLead.methodOfContact}
                                    onChange={(opt) => setNewLead({ ...newLead, methodOfContact: opt })}
                                />
                            </FormItem>
                            <FormItem label="Project market">
                                <Select
                                    placeholder="Select market"
                                    options={projectMarketOptions}
                                    value={newLead.projectMarket}
                                    onChange={(opt) => setNewLead({ ...newLead, projectMarket: opt })}
                                />
                            </FormItem>
                            <FormItem label="Lead conception">
                                <Select
                                    placeholder="Select conception"
                                    options={leadConceptionOptions}
                                    value={newLead.leadConception}
                                    onChange={(opt) => setNewLead({ ...newLead, leadConception: opt })}
                                />
                            </FormItem>
                            <FormItem label="Date last contacted">
                                <DatePicker
                                    value={newLead.dateLastContacted}
                                    onChange={(date) => setNewLead({ ...newLead, dateLastContacted: date })}
                                />
                            </FormItem>
                            <FormItem label="Responded">
                                <Switcher
                                    checked={newLead.responded}
                                    onChange={(checked) => setNewLead({ ...newLead, responded: checked })}
                                />
                            </FormItem>
                            <FormItem label="Notes" className="md:col-span-2">
                                <Input
                                    value={newLead.notes}
                                    onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                                    placeholder="Enter notes"
                                    textArea
                                />
                            </FormItem>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <Button
                                variant="twoTone"
                                onClick={() => {
                                    setIsCreateOpen(false)
                                    resetNewLead()
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="solid"
                                onClick={handleCreateLead}
                                disabled={!newLead.leadName || !newLead.title || !newLead.status}
                            >
                                Create Lead
                            </Button>
                        </div>
                    </Form>
                </div>
            </Dialog>

            {/* Lead Detail Drawer */}
            {selectedLead && (
                <LeadDetail
                    lead={selectedLead}
                    onClose={() => setSelectedLeadId(null)}
                />
            )}

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
