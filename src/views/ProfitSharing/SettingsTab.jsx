import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Card, Button, Input, Table, Dialog, Notification, toast, Select, Tag, Avatar } from '@/components/ui'
import DataTable from '@/components/shared/DataTable'
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineCheck, HiOutlineX, HiOutlineUserGroup, HiOutlineSearch, HiOutlineEye, HiOutlineChartBar, HiOutlineDownload } from 'react-icons/hi'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { useSelectedCompany } from '@/hooks/useSelectedCompany'
import { useProfitSharingAccessContext } from '@/context/ProfitSharingAccessContext'
import { useSessionUser } from '@/store/authStore'
import { db } from '@/configs/firebase.config'
import { collection, getDocs, doc, updateDoc, query, orderBy, where } from 'firebase/firestore'
import { createNotification } from '@/utils/notificationHelper'
import { NOTIFICATION_TYPES } from '@/constants/notification.constant'
import { components } from 'react-select'
import React from 'react'
import * as XLSX from 'xlsx'

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
    { value: 'supervisor', label: 'Supervisor - Can view direct reports' },
    { value: 'user', label: 'User - View only access' },
]

const SettingsTab = () => {
    const navigate = useNavigate()
    const user = useSessionUser((state) => state.user)
    const { selectedCompanyId, setSelectedCompany, loading: loadingSelected } = useSelectedCompany()
    const { refreshAccess, userRole, canEdit } = useProfitSharingAccessContext()
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
    
    // Payroll Export state
    const [exportSelectedCompanies, setExportSelectedCompanies] = useState([])
    const [exporting, setExporting] = useState(false)

    // User Management state
    const [accessRecords, setAccessRecords] = useState([])
    const [stakeholderUsers, setStakeholderUsers] = useState([]) // Users with stakeholder records but no access records
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

    // User Profit Sharing Overview state
    const [userOverviewData, setUserOverviewData] = useState([])
    const [loadingOverview, setLoadingOverview] = useState(false)
    const [overviewSearchQuery, setOverviewSearchQuery] = useState('')
    const [overviewCompanyFilter, setOverviewCompanyFilter] = useState(null)
    const [overviewPageIndex, setOverviewPageIndex] = useState(1)
    const [overviewPageSize, setOverviewPageSize] = useState(1000) // Large default to show all users

    useEffect(() => {
        loadCompanies()
        loadAllUsers()
        loadUserProfitSharingOverview()
        
        // Listen for stakeholder updates (when awards are added/updated/issued/accepted)
        const handleStakeholdersUpdate = () => {
            loadUserProfitSharingOverview()
        }
        window.addEventListener('stakeholdersUpdated', handleStakeholdersUpdate)
        
        return () => {
            window.removeEventListener('stakeholdersUpdated', handleStakeholdersUpdate)
        }
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
        if (!selectedCompanyId) {
            setAccessRecords([])
            setStakeholderUsers([])
            return
        }
        
        try {
            // Load explicit access records
            const result = await FirebaseDbService.profitSharingAccess.getByCompany(selectedCompanyId)
            
            if (result.success) {
                setAccessRecords(result.data)
            } else {
                console.error('Failed to load access records:', result.error)
                setAccessRecords([])
            }
            
            // Also load users who have stakeholder records for this company but no explicit access records
            // This ensures all users associated with the company are visible in user management
            try {
                const stakeholdersResult = await FirebaseDbService.stakeholders.getAll()
                
                if (stakeholdersResult.success) {
                    // Get all stakeholder records for this company
                    // IMPORTANT: Include stakeholders even if they don't have linkedUserId
                    // Some stakeholders might be added without a linked user initially
                    const allCompanyStakeholders = stakeholdersResult.data.filter(
                        sh => sh.companyId === selectedCompanyId
                    )
                    const companyStakeholders = allCompanyStakeholders.filter(sh => sh.linkedUserId)
                    
                    // Get user IDs from access records
                    const accessUserIds = new Set(result.success ? result.data.map(r => r.userId).filter(Boolean) : [])
                    
                    // Get unique user IDs from stakeholders who don't have access records
                    const stakeholderUserIds = new Set()
                    companyStakeholders.forEach(sh => {
                        if (sh.linkedUserId && !accessUserIds.has(sh.linkedUserId)) {
                            stakeholderUserIds.add(sh.linkedUserId)
                        }
                    })
                    
                    // Load user details for these stakeholder users
                    if (stakeholderUserIds.size > 0) {
                        const usersResult = await FirebaseDbService.users.getAll()
                        
                        if (usersResult.success) {
                            const stakeholderUsersList = Array.from(stakeholderUserIds).map(userId => {
                                const user = usersResult.data.find(u => u.id === userId || u.uid === userId)
                                
                                if (!user) return null
                                
                                // Create a pseudo-access record for display purposes
                                // Format user name consistently
                                let userName = ''
                                if (user.firstName && user.lastName) {
                                    userName = `${user.firstName} ${user.lastName}`
                                } else if (user.firstName) {
                                    userName = user.firstName
                                } else if (user.name) {
                                    userName = user.name
                                } else if (user.userName) {
                                    userName = user.userName
                                } else {
                                    userName = user.email || 'Unknown User'
                                }
                                
                                return {
                                    id: `stakeholder-${userId}`, // Pseudo ID
                                    userId: userId,
                                    companyId: selectedCompanyId,
                                    userName: userName,
                                    userEmail: user.email || '',
                                    role: 'user', // Default to user role for stakeholder-only users
                                    isStakeholderOnly: true // Flag to indicate this is from stakeholder record
                                }
                            }).filter(Boolean)
                            
                            setStakeholderUsers(stakeholderUsersList)
                        } else {
                            console.error('Failed to load users:', usersResult.error)
                            setStakeholderUsers([])
                        }
                    } else {
                        setStakeholderUsers([])
                    }
                } else {
                    console.error('Failed to load stakeholders:', stakeholdersResult.error)
                    setStakeholderUsers([])
                }
            } catch (stakeholderError) {
                console.error('Error loading stakeholder users:', stakeholderError)
                setStakeholderUsers([])
            }
        } catch (error) {
            console.error('Error loading access records:', error)
            setAccessRecords([])
            setStakeholderUsers([])
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

    const handleEditAccess = async (access) => {
        setEditingAccess(access)
        
        // Load all access records for this user to get all companies they have access to
        try {
            const allAccessResult = await FirebaseDbService.profitSharingAccess.getByUserId(access.userId)
            if (allAccessResult.success && allAccessResult.data.length > 0) {
                // Get all company IDs this user has access to
                const userCompanyIds = allAccessResult.data
                    .map(record => record.companyId)
                    .filter(Boolean)
                
                // Use the role from the current access record being edited
                // (assuming all records have the same role, but we'll use the one being edited)
                setUserFormData({
                    userId: access.userId,
                    role: access.role,
                    companyIds: userCompanyIds // All companies the user has access to
                })
            } else {
                // Fallback to single company if we can't load all records
                setUserFormData({
                    userId: access.userId,
                    role: access.role,
                    companyIds: access.companyId ? [access.companyId] : []
                })
            }
        } catch (error) {
            console.error('Error loading all access records for user:', error)
            // Fallback to single company
            setUserFormData({
                userId: access.userId,
                role: access.role,
                companyIds: access.companyId ? [access.companyId] : []
            })
        }
        
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

        // Validate company selection for both new and editing users
        if (!userFormData.companyIds || userFormData.companyIds.length === 0) {
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
                // Update existing access records for all companies
                // Get all existing access records for this user
                const allUserAccessResult = await FirebaseDbService.profitSharingAccess.getByUserId(editingAccess.userId)
                const existingAccessRecords = allUserAccessResult.success ? allUserAccessResult.data : []
                const existingCompanyIds = existingAccessRecords.map(r => r.companyId).filter(Boolean)
                const newCompanyIds = userFormData.companyIds
                const oldRole = editingAccess.role
                
                // Companies to remove (in existing but not in new)
                const companiesToRemove = existingCompanyIds.filter(id => !newCompanyIds.includes(id))
                
                // Companies to add (in new but not in existing)
                const companiesToAdd = newCompanyIds.filter(id => !existingCompanyIds.includes(id))
                
                // Companies to update (in both, need to update role)
                const companiesToUpdate = newCompanyIds.filter(id => existingCompanyIds.includes(id))
                
                try {
                    // Delete access records for removed companies
                    for (const companyId of companiesToRemove) {
                        const recordToDelete = existingAccessRecords.find(r => r.companyId === companyId)
                        if (recordToDelete) {
                            await FirebaseDbService.profitSharingAccess.delete(recordToDelete.id)
                        }
                    }
                    
                    // Update role for existing companies
                    for (const companyId of companiesToUpdate) {
                        const recordToUpdate = existingAccessRecords.find(r => r.companyId === companyId)
                        if (recordToUpdate) {
                            await FirebaseDbService.profitSharingAccess.update(recordToUpdate.id, {
                                role: userFormData.role
                            })
                        }
                    }
                    
                    // Create new access records for added companies
                    const selectedUser = allUsers.find(u => u.id === userFormData.userId)
                    let userName = ''
                    if (selectedUser?.firstName && selectedUser?.lastName) {
                        userName = `${selectedUser.firstName} ${selectedUser.lastName}`
                    } else if (selectedUser?.firstName) {
                        userName = selectedUser.firstName
                    } else if (selectedUser?.name) {
                        userName = selectedUser.name
                    } else if (selectedUser?.userName) {
                        userName = selectedUser.userName
                    } else {
                        userName = selectedUser?.email || 'Unknown'
                    }
                    const userEmail = selectedUser?.email || ''
                    
                    for (const companyId of companiesToAdd) {
                        await FirebaseDbService.profitSharingAccess.create({
                            userId: editingAccess.userId,
                            companyId: companyId,
                            role: userFormData.role,
                            userName: userName,
                            userEmail: userEmail
                        })
                    }
                    
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
                } catch (updateError) {
                    console.error('Error updating access records:', updateError)
                    throw new Error(updateError.message || 'Failed to update access')
                }
            } else {
                // Create new access records for each selected company
                // Always use "First Name Last Name" format when both are available
                let userName = ''
                if (selectedUser?.firstName && selectedUser?.lastName) {
                    userName = `${selectedUser.firstName} ${selectedUser.lastName}`
                } else if (selectedUser?.firstName) {
                    userName = selectedUser.firstName
                } else if (selectedUser?.name) {
                    userName = selectedUser.name
                } else if (selectedUser?.userName) {
                    userName = selectedUser.userName
                } else {
                    userName = selectedUser?.email || 'Unknown'
                }
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

    // Payroll Export function
    const handlePayrollExport = async () => {
        if (exportSelectedCompanies.length === 0) {
            toast.push(
                <Notification type="warning" duration={2000} title="Validation">
                    Please select at least one company to export
                </Notification>
            )
            return
        }

        setExporting(true)
        try {
            const exportData = []

            // Load all valuations
            const valuationsRef = collection(db, 'valuations')
            const valuationsQuery = query(valuationsRef, orderBy('valuationDate', 'desc'))
            const valuationsSnapshot = await getDocs(valuationsQuery)
            const allValuations = valuationsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                valuationDate: doc.data().valuationDate?.toDate ? doc.data().valuationDate.toDate() : (doc.data().valuationDate ? new Date(doc.data().valuationDate) : null),
            }))

            // Load all stakeholders
            const stakeholdersResult = await FirebaseDbService.stakeholders.getAll()
            if (!stakeholdersResult.success) {
                throw new Error('Failed to load stakeholders')
            }
            const allStakeholders = stakeholdersResult.data

            // Process each selected company
            for (const companyId of exportSelectedCompanies) {
                const company = companies.find(c => c.id === companyId)
                const companyName = company?.name || 'Unknown Company'

                // Get the most recent actual profit valuation for this company
                // Try actual first, then fall back to estimated if no actual exists
                let companyValuations = allValuations
                    .filter(v => v.companyId === companyId && v.profitType === 'actual')
                    .sort((a, b) => {
                        const aDate = a.valuationDate?.getTime() || 0
                        const bDate = b.valuationDate?.getTime() || 0
                        return bDate - aDate // Most recent first
                    })

                // If no actual profits, try estimated profits
                if (companyValuations.length === 0) {
                    companyValuations = allValuations
                        .filter(v => v.companyId === companyId)
                        .sort((a, b) => {
                            const aDate = a.valuationDate?.getTime() || 0
                            const bDate = b.valuationDate?.getTime() || 0
                            return bDate - aDate
                        })
                }

                if (companyValuations.length === 0) {
                    continue
                }

                const lastValuation = companyValuations[0]
                const valuationDate = lastValuation.valuationDate instanceof Date 
                    ? lastValuation.valuationDate 
                    : new Date(lastValuation.valuationDate)

                // Format profit date for export (DD/MM/YYYY format)
                const profitDateFormatted = valuationDate.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                })

                // Calculate price per share
                const pricePerShare = lastValuation.pricePerShare || 
                    (lastValuation.profitAmount && lastValuation.totalShares && lastValuation.totalShares > 0
                        ? lastValuation.profitAmount / lastValuation.totalShares 
                        : 0)

                if (pricePerShare === 0) {
                    continue
                }

                // Get all stakeholders for this company
                const companyStakeholders = allStakeholders.filter(sh => sh.companyId === companyId)

                // Calculate dollar amounts for each stakeholder
                for (const stakeholder of companyStakeholders) {
                    const awards = stakeholder.profitAwards || []
                    let totalDollarAmount = 0

                    for (const award of awards) {
                        if (!award.sharesIssued || award.sharesIssued === 0) continue

                        // Check if award was active during the valuation date
                        // If award has no dates, include it (assume it's always active)
                        const awardStart = award.awardStartDate ? new Date(award.awardStartDate) : null
                        const awardEnd = award.awardEndDate ? new Date(award.awardEndDate) : null
                        
                        // Award is active if:
                        // 1. It has no dates (always active), OR
                        // 2. It has dates and the valuation date falls within the range
                        const awardWasActive = !awardStart || !awardEnd || (valuationDate >= awardStart && valuationDate <= awardEnd)

                        if (!awardWasActive) {
                            continue
                        }

                        // Check planId match:
                        // Use company-level fallback when planIds don't match (similar to StakeholderDetail)
                        // This allows using the most recent company profit even if it's for a different plan
                        const usingCompanyFallback = !lastValuation.planId || (award.planId && award.planId !== lastValuation.planId)
                        // If using company fallback, include all awards. Otherwise, only include matching planIds
                        const planMatches = usingCompanyFallback || award.planId === lastValuation.planId

                        if (planMatches) {
                            const payout = award.sharesIssued * pricePerShare
                            totalDollarAmount += payout
                        }
                    }

                    // Only include stakeholders with a dollar amount > 0
                    if (totalDollarAmount > 0) {
                        exportData.push({
                            'Company Name': companyName,
                            'Employee Name': stakeholder.name || 'Unknown',
                            'Dollar Amount': totalDollarAmount,
                            'Profit Date': profitDateFormatted
                        })
                    }
                }
            }

            if (exportData.length === 0) {
                toast.push(
                    <Notification type="warning" duration={3000} title="No Data">
                        No payroll data found for the selected companies. Make sure there are profit entries and active awards.
                    </Notification>
                )
                setExporting(false)
                return
            }

            // Create Excel workbook
            const ws = XLSX.utils.json_to_sheet(exportData)
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'Payroll Export')

            // Generate filename with current date
            const dateStr = new Date().toISOString().split('T')[0]
            const filename = `Profit_Sharing_Payroll_Export_${dateStr}.xlsx`

            // Write file and trigger download
            XLSX.writeFile(wb, filename)

            toast.push(
                <Notification type="success" duration={2000} title="Success">
                    Payroll export completed successfully. Exported {exportData.length} employee{exportData.length !== 1 ? 's' : ''}.
                </Notification>
            )
        } catch (error) {
            console.error('Error exporting payroll:', error)
            toast.push(
                <Notification type="danger" duration={2000} title="Error">
                    Failed to export payroll: {error.message || 'Unknown error'}
                </Notification>
            )
        } finally {
            setExporting(false)
        }
    }

    // Get users not yet added to this company
    const availableUsers = allUsers.filter(u => 
        !accessRecords.some(a => a.userId === u.id)
    )

    // Always use "First Name Last Name" format when both are available
    const userSelectOptions = availableUsers.map(u => {
        let displayName = ''
        if (u.firstName && u.lastName) {
            displayName = `${u.firstName} ${u.lastName}`
        } else if (u.firstName) {
            displayName = u.firstName
        } else if (u.name) {
            displayName = u.name
        } else if (u.userName) {
            displayName = u.userName
        } else {
            displayName = u.email || 'Unknown'
        }
        return {
            value: u.id,
            label: displayName
        }
    })

    // Combine built-in admins with database records and stakeholder-only users
    // Stakeholder-only users are users who have stakeholder records but no explicit access records
    const allAccessRecords = [...SUPER_ADMINS, ...accessRecords, ...stakeholderUsers]

    // User Profit Sharing Overview functions
    const loadUserProfitSharingOverview = async () => {
        setLoadingOverview(true)
        try {
            // Load all access records (all users with profit sharing access)
            const accessResult = await FirebaseDbService.profitSharingAccess.getAll()
            if (!accessResult.success) {
                console.error('Failed to load access records:', accessResult.error)
                setUserOverviewData([])
                setLoadingOverview(false)
                return
            }

            // Load all stakeholders
            const stakeholdersResult = await FirebaseDbService.stakeholders.getAll()
            if (!stakeholdersResult.success) {
                console.error('Failed to load stakeholders:', stakeholdersResult.error)
                setUserOverviewData([])
                setLoadingOverview(false)
                return
            }

            // Load all companies for name mapping
            const companiesResult = await FirebaseDbService.companies.getAll()
            const companiesMap = new Map()
            if (companiesResult.success) {
                companiesResult.data.forEach(company => {
                    companiesMap.set(company.id, company.name)
                })
            }

            // Load all plans for name mapping
            const plansRef = collection(db, 'profitSharingPlans')
            const plansSnapshot = await getDocs(plansRef)
            const plansMap = new Map()
            plansSnapshot.docs.forEach(doc => {
                const plan = { id: doc.id, ...doc.data() }
                plansMap.set(plan.id, plan.name || 'Unknown Plan')
            })

            // Group access records by userId
            const accessByUserId = new Map()
            accessResult.data.forEach(access => {
                if (!accessByUserId.has(access.userId)) {
                    accessByUserId.set(access.userId, [])
                }
                accessByUserId.get(access.userId).push(access)
            })

            // Group stakeholders by linkedUserId
            const stakeholdersByUserId = new Map()
            stakeholdersResult.data.forEach(stakeholder => {
                if (stakeholder.linkedUserId) {
                    if (!stakeholdersByUserId.has(stakeholder.linkedUserId)) {
                        stakeholdersByUserId.set(stakeholder.linkedUserId, [])
                    }
                    stakeholdersByUserId.get(stakeholder.linkedUserId).push(stakeholder)
                }
            })

            // Build overview data for each user
            const overviewData = []
            
            accessByUserId.forEach((accessRecords, userId) => {
                // Get user info from first access record
                const firstAccess = accessRecords[0]
                const userName = firstAccess.userName || 'Unknown User'
                const userEmail = firstAccess.userEmail || ''
                
                // Get all companies this user has access to
                const userCompanyIds = [...new Set(accessRecords.map(a => a.companyId).filter(Boolean))]
                const userCompanies = userCompanyIds.map(id => ({
                    id,
                    name: companiesMap.get(id) || 'Unknown Company'
                }))

                // Get all stakeholder records for this user
                const userStakeholders = stakeholdersByUserId.get(userId) || []
                
                // Aggregate all awards across all stakeholder records
                const allAwards = []
                const planIds = new Set()
                const companyIdsFromStakeholders = new Set()
                
                userStakeholders.forEach(stakeholder => {
                    if (stakeholder.companyId) {
                        companyIdsFromStakeholders.add(stakeholder.companyId)
                    }
                    
                    if (stakeholder.profitAwards && Array.isArray(stakeholder.profitAwards)) {
                        stakeholder.profitAwards.forEach(award => {
                            allAwards.push({
                                ...award,
                                companyId: stakeholder.companyId,
                                stakeholderId: stakeholder.id,
                                companyName: companiesMap.get(stakeholder.companyId) || 'Unknown Company'
                            })
                            if (award.planId) {
                                planIds.add(award.planId)
                            }
                        })
                    }
                })

                // Get unique plan names
                const planNames = Array.from(planIds).map(planId => plansMap.get(planId) || 'Unknown Plan')

                // Count awards by status
                const normalizeStatus = (status) => {
                    if (!status) return 'draft'
                    return String(status).toLowerCase().trim()
                }

                const draftCount = allAwards.filter(a => normalizeStatus(a.status) === 'draft').length
                const issuedCount = allAwards.filter(a => normalizeStatus(a.status) === 'issued').length
                const finalizedCount = allAwards.filter(a => normalizeStatus(a.status) === 'finalized').length

                // Get primary stakeholder ID (for navigation) - prefer one with most awards
                const primaryStakeholder = userStakeholders.reduce((prev, current) => {
                    const prevAwards = (prev?.profitAwards?.length || 0)
                    const currentAwards = (current?.profitAwards?.length || 0)
                    return currentAwards > prevAwards ? current : prev
                }, userStakeholders[0])

                // Combine company IDs from access records and stakeholder records
                const allCompanyIds = [...new Set([...userCompanyIds, ...Array.from(companyIdsFromStakeholders)])]
                const allCompanies = allCompanyIds.map(id => ({
                    id,
                    name: companiesMap.get(id) || 'Unknown Company'
                }))

                overviewData.push({
                    userId,
                    userName,
                    userEmail,
                    companies: allCompanies,
                    planNames,
                    totalAwards: allAwards.length,
                    draftCount,
                    issuedCount,
                    finalizedCount,
                    pendingAcceptance: issuedCount, // Awards that are issued but not yet finalized
                    primaryStakeholderId: primaryStakeholder?.id || null,
                    allAwards,
                    accessRecords
                })
            })

            // Sort by user name
            overviewData.sort((a, b) => (a.userName || '').localeCompare(b.userName || ''))
            
            setUserOverviewData(overviewData)
        } catch (error) {
            console.error('Error loading user profit sharing overview:', error)
            toast.push(
                <Notification type="danger" duration={2000} title="Error">
                    Failed to load user profit sharing overview: {error.message}
                </Notification>
            )
            setUserOverviewData([])
        } finally {
            setLoadingOverview(false)
        }
    }

    // Filter overview data based on search and company filter
    const filteredOverviewData = userOverviewData.filter(userData => {
        // Search filter
        if (overviewSearchQuery) {
            const query = overviewSearchQuery.toLowerCase()
            const matchesName = userData.userName?.toLowerCase().includes(query)
            const matchesEmail = userData.userEmail?.toLowerCase().includes(query)
            const matchesCompany = userData.companies.some(c => c.name.toLowerCase().includes(query))
            const matchesPlan = userData.planNames.some(p => p.toLowerCase().includes(query))
            
            if (!matchesName && !matchesEmail && !matchesCompany && !matchesPlan) {
                return false
            }
        }

        // Company filter
        if (overviewCompanyFilter) {
            const hasCompany = userData.companies.some(c => c.id === overviewCompanyFilter)
            if (!hasCompany) {
                return false
            }
        }

        return true
    })

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
                            {row.original.isStakeholderOnly && (
                                <Tag className="ml-2 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs">
                                    Stakeholder Only
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
            cell: ({ row }) => {
                const role = row.original.role
                const tagClass = role === 'admin' 
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    : role === 'supervisor'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                const roleLabel = role === 'admin' ? 'Admin' : role === 'supervisor' ? 'Supervisor' : 'User'
                return (
                    <Tag className={tagClass}>
                        {roleLabel}
                    </Tag>
                )
            }
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
                // Stakeholder-only users (have stakeholder records but no access records) need to be added first
                if (row.original.isStakeholderOnly) {
                    return (
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="plain"
                                icon={<HiOutlinePlus />}
                                onClick={() => {
                                    // Pre-populate form with user info and add them
                                    setUserFormData({
                                        userId: row.original.userId,
                                        role: 'user',
                                        companyIds: [selectedCompanyId]
                                    })
                                    setEditingAccess(null)
                                    setShowAddUserDialog(true)
                                }}
                            >
                                Add Access
                            </Button>
                            <span className="text-xs text-gray-400">Stakeholder only</span>
                        </div>
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

            {/* Payroll Export Section - Admin Only */}
            {canEdit && (
                <Card className="p-6">
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                            <HiOutlineDownload className="w-5 h-5" />
                            Payroll Export
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Export employee dollar amounts based on the last profit entered for selected companies. The export will include Company Name, Employee Name, Dollar Amount, and Profit Date.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Select Companies *
                            </label>
                            <Select
                                options={companies.map(c => ({ value: c.id, label: c.name }))}
                                value={companies.filter(c => exportSelectedCompanies.includes(c.id)).map(c => ({ value: c.id, label: c.name }))}
                                onChange={(selected) => {
                                    const selectedIds = Array.isArray(selected) 
                                        ? selected.map(opt => opt.value)
                                        : selected 
                                            ? [selected.value]
                                            : []
                                    setExportSelectedCompanies(selectedIds)
                                }}
                                placeholder="Select one or more companies..."
                                isMulti
                                isSearchable
                                closeMenuOnSelect={false}
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
                                {exportSelectedCompanies.length > 0 
                                    ? `${exportSelectedCompanies.length} compan${exportSelectedCompanies.length > 1 ? 'ies' : 'y'} selected`
                                    : 'Select companies to include in the export'}
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button
                                variant="solid"
                                icon={<HiOutlineDownload />}
                                onClick={handlePayrollExport}
                                loading={exporting}
                                disabled={exportSelectedCompanies.length === 0}
                            >
                                Export Payroll
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            <Card className="p-6">
                <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2">Company Management</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Manage companies for profit sharing. Select a company to filter all data across Overview, Plans, Stakeholders, Valuations, and Trigger Tracking tabs.
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
                            // IMPORTANT: Show all users on a single page in User Management
                            // so newly added users are always visible and not hidden
                            // on a second page due to default pageSize=10 in DataTable.
                            pagingData={{
                                total: allAccessRecords.length,
                                pageIndex: 1,
                                pageSize: allAccessRecords.length || 10,
                            }}
                        />
                    </div>
                )}
            </Card>

            {/* User Profit Sharing Overview Section */}
            <Card className="p-6">
                <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                        <HiOutlineChartBar className="w-5 h-5" />
                        User Profit Sharing Overview
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        View all users in profit sharing with their companies, profit plans, awards, and acceptance status across all companies.
                    </p>
                </div>

                {/* Search and Filter Controls */}
                <div className="mb-4 flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                        <Input
                            placeholder="Search by name, email, company, or plan..."
                            value={overviewSearchQuery}
                            onChange={(e) => setOverviewSearchQuery(e.target.value)}
                            prefix={<HiOutlineSearch className="text-gray-400" />}
                        />
                    </div>
                    <div className="w-full sm:w-56">
                        <Select
                            placeholder="Filter by company..."
                            options={companies.map(c => ({ value: c.id, label: c.name }))}
                            value={overviewCompanyFilter ? companies.find(c => c.id === overviewCompanyFilter) ? { value: overviewCompanyFilter, label: companies.find(c => c.id === overviewCompanyFilter).name } : null : null}
                            onChange={(opt) => setOverviewCompanyFilter(opt?.value || null)}
                            isClearable
                            menuPortalTarget={document.body}
                            menuPosition="fixed"
                            styles={{
                                menuPortal: (provided) => ({ ...provided, zIndex: 10000 }),
                                menu: (provided) => ({ ...provided, zIndex: 10000 }),
                            }}
                        />
                    </div>
                </div>

                {loadingOverview ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        Loading user profit sharing overview...
                    </div>
                ) : filteredOverviewData.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        {overviewSearchQuery || overviewCompanyFilter 
                            ? 'No users found matching your filters'
                            : 'No users found in profit sharing'}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <DataTable
                            columns={[
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
                                                <div className="font-medium">{row.original.userName}</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">{row.original.userEmail}</div>
                                            </div>
                                        </div>
                                    )
                                },
                                {
                                    header: 'Companies',
                                    accessorKey: 'companies',
                                    cell: ({ row }) => {
                                        const companies = row.original.companies || []
                                        if (companies.length === 0) {
                                            return <span className="text-gray-400 text-sm">No companies</span>
                                        }
                                        return (
                                            <div className="flex flex-wrap gap-1">
                                                {companies.slice(0, 3).map(company => (
                                                    <Tag
                                                        key={company.id}
                                                        className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs"
                                                    >
                                                        {company.name}
                                                    </Tag>
                                                ))}
                                                {companies.length > 3 && (
                                                    <Tag className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-xs">
                                                        +{companies.length - 3} more
                                                    </Tag>
                                                )}
                                            </div>
                                        )
                                    }
                                },
                                {
                                    header: 'Profit Plans',
                                    accessorKey: 'planNames',
                                    cell: ({ row }) => {
                                        const plans = row.original.planNames || []
                                        if (plans.length === 0) {
                                            return <span className="text-gray-400 text-sm">No plans</span>
                                        }
                                        return (
                                            <div className="flex flex-wrap gap-1">
                                                {plans.slice(0, 2).map((plan, idx) => (
                                                    <Tag
                                                        key={idx}
                                                        className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs"
                                                    >
                                                        {plan}
                                                    </Tag>
                                                ))}
                                                {plans.length > 2 && (
                                                    <Tag className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-xs">
                                                        +{plans.length - 2} more
                                                    </Tag>
                                                )}
                                            </div>
                                        )
                                    }
                                },
                                {
                                    header: 'Total Awards',
                                    accessorKey: 'totalAwards',
                                    cell: ({ row }) => (
                                        <div className="font-medium">{row.original.totalAwards}</div>
                                    )
                                },
                                {
                                    header: 'Award Status',
                                    accessorKey: 'awardStatus',
                                    cell: ({ row }) => {
                                        const { draftCount, issuedCount, finalizedCount } = row.original
                                        return (
                                            <div className="flex flex-col gap-1">
                                                {draftCount > 0 && (
                                                    <div className="flex items-center gap-1">
                                                        <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                                                        <span className="text-xs text-gray-600 dark:text-gray-400">Draft: {draftCount}</span>
                                                    </div>
                                                )}
                                                {issuedCount > 0 && (
                                                    <div className="flex items-center gap-1">
                                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                        <span className="text-xs text-blue-600 dark:text-blue-400">Issued: {issuedCount}</span>
                                                    </div>
                                                )}
                                                {finalizedCount > 0 && (
                                                    <div className="flex items-center gap-1">
                                                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                        <span className="text-xs text-green-600 dark:text-green-400">Finalized: {finalizedCount}</span>
                                                    </div>
                                                )}
                                                {draftCount === 0 && issuedCount === 0 && finalizedCount === 0 && (
                                                    <span className="text-xs text-gray-400">No awards</span>
                                                )}
                                            </div>
                                        )
                                    }
                                },
                                {
                                    header: 'Pending Acceptance',
                                    accessorKey: 'pendingAcceptance',
                                    cell: ({ row }) => {
                                        const pending = row.original.pendingAcceptance || 0
                                        if (pending === 0) {
                                            return <span className="text-xs text-gray-400">None</span>
                                        }
                                        return (
                                            <Tag className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs">
                                                {pending} pending
                                            </Tag>
                                        )
                                    }
                                },
                                {
                                    header: 'Actions',
                                    accessorKey: 'actions',
                                    cell: ({ row }) => {
                                        const primaryStakeholderId = row.original.primaryStakeholderId
                                        if (!primaryStakeholderId) {
                                            return <span className="text-xs text-gray-400">No details</span>
                                        }
                                        return (
                                            <Button
                                                size="sm"
                                                variant="plain"
                                                icon={<HiOutlineEye />}
                                                onClick={() => navigate(`/profit-sharing/stakeholders/${primaryStakeholderId}`)}
                                            >
                                                View Details
                                            </Button>
                                        )
                                    }
                                }
                            ]}
                            data={filteredOverviewData}
                            loading={false}
                            pagingData={{
                                total: filteredOverviewData.length,
                                pageIndex: overviewPageIndex,
                                pageSize: overviewPageSize,
                            }}
                            onPaginationChange={(page) => setOverviewPageIndex(page)}
                            onSelectChange={(size) => {
                                setOverviewPageSize(size)
                                setOverviewPageIndex(1)
                            }}
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
                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-4">
                                <div className="font-medium">{editingAccess.userName}</div>
                                <div className="text-sm text-gray-500">{editingAccess.userEmail}</div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                {editingAccess ? 'Select Companies *' : 'Select Companies *'}
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
                                <div><strong>Supervisor:</strong> Can view Overview, Valuations, and their direct reports' awards</div>
                                <div><strong>User:</strong> Can only view Overview, Valuations, and their own awards (My Awards)</div>
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
