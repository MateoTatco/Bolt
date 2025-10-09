import { useMemo, useState, useEffect } from 'react'
import { Button, Card, Input, Select, DatePicker, Tag, Tooltip, Dialog, Form, FormItem, FormContainer, Switcher, Drawer, Timeline } from '@/components/ui'
import DataTable from '@/components/shared/DataTable'
import { useCrmStore } from '@/store/crmStore'
import { leadStatusOptions, methodOfContactOptions, projectMarketOptions } from '@/mock/data/leadsData'
import { HiOutlineStar, HiOutlineEye, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi'

const Home = () => {
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

    const columns = useMemo(
        () => [
            {
                header: 'Lead Name',
                accessorKey: 'leadName',
                size: 220,
                cell: (props) => <span className="font-semibold">{props.row.original.leadName}</span>,
            },
            { header: 'Title', accessorKey: 'title', size: 180 },
            { header: 'Email', accessorKey: 'email', size: 220 },
            { header: 'Phone', accessorKey: 'phone', size: 160 },
            {
                header: 'Method',
                accessorKey: 'methodOfContact',
                size: 140,
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

    const [isCreateOpen, setIsCreateOpen] = useState(false)

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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">CRM</h1>
                <Button variant="solid" onClick={() => setIsCreateOpen(true)}>Create lead</Button>
            </div>

            <Card className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
                    <Input
                        placeholder="Search leads"
                        value={filters.search}
                        onChange={(e) => {
                            setPageIndex(1)
                            setFilters({ search: e.target.value })
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
                        value={
                            filters.dateFrom && filters.dateTo
                                ? [filters.dateFrom, filters.dateTo]
                                : null
                        }
                        onChange={(vals) => {
                            const [from, to] = vals || []
                            setPageIndex(1)
                            setFilters({
                                dateFrom: from || null,
                                dateTo: to || null,
                            })
                        }}
                                />
                            </div>
            </Card>

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
                className="card"
            />

            <LeadDetail lead={selectedLead} onClose={() => setSelectedLeadId(null)} />

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
