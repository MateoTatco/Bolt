import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Card, Alert, Badge, Dialog, Input, Select, Notification, toast } from '@/components/ui'
import { HiOutlineTrash } from 'react-icons/hi'
import { useCrmStore } from '@/store/crmStore'
import { ProcoreService } from '@/services/ProcoreService'
import { useSessionUser } from '@/store/authStore'
import { createNotification } from '@/utils/notificationHelper'
import { NOTIFICATION_TYPES } from '@/constants/notification.constant'
import { FirebaseAuthService } from '@/services/FirebaseAuthService'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { getAllRoleOptions, USER_ROLES, ROLE_DISPLAY_NAMES } from '@/constants/roles.constant'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { components } from 'react-select'

// Authorized emails that can access Advanced Features Dashboard (legacy)
const AUTHORIZED_EMAILS = [
    'admin-01@tatco.construction',
    'brett@tatco.construction'
]

// Custom ValueContainer for multi-select (like Master Tracker)
const CustomValueContainer = ({ children, ...props }) => {
    const { getValue, selectProps } = props
    const selected = getValue()
    const hasValue = selected && selected.length > 0
    
    const childrenArray = React.Children.toArray(children)
    const filteredChildren = hasValue 
        ? childrenArray.filter(child => {
            if (React.isValidElement(child) && child.props && child.props.className) {
                return !child.props.className.includes('select-placeholder')
            }
            return true
        })
        : childrenArray
    
    if (selectProps.isMulti && hasValue) {
        const input = filteredChildren[filteredChildren.length - 2]
        const indicators = filteredChildren[filteredChildren.length - 1]
        
        if (selected.length === 1) {
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
    
    // When no value, use default ValueContainer to avoid whitespace
    if (!hasValue) {
        const { ValueContainer } = components
        return <ValueContainer {...props}>{children}</ValueContainer>
    }
    
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
    
    if (selectedOptions.length > 0 && unselectedOptions.length > 0) {
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

// Z-index fix for Select dropdowns to appear above sticky headers
const selectZIndexStyles = {
    menuPortal: (provided) => ({ ...provided, zIndex: 9999 }),
    menu: (provided) => ({ ...provided, zIndex: 9999 }),
}

const AdvancedFeatures = () => {
    const navigate = useNavigate()
    const user = useSessionUser((state) => state.user)
    const userRole = user?.role
    
    // Check authorization: admin role OR authorized email
    const userEmail = user?.email?.toLowerCase() || ''
    const isAuthorizedByEmail = AUTHORIZED_EMAILS.some(email => email.toLowerCase() === userEmail)
    // Handle both single role (string) and multiple roles (array)
    const roles = Array.isArray(userRole) ? userRole : (userRole ? [userRole] : [])
    // Check for both 'admin' string and USER_ROLES.ADMIN constant
    const isAuthorizedByRole = roles.includes(USER_ROLES.ADMIN) || roles.includes('admin')
    const isAuthorized = isAuthorizedByRole || isAuthorizedByEmail
    
    // Check authorization on mount
    useEffect(() => {
        if (!isAuthorized) {
            // Redirect unauthorized users to home page
            navigate('/home', { replace: true })
        }
    }, [user, userRole, navigate, isAuthorized])
    
    // Don't render anything if unauthorized (will redirect)
    if (!isAuthorized) {
        return null
    }
    const {
        isOnline,
        lastSyncTime,
        pendingChanges,
        changeHistory,
        conflictResolution,
        startRealtimeListeners,
        stopRealtimeListeners,
        loadFromCache,
        cacheData,
        rollbackChange,
        resolveConflict,
        setOnlineStatus
    } = useCrmStore()

    const [showHistory, setShowHistory] = useState(false)
    const [showConflicts, setShowConflicts] = useState(false)
    const [showDevTools, setShowDevTools] = useState(false)
    const [showAzureSqlTools, setShowAzureSqlTools] = useState(false)
    const [investigationProjectNumber, setInvestigationProjectNumber] = useState('')
    const [investigationResults, setInvestigationResults] = useState(null)
    const [isInvestigating, setIsInvestigating] = useState(false)
    const [deleteConfirmText, setDeleteConfirmText] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)
    const [showProcoreTemplates, setShowProcoreTemplates] = useState(false)
    const [procoreTemplates, setProcoreTemplates] = useState(null)
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)

    // Simple Bolt user invite state
    const [inviteForm, setInviteForm] = useState({
        email: '',
        firstName: '',
        lastName: '',
        role: [USER_ROLES.TATCO_USER], // Default to Tatco User, now supports multiple roles
    })
    const [isInvitingUser, setIsInvitingUser] = useState(false)
    
    // User management state
    const [allUsers, setAllUsers] = useState([])
    const [loadingUsers, setLoadingUsers] = useState(false)
    const [updatingUserRole, setUpdatingUserRole] = useState(null)
    const [userRoleChanges, setUserRoleChanges] = useState({}) // Track pending role changes

    const roleOptions = getAllRoleOptions()

    // Online/Offline detection
    useEffect(() => {
        const handleOnline = () => setOnlineStatus(true)
        const handleOffline = () => setOnlineStatus(false)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [setOnlineStatus])

    // Start real-time listeners on mount
    useEffect(() => {
        startRealtimeListeners()
        return () => stopRealtimeListeners()
    }, [startRealtimeListeners, stopRealtimeListeners])

    // Try to load from cache on mount
    useEffect(() => {
        if (!isOnline) {
            loadFromCache()
        }
    }, [isOnline, loadFromCache])

    // Load all users on mount
    useEffect(() => {
        loadAllUsers()
        // Set default admin roles for super admins on mount
        setDefaultAdminRoles()
    }, [])

    // Set default admin roles for super admin emails and migrate profit sharing users
    const setDefaultAdminRoles = async () => {
        try {
            const usersResult = await FirebaseDbService.users.getAll()
            if (!usersResult.success) return
            
            const users = usersResult.data || []
            const superAdminEmails = ['admin-01@tatco.construction', 'brett@tatco.construction']
            
            // Get all profit sharing access records
            const profitSharingResult = await FirebaseDbService.profitSharingAccess.getAll()
            const profitSharingUsers = profitSharingResult.success ? profitSharingResult.data : []
            
            // Create a map of userId -> has profit sharing access
            const profitSharingUserIds = new Set(profitSharingUsers.map(ps => ps.userId))
            
            for (const userItem of users) {
                const email = userItem.email?.toLowerCase()
                const userId = userItem.id
                const currentRole = userItem.role
                
                // Check if super admin
                if (email && superAdminEmails.includes(email)) {
                    const currentRoles = Array.isArray(currentRole) ? currentRole : (currentRole ? [currentRole] : [])
                    if (!currentRoles.includes(USER_ROLES.ADMIN)) {
                        // Add admin role (keep existing roles)
                        const newRoles = [...currentRoles, USER_ROLES.ADMIN]
                        await FirebaseDbService.users.upsert(userId, {
                            role: newRoles,
                        })
                        console.log(`Set admin role for ${email}`)
                    }
                    continue
                }
                
                // Check if user has profit sharing access
                if (profitSharingUserIds.has(userId)) {
                    const currentRoles = Array.isArray(currentRole) ? currentRole : (currentRole ? [currentRole] : [])
                    
                    // Determine which role to add based on existing role
                    let roleToAdd = null
                    if (currentRoles.length === 0 || (currentRoles.length === 1 && currentRoles[0] === USER_ROLES.TATCO_USER)) {
                        // User only has Tatco User or no role - add profit sharing
                        roleToAdd = USER_ROLES.TATCO_USER_WITH_PROFIT_SHARING
                    } else if (currentRoles.includes(USER_ROLES.TATCO_USER) && !currentRoles.includes(USER_ROLES.TATCO_USER_WITH_PROFIT_SHARING)) {
                        // User has Tatco User but not profit sharing - replace with profit sharing version
                        roleToAdd = USER_ROLES.TATCO_USER_WITH_PROFIT_SHARING
                    }
                    // If user already has a profit sharing role, don't change it
                    
                    if (roleToAdd) {
                        const newRoles = currentRoles.length === 0 
                            ? [roleToAdd]
                            : currentRoles.includes(USER_ROLES.TATCO_USER)
                                ? currentRoles.map(r => r === USER_ROLES.TATCO_USER ? roleToAdd : r)
                                : [...currentRoles, roleToAdd]
                        
                        await FirebaseDbService.users.upsert(userId, {
                            role: newRoles,
                        })
                        console.log(`Migrated user ${email || userId} to profit sharing role`)
                    }
                }
            }
        } catch (error) {
            console.error('Error setting default admin roles and migrating users:', error)
            // Silently fail - this is just a convenience function
        }
    }

    const loadAllUsers = async () => {
        setLoadingUsers(true)
        try {
            const result = await FirebaseDbService.users.getAll()
            if (result.success) {
                // Deduplicate users by email (keep the most recent one if duplicates exist)
                const usersMap = new Map()
                const users = result.data || []
                
                users.forEach(user => {
                    const email = user.email?.toLowerCase()
                    if (email) {
                        const existing = usersMap.get(email)
                        // Keep the user with the most recent updatedAt, or the one with an ID if the other doesn't
                        if (!existing || 
                            (user.updatedAt && existing.updatedAt && 
                             new Date(user.updatedAt) > new Date(existing.updatedAt)) ||
                            (user.id && !existing.id)) {
                            usersMap.set(email, user)
                        }
                    } else if (user.id) {
                        // If no email, use ID as key
                        usersMap.set(user.id, user)
                    }
                })
                
                setAllUsers(Array.from(usersMap.values()))
            } else {
                console.error('Failed to load users:', result.error)
                toast.push(
                    <Notification type="danger" duration={3000} title="Error">
                        Failed to load users: {result.error}
                    </Notification>
                )
            }
        } catch (error) {
            console.error('Error loading users:', error)
            toast.push(
                <Notification type="danger" duration={3000} title="Error">
                    Error loading users
                </Notification>
            )
        } finally {
            setLoadingUsers(false)
        }
    }

    const handleUpdateUserRole = async (userId, newRole) => {
        setUpdatingUserRole(userId)
        try {
            // Handle both single role (string) and multiple roles (array)
            // If empty array, default to TATCO_USER
            let rolesToStore = Array.isArray(newRole) ? newRole : (newRole ? [newRole] : [])
            if (rolesToStore.length === 0) {
                rolesToStore = [USER_ROLES.TATCO_USER]
            }
            
            // Use upsert instead of update to handle permission issues better
            const result = await FirebaseDbService.users.upsert(userId, {
                role: rolesToStore,
            })

            if (result.success) {
                // Update local state
                setAllUsers(prevUsers =>
                    prevUsers.map(u =>
                        u.id === userId ? { ...u, role: rolesToStore } : u
                    )
                )

                toast.push(
                    <Notification type="success" duration={2500} title="Role Updated">
                        User role has been updated successfully.
                    </Notification>
                )

                // Reload user session if it's the current user (but don't reload page)
                if (user?.id === userId || user?.uid === userId) {
                    // Reload user profile to get updated role
                    const profileResult = await FirebaseDbService.users.getById(userId)
                    if (profileResult.success && profileResult.data) {
                        const updatedProfile = profileResult.data
                        // Update user in store
                        const { setUser } = useSessionUser.getState()
                        setUser({
                            ...user,
                            role: updatedProfile.role
                        })
                    }
                }
            } else {
                throw new Error(result.error || 'Failed to update user role')
            }
        } catch (error) {
            console.error('Error updating user role:', error)
            toast.push(
                <Notification type="danger" duration={3000} title="Error">
                    {error.message || 'Failed to update user role. You may not have permission to update users.'}
                </Notification>
            )
        } finally {
            setUpdatingUserRole(null)
        }
    }
    
    const handleSaveAllRoleChanges = async () => {
        const userIds = Object.keys(userRoleChanges)
        if (userIds.length === 0) {
            toast.push(
                <Notification type="warning" duration={2500} title="No Changes">
                    No role changes to save.
                </Notification>
            )
            return
        }
        
        // Update all users with pending changes
        for (const userId of userIds) {
            const newRole = userRoleChanges[userId]
            await handleUpdateUserRole(userId, newRole)
        }
        
        // Clear all pending changes after successful save
        setUserRoleChanges({})
    }

    const handleDeleteUser = async (userId, userEmail) => {
        if (!window.confirm(`Are you sure you want to delete ${userEmail}? This will permanently delete their account from Firebase Auth and Firestore.`)) {
            return
        }

        try {
            // Step 1: Delete from Firebase Auth via Cloud Function
            try {
                const functions = getFunctions()
                const deleteUserFunction = httpsCallable(functions, 'deleteUser')
                await deleteUserFunction({ userId })
            } catch (authError) {
                console.warn('Failed to delete from Auth (user may not exist in Auth):', authError)
                // Continue with Firestore deletion even if Auth deletion fails
            }

            // Step 2: Delete from Firestore
            const result = await FirebaseDbService.users.delete(userId)
            
            if (result.success) {
                // Remove from local state
                setAllUsers(prevUsers => prevUsers.filter(u => u.id !== userId))
                
                toast.push(
                    <Notification type="success" duration={2500} title="User Deleted">
                        User has been permanently deleted from Firebase Auth and Firestore.
                    </Notification>
                )
            } else {
                throw new Error(result.error || 'Failed to delete user from Firestore')
            }
        } catch (error) {
            console.error('Error deleting user:', error)
            toast.push(
                <Notification type="danger" duration={3000} title="Error">
                    {error.message || 'Failed to delete user. You may not have permission to delete users.'}
                </Notification>
            )
        }
    }

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleString()
    }

    const handleRollback = async (historyId) => {
        if (window.confirm('Are you sure you want to rollback this change?')) {
            await rollbackChange(historyId)
        }
    }

    const handleShowTatcoContact = () => {
        try {
            // Get current type from localStorage or default to 'lead'
            const currentType = localStorage.getItem('crmCurrentType') || 'lead'
            const storageSuffix = currentType === 'client' ? 'client' : 'lead'
            
            // Get current visible columns
            const rawVisible = localStorage.getItem(`crmVisibleColumns_${storageSuffix}`)
            const visibleColumns = rawVisible ? JSON.parse(rawVisible) : {}
            
            // Force visibility
            visibleColumns.tatcoContact = true
            localStorage.setItem(`crmVisibleColumns_${storageSuffix}`, JSON.stringify(visibleColumns))
            
            // Get current column order
            const rawOrder = localStorage.getItem(`crmColumnOrder_${storageSuffix}`)
            const columnOrder = rawOrder ? JSON.parse(rawOrder) : []
            
            // Force column order
            if (!columnOrder.includes('tatcoContact')) {
                const newOrder = [...columnOrder]
                const leadContactIndex = newOrder.indexOf('leadContact')
                if (leadContactIndex !== -1) {
                    newOrder.splice(leadContactIndex + 1, 0, 'tatcoContact')
                } else {
                    newOrder.unshift('tatcoContact')
                }
                localStorage.setItem(`crmColumnOrder_${storageSuffix}`, JSON.stringify(newOrder))
            }
            
            // Dispatch event to notify Home.jsx to refresh
            window.dispatchEvent(new CustomEvent('crmColumnsUpdated'))
            
            // Optionally reload the page to see changes immediately
            if (window.location.pathname === '/home') {
                window.location.reload()
            }
        } catch (error) {
            console.error('Error updating Tatco Contact column:', error)
        }
    }

    const handleGetProcoreTemplates = async () => {
        setIsLoadingTemplates(true)
        setProcoreTemplates(null)
        try {
            console.log('🔍 Fetching Procore project templates...')
            const result = await ProcoreService.getProjectTemplates({ page: 1, per_page: 100 })
            console.log('Templates result:', result)
            setProcoreTemplates(result)
        } catch (error) {
            console.error('Error fetching templates:', error)
            alert(`Error fetching templates: ${error?.message || error?.details || 'Unknown error'}`)
        } finally {
            setIsLoadingTemplates(false)
        }
    }

    const handleInviteUser = async () => {
        const trimmedEmail = inviteForm.email.trim().toLowerCase()
        const trimmedFirst = inviteForm.firstName.trim()
        const trimmedLast = inviteForm.lastName.trim()

        if (!trimmedEmail) {
            toast.push(
                <Notification type="warning" duration={2500} title="Validation">
                    Email is required to invite a user.
                </Notification>
            )
            return
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(trimmedEmail)) {
            toast.push(
                <Notification type="warning" duration={2500} title="Validation">
                    Please enter a valid email address.
                </Notification>
            )
            return
        }

        setIsInvitingUser(true)
        try {
            const invitedByEmail = user?.email || null
            const invitedByName = user?.userName || user?.name || null

            // Step 1: Create Firebase Auth user and send password reset email
            const displayName = trimmedFirst && trimmedLast 
                ? `${trimmedFirst} ${trimmedLast}`.trim()
                : trimmedFirst || trimmedLast || trimmedEmail.split('@')[0]
            
            const authResult = await FirebaseAuthService.createUserWithPasswordReset(
                trimmedEmail,
                displayName
            )

            let userId = null
            let userAlreadyExists = false

            if (!authResult.success) {
                // Check if user already exists
                if (authResult.errorCode === 'auth/email-already-in-use') {
                    // User already exists - send them a welcome email and update their profile
                    userAlreadyExists = true
                    
                    // Try to find the user in Firestore to get their ID
                    const usersResult = await FirebaseDbService.users.getAll()
                    if (usersResult.success) {
                        const existingUser = usersResult.data.find(u => 
                            u.email?.toLowerCase() === trimmedEmail.toLowerCase()
                        )
                        if (existingUser?.id) {
                            userId = existingUser.id
                        }
                    }
                    
                    // If we couldn't find the user ID, try to get it from Auth
                    // We can't directly query Auth from client, but we can try to send the email anyway
                    // The Cloud Function will handle generating the password reset link for existing users
                    
                    // Send welcome email to existing user
                    try {
                        const functions = getFunctions()
                        const sendWelcomeEmailFunction = httpsCallable(functions, 'sendWelcomeEmail')
                        await sendWelcomeEmailFunction({ email: trimmedEmail, displayName })
                    } catch (emailError) {
                        console.warn('Failed to send welcome email to existing user:', emailError)
                        // Fall back to regular password reset
                        try {
                            await FirebaseAuthService.resetPassword(trimmedEmail)
                        } catch (resetError) {
                            console.error('Failed to send password reset:', resetError)
                            throw new Error('User exists but failed to send password reset email. Please try again or contact support.')
                        }
                    }
                } else {
                    throw new Error(authResult.error || 'Failed to create user in Firebase Auth.')
                }
            } else {
                userId = authResult.userId
            }

            // Step 2: Create or update user profile in Firestore with role(s)
            // If user already exists, we still want to update their profile with the new role/info
            if (userId) {
                // Handle multiple roles - store as array, or single role as string for backward compatibility
                // If empty array, default to TATCO_USER
                let rolesToStore = Array.isArray(inviteForm.role) 
                    ? inviteForm.role.length > 0 
                        ? inviteForm.role 
                        : [USER_ROLES.TATCO_USER]
                    : (inviteForm.role ? [inviteForm.role] : [USER_ROLES.TATCO_USER])
                if (rolesToStore.length === 0) {
                    rolesToStore = [USER_ROLES.TATCO_USER]
                }
                
                const userProfileResult = await FirebaseDbService.users.upsert(userId, {
                    email: trimmedEmail,
                    firstName: trimmedFirst || '',
                    lastName: trimmedLast || '',
                    avatar: '',
                    role: rolesToStore, // Store role(s) in user profile
                })

                if (!userProfileResult.success) {
                    console.error('Failed to create/update user profile:', userProfileResult.error)
                    // Don't throw here - user exists in Auth, profile can be updated later
                }
            } else {
                // User exists but we couldn't find their ID - this is okay, they'll get the email
                console.warn('User exists in Auth but ID not found in Firestore. Email sent but profile not updated.')
            }

            // Step 3: Create invitation record in Firestore (optional - for tracking only)
            // This may fail due to Firestore rules, but that's okay - user is already created
            if (userId) {
                try {
                    const rolesForInvitation = Array.isArray(inviteForm.role) ? inviteForm.role : [inviteForm.role || 'user']
                    const invitationData = {
                        email: trimmedEmail,
                        firstName: trimmedFirst || null,
                        lastName: trimmedLast || null,
                        role: rolesForInvitation,
                        invitedByEmail,
                        invitedByName,
                        userId: userId,
                        status: 'completed',
                    }

                    await FirebaseDbService.userInvitations.create(invitationData)
                    // Silently ignore errors - invitation record is optional tracking only
                } catch (inviteError) {
                    // Silently ignore - user creation is the important part and it succeeded
                }
            }

            // Step 4: Create notification
            const rolesForMetadata = Array.isArray(inviteForm.role) ? inviteForm.role : [inviteForm.role || 'user']
            const metadata = {
                email: trimmedEmail,
                firstName: trimmedFirst || null,
                lastName: trimmedLast || null,
                role: rolesForMetadata,
                invitedByEmail,
                invitedByName,
                userId: userId,
            }

            const notifyResult = await createNotification({
                userId: user?.id || user?.uid || null,
                type: NOTIFICATION_TYPES.SYSTEM,
                title: userAlreadyExists ? 'Bolt User Updated' : 'Bolt User Created',
                message: userAlreadyExists 
                    ? `User ${trimmedEmail} already existed. A welcome email has been sent and their profile has been updated.`
                    : `User ${trimmedEmail} has been created and can now sign in. A welcome email has been sent.`,
                entityType: null,
                entityId: null,
                relatedUserId: user?.id || user?.uid || null,
                metadata,
            })

            if (!notifyResult.success) {
                console.warn('Failed to create notification:', notifyResult.error)
                // Don't throw - user creation was successful
            }

            toast.push(
                <Notification type="success" duration={4000} title={userAlreadyExists ? "User Updated Successfully" : "User Created Successfully"}>
                    {userAlreadyExists 
                        ? `User ${trimmedEmail} already exists. A welcome email with password reset link has been sent, and their profile has been updated.`
                        : `User ${trimmedEmail} has been created in Firebase Auth and can sign in immediately. A welcome email has been sent to set their password.`
                    }
                </Notification>
            )

            setInviteForm({
                email: '',
                firstName: '',
                lastName: '',
                role: [USER_ROLES.TATCO_USER],
            })
        } catch (error) {
            console.error('Error creating user:', error)
            toast.push(
                <Notification type="danger" duration={3000} title="Error">
                    {error.message || 'Failed to create user. Please try again.'}
                </Notification>
            )
        } finally {
            setIsInvitingUser(false)
        }
    }

    const handleInvestigateProject = async () => {
        if (!investigationProjectNumber.trim()) {
            alert('Please enter a project number')
            return
        }

        setIsInvestigating(true)
        setInvestigationResults(null)
        try {
            const results = await ProcoreService.investigateProjectInAzure(investigationProjectNumber.trim())
            setInvestigationResults(results)
            console.log('Investigation results:', results)
        } catch (error) {
            console.error('Error investigating project:', error)
            alert(`Error investigating project: ${error.message || 'Unknown error'}`)
        } finally {
            setIsInvestigating(false)
        }
    }

    const handleDeleteProject = async (projectName, archiveDate) => {
        if (!investigationProjectNumber.trim()) {
            alert('Project number is required')
            return
        }

        // Require explicit confirmation
        const confirmMessage = `⚠️ WARNING: This will permanently delete project records from Azure SQL Database!\n\n` +
            `Project Number: ${investigationProjectNumber}\n` +
            (projectName ? `Project Name: ${projectName}\n` : '') +
            (archiveDate ? `Archive Date: ${archiveDate}\n` : '') +
            `\nThis action cannot be undone. Type "DELETE" to confirm:`

        const userInput = prompt(confirmMessage)
        if (userInput !== 'DELETE') {
            alert('Deletion cancelled. You must type "DELETE" exactly to confirm.')
            return
        }

        setIsDeleting(true)
        try {
            console.log('Calling deleteProjectFromAzure with:', {
                projectNumber: investigationProjectNumber.trim(),
                projectName: projectName || undefined,
                archiveDate: archiveDate || undefined,
                confirmDelete: true,
            })
            const result = await ProcoreService.deleteProjectFromAzure({
                projectNumber: investigationProjectNumber.trim(),
                projectName: projectName || undefined,
                archiveDate: archiveDate || undefined,
                confirmDelete: true,
            })
            console.log('Deletion result:', result)
            
            if (result && result.success !== false) {
                alert(`Successfully deleted ${result.deleted || 0} record(s)`)
                // Refresh investigation results
                await handleInvestigateProject()
            } else {
                alert(`⚠️ Deletion completed but result was unexpected: ${JSON.stringify(result)}`)
            }
        } catch (error) {
            console.error('Error deleting project:', error)
            const errorMessage = error?.message || error?.details || error?.code || 'Unknown error'
            alert(`Error deleting project: ${errorMessage}`)
        } finally {
            setIsDeleting(false)
        }
    }

    const handlePromoteProject = async (projectName, sourceArchiveDate) => {
        if (!investigationProjectNumber.trim()) {
            alert('Project number is required')
            return
        }

        if (!sourceArchiveDate) {
            alert('Source archive date is required')
            return
        }

        // Require explicit confirmation
        const confirmMessage = `🔄 PROMOTE PROJECT TO MOST RECENT DATE\n\n` +
            `This will copy the selected record to the most recent archive date.\n\n` +
            `Project Number: ${investigationProjectNumber}\n` +
            `Project Name: ${projectName}\n` +
            `From Archive Date: ${sourceArchiveDate}\n` +
            `\nType "PROMOTE" to confirm:`

        const userInput = prompt(confirmMessage)
        if (userInput !== 'PROMOTE') {
            alert('Promotion cancelled. You must type "PROMOTE" exactly to confirm.')
            return
        }

        setIsDeleting(true) // Reuse loading state
        try {
            console.log('Calling promoteProjectToRecentDate with:', {
                projectNumber: investigationProjectNumber.trim(),
                sourceArchiveDate: sourceArchiveDate,
                sourceProjectName: projectName || undefined,
                confirmPromote: true,
            })
            const result = await ProcoreService.promoteProjectToRecentDate({
                projectNumber: investigationProjectNumber.trim(),
                sourceArchiveDate: sourceArchiveDate,
                sourceProjectName: projectName || undefined,
                confirmPromote: true,
            })
            console.log('Promotion result:', result)
            
            if (result && result.success !== false) {
                alert(`Successfully promoted record to most recent archive date (${result.promotedToDate || 'N/A'})`)
                // Refresh investigation results
                await handleInvestigateProject()
            } else {
                alert(`Promotion completed but result was unexpected: ${JSON.stringify(result)}`)
            }
        } catch (error) {
            console.error('Error promoting project:', error)
            const errorMessage = error?.message || error?.details || error?.code || 'Unknown error'
            alert(`Error promoting project: ${errorMessage}`)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* Dev Tools Buttons */}
            <div className="flex justify-end gap-2 mb-4">
                <Button 
                    onClick={() => setShowDevTools(!showDevTools)}
                    variant="twoTone"
                    size="sm"
                    className="text-xs"
                >
                    {showDevTools ? 'Hide Dev Tools' : 'Dev Only'}
                </Button>
                <Button 
                    onClick={handleShowTatcoContact}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                >
                    Show Tatco Contact
                </Button>
            </div>

            {/* Development Tools - Hidden by default */}
            {showDevTools && (
                <Card className="p-4">
                    <h3 className="text-lg font-semibold mb-4">Column Debug Info</h3>
                    <div className="space-y-2">
                        <p><strong>Current Type:</strong> {localStorage.getItem('crmCurrentType') || 'lead'}</p>
                        <p><strong>Column Order (Lead):</strong> {localStorage.getItem('crmColumnOrder_lead') || 'Not set'}</p>
                        <p><strong>Visible Columns (Lead):</strong> {localStorage.getItem('crmVisibleColumns_lead') || 'Not set'}</p>
                        <p><strong>Column Order (Client):</strong> {localStorage.getItem('crmColumnOrder_client') || 'Not set'}</p>
                        <p><strong>Visible Columns (Client):</strong> {localStorage.getItem('crmVisibleColumns_client') || 'Not set'}</p>
                    </div>
                </Card>
            )}

            {/* Procore Templates Test */}
            <Card className="p-4 mb-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Procore Templates Test</h3>
                    <Button 
                        onClick={() => setShowProcoreTemplates(!showProcoreTemplates)}
                        variant="twoTone"
                        size="sm"
                    >
                        {showProcoreTemplates ? 'Hide' : 'Show'} Templates Test
                    </Button>
                </div>
                {showProcoreTemplates && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Test the Procore API to see what project templates are available in your Procore account.
                        </p>
                        <Button 
                            onClick={handleGetProcoreTemplates}
                            loading={isLoadingTemplates}
                            variant="solid"
                        >
                            {isLoadingTemplates ? 'Loading...' : 'Fetch Project Templates'}
                        </Button>
                        {procoreTemplates && (
                            <div className="mt-4">
                                <h4 className="font-semibold mb-2">Available Templates:</h4>
                                {procoreTemplates.success && procoreTemplates.data && Array.isArray(procoreTemplates.data) ? (
                                    <div className="space-y-2">
                                        {procoreTemplates.data.length > 0 ? (
                                            <>
                                                <div className="text-sm text-gray-600 mb-2">
                                                    Found {procoreTemplates.data.length} template(s)
                                                    {procoreTemplates.pagination?.total && ` (Total: ${procoreTemplates.pagination.total})`}
                                                </div>
                                                <div className="border rounded-lg overflow-hidden">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50 dark:bg-gray-800">
                                                            <tr>
                                                                <th className="px-4 py-2 text-left font-semibold">ID</th>
                                                                <th className="px-4 py-2 text-left font-semibold">Name</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {procoreTemplates.data.map((template, idx) => (
                                                                <tr key={template.id || idx} className="border-t">
                                                                    <td className="px-4 py-2">{template.id}</td>
                                                                    <td className="px-4 py-2 font-medium">{template.name}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                                    <p className="text-sm text-blue-800 dark:text-blue-200">
                                                        <strong>Note:</strong> Check the browser console for detailed API response data.
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="text-sm text-gray-500">No templates found.</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                            Unexpected response format. Check console for details.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* Azure SQL Project Investigation Tools */}
            <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Azure SQL Project Management</h3>
                    <Button 
                        onClick={() => setShowAzureSqlTools(!showAzureSqlTools)}
                        variant="twoTone"
                        size="sm"
                    >
                        {showAzureSqlTools ? 'Hide' : 'Show'} Tools
                    </Button>
                </div>
                
                {showAzureSqlTools && (
                    <div className="space-y-4">
                        <Alert type="warning">
                            <div>
                                <strong>⚠️ Warning:</strong> These tools allow you to investigate and delete projects from Azure SQL Database. 
                                Use with extreme caution. Deletions are permanent and cannot be undone.
                            </div>
                        </Alert>

                        {/* Investigation Section */}
                        <div className="space-y-3">
                            <h4 className="font-semibold">Investigate Project</h4>
                            <p className="text-sm text-gray-600">
                                Enter a project number to see all records (across all archive dates) in Azure SQL.
                            </p>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Enter project number (e.g., 135250002)"
                                    value={investigationProjectNumber}
                                    onChange={(e) => setInvestigationProjectNumber(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            handleInvestigateProject()
                                        }
                                    }}
                                />
                                <Button
                                    onClick={handleInvestigateProject}
                                    disabled={isInvestigating || !investigationProjectNumber.trim()}
                                    loading={isInvestigating}
                                >
                                    Investigate
                                </Button>
                            </div>
                        </div>

                        {/* Investigation Results */}
                        {investigationResults && (
                            <div className="mt-4 space-y-3">
                                <div>
                                    <h4 className="font-semibold">
                                        Most Recent Records ({investigationResults.totalRecords} record(s))
                                    </h4>
                                    <p className="text-xs text-gray-500 mt-1">
                                        These are the records that appear on Project Profitability page
                                        {investigationResults.mostRecentArchiveDate && 
                                            ` (Archive Date: ${investigationResults.mostRecentArchiveDate})`
                                        }
                                    </p>
                                </div>
                                
                                {investigationResults.records.length === 0 ? (
                                    <Alert type="warning">
                                        <p className="text-sm">
                                            No records found on the most recent archive date. 
                                            If you delete any records, this project will disappear from Project Profitability.
                                        </p>
                                    </Alert>
                                ) : (
                                    <div className="space-y-2 max-h-96 overflow-y-auto">
                                        {investigationResults.records.map((record, index) => (
                                            <Card key={index} className="p-3 border border-blue-200">
                                                <div className="space-y-2">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <p className="font-medium">
                                                                {String(record.projectName || 'Unknown')}
                                                                {record.hasDeleteInName && (
                                                                    <Badge className="ml-2 bg-red-100 text-red-800">
                                                                        HAS "DELETE"
                                                                    </Badge>
                                                                )}
                                                                <Badge className="ml-2 bg-blue-100 text-blue-800">
                                                                    Most Recent
                                                                </Badge>
                                                            </p>
                                                            <p className="text-sm text-gray-600">
                                                                Project #: {String(record.projectNumber || 'N/A')}
                                                            </p>
                                                            {record.projectManager && (
                                                                <p className="text-sm text-gray-600">
                                                                    Project Manager: {String(record.projectManager)}
                                                                </p>
                                                            )}
                                                            <p className="text-xs text-gray-500">
                                                                Archive Date: {(() => {
                                                                    const date = record.archiveDateOnly;
                                                                    if (!date) return 'N/A';
                                                                    if (typeof date === 'string') return date;
                                                                    if (date instanceof Date) return date.toISOString().split('T')[0];
                                                                    return String(date);
                                                                })()}
                                                            </p>
                                                            <div className="flex gap-2 mt-1">
                                                                <Badge className={record.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                                                    {record.isActive ? 'Active' : 'Inactive'}
                                                                </Badge>
                                                                {record.redTeamImport && (
                                                                    <Badge className="bg-purple-100 text-purple-800">
                                                                        Red Team
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="solid"
                                                            color="red"
                                                            onClick={() => handleDeleteProject(record.projectName, record.archiveDateOnly || record.archiveDate)}
                                                            disabled={isDeleting}
                                                        >
                                                            Delete This Record
                                                        </Button>
                                                    </div>
                                                    <div className="text-xs text-gray-500 space-y-1">
                                                        <div>
                                                            Contract Amount: ${(record.contractAmount || 0).toLocaleString()} | 
                                                            Est Cost: ${(record.estCostAtCompletion || 0).toLocaleString()} | 
                                                            Projected Profit: ${(record.projectedProfit || 0).toLocaleString()}
                                                        </div>
                                                        <div>
                                                            Status: {String(record.contractStatus || 'N/A')} | 
                                                            Stage: {String(record.projectStage || 'N/A')}
                                                            {record.contractStartDate && ` | Start: ${record.contractStartDate}`}
                                                            {record.contractEndDate && ` | End: ${record.contractEndDate}`}
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                )}

                                {/* Other Records from Different Archive Dates */}
                                {investigationResults.otherRecords && investigationResults.otherRecords.length > 0 && (
                                    <div className="mt-4">
                                        <div>
                                            <h4 className="font-semibold">
                                                Other Records on Different Dates ({investigationResults.otherRecords.length} record(s))
                                            </h4>
                                            <p className="text-xs text-gray-500 mt-1">
                                                These records exist but are NOT on the most recent archive date, so they won't appear on Project Profitability.
                                                If you delete the most recent record, these older records will NOT automatically appear.
                                            </p>
                                        </div>
                                        <div className="space-y-2 max-h-64 overflow-y-auto mt-2">
                                            {investigationResults.otherRecords.map((record, index) => (
                                                <Card key={`other-${index}`} className="p-3 border border-gray-200 opacity-75">
                                                    <div className="space-y-2">
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex-1">
                                                                <p className="font-medium text-sm">
                                                                    {String(record.projectName || 'Unknown')}
                                                                    {record.hasDeleteInName && (
                                                                        <Badge className="ml-2 bg-red-100 text-red-800">
                                                                            HAS "DELETE"
                                                                        </Badge>
                                                                    )}
                                                                    <Badge className="ml-2 bg-gray-100 text-gray-800">
                                                                        Older Date
                                                                    </Badge>
                                                                </p>
                                                                <p className="text-xs text-gray-600">
                                                                    Project #: {String(record.projectNumber || 'N/A')}
                                                                </p>
                                                                {record.projectManager && (
                                                                    <p className="text-xs text-gray-600">
                                                                        Project Manager: {String(record.projectManager)}
                                                                    </p>
                                                                )}
                                                                <p className="text-xs text-gray-500">
                                                                    Archive Date: {(() => {
                                                                        const date = record.archiveDateOnly;
                                                                        if (!date) return 'N/A';
                                                                        if (typeof date === 'string') return date;
                                                                        if (date instanceof Date) return date.toISOString().split('T')[0];
                                                                        return String(date);
                                                                    })()}
                                                                </p>
                                                                <div className="flex gap-2 mt-1">
                                                                    <Badge className={record.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                                                        {record.isActive ? 'Active' : 'Inactive'}
                                                                    </Badge>
                                                                </div>
                                                                <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                                                                    <div>
                                                                        Contract: ${(record.contractAmount || 0).toLocaleString()} | 
                                                                        Est Cost: ${(record.estCostAtCompletion || 0).toLocaleString()} | 
                                                                        Profit: ${(record.projectedProfit || 0).toLocaleString()}
                                                                    </div>
                                                                    <div>
                                                                        {record.contractStatus && `Status: ${record.contractStatus} | `}
                                                                        {record.projectStage && `Stage: ${record.projectStage}`}
                                                                        {record.contractStartDate && ` | Start: ${record.contractStartDate}`}
                                                                        {record.contractEndDate && ` | End: ${record.contractEndDate}`}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                variant="solid"
                                                                color="blue"
                                                                onClick={() => handlePromoteProject(record.projectName, record.archiveDateOnly || record.archiveDate)}
                                                                disabled={isDeleting}
                                                            >
                                                                Promote to Recent
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h6 className="text-sm font-medium">Connection Status</h6>
                            <p className="text-xs text-gray-500">
                                {isOnline ? 'Online' : 'Offline'}
                            </p>
                        </div>
                        <Badge 
                            className={isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                        >
                            {isOnline ? '🟢' : '🔴'}
                        </Badge>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h6 className="text-sm font-medium">Last Sync</h6>
                            <p className="text-xs text-gray-500">
                                {lastSyncTime ? formatTime(lastSyncTime) : 'Never'}
                            </p>
                        </div>
                        <Button 
                            size="sm" 
                            onClick={cacheData}
                            disabled={!isOnline}
                        >
                            Cache
                        </Button>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h6 className="text-sm font-medium">Pending Changes</h6>
                            <p className="text-xs text-gray-500">
                                {pendingChanges.length} changes
                            </p>
                        </div>
                        <Badge className="bg-yellow-100 text-yellow-800">
                            {pendingChanges.length}
                        </Badge>
                    </div>
                </Card>
            </div>

            {/* Advanced Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                    <h6 className="text-sm font-medium mb-3">Change History</h6>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">
                                {changeHistory.length} recent changes
                            </span>
                            <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => setShowHistory(true)}
                            >
                                View History
                            </Button>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <h6 className="text-sm font-medium mb-3">Conflict Resolution</h6>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">
                                {conflictResolution.conflicts.length} conflicts
                            </span>
                            <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => setShowConflicts(true)}
                                disabled={conflictResolution.conflicts.length === 0}
                            >
                                Resolve
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Offline Mode Alert */}
            {!isOnline && (
                <Alert type="warning">
                    <div className="flex items-center">
                        <span className="mr-2">⚠️</span>
                        <div>
                            <strong>Offline Mode</strong>
                            <p className="text-sm mt-1">
                                You're working offline. Changes will be synced when you're back online.
                            </p>
                        </div>
                    </div>
                </Alert>
            )}

            {/* Change History Dialog */}
            <Dialog
                isOpen={showHistory}
                onClose={() => setShowHistory(false)}
            >
                <div className="p-6">
                    <h5 className="text-xl font-semibold mb-4">Change History</h5>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                    {changeHistory.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No changes recorded</p>
                    ) : (
                        changeHistory.map((change) => (
                            <div key={change.id} className="flex items-center justify-between p-3 border rounded">
                                <div>
                                    <p className="text-sm font-medium capitalize">
                                        {change.action.replace('_', ' ')}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {formatTime(change.timestamp)}
                                    </p>
                                </div>
                                <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleRollback(change.id)}
                                >
                                    Rollback
                                </Button>
                            </div>
                        ))
                    )}
                    </div>
                </div>
            </Dialog>

            {/* Conflict Resolution Dialog */}
            <Dialog
                isOpen={showConflicts}
                onClose={() => setShowConflicts(false)}
            >
                <div className="p-6">
                    <h5 className="text-xl font-semibold mb-4">Resolve Conflicts</h5>
                    <div className="space-y-4">
                    {conflictResolution.conflicts.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No conflicts to resolve</p>
                    ) : (
                        conflictResolution.conflicts.map((conflict) => (
                            <div key={conflict.id} className="p-4 border rounded">
                                <h6 className="font-medium mb-2">Conflict in {conflict.field}</h6>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm text-gray-600">Local Version</label>
                                        <Input 
                                            value={conflict.local} 
                                            readOnly 
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm text-gray-600">Server Version</label>
                                        <Input 
                                            value={conflict.server} 
                                            readOnly 
                                            className="mt-1"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-4">
                                    <Button 
                                        size="sm"
                                        onClick={() => resolveConflict(conflict.id, 'local')}
                                    >
                                        Use Local
                                    </Button>
                                    <Button 
                                        size="sm"
                                        onClick={() => resolveConflict(conflict.id, 'server')}
                                    >
                                        Use Server
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                    </div>
                </div>
            </Dialog>

            {/* Bolt User Invitations */}
            <Card className="p-4 mt-4">
                <h3 className="text-lg font-semibold mb-2">Bolt User Invitations</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Create new Bolt users directly from here. Users will be registered in Firebase Auth and receive a password reset email to set their own password. They can sign in immediately after setting their password.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-1">Email *</label>
                        <Input
                            value={inviteForm.email}
                            onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="new.user@company.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">First Name</label>
                        <Input
                            value={inviteForm.firstName}
                            onChange={(e) => setInviteForm(prev => ({ ...prev, firstName: e.target.value }))}
                            placeholder="First name"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Last Name</label>
                        <Input
                            value={inviteForm.lastName}
                            onChange={(e) => setInviteForm(prev => ({ ...prev, lastName: e.target.value }))}
                            placeholder="Last name"
                        />
                    </div>
                </div>
                <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="min-w-[350px]">
                        <label className="block text-sm font-medium mb-1">User Role(s)</label>
                        <Select
                            isMulti
                            isClearable
                            options={roleOptions}
                            placeholder="Select role(s)..."
                            value={(() => {
                                const roles = Array.isArray(inviteForm.role) ? inviteForm.role : (inviteForm.role ? [inviteForm.role] : [])
                                if (roles.length === 0) {
                                    return null // Show placeholder when empty
                                }
                                return roleOptions.filter(opt => roles.includes(opt.value))
                            })()}
                            onChange={(selected) => {
                                // Handle clear (null or empty array) - set to empty array to show placeholder
                                if (!selected || selected.length === 0) {
                                    setInviteForm(prev => ({ ...prev, role: [] }))
                                } else {
                                    const selectedRoles = selected.map(opt => opt.value)
                                    setInviteForm(prev => ({ ...prev, role: selectedRoles }))
                                }
                            }}
                            components={{
                                ValueContainer: CustomValueContainer,
                                MultiValue: CustomMultiValue,
                                MenuList: CustomMenuList,
                                Option: CustomOption,
                                Placeholder: CustomPlaceholder,
                            }}
                            menuPortalTarget={document.body}
                            menuPosition="fixed"
                            styles={selectZIndexStyles}
                            controlShouldRenderValue={false}
                            hideSelectedOptions={false}
                        />
                    </div>
                    <div className="flex justify-end">
                        <Button
                            onClick={handleInviteUser}
                            loading={isInvitingUser}
                            disabled={isInvitingUser}
                        >
                            Create User
                        </Button>
                    </div>
                </div>
            </Card>

            {/* User Role Management */}
            <Card className="p-4 mt-4">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold mb-1">User Role Management</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            View and manage user roles. Changes take effect immediately.
                        </p>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            setUserRoleChanges({}) // Clear pending changes
                            loadAllUsers() // Reload users
                        }}
                        loading={loadingUsers}
                    >
                        Refresh
                    </Button>
                </div>

                {loadingUsers ? (
                    <div className="text-center py-8">
                        <div className="text-gray-500">Loading users...</div>
                    </div>
                ) : allUsers.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="text-gray-500">No users found</div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                    <th className="text-left py-3 px-4 font-semibold text-sm">Name</th>
                                    <th className="text-left py-3 px-4 font-semibold text-sm">Email</th>
                                    <th className="text-left py-3 px-4 font-semibold text-sm">Current Role</th>
                                    <th className="text-left py-3 px-4 font-semibold text-sm">Change Role</th>
                                    <th className="text-left py-3 px-4 font-semibold text-sm">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allUsers.map((userItem) => (
                                    <tr
                                        key={userItem.id}
                                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                                    >
                                        <td className="py-3 px-4">
                                            {userItem.firstName || userItem.lastName
                                                ? `${userItem.firstName || ''} ${userItem.lastName || ''}`.trim()
                                                : 'N/A'}
                                        </td>
                                        <td className="py-3 px-4">{userItem.email || 'N/A'}</td>
                                        <td className="py-3 px-4">
                                            <div className="flex flex-wrap gap-1">
                                                {(() => {
                                                    const roles = Array.isArray(userItem.role) ? userItem.role : (userItem.role ? [userItem.role] : [])
                                                    if (roles.length === 0) {
                                                        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">No role assigned</Badge>
                                                    }
                                                    return roles.map((role, idx) => (
                                                        <Badge key={idx} className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                            {ROLE_DISPLAY_NAMES[role] || role}
                                                        </Badge>
                                                    ))
                                                })()}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <Select
                                                    isMulti
                                                    isClearable
                                                    options={roleOptions}
                                                    value={(() => {
                                                        // Use pending changes if available, otherwise use current role
                                                        const pendingRoles = userRoleChanges[userItem.id]
                                                        if (pendingRoles !== undefined) {
                                                            // If pendingRoles is empty array, return null (cleared)
                                                            if (pendingRoles.length === 0) {
                                                                return null
                                                            }
                                                            return roleOptions.filter(opt => pendingRoles.includes(opt.value))
                                                        }
                                                        const roles = Array.isArray(userItem.role) ? userItem.role : (userItem.role ? [userItem.role] : [])
                                                        if (roles.length === 0) {
                                                            return null
                                                        }
                                                        return roleOptions.filter(opt => roles.includes(opt.value))
                                                    })()}
                                                    onChange={(selected) => {
                                                        // Handle clear (null or empty array)
                                                        if (!selected || selected.length === 0) {
                                                            // Clear all selections - store empty array
                                                            setUserRoleChanges(prev => ({
                                                                ...prev,
                                                                [userItem.id]: []
                                                            }))
                                                        } else {
                                                            const selectedRoles = selected.map(opt => opt.value)
                                                            // Store changes locally instead of immediately updating
                                                            setUserRoleChanges(prev => ({
                                                                ...prev,
                                                                [userItem.id]: selectedRoles
                                                            }))
                                                        }
                                                    }}
                                                    size="sm"
                                                    className="min-w-[350px]"
                                                    disabled={updatingUserRole === userItem.id}
                                                    components={{
                                                        ValueContainer: CustomValueContainer,
                                                        MultiValue: CustomMultiValue,
                                                        MenuList: CustomMenuList,
                                                        Option: CustomOption,
                                                        Placeholder: CustomPlaceholder,
                                                    }}
                                                    menuPortalTarget={document.body}
                                                    menuPosition="fixed"
                                                    styles={selectZIndexStyles}
                                                    controlShouldRenderValue={false}
                                                    hideSelectedOptions={false}
                                                    placeholder="Select role(s)..."
                                                />
                                                {updatingUserRole === userItem.id && (
                                                    <div className="text-xs text-gray-500">Updating...</div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <Button
                                                size="sm"
                                                variant="plain"
                                                icon={<HiOutlineTrash />}
                                                onClick={() => handleDeleteUser(userItem.id, userItem.email || 'this user')}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                Remove
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                
                {/* Save button for role changes */}
                {Object.keys(userRoleChanges).length > 0 && (
                    <div className="mt-4 flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setUserRoleChanges({})
                                loadAllUsers() // Reload to reset changes
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveAllRoleChanges}
                            loading={Object.keys(userRoleChanges).some(id => updatingUserRole === id)}
                        >
                            Save Role Changes ({Object.keys(userRoleChanges).length})
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    )
}

export default AdvancedFeatures
