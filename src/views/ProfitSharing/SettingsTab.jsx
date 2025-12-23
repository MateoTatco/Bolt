import { useState, useEffect } from 'react'
import { Card, Button, Input, Table, Dialog, Notification, toast, Select, Tag, Avatar } from '@/components/ui'
import DataTable from '@/components/shared/DataTable'
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineCheck, HiOutlineX, HiOutlineUserGroup } from 'react-icons/hi'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { useSelectedCompany } from '@/hooks/useSelectedCompany'
import { useProfitSharingAccessContext } from '@/context/ProfitSharingAccessContext'
import { useSessionUser } from '@/store/authStore'
import { db } from '@/configs/firebase.config'
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore'
import { createNotification } from '@/utils/notificationHelper'
import { NOTIFICATION_TYPES } from '@/constants/notification.constant'
import { components } from 'react-select'
import React from 'react'

const DEFAULT_COMPANY_NAME = 'Tatco OKC'

// Built-in super admins (always have access)
const SUPER_ADMINS = [
    { id: 'super-admin-1', userName: 'Admin', userEmail: 'admin-01@tatco.construction', role: 'admin', isBuiltIn: true },
    { id: 'super-admin-2', userName: 'Brett', userEmail: 'brett@tatco.construction', role: 'admin', isBuiltIn: true },
]

// Custom ValueContainer to show selected value or count badge (from Master Tracker)
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

const getInitials = (name) => {
    if (!name) return '?'
    const parts = name.split(' ')
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name[0].toUpperCase()
}

const roleOptions = [
    { value: 'admin', label: 'Admin - Full access to all features' },
    { value: 'user', label: 'User - View only access' },
]

