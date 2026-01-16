import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Button, Card, Input, Select, Tag, Tooltip } from '@/components/ui'
import DataTable from '@/components/shared/DataTable'
import { useWarrantyStore } from '@/store/warrantyStore'
import { HiOutlinePlus, HiOutlineEye, HiOutlinePencil, HiOutlineCheckCircle, HiOutlineRefresh } from 'react-icons/hi'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import Avatar from '@/components/ui/Avatar'
import acronym from '@/utils/acronym'
import useRandomBgColor from '@/utils/hooks/useRandomBgColor'
import CreateWarrantyModal from '@/views/WarrantyTracker/components/CreateWarrantyModal'

const WarrantyTracker = () => {
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState('open')
    const [users, setUsers] = useState([])
    const [loadingUsers, setLoadingUsers] = useState(true)
    const [showCreateModal, setShowCreateModal] = useState(false)
    
    const {
        warranties,
        filters,
        loading,
        loadWarranties,
        setFilters,
        setupRealtimeListener,
        cleanupRealtimeListener,
        completeWarranty,
    } = useWarrantyStore()

    const bgColor = useRandomBgColor()

    // Load users for assignedTo display and filters
    useEffect(() => {
        const loadUsers = async () => {
            setLoadingUsers(true)
            try {
                const response = await FirebaseDbService.users.getAll()
                if (response.success) {
                    setUsers(response.data || [])
                }
            } catch (error) {
                console.error('Failed to load users:', error)
            } finally {
                setLoadingUsers(false)
            }
        }
        loadUsers()
    }, [])

    // Load warranties and setup real-time listener
    useEffect(() => {
        // Set status filter based on active tab
        setFilters({ status: activeTab === 'open' ? 'open' : 'completed' })
        loadWarranties()
        const unsubscribe = setupRealtimeListener()
        
        return () => {
            cleanupRealtimeListener()
            if (unsubscribe) unsubscribe()
        }
    }, [activeTab])

    // Reload when filters change
    useEffect(() => {
        if (activeTab) {
            loadWarranties()
        }
    }, [filters.search, filters.assignedTo, filters.projectName])

    // Get user by ID
    const getUserById = (userId) => {
        return users.find(u => u.id === userId || u.uid === userId)
    }

    // Format date helper
    const formatDate = (date) => {
        if (!date) return '-'
        try {
            if (date?.toDate) {
                return date.toDate().toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                })
            }
            if (date instanceof Date) {
                return date.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                })
            }
            if (typeof date === 'string') {
                return new Date(date).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                })
            }
            return '-'
        } catch {
            return '-'
        }
    }

    // Get user display name
    const getUserDisplayName = (user) => {
        if (!user) return 'Unknown'
        return user.userName || 
               user.firstName || 
               user.lastName || 
               user.displayName || 
               user.email?.split('@')[0] || 
               'Unknown'
    }

    // Get user initials
    const getUserInitials = (user) => {
        if (!user) return '?'
        const name = getUserDisplayName(user)
        return acronym(name)
    }

    // Filtered warranties - already filtered by status in store, just apply search/other filters
    const filteredWarranties = useMemo(() => {
        return warranties // Store already filters by status
    }, [warranties])

    // User options for filter
    const userOptions = useMemo(() => {
        return users.map(user => ({
            value: user.id || user.uid,
            label: getUserDisplayName(user),
        }))
    }, [users])

    // Table columns
    const columns = useMemo(() => [
        {
            header: 'Project Name',
            accessorKey: 'projectName',
            size: 250,
            cell: ({ row }) => {
                const warranty = row.original
                return (
                    <Tooltip title={warranty.projectName || '-'}>
                        <button
                            onClick={() => navigate(`/warranty-tracker/${warranty.id}`)}
                            className="font-semibold text-left hover:text-primary transition-colors block max-w-[230px] truncate"
                        >
                            {warranty.projectName || '-'}
                        </button>
                    </Tooltip>
                )
            },
        },
        {
            header: 'Description',
            accessorKey: 'description',
            size: 300,
            cell: ({ row }) => {
                const description = row.original.description || '-'
                return (
                    <Tooltip title={description}>
                        <span className="block max-w-[280px] truncate text-gray-600 dark:text-gray-400">
                            {description}
                        </span>
                    </Tooltip>
                )
            },
        },
        {
            header: 'Requested By',
            accessorKey: 'requestedBy',
            size: 150,
            cell: ({ row }) => {
                const warranty = row.original
                return (
                    <div className="flex flex-col">
                        <span className="font-medium">{warranty.requestedBy || '-'}</span>
                        {warranty.requestedByEmail && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {warranty.requestedByEmail}
                            </span>
                        )}
                    </div>
                )
            },
        },
        {
            header: 'Assigned To',
            accessorKey: 'assignedTo',
            size: 200,
            cell: ({ row }) => {
                const assignedUserIds = row.original.assignedTo || []
                if (assignedUserIds.length === 0) {
                    return <span className="text-gray-400">Unassigned</span>
                }
                
                const assignedUsers = assignedUserIds
                    .map(id => getUserById(id))
                    .filter(Boolean)
                    .slice(0, 3) // Show max 3 avatars
                
                const remainingCount = assignedUserIds.length - assignedUsers.length

                return (
                    <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                            {assignedUsers.map((user, index) => {
                                const displayName = getUserDisplayName(user)
                                return (
                                    <Tooltip
                                        key={user.id || user.uid || index}
                                        title={displayName}
                                    >
                                        <Avatar
                                            size={28}
                                            className={`${bgColor(displayName)} border-2 border-white dark:border-gray-800`}
                                        >
                                            {getUserInitials(user)}
                                        </Avatar>
                                    </Tooltip>
                                )
                            })}
                        </div>
                        {remainingCount > 0 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                                +{remainingCount}
                            </span>
                        )}
                    </div>
                )
            },
        },
        {
            header: 'Status',
            accessorKey: 'status',
            size: 120,
            cell: ({ row }) => {
                const status = row.original.status
                const statusClass = status === 'completed' 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                return (
                    <Tag className={statusClass}>
                        {status === 'completed' ? 'Completed' : 'Open'}
                    </Tag>
                )
            },
        },
        {
            header: 'Start Date',
            accessorKey: 'startDate',
            size: 120,
            cell: ({ row }) => {
                return <span className="whitespace-nowrap">{formatDate(row.original.startDate)}</span>
            },
        },
        {
            header: 'Created',
            accessorKey: 'createdAt',
            size: 120,
            cell: ({ row }) => {
                return <span className="whitespace-nowrap">{formatDate(row.original.createdAt)}</span>
            },
        },
        {
            header: 'Actions',
            accessorKey: 'actions',
            size: 150,
            cell: ({ row }) => {
                const warranty = row.original
                return (
                    <div className="flex items-center gap-2">
                        <Tooltip title="View Details">
                            <Button
                                size="sm"
                                variant="plain"
                                icon={<HiOutlineEye />}
                                onClick={() => navigate(`/warranty-tracker/${warranty.id}`)}
                            />
                        </Tooltip>
                        <Tooltip title="Edit">
                            <Button
                                size="sm"
                                variant="plain"
                                icon={<HiOutlinePencil />}
                                onClick={() => navigate(`/warranty-tracker/${warranty.id}?edit=true`)}
                            />
                        </Tooltip>
                        {warranty.status === 'open' && (
                            <Tooltip title="Mark as Completed">
                                <Button
                                    size="sm"
                                    variant="plain"
                                    icon={<HiOutlineCheckCircle />}
                                    onClick={async () => {
                                        if (window.confirm('Mark this warranty as completed?')) {
                                            try {
                                                await completeWarranty(warranty.id)
                                            } catch (error) {
                                                console.error('Failed to complete warranty:', error)
                                            }
                                        }
                                    }}
                                    className="text-green-600 hover:text-green-700"
                                />
                            </Tooltip>
                        )}
                    </div>
                )
            },
        },
    ], [navigate, users, bgColor, completeWarranty])

    return (
        <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
                <h1 className="text-2xl font-bold">Warranty Tracker</h1>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <Button
                        variant="solid"
                        icon={<HiOutlinePlus />}
                        onClick={() => setShowCreateModal(true)}
                        className="w-full sm:w-auto"
                    >
                        New Warranty Item
                    </Button>
                    <Button
                        variant="twoTone"
                        icon={<HiOutlineRefresh />}
                        onClick={loadWarranties}
                        loading={loading}
                        className="w-full sm:w-auto"
                    >
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Tabs and Filters */}
            <Card>
                <div className="p-4 md:p-6 space-y-4">
                    {/* Tabs */}
                    <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => setActiveTab('open')}
                            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                                activeTab === 'open'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                            }`}
                        >
                            Open Warranties ({activeTab === 'open' ? filteredWarranties.length : warranties.filter(w => w.status === 'open').length})
                        </button>
                        <button
                            onClick={() => setActiveTab('completed')}
                            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                                activeTab === 'completed'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                            }`}
                        >
                            Completed Warranties ({activeTab === 'completed' ? filteredWarranties.length : warranties.filter(w => w.status === 'completed').length})
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                        <div className="md:col-span-2">
                            <Input
                                placeholder="Search by project name, description, or requested by..."
                                value={filters.search || ''}
                                onChange={(e) => setFilters({ search: e.target.value })}
                            />
                        </div>
                        <Select
                            placeholder="Filter by Assigned To"
                            isClearable
                            isMulti
                            options={userOptions}
                            value={filters.assignedTo ? userOptions.filter(opt => filters.assignedTo.includes(opt.value)) : null}
                            onChange={(selected) => {
                                setFilters({ 
                                    assignedTo: selected ? selected.map(s => s.value) : null 
                                })
                            }}
                            isLoading={loadingUsers}
                        />
                    </div>

                    {/* Data Table */}
                    <div className="pt-4">
                        <DataTable
                            columns={columns}
                            data={filteredWarranties}
                            loading={loading}
                            skeletonAvatarColumns={[0]}
                            skeletonAvatarProps={{ size: 20 }}
                        />
                    </div>
                </div>
            </Card>

            {/* Create/Edit Warranty Modal */}
            <CreateWarrantyModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
            />
        </div>
    )
}

export default WarrantyTracker
