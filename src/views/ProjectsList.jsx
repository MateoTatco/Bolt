import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Button, Card, Input, Select, Tag, Tooltip, Dialog, DatePicker } from '@/components/ui'
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
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
        onCancel: null
    })
    const [newProject, setNewProject] = useState({
        ProjectNumber: '',
        ProjectName: '',
        city: '',
        State: '',
        Market: '',
        ProjectStatus: '',
        ProjectProbability: '',
        ProjectManager: '',
        StartDate: null,
        ProjectedFinishDate: null,
        BidDueDate: null,
        ProjectRevisedContractAmount: '',
        Superintendent: '',
    })

    useEffect(() => {
        loadProjects()
    }, [loadProjects])

    const filteredProjects = useMemo(() => {
        const { search, market, projectStatus, projectProbability } = filters
        
        return projects
            .filter((project) => {
                if (search) {
                    const term = search.toLowerCase()
                    const hay = `${project.ProjectNumber || ''} ${project.ProjectName || ''} ${project.city || ''} ${project.State || ''} ${project.ProjectManager || ''}`.toLowerCase()
                    if (!hay.includes(term)) return false
                }
                
                if (market && market.value && project.Market !== market.value) return false
                if (projectStatus && projectStatus.value && project.ProjectStatus !== projectStatus.value) return false
                if (projectProbability && projectProbability.value && project.ProjectProbability !== projectProbability.value) return false
                
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

    const resetNewProject = () => setNewProject({
        ProjectNumber: '',
        ProjectName: '',
        city: '',
        State: '',
        Market: '',
        ProjectStatus: '',
        ProjectProbability: '',
        ProjectManager: '',
        StartDate: null,
        ProjectedFinishDate: null,
        BidDueDate: null,
        ProjectRevisedContractAmount: '',
        Superintendent: '',
    })

    const handleCreateProject = async () => {
        if (!newProject.ProjectName.trim()) {
            alert('Project Name is required')
            return
        }
        
        try {
            const payload = {
                ...newProject,
                StartDate: newProject.StartDate ? (newProject.StartDate instanceof Date ? newProject.StartDate.toISOString() : newProject.StartDate) : null,
                ProjectedFinishDate: newProject.ProjectedFinishDate ? (newProject.ProjectedFinishDate instanceof Date ? newProject.ProjectedFinishDate.toISOString() : newProject.ProjectedFinishDate) : null,
                BidDueDate: newProject.BidDueDate ? (newProject.BidDueDate instanceof Date ? newProject.BidDueDate.toISOString() : newProject.BidDueDate) : null,
                Market: newProject.Market?.value || newProject.Market || '',
                ProjectStatus: newProject.ProjectStatus?.value || newProject.ProjectStatus || '',
                ProjectProbability: newProject.ProjectProbability?.value || newProject.ProjectProbability || '',
                ProjectRevisedContractAmount: newProject.ProjectRevisedContractAmount ? parseFloat(newProject.ProjectRevisedContractAmount) : null,
                ProjectNumber: newProject.ProjectNumber ? parseFloat(newProject.ProjectNumber) : null,
                favorite: false,
            }
            await addProject(payload)
            resetNewProject()
            setIsCreateOpen(false)
        } catch (error) {
            console.error('Error creating project:', error)
        }
    }

    const columns = useMemo(() => [
        {
            header: 'Project Number',
            accessorKey: 'ProjectNumber',
            size: 140,
            cell: (props) => {
                const value = props.row.original.ProjectNumber
                return <span>{value || '-'}</span>
            },
        },
        {
            header: 'Project',
            accessorKey: 'ProjectName',
            size: 300,
            cell: (props) => {
                const item = props.row.original
                return (
                    <button 
                        onClick={(e) => handleProjectNameClick(e, item.id)}
                        className="font-semibold text-left hover:text-primary transition-colors"
                    >
                        {item.ProjectName || '-'}
                    </button>
                )
            },
        },
        {
            header: 'City',
            accessorKey: 'city',
            size: 150,
            cell: (props) => <span>{props.row.original.city || '-'}</span>,
        },
        {
            header: 'PM',
            accessorKey: 'ProjectManager',
            size: 180,
            cell: (props) => <span>{props.row.original.ProjectManager || '-'}</span>,
        },
        {
            header: 'State',
            accessorKey: 'State',
            size: 100,
            cell: (props) => <span>{props.row.original.State || '-'}</span>,
        },
        {
            header: 'Market',
            accessorKey: 'Market',
            size: 100,
            cell: (props) => {
                const val = props.row.original.Market
                const opt = marketOptions.find((o) => o.value === val)
                return <span>{opt ? opt.label : val || '-'}</span>
            },
        },
        {
            header: 'Status',
            accessorKey: 'ProjectStatus',
            size: 180,
            cell: (props) => {
                const val = props.row.original.ProjectStatus
                if (!val) return <span>-</span>
                return <Tag className={statusColor(val)}>{val}</Tag>
            },
        },
        {
            header: 'Project Probability',
            accessorKey: 'ProjectProbability',
            size: 160,
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
            cell: (props) => <span>{formatDate(props.row.original.BidDueDate)}</span>,
        },
        {
            header: 'Contract Amount',
            accessorKey: 'ProjectRevisedContractAmount',
            size: 160,
            cell: (props) => <span>{formatCurrency(props.row.original.ProjectRevisedContractAmount)}</span>,
        },
        {
            header: 'Start Date',
            accessorKey: 'StartDate',
            size: 140,
            cell: (props) => <span>{formatDate(props.row.original.StartDate)}</span>,
        },
        {
            header: 'Projected Completion',
            accessorKey: 'ProjectedFinishDate',
            size: 180,
            cell: (props) => <span>{formatDate(props.row.original.ProjectedFinishDate)}</span>,
        },
        {
            header: 'Super Assigned',
            accessorKey: 'Superintendent',
            size: 180,
            cell: (props) => <span>{props.row.original.Superintendent || '-'}</span>,
        },
        {
            header: 'Actions',
            id: 'actions',
            size: 200,
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

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Master Tracker</h1>
                <div className="flex items-center gap-2">
                    <Button
                        variant="twoTone"
                        icon={<HiOutlinePlus />}
                        onClick={() => setIsCreateOpen(true)}
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
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Input
                            placeholder="Search by Project Number, Name, City, State, PM..."
                            value={filters.search || ''}
                            onChange={(e) => setFilters({ search: e.target.value })}
                        />
                        <Select
                            placeholder="Market"
                            options={marketOptions}
                            value={filters.market}
                            onChange={(opt) => setFilters({ market: opt })}
                        />
                        <Select
                            placeholder="Status"
                            options={projectStatusOptions}
                            value={filters.projectStatus}
                            onChange={(opt) => setFilters({ projectStatus: opt })}
                        />
                        <Select
                            placeholder="Probability"
                            options={projectProbabilityOptions}
                            value={filters.projectProbability}
                            onChange={(opt) => setFilters({ projectProbability: opt })}
                        />
                    </div>

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

            {/* Create Project Dialog */}
            <Dialog isOpen={isCreateOpen} onClose={() => { setIsCreateOpen(false); resetNewProject() }} width={700}>
                <div className="p-6">
                    <h3 className="text-lg font-semibold mb-6">Create New Project</h3>
                    
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project Name *</label>
                                <Input 
                                    value={newProject.ProjectName} 
                                    onChange={(e) => setNewProject({ ...newProject, ProjectName: e.target.value })} 
                                    placeholder="Enter project name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project Number</label>
                                <Input 
                                    value={newProject.ProjectNumber} 
                                    onChange={(e) => setNewProject({ ...newProject, ProjectNumber: e.target.value.replace(/[^0-9.]/g, '') })} 
                                    placeholder="Enter project number"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City</label>
                                <Input 
                                    value={newProject.city} 
                                    onChange={(e) => setNewProject({ ...newProject, city: e.target.value })} 
                                    placeholder="Enter city"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">State</label>
                                <Input 
                                    value={newProject.State} 
                                    onChange={(e) => setNewProject({ ...newProject, State: e.target.value })} 
                                    placeholder="Enter state"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Market</label>
                                <Select
                                    options={marketOptions}
                                    value={marketOptions.find((o) => o.value === newProject.Market) || null}
                                    onChange={(opt) => setNewProject({ ...newProject, Market: opt })}
                                    placeholder="Select market"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                                <Select
                                    options={projectStatusOptions}
                                    value={projectStatusOptions.find((o) => o.value === newProject.ProjectStatus) || null}
                                    onChange={(opt) => setNewProject({ ...newProject, ProjectStatus: opt })}
                                    placeholder="Select status"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Probability</label>
                                <Select
                                    options={projectProbabilityOptions}
                                    value={projectProbabilityOptions.find((o) => o.value === newProject.ProjectProbability) || null}
                                    onChange={(opt) => setNewProject({ ...newProject, ProjectProbability: opt })}
                                    placeholder="Select probability"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project Manager</label>
                                <Input 
                                    value={newProject.ProjectManager} 
                                    onChange={(e) => setNewProject({ ...newProject, ProjectManager: e.target.value })} 
                                    placeholder="Enter PM name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Superintendent</label>
                                <Input 
                                    value={newProject.Superintendent} 
                                    onChange={(e) => setNewProject({ ...newProject, Superintendent: e.target.value })} 
                                    placeholder="Enter superintendent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contract Amount (USD)</label>
                                <Input 
                                    value={newProject.ProjectRevisedContractAmount} 
                                    onChange={(e) => setNewProject({ ...newProject, ProjectRevisedContractAmount: e.target.value.replace(/[^0-9.]/g, '') })} 
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                                <DatePicker 
                                    value={newProject.StartDate ? new Date(newProject.StartDate) : null} 
                                    onChange={(d) => setNewProject({ ...newProject, StartDate: d })} 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Projected Finish Date</label>
                                <DatePicker 
                                    value={newProject.ProjectedFinishDate ? new Date(newProject.ProjectedFinishDate) : null} 
                                    onChange={(d) => setNewProject({ ...newProject, ProjectedFinishDate: d })} 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bid Due Date</label>
                                <DatePicker 
                                    value={newProject.BidDueDate ? new Date(newProject.BidDueDate) : null} 
                                    onChange={(d) => setNewProject({ ...newProject, BidDueDate: d })} 
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="twoTone" onClick={() => { setIsCreateOpen(false); resetNewProject() }}>Cancel</Button>
                        <Button 
                            variant="solid" 
                            onClick={handleCreateProject}
                            disabled={!newProject.ProjectName.trim()}
                        >
                            Create Project
                        </Button>
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