const SettingsTab = () => {
    const user = useSessionUser((state) => state.user)
    const { selectedCompanyId, setSelectedCompany, loading: loadingSelected } = useSelectedCompany()
    const { refreshAccess } = useProfitSharingAccessContext()
    const [companies, setCompanies] = useState([])
    const [loading, setLoading] = useState(true)
    const [showAddDialog, setShowAddDialog] = useState(false)
    const [editingCompany, setEditingCompany] = useState(null)
    const [showDeleteDialog, setShowDeleteDialog] = useState(null)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        locationOfBusiness: '',
        legalAddress: ''
    })

    // User Management state
    const [accessRecords, setAccessRecords] = useState([])
    const [allUsers, setAllUsers] = useState([])
    const [loadingUsers, setLoadingUsers] = useState(true)
    const [showAddUserDialog, setShowAddUserDialog] = useState(false)
    const [editingAccess, setEditingAccess] = useState(null)
    const [showDeleteUserDialog, setShowDeleteUserDialog] = useState(null)
    const [userFormData, setUserFormData] = useState({
        userId: null,
        role: 'user',
        companyIds: [] // Multi-select companies
    })

    useEffect(() => {
        loadCompanies()
        loadAllUsers()
    }, [])

    useEffect(() => {
        if (selectedCompanyId) {
            loadAccessRecords()
        }
    }, [selectedCompanyId])

    const loadCompanies = async () => {
        setLoading(true)
        try {
            const result = await FirebaseDbService.companies.getAll()
            
            if (result.success) {
                // Sort companies: selected first, then by name
                const sorted = result.data.sort((a, b) => {
                    if (a.id === selectedCompanyId) return -1
                    if (b.id === selectedCompanyId) return 1
                    return (a.name || '').localeCompare(b.name || '')
                })
                setCompanies(sorted)
                
                // If no companies exist, create default "Tatco OKC"
                if (result.data.length === 0) {
                    await createDefaultCompany()
                    // Reload after creating
                    const reloadResult = await FirebaseDbService.companies.getAll()
                    if (reloadResult.success) {
                        setCompanies(reloadResult.data)
                    }
                }
            } else {
                console.error('Failed to load companies:', result.error)
                setCompanies([])
            }
        } catch (error) {
            console.error('Error loading companies:', error)
            toast.push(
                <Notification type="danger" duration={2000} title="Error">
                    Failed to load companies: {error.message}
                </Notification>
            )
            setCompanies([])
        } finally {
            setLoading(false)
        }
    }

    const createDefaultCompany = async () => {
        try {
            const defaultCompanyData = {
                name: DEFAULT_COMPANY_NAME,
                locationOfBusiness: '',
                legalAddress: ''
            }
            const result = await FirebaseDbService.companies.create(defaultCompanyData)
            if (result.success) {
                // Auto-select the default company if none is selected
                if (!selectedCompanyId) {
                    await setSelectedCompany(result.data.id)
                }
            }
        } catch (error) {
            console.error('Error creating default company:', error)
        }
    }

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleAdd = () => {
        setEditingCompany(null)
        setFormData({
            name: '',
            locationOfBusiness: '',
            legalAddress: ''
        })
        setShowAddDialog(true)
    }

    const handleEdit = (company) => {
        setEditingCompany(company)
        setFormData({
            name: company.name || '',
            locationOfBusiness: company.locationOfBusiness || '',
            legalAddress: company.legalAddress || ''
        })
        setShowAddDialog(true)
    }

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.push(
                <Notification type="warning" duration={2000} title="Validation">
                    Company name is required
                </Notification>
            )
            return
        }

        setSaving(true)
        try {
            if (editingCompany) {
                // Update existing
                const result = await FirebaseDbService.companies.update(editingCompany.id, formData)
                if (result.success) {
                    toast.push(
                        <Notification type="success" duration={2000} title="Success">
                            Company updated successfully
                        </Notification>
                    )
                    await loadCompanies()
                    setShowAddDialog(false)
                } else {
                    throw new Error(result.error || 'Failed to update company')
                }
            } else {
                // Create new
                const result = await FirebaseDbService.companies.create(formData)
                if (result.success) {
                    toast.push(
                        <Notification type="success" duration={2000} title="Success">
                            Company created successfully
                        </Notification>
                    )
                    await loadCompanies()
                    
                    // Auto-select the newly created company if no company is currently selected
                    if (!selectedCompanyId) {
                        await setSelectedCompany(result.data.id)
                        toast.push(
                            <Notification type="info" duration={2000} title="Company Selected">
                                {formData.name} has been automatically selected
                            </Notification>
                        )
                    }
                    
                    setShowAddDialog(false)
                } else {
                    throw new Error(result.error || 'Failed to create company')
                }
            }
        } catch (error) {
            console.error('Error saving company:', error)
            toast.push(
                <Notification type="danger" duration={2000} title="Error">
                    {error.message || 'Failed to save company'}
                </Notification>
            )
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (company) => {
        setSaving(true)
        try {
            const result = await FirebaseDbService.companies.delete(company.id)
            if (result.success) {
                toast.push(
                    <Notification type="success" duration={2000} title="Success">
                        Company deleted successfully
                    </Notification>
                )
                
                // If deleted company was selected, switch to default
                if (selectedCompanyId === company.id) {
                    const defaultCompany = companies.find(c => c.name === DEFAULT_COMPANY_NAME)
                    if (defaultCompany) {
                        await setSelectedCompany(defaultCompany.id)
                    }
                }
                
                await loadCompanies()
                setShowDeleteDialog(null)
            } else {
                throw new Error(result.error || 'Failed to delete company')
            }
        } catch (error) {
            console.error('Error deleting company:', error)
            toast.push(
                <Notification type="danger" duration={2000} title="Error">
                    {error.message || 'Failed to delete company'}
                </Notification>
            )
        } finally {
            setSaving(false)
        }
    }

    const handleSelectCompany = async (companyId) => {
        await setSelectedCompany(companyId)
        toast.push(
            <Notification type="success" duration={2000} title="Success">
                Company selected
            </Notification>
        )
    }

    // User Management functions
    const loadAllUsers = async () => {
        setLoadingUsers(true)
        try {
            const result = await FirebaseDbService.users.getAll()
            if (result.success) {
                setAllUsers(result.data)
            } else {
                console.error('Failed to load users:', result.error)
            }
        } catch (error) {
            console.error('Error loading users:', error)
        } finally {
            setLoadingUsers(false)
        }
    }

    const loadAccessRecords = async () => {
        if (!selectedCompanyId) return
        
        try {
            const result = await FirebaseDbService.profitSharingAccess.getByCompany(selectedCompanyId)
            if (result.success) {
                setAccessRecords(result.data)
            } else {
                console.error('Failed to load access records:', result.error)
            }
        } catch (error) {
            console.error('Error loading access records:', error)
        }
    }

    const handleAddUser = () => {
        setEditingAccess(null)
        setUserFormData({
            userId: null,
            role: 'user',
            companyIds: selectedCompanyId ? [selectedCompanyId] : [] // Pre-select current company if available
        })
        setShowAddUserDialog(true)
    }

    const handleEditAccess = (access) => {
        setEditingAccess(access)
        setUserFormData({
            userId: access.userId,
            role: access.role,
            companyIds: access.companyId ? [access.companyId] : [] // Single company for editing existing
        })
        setShowAddUserDialog(true)
    }

    const handleSaveAccess = async () => {
        if (!userFormData.userId) {
            toast.push(
                <Notification type="warning" duration={2000} title="Validation">
                    Please select a user
                </Notification>
            )
            return
        }

        // Validate company selection for new users
        if (!editingAccess && (!userFormData.companyIds || userFormData.companyIds.length === 0)) {
            toast.push(
                <Notification type="warning" duration={2000} title="Validation">
                    Please select at least one company
                </Notification>
            )
            return
        }

        setSaving(true)
        try {
            const selectedUser = allUsers.find(u => u.id === userFormData.userId)
            
            if (editingAccess) {
                // Update existing (single company)
                const oldRole = editingAccess.role
                const result = await FirebaseDbService.profitSharingAccess.update(editingAccess.id, {
                    role: userFormData.role
                })
                if (result.success) {
                    // Notify admins if role changed
                    if (oldRole !== userFormData.role) {
                        try {
                            // Get all admins (super admins + profit sharing admins)
                            const allUsersResult = await FirebaseDbService.users.getAll()
                            const allUsers = allUsersResult.success ? allUsersResult.data : []
                            
                            // Get profit sharing access records to find admins
                            const accessResult = await FirebaseDbService.profitSharingAccess.getAll()
                            const accessRecords = accessResult.success ? accessResult.data : []
                            
                            // Find admin user IDs
                            const adminUserIds = new Set()
                            allUsers.forEach(u => {
                                const email = u.email?.toLowerCase()
                                if (email === 'admin-01@tatco.construction' || email === 'brett@tatco.construction') {
                                    adminUserIds.add(u.id)
                                }
                            })
                            accessRecords.forEach(access => {
                                if (access.role === 'admin' && access.companyId === editingAccess.companyId && access.userId !== editingAccess.userId) {
                                    adminUserIds.add(access.userId)
                                }
                            })
                            
                            const userName = editingAccess.userName || selectedUser?.name || 'Unknown User'
                            
                            // Notify all admins
                            await Promise.all(
                                Array.from(adminUserIds).map(adminId =>
                                    createNotification({
                                        userId: adminId,
                                        type: NOTIFICATION_TYPES.PROFIT_SHARING_ADMIN,
                                        title: 'User Role Changed',
                                        message: `${userName}'s role has been changed from ${oldRole} to ${userFormData.role}.`,
                                        entityType: 'profit_sharing',
                                        entityId: editingAccess.companyId,
                                        metadata: {
                                            userId: editingAccess.userId,
                                            userName,
                                            oldRole,
                                            newRole: userFormData.role,
                                        }
                                    })
                                )
                            )
                        } catch (notifError) {
                            console.error('Error notifying admins about role change:', notifError)
                        }
                    }
                    
                    toast.push(
                        <Notification type="success" duration={2000} title="Success">
                            Access updated successfully
                        </Notification>
                    )
                    await loadAccessRecords()
                    setShowAddUserDialog(false)
                } else {
                    throw new Error(result.error || 'Failed to update access')
                }
            } else {
                // Create new access records for each selected company
                const userName = selectedUser?.name || selectedUser?.firstName ? `${selectedUser.firstName} ${selectedUser.lastName || ''}`.trim() : selectedUser?.email || 'Unknown'
                const userEmail = selectedUser?.email || ''
                
                // Check for existing access per company
                const companiesToAdd = []
                const companiesAlreadyAdded = []
                
                userFormData.companyIds.forEach(companyId => {
                    const existingAccess = accessRecords.find(a => a.userId === userFormData.userId && a.companyId === companyId)
                    if (existingAccess) {
                        companiesAlreadyAdded.push(companyId)
                    } else {
                        companiesToAdd.push(companyId)
                    }
                })
                
                if (companiesAlreadyAdded.length > 0) {
                    const companyNames = companies
                        .filter(c => companiesAlreadyAdded.includes(c.id))
                        .map(c => c.name)
                        .join(', ')
                    toast.push(
                        <Notification type="warning" duration={3000} title="Warning">
                            User already has access to: {companyNames}. Skipping those companies.
                        </Notification>
                    )
                }
                
                if (companiesToAdd.length === 0) {
                    setSaving(false)
                    return
                }
                
                // Create access records for each company
                const createPromises = companiesToAdd.map(companyId =>
                    FirebaseDbService.profitSharingAccess.create({
                        userId: userFormData.userId,
                        userEmail,
                        userName,
                        role: userFormData.role,
                        companyId,
                        addedBy: user?.id || user?.uid
                    })
                )
                
                const results = await Promise.all(createPromises)
                const successful = results.filter(r => r.success)
                const failed = results.filter(r => !r.success)
                
                if (successful.length > 0) {
                    // Notify the user for each company they were added to
                    try {
                        await Promise.all(
                            companiesToAdd.map(companyId =>
                                createNotification({
                                    userId: userFormData.userId,
                                    type: NOTIFICATION_TYPES.PROFIT_SHARING,
                                    title: 'You have been added to Profit Sharing',
                                    message: `You now have access to the Profit Sharing section.`,
                                    entityType: 'profit_sharing',
                                    entityId: companyId,
                                    relatedUserId: user?.id || user?.uid || null,
                                    metadata: {
                                        companyId,
                                        role: userFormData.role,
                                    },
                                })
                            )
                        )
                    } catch (notifyError) {
                        console.error('Error creating profit sharing access notifications:', notifyError)
                    }
                    
                    toast.push(
                        <Notification type="success" duration={2000} title="Success">
                            User added successfully to {successful.length} company{successful.length > 1 ? 'ies' : ''}
                        </Notification>
                    )
                    await loadAccessRecords()
                    refreshAccess() // Refresh global access state
                    setShowAddUserDialog(false)
                }
                
                if (failed.length > 0) {
                    throw new Error(`Failed to add user to ${failed.length} company${failed.length > 1 ? 'ies' : ''}`)
                }
            }
        } catch (error) {
            console.error('Error saving access:', error)
            toast.push(
                <Notification type="danger" duration={2000} title="Error">
                    {error.message || 'Failed to save access'}
                </Notification>
            )
        } finally {
            setSaving(false)
        }
    }

    const handleDeleteAccess = async (access) => {
        setSaving(true)
        try {
            const result = await FirebaseDbService.profitSharingAccess.delete(access.id)
            if (result.success) {
                toast.push(
                    <Notification type="success" duration={2000} title="Success">
                        User access removed
                    </Notification>
                )
                await loadAccessRecords()
                refreshAccess() // Refresh global access state
                setShowDeleteUserDialog(null)
            } else {
                throw new Error(result.error || 'Failed to remove access')
            }
        } catch (error) {
            console.error('Error deleting access:', error)
            toast.push(
                <Notification type="danger" duration={2000} title="Error">
                    {error.message || 'Failed to remove access'}
                </Notification>
            )
        } finally {
            setSaving(false)
        }
    }

    // Get users not yet added to this company
    const availableUsers = allUsers.filter(u => 
        !accessRecords.some(a => a.userId === u.id)
    )

    const userSelectOptions = availableUsers.map(u => ({
        value: u.id,
        label: u.name || (u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.email) || u.email
    }))

    // Combine built-in admins with database records
    const allAccessRecords = [...SUPER_ADMINS, ...accessRecords]

    const accessColumns = [
        {
            header: 'User',
            accessorKey: 'userName',
            cell: ({ row }) => (
                <div className="flex items-center gap-3">
                    <Avatar
                        size={32}
                        icon={<span className="text-xs font-semibold">{getInitials(row.original.userName)}</span>}
                    />
                    <div>
                        <div className="font-medium">
                            {row.original.userName}
                            {row.original.isBuiltIn && (
                                <Tag className="ml-2 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-xs">
                                    Built-in
                                </Tag>
                            )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{row.original.userEmail}</div>
                    </div>
                </div>
            )
        },
        {
            header: 'Role',
            accessorKey: 'role',
            cell: ({ row }) => (
                <Tag className={row.original.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}>
                    {row.original.role === 'admin' ? 'Admin' : 'User'}
                </Tag>
            )
        },
        {
            header: 'Actions',
            accessorKey: 'actions',
            cell: ({ row }) => {
                // Built-in admins cannot be edited or removed
                if (row.original.isBuiltIn) {
                    return (
                        <span className="text-xs text-gray-400">Cannot modify</span>
                    )
                }
                return (
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="plain"
                            icon={<HiOutlinePencil />}
                            onClick={() => handleEditAccess(row.original)}
                        >
                            Edit
                        </Button>
                        <Button
                            size="sm"
                            variant="plain"
                            icon={<HiOutlineTrash />}
                            onClick={() => setShowDeleteUserDialog(row.original)}
                            className="text-red-600 hover:text-red-700"
                        >
                            Remove
                        </Button>
                    </div>
                )
            }
        }
    ]

    const columns = [
        {
            header: 'Company Name',
            accessorKey: 'name',
            cell: ({ row }) => (
                <div className="font-medium">{row.original.name}</div>
            )
        },
        {
            header: 'Location of Business',
            accessorKey: 'locationOfBusiness',
            cell: ({ row }) => (
                <div className="text-gray-600 dark:text-gray-400">
                    {row.original.locationOfBusiness || '-'}
                </div>
            )
        },
        {
            header: 'Legal Address',
            accessorKey: 'legalAddress',
            cell: ({ row }) => (
                <div className="text-gray-600 dark:text-gray-400">
                    {row.original.legalAddress || '-'}
                </div>
            )
        },
        {
            header: 'Status',
            accessorKey: 'status',
            cell: ({ row }) => {
                const isSelected = selectedCompanyId === row.original.id
                return (
                    <div className="flex items-center gap-2">
                        {isSelected && (
                            <Tag className="bg-primary text-white">
                                <HiOutlineCheck className="mr-1" />
                                Active
                            </Tag>
                        )}
                    </div>
                )
            }
        },
        {
            header: 'Actions',
            accessorKey: 'actions',
            cell: ({ row }) => {
                const company = row.original
                const isDefault = company.name === DEFAULT_COMPANY_NAME
                const isSelected = selectedCompanyId === company.id
                
                return (
                    <div className="flex items-center gap-2">
                        {!isSelected && (
                            <Button
                                size="sm"
                                variant="plain"
                                icon={<HiOutlineCheck />}
                                onClick={() => handleSelectCompany(company.id)}
                            >
                                Select
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant="plain"
                            icon={<HiOutlinePencil />}
                            onClick={() => handleEdit(company)}
                        >
                            Edit
                        </Button>
                        <Button
                            size="sm"
                            variant="plain"
                            icon={<HiOutlineTrash />}
                            onClick={() => setShowDeleteDialog(company)}
                            className="text-red-600 hover:text-red-700"
                        >
                            Delete
                        </Button>
                    </div>
                )
            }
        }
    ]

    if (loading || loadingSelected) {
        return (
            <div className="space-y-6">
                <div className="flex items-center space-x-3">
                    <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Settings</h2>
                </div>
                <Card className="p-6">
                    <div className="text-center py-12">
                        <div className="text-gray-400 dark:text-gray-500 text-lg">Loading...</div>
                    </div>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Settings</h2>
                </div>
                <Button
                    icon={<HiOutlinePlus />}
                    onClick={handleAdd}
                >
                    Add Company
                </Button>
            </div>

            <Card className="p-6">
                <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2">Company Management</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Manage companies for profit sharing. Select a company to filter all data across Overview, Plans, Stakeholders, Valuations, and Milestones tabs.
                    </p>
                </div>

                {companies.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="text-gray-400 dark:text-gray-500 text-lg">No companies found</div>
                                <div className="text-gray-400 dark:text-gray-500 text-sm mt-2">Create your first company to get started</div>
                                <Button
                                    className="mt-4"
                                    icon={<HiOutlinePlus />}
                                    onClick={handleAdd}
                                >
                                    Create First Company
                                </Button>
                            </div>
                ) : (
                    <div className="overflow-x-auto">
                        <DataTable
                            columns={columns}
                            data={companies}
                            loading={false}
                        />
                    </div>
                )}
            </Card>

            {/* User Management Section */}
            <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                            <HiOutlineUserGroup className="w-5 h-5" />
                            User Management
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Manage who can access the Profit Sharing section. Admins have full access, Users can only view the Overview and their own awards.
                        </p>
                    </div>
                    <Button
                        icon={<HiOutlinePlus />}
                        onClick={handleAddUser}
                        disabled={!selectedCompanyId}
                    >
                        Add User
                    </Button>
                </div>

                {!selectedCompanyId ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        Please select a company above to manage user access
                    </div>
                ) : loadingUsers ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        Loading users...
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <DataTable
                            columns={accessColumns}
                            data={allAccessRecords}
                            loading={false}
                        />
                    </div>
                )}
            </Card>

            {/* Add/Edit User Dialog */}
            <Dialog
                isOpen={showAddUserDialog}
                onClose={() => setShowAddUserDialog(false)}
                width={500}
            >
                <div className="p-6">
                    <h3 className="text-xl font-semibold mb-4">
                        {editingAccess ? 'Edit User Access' : 'Add User Access'}
                    </h3>
                    
                    <div className="space-y-4">
                        {!editingAccess && (
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Select User *
                                </label>
                                <Select
                                    options={userSelectOptions}
                                    value={userSelectOptions.find(opt => opt.value === userFormData.userId) || null}
                                    onChange={(opt) => setUserFormData(prev => ({ ...prev, userId: opt?.value || null }))}
                                    placeholder="Search and select a user..."
                                    isSearchable
                                />
                                {availableUsers.length === 0 && (
                                    <p className="text-xs text-gray-500 mt-1">All registered users already have access</p>
                                )}
                            </div>
                        )}

                        {editingAccess && (
                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <div className="font-medium">{editingAccess.userName}</div>
                                <div className="text-sm text-gray-500">{editingAccess.userEmail}</div>
                                <div className="text-xs text-gray-400 mt-1">Company: {companies.find(c => c.id === editingAccess.companyId)?.name || 'Unknown'}</div>
                            </div>
                        )}

                        {!editingAccess && (
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Select Companies *
                                </label>
                                <Select
                                    options={companies.map(c => ({ value: c.id, label: c.name }))}
                                    value={companies.filter(c => userFormData.companyIds.includes(c.id)).map(c => ({ value: c.id, label: c.name }))}
                                    onChange={(selected) => {
                                        const selectedIds = Array.isArray(selected) 
                                            ? selected.map(opt => opt.value)
                                            : selected 
                                                ? [selected.value]
                                                : []
                                        setUserFormData(prev => ({ ...prev, companyIds: selectedIds }))
                                    }}
                                    placeholder="Select one or more companies..."
                                    isMulti
                                    isSearchable
                                    menuPortalTarget={document.body}
                                    menuPosition="fixed"
                                    styles={{
                                        menuPortal: (provided) => ({ ...provided, zIndex: 9999 }),
                                        menu: (provided) => ({ ...provided, zIndex: 9999 }),
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
                                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    User will have access to Profit Sharing for all selected companies
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Role *
                            </label>
                            <Select
                                options={roleOptions}
                                value={roleOptions.find(opt => opt.value === userFormData.role) || roleOptions[1]}
                                onChange={(opt) => setUserFormData(prev => ({ ...prev, role: opt?.value || 'user' }))}
                            />
                            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                <div><strong>Admin:</strong> Full access to all tabs and features</div>
                                <div><strong>User:</strong> Can only view Overview and their own awards (My Awards)</div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <Button
                            variant="plain"
                            onClick={() => setShowAddUserDialog(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveAccess}
                            loading={saving}
                        >
                            {editingAccess ? 'Update' : 'Add User'}
                        </Button>
                    </div>
                </div>
            </Dialog>

            {/* Delete User Confirmation Dialog */}
            <Dialog
                isOpen={!!showDeleteUserDialog}
                onClose={() => setShowDeleteUserDialog(null)}
                width={400}
            >
                <div className="p-6">
                    <h3 className="text-xl font-semibold mb-4">Remove User Access</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Are you sure you want to remove access for "{showDeleteUserDialog?.userName}"? They will no longer be able to view this company's profit sharing data.
                    </p>
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="plain"
                            onClick={() => setShowDeleteUserDialog(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="solid"
                            color="red"
                            onClick={() => handleDeleteAccess(showDeleteUserDialog)}
                            loading={saving}
                        >
                            Remove
                        </Button>
                    </div>
                </div>
            </Dialog>

            {/* Add/Edit Dialog */}
            <Dialog
                isOpen={showAddDialog}
                onClose={() => setShowAddDialog(false)}
                width={600}
            >
                <div className="p-6">
                    <h3 className="text-xl font-semibold mb-4">
                        {editingCompany ? 'Edit Company' : 'Add Company'}
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Company Name *
                            </label>
                            <Input
                                value={formData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                placeholder="Enter company name"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Location of Business
                            </label>
                            <Input
                                value={formData.locationOfBusiness}
                                onChange={(e) => handleInputChange('locationOfBusiness', e.target.value)}
                                placeholder="Enter location of business"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Legal Address
                            </label>
                            <Input
                                value={formData.legalAddress}
                                onChange={(e) => handleInputChange('legalAddress', e.target.value)}
                                placeholder="Enter legal address"
                                textArea
                                rows={3}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <Button
                            variant="plain"
                            onClick={() => setShowAddDialog(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            loading={saving}
                        >
                            {editingCompany ? 'Update' : 'Create'}
                        </Button>
                    </div>
                </div>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                isOpen={!!showDeleteDialog}
                onClose={() => setShowDeleteDialog(null)}
                width={400}
            >
                <div className="p-6">
                    <h3 className="text-xl font-semibold mb-4">Delete Company</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Are you sure you want to delete "{showDeleteDialog?.name}"? This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="plain"
                            onClick={() => setShowDeleteDialog(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="solid"
                            color="red"
                            onClick={() => handleDelete(showDeleteDialog)}
                            loading={saving}
                        >
                            Delete
                        </Button>
                    </div>
                </div>
            </Dialog>
        </div>
    )
}

export default SettingsTab
