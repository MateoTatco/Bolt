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

    // Saved filters state (list of named presets from localStorage)
    const [savedFilters, setSavedFilters] = useState(() => {
        try {
            const raw = localStorage.getItem('crmSavedFilters')
            return raw ? JSON.parse(raw) : []
        } catch {
            return []
        }
    })
    const [activeSavedFilter, setActiveSavedFilter] = useState('')
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
        if (window.confirm('Are you sure you want to delete this lead? This action cannot be undone.')) {
            try {
                await deleteLead(leadId)
            } catch (error) {
                console.error('Error deleting lead:', error)
            }
        }
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
                        onClick={() => navigate(`/leads/${props.row.original.id}`)}
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

    const [isCreateOpen, setIsCreateOpen] = useState(false)
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
        if (!window.confirm(`Delete ${selectedIds.size} selected lead(s)? This cannot be undone.`)) return
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

    // Helpers: Saved filters (localStorage)
    const saveCurrentFilters = () => {
        const name = window.prompt('Save current filters as? (name)')
        if (!name) return
        const preset = {
            name,
            filters,
            sort,
            pageSize,
        }
        try {
            const next = [...savedFilters.filter((p) => p.name !== name), preset]
            localStorage.setItem('crmSavedFilters', JSON.stringify(next))
            setSavedFilters(next)
            setActiveSavedFilter(name)
            console.log('[Home] saved filter preset', preset)
        } catch (e) {
            console.log('[Home] failed to save filter preset', e)
        }
    }

    const applySavedFilter = (name) => {
        const preset = savedFilters.find((p) => p.name === name)
        if (!preset) return
        setActiveSavedFilter(name)
        setSort(preset.sort || { key: '', order: '' })
        setPageSize(preset.pageSize || 10)
        setPageIndex(1)
        setFilters(preset.filters || {})
        console.log('[Home] applySavedFilter', preset)
    }

    // Clear sort handler: reset local sort and force table remount
    const handleClearSort = () => {
        setSort({ key: '', order: '' })
        setTableInstanceKey((k) => k + 1)
        console.log('[Home] clear sort')
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">CRM</h1>
                <div className="flex items-center gap-2">
                    <Button onClick={saveCurrentFilters} variant="twoTone">Save filter</Button>
                    <Select
                        placeholder="Saved filters"
                        isClearable
                        options={savedFilters.map((p) => ({ value: p.name, label: p.name }))}
                        value={activeSavedFilter ? { value: activeSavedFilter, label: activeSavedFilter } : null}
                        onChange={(opt) => applySavedFilter(opt?.value || '')}
                    />
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
                    <Button size="sm" onClick={handleClearSort}>
                        Clear sort
                    </Button>
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

            <Dialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} width={700}>
                <div className="p-6">
                    <h5 className="text-xl font-semibold mb-4">Create Lead</h5>
                    
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Lead name *</label>
                                <Input 
                                    value={newLead.leadName} 
                                    onChange={(e) => setNewLead({ ...newLead, leadName: e.target.value })} 
                                    placeholder="Enter lead name"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium mb-2">Lead contact</label>
                                <Input 
                                    value={newLead.leadContact} 
                                    onChange={(e) => setNewLead({ ...newLead, leadContact: e.target.value })} 
                                    placeholder="Enter contact person"
                                />
        </div>
                            
                            <div>
                                <label className="block text-sm font-medium mb-2">Title *</label>
                                <Input 
                                    value={newLead.title} 
                                    onChange={(e) => setNewLead({ ...newLead, title: e.target.value })} 
                                    placeholder="Enter title"
                                />
            </div>

            <div>
                                <label className="block text-sm font-medium mb-2">Email</label>
                                <Input 
                                    type="email"
                                    value={newLead.email} 
                                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} 
                                    placeholder="Enter email"
                                />
            </div>

            <div>
                                <label className="block text-sm font-medium mb-2">Phone</label>
                                <Input 
                                    value={newLead.phone} 
                                    onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} 
                                    placeholder="Enter phone"
                                />
            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Status *</label>
                                <Select
                                    placeholder="Select status"
                                    options={leadStatusOptions}
                                    value={newLead.status}
                                    onChange={(opt) => setNewLead({ ...newLead, status: opt })}
                                />
                        </div>
                        
                            <div>
                                <label className="block text-sm font-medium mb-2">Method of contact</label>
                                <Select
                                    placeholder="Select method"
                                    isClearable
                                    options={methodOfContactOptions}
                                    value={newLead.methodOfContact}
                                    onChange={(opt) => setNewLead({ ...newLead, methodOfContact: opt })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Project market</label>
                                <Select
                                    placeholder="Select market"
                                    isClearable
                                    options={projectMarketOptions}
                                    value={newLead.projectMarket}
                                    onChange={(opt) => setNewLead({ ...newLead, projectMarket: opt })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Date last contacted</label>
                                <DatePicker
                                    placeholder="Select date"
                                    value={newLead.dateLastContacted}
                                    onChange={(val) => {
                                        console.log('DatePicker onChange:', val)
                                        setNewLead({ ...newLead, dateLastContacted: val })
                                    }}
                                />
                            </div>
                        </div>

                            <div>
                            <label className="block text-sm font-medium mb-2">Notes</label>
                                <Input 
                                    textArea
                                rows={3}
                                value={newLead.notes} 
                                onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })} 
                                placeholder="Enter notes"
                                />
                            </div>
                        </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <Button onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                            <Button 
                                variant="solid" 
                            onClick={handleCreateLead}
                            disabled={!newLead.leadName || !newLead.title || !newLead.status || loading}
                            loading={loading}
                            >
                            Create
                            </Button>
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
}

export default Home
