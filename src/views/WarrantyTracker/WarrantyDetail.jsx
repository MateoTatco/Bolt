import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router'
import { Card, Button, Tag, Avatar, Dialog, Input, Alert, Select, DatePicker } from '@/components/ui'
import { 
    HiOutlineArrowLeft, 
    HiOutlinePencil, 
    HiOutlineCheckCircle, 
    HiOutlineClock, 
    HiOutlinePaperClip, 
    HiOutlineUser, 
    HiOutlineRefresh,
    HiOutlineCalendar,
    HiOutlineMail,
    HiOutlinePhone,
    HiOutlineOfficeBuilding,
    HiOutlineDocumentText,
    HiOutlineUserGroup,
    HiOutlineBell,
    HiOutlineCheckCircle as HiOutlineCheckCircleSolid,
    HiOutlineX,
    HiOutlineCheck,
    HiOutlinePlus
} from 'react-icons/hi'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import ActivitiesTimeline from '@/components/Activities/ActivitiesTimeline'
import AttachmentsManager from '@/components/Attachments/AttachmentsManager'
import CreateWarrantyModal from './components/CreateWarrantyModal'
import { useWarrantyStore } from '@/store/warrantyStore'
import { useProjectsStore } from '@/store/projectsStore'
import acronym from '@/utils/acronym'
import useRandomBgColor from '@/utils/hooks/useRandomBgColor'
import { getCurrentUserId } from '@/utils/notificationHelper'
import { USER_ROLES } from '@/constants/roles.constant'
import { collection, query, orderBy, onSnapshot, doc } from 'firebase/firestore'
import { db } from '@/configs/firebase.config'
import { Timestamp } from 'firebase/firestore'

const WarrantyDetail = () => {
    const { warrantyId } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const [warranty, setWarranty] = useState(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('overview')
    const [showCompleteDialog, setShowCompleteDialog] = useState(false)
    const [updates, setUpdates] = useState([])
    const [newUpdateText, setNewUpdateText] = useState('')
    const [addingUpdate, setAddingUpdate] = useState(false)
    const [updateCc, setUpdateCc] = useState([]) // CC recipients for updates
    const [users, setUsers] = useState([])
    const [alertBanner, setAlertBanner] = useState({ visible: false, kind: 'saved' })
    // Initialize isEditing from URL parameter to persist across remounts
    const getInitialEditState = () => {
        const params = new URLSearchParams(window.location.search)
        return params.get('edit') === 'true'
    }
    const [isEditing, setIsEditing] = useState(getInitialEditState())
    const [editFormData, setEditFormData] = useState({})
    const [saving, setSaving] = useState(false)
    const [projects, setProjects] = useState([])

    
    const { completeWarranty, updateWarranty } = useWarrantyStore()
    const projectsFromStore = useProjectsStore((state) => state.projects) || []
    const loadProjects = useProjectsStore((state) => state.loadProjects)
    const bgColor = useRandomBgColor()

    // Load users for display (Tatco users and admins only)
    useEffect(() => {
        const loadUsers = async () => {
            try {
                const response = await FirebaseDbService.users.getAll()
                if (response.success) {
                    const allUsers = response.data || []

                    const tatcoUsers = allUsers.filter(user => {
                        const userRole = user.role
                        if (!userRole) return false

                        const roles = Array.isArray(userRole) ? userRole : [userRole]

                        const hasTatcoRole = roles.some(r =>
                            r === USER_ROLES.TATCO_USER ||
                            r === USER_ROLES.TATCO_USER_WITH_PROFIT_SHARING
                        )
                        const hasAdminRole = roles.some(r => r === USER_ROLES.ADMIN)

                        return hasTatcoRole || hasAdminRole
                    })

                    setUsers(tatcoUsers)
                }
            } catch (error) {
                console.error('Failed to load users:', error)
            }
        }
        loadUsers()
    }, [])

    // Check for edit parameter and automatically enter edit mode (same as clicking Edit button)
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const editParam = params.get('edit')
        
        // If we have edit=true in URL and not already editing, enter edit mode
        if (editParam === 'true' && !isEditing) {
            // Same behavior as clicking the Edit button at the top
            setIsEditing(true)
        }
    }, [location.search, warrantyId, isEditing]) // Include warrantyId to catch navigation to new warranty

    // Load warranty
    useEffect(() => {
        const loadWarranty = async () => {
            if (!warrantyId) return
            setLoading(true)
            try {
                const response = await FirebaseDbService.warranties.getById(warrantyId)
                if (response.success) {
                    setWarranty(response.data)
                } else {
                    console.error('Failed to load warranty:', response.error)
                    // If warranty not found, navigate back after a delay
                    setTimeout(() => {
                        navigate('/warranty-tracker')
                    }, 2000)
                }
            } catch (error) {
                console.error('Error loading warranty:', error)
            } finally {
                setLoading(false)
            }
        }
        loadWarranty()
    }, [warrantyId, navigate])

    // Setup real-time listener for warranty
    useEffect(() => {
        if (!warrantyId) return
        const warrantyRef = doc(db, 'warranties', warrantyId)
        const unsubscribe = onSnapshot(warrantyRef, (snap) => {
            if (snap.exists()) {
                setWarranty({ id: snap.id, ...snap.data() })
            }
        }, (error) => {
            console.error('Warranty listener error:', error)
        })
        return () => unsubscribe()
    }, [warrantyId])

    // Setup real-time listener for updates
    useEffect(() => {
        if (!warrantyId) return
        const updatesRef = collection(db, 'warranties', warrantyId, 'updates')
        const q = query(updatesRef, orderBy('createdAt', 'desc'))
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const updatesList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            setUpdates(updatesList)
        }, (error) => {
            console.error('Updates listener error:', error)
        })
        return () => unsubscribe()
    }, [warrantyId])

    // Load projects for editing
    useEffect(() => {
        if (!isEditing) return
        const loadProjectsData = async () => {
            try {
                if (projectsFromStore.length === 0) {
                    await loadProjects()
                }
                const validProjects = (projectsFromStore || [])
                    .filter(p => {
                        const projectName = p.ProjectName || p.projectName
                        return projectName && projectName.trim() !== ''
                    })
                    .sort((a, b) => {
                        const nameA = (a.ProjectName || a.projectName || '').toLowerCase()
                        const nameB = (b.ProjectName || b.projectName || '').toLowerCase()
                        return nameA.localeCompare(nameB)
                    })
                setProjects(validProjects)
            } catch (error) {
                console.error('Failed to load projects:', error)
            }
        }
        loadProjectsData()
    }, [isEditing, projectsFromStore, loadProjects])

    // Initialize edit form data when entering edit mode
    useEffect(() => {
        if (isEditing && warranty) {
            setEditFormData({
                projectId: warranty.projectId || null,
                projectName: warranty.projectName || '',
                description: warranty.description || '',
                requestedBy: warranty.requestedBy || '',
                requestedByEmail: warranty.requestedByEmail || '',
                assignedTo: warranty.assignedTo || [],
                cc: warranty.cc || [],
                reminderFrequency: warranty.reminderFrequency || '5days',
                startDate: warranty.startDate?.toDate ? warranty.startDate.toDate() : (warranty.startDate || null),
                expectedCompletionDate: warranty.expectedCompletionDate?.toDate ? warranty.expectedCompletionDate.toDate() : (warranty.expectedCompletionDate || null),
            })
        }
    }, [isEditing, warranty])

    // Handle tab query parameter
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const tab = params.get('tab')
        if (tab && ['overview', 'updates', 'attachments', 'settings'].includes(tab)) {
            setActiveTab(tab)
        }
    }, [location.search])

    // Handle edit query parameter - automatically enter edit mode when ?edit=true
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const editParam = params.get('edit')
        if (editParam === 'true') {
            if (!isEditing) {
                setIsEditing(true)
            }
            // Remove the edit parameter from URL to clean it up (only if we're not already editing)
            if (!isEditing) {
                params.delete('edit')
                const newSearch = params.toString()
                const newUrl = `${location.pathname}${newSearch ? `?${newSearch}` : ''}`
                navigate(newUrl, { replace: true })
            }
        }
    }, [location.search, location.pathname, isEditing, navigate])

    // Format date helper - MM/DD/YYYY format (with time for updates)
    const formatDate = (date) => {
        if (!date) return '-'
        try {
            let dateObj
            if (date?.toDate) {
                dateObj = date.toDate()
            } else if (date instanceof Date) {
                dateObj = date
            } else if (typeof date === 'string') {
                dateObj = new Date(date)
            } else {
                return '-'
            }
            
            const day = String(dateObj.getDate()).padStart(2, '0')
            const month = String(dateObj.getMonth() + 1).padStart(2, '0')
            const year = dateObj.getFullYear()
            const hours = String(dateObj.getHours()).padStart(2, '0')
            const minutes = String(dateObj.getMinutes()).padStart(2, '0')
            return `${month}/${day}/${year} ${hours}:${minutes}`
        } catch {
            return '-'
        }
    }

    // Format date only (no time) - MM/DD/YYYY format
    const formatDateOnly = (date) => {
        if (!date) return '-'
        try {
            let dateObj
            if (date?.toDate) {
                dateObj = date.toDate()
            } else if (date instanceof Date) {
                dateObj = date
            } else if (typeof date === 'string') {
                dateObj = new Date(date)
            } else {
                return '-'
            }
            
            const day = String(dateObj.getDate()).padStart(2, '0')
            const month = String(dateObj.getMonth() + 1).padStart(2, '0')
            const year = dateObj.getFullYear()
            return `${month}/${day}/${year}`
        } catch {
            return '-'
        }
    }

    // Get user by ID
    const getUserById = (userId) => {
        return users.find(u => u.id === userId || u.uid === userId)
    }

    // Get user display name - Always show "First Name Last Name" format when available
    const getUserDisplayName = (user) => {
        if (!user) return 'Unknown'
        if (user.firstName && user.lastName) {
            return `${user.firstName} ${user.lastName}`.trim()
        } else if (user.firstName) {
            return user.firstName
        } else if (user.lastName) {
            return user.lastName
        } else {
            return user.userName || 
                   user.displayName || 
                   user.email?.split('@')[0] || 
                   'Unknown'
        }
    }

    // Get user initials
    const getUserInitials = (user) => {
        if (!user) return '?'
        const name = getUserDisplayName(user)
        return acronym(name)
    }

    // User options for selects
    const userOptions = useMemo(() => {
        return users.map(user => {
            let displayName = 'Unknown User'
            if (user.firstName && user.lastName) {
                displayName = `${user.firstName} ${user.lastName}`.trim()
            } else if (user.firstName) {
                displayName = user.firstName
            } else if (user.lastName) {
                displayName = user.lastName
            } else {
                displayName = user.userName || 
                             user.displayName || 
                             user.email?.split('@')[0] || 
                             'Unknown User'
            }
            return {
                value: user.id || user.uid,
                label: displayName,
                email: user.email || '',
            }
        })
    }, [users])

    // Project options
    const projectOptions = useMemo(() => {
        return projects
            .filter(project => {
                const projectName = project.ProjectName || project.projectName
                return projectName && projectName.trim() !== ''
            })
            .map(project => {
                const projectName = project.ProjectName || project.projectName
                const isArchived = project.Archived || project.archived
                return {
                    value: project.id,
                    label: isArchived ? `${projectName} (Archived)` : projectName,
                    project: project,
                }
            })
    }, [projects])

    const reminderFrequencyOptions = [
        { value: '1day', label: '1 Day' },
        { value: '3days', label: '3 Days' },
        { value: '5days', label: '5 Days' },
        { value: '7days', label: '7 Days' },
    ]

    // Handle add update
    const handleAddUpdate = async () => {
        if (!newUpdateText.trim() || !warrantyId) return
        
        setAddingUpdate(true)
        try {
            const currentUserId = getCurrentUserId()
            const currentUser = currentUserId ? getUserById(currentUserId) : null
            const displayName = currentUser ? getUserDisplayName(currentUser) : 'Unknown User'
            
            const updateData = {
                note: newUpdateText.trim(),
                createdBy: currentUserId || 'unknown',
                createdByName: displayName,
                cc: updateCc.filter(id => id !== null && id !== undefined) // Include CC recipients
            }
            
            const response = await FirebaseDbService.warranties.addUpdate(warrantyId, updateData)
            if (response.success) {
                setNewUpdateText('')
                setUpdateCc([]) // Reset CC after successful update
                setAlertBanner({ visible: true, kind: 'saved', message: 'Update added successfully' })
                setTimeout(() => setAlertBanner(b => ({ ...b, visible: false })), 3000)
            } else {
                throw new Error(response.error)
            }
        } catch (error) {
            console.error('Failed to add update:', error)
            setAlertBanner({ visible: true, kind: 'danger', message: 'Failed to add update' })
            setTimeout(() => setAlertBanner(b => ({ ...b, visible: false })), 3000)
        } finally {
            setAddingUpdate(false)
        }
    }

    // Handle complete warranty
    const handleCompleteWarranty = async () => {
        if (!warrantyId) return
        try {
            await completeWarranty(warrantyId)
            setShowCompleteDialog(false)
            setAlertBanner({ visible: true, kind: 'saved', message: 'Warranty marked as completed' })
            setTimeout(() => setAlertBanner(b => ({ ...b, visible: false })), 3000)
        } catch (error) {
            console.error('Failed to complete warranty:', error)
            setAlertBanner({ visible: true, kind: 'danger', message: 'Failed to complete warranty' })
            setTimeout(() => setAlertBanner(b => ({ ...b, visible: false })), 3000)
        }
    }

    // Handle reopen warranty (change status back to open)
    const handleReopenWarranty = async () => {
        if (!warrantyId) return
        try {
            await updateWarranty(warrantyId, { 
                status: 'open',
                completedDate: null 
            })
            setAlertBanner({ visible: true, kind: 'saved', message: 'Warranty reopened' })
            setTimeout(() => setAlertBanner(b => ({ ...b, visible: false })), 3000)
        } catch (error) {
            console.error('Failed to reopen warranty:', error)
            setAlertBanner({ visible: true, kind: 'danger', message: 'Failed to reopen warranty' })
            setTimeout(() => setAlertBanner(b => ({ ...b, visible: false })), 3000)
        }
    }

    // Handle save inline edits
    const handleSaveEdit = async () => {
        if (!warrantyId) return
        setSaving(true)
        try {
            const updateData = {
                projectId: editFormData.projectId,
                projectName: editFormData.projectName.trim(),
                description: editFormData.description.trim(),
                requestedBy: editFormData.requestedBy.trim(),
                requestedByEmail: editFormData.requestedByEmail.trim() || null,
                assignedTo: editFormData.assignedTo,
                cc: editFormData.cc.filter(id => id !== null && id !== undefined),
                reminderFrequency: editFormData.reminderFrequency,
                startDate: editFormData.startDate ? (editFormData.startDate instanceof Date ? Timestamp.fromDate(editFormData.startDate) : editFormData.startDate) : null,
                expectedCompletionDate: editFormData.expectedCompletionDate ? (editFormData.expectedCompletionDate instanceof Date ? Timestamp.fromDate(editFormData.expectedCompletionDate) : editFormData.expectedCompletionDate) : null,
            }
            await updateWarranty(warrantyId, updateData)
            setIsEditing(false)
            setAlertBanner({ visible: true, kind: 'saved', message: 'Warranty updated successfully' })
            setTimeout(() => setAlertBanner(b => ({ ...b, visible: false })), 3000)
        } catch (error) {
            console.error('Failed to save warranty:', error)
            setAlertBanner({ visible: true, kind: 'danger', message: 'Failed to save warranty' })
            setTimeout(() => setAlertBanner(b => ({ ...b, visible: false })), 3000)
        } finally {
            setSaving(false)
        }
    }

    // Handle cancel edit
    const handleCancelEdit = () => {
        setIsEditing(false)
        setEditFormData({})
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="text-lg font-semibold text-gray-500">Loading warranty...</div>
                </div>
            </div>
        )
    }

    if (!warranty) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="text-lg font-semibold text-gray-500">Warranty not found</div>
                    <Button onClick={() => navigate('/warranty-tracker')} className="mt-4">
                        Back to Warranty Tracker
                    </Button>
                </div>
            </div>
        )
    }

    const statusClass = warranty.status === 'completed' 
        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'

    return (
        <div className="flex flex-col gap-6">
            {/* Alert Banner */}
            {alertBanner.visible && (
                <Alert
                    type={alertBanner.kind}
                    showIcon
                    className="mb-2"
                >
                    {alertBanner.message || (alertBanner.kind === 'saved' ? 'Changes saved successfully' : 'An error occurred')}
                </Alert>
            )}

            {/* Top Action Buttons */}
            <div className="flex items-center justify-between gap-3">
                <Button
                    variant="plain"
                    icon={<HiOutlineArrowLeft />}
                    onClick={() => navigate('/warranty-tracker')}
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                >
                    Back
                </Button>
                <div className="flex items-center gap-2">
                    {warranty.status === 'open' && !isEditing && (
                        <Button
                            variant="solid"
                            icon={<HiOutlineCheckCircle />}
                            onClick={() => setShowCompleteDialog(true)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            Mark as Completed
                        </Button>
                    )}
                    {warranty.status === 'completed' && !isEditing && (
                        <Button
                            variant="twoTone"
                            icon={<HiOutlineRefresh />}
                            onClick={handleReopenWarranty}
                        >
                            Reopen
                        </Button>
                    )}
                    {!isEditing ? (
                        <Button
                            variant="solid"
                            icon={<HiOutlinePencil />}
                            onClick={() => setIsEditing(true)}
                        >
                            Edit
                        </Button>
                    ) : (
                        <div className="flex gap-2">
                            <Button
                                variant="twoTone"
                                icon={<HiOutlineX />}
                                onClick={handleCancelEdit}
                                disabled={saving}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="solid"
                                icon={<HiOutlineCheck />}
                                onClick={handleSaveEdit}
                                loading={saving}
                            >
                                Save
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Header - Project Name and Info */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div>
                    {isEditing ? (
                        <Input
                            value={editFormData.projectName || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, projectName: e.target.value })}
                            placeholder="Project Name"
                            className="text-3xl md:text-4xl font-bold mb-3"
                        />
                    ) : (
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3">
                            {warranty.projectName || 'Warranty Item'}
                        </h1>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                        <Tag className={`${statusClass} px-4 py-1.5 text-sm font-semibold rounded-full`}>
                            {warranty.status === 'completed' ? 'Completed' : 'Open'}
                        </Tag>
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <HiOutlineCalendar className="text-base" />
                            <span>Created {formatDate(warranty.createdAt)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Card */}
            <Card>
                {/* Tabs */}
                <div className="border-b border-gray-200 dark:border-gray-700">
                    <div className="flex gap-2 px-4 md:px-6 overflow-x-auto">
                        <button
                            onClick={() => {
                                setActiveTab('overview')
                                navigate(`/warranty-tracker/${warrantyId}?tab=overview`, { replace: true })
                            }}
                            className={`px-3 md:px-4 py-3 font-medium text-xs md:text-sm border-b-2 transition-colors whitespace-nowrap ${
                                activeTab === 'overview'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                            }`}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('updates')
                                navigate(`/warranty-tracker/${warrantyId}?tab=updates`, { replace: true })
                            }}
                            className={`px-3 md:px-4 py-3 font-medium text-xs md:text-sm border-b-2 transition-colors whitespace-nowrap ${
                                activeTab === 'updates'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                            }`}
                        >
                            Updates ({updates.length})
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('attachments')
                                navigate(`/warranty-tracker/${warrantyId}?tab=attachments`, { replace: true })
                            }}
                            className={`px-3 md:px-4 py-3 font-medium text-xs md:text-sm border-b-2 transition-colors whitespace-nowrap ${
                                activeTab === 'attachments'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                            }`}
                        >
                            <HiOutlinePaperClip className="inline mr-1" />
                            Attachments
                        </button>
                    </div>
                </div>

                {/* Tab Content */}
                <div className="p-4 md:p-6">
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="space-y-8">
                            {/* Description Section */}
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                    <HiOutlineDocumentText className="text-xl text-gray-400 dark:text-gray-500" />
                                    Description
                                </h2>
                                {isEditing ? (
                                    <textarea
                                        value={editFormData.description || ''}
                                        onChange={(e) => {
                                            setEditFormData({ ...editFormData, description: e.target.value })
                                            e.target.style.height = 'auto'
                                            e.target.style.height = `${Math.max(120, e.target.scrollHeight)}px`
                                        }}
                                        placeholder="Describe the warranty issue..."
                                        rows={5}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none min-h-[120px]"
                                        style={{ minHeight: '120px' }}
                                    />
                                ) : (
                                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                            {warranty.description || <span className="text-gray-400 italic">No description provided</span>}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <HiOutlineUser className="text-xl text-gray-400 dark:text-gray-500" />
                                    Request Details
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
                                            Requested By
                                        </label>
                                        {isEditing ? (
                                            <Input
                                                value={editFormData.requestedBy || ''}
                                                onChange={(e) => setEditFormData({ ...editFormData, requestedBy: e.target.value })}
                                                placeholder="Requested By"
                                            />
                                        ) : (
                                            <p className="text-base font-medium text-gray-900 dark:text-white">
                                                {warranty.requestedBy || '-'}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
                                            Email
                                        </label>
                                        {isEditing ? (
                                            <Input
                                                type="email"
                                                value={editFormData.requestedByEmail || ''}
                                                onChange={(e) => setEditFormData({ ...editFormData, requestedByEmail: e.target.value })}
                                                placeholder="Email"
                                            />
                                        ) : warranty.requestedByEmail ? (
                                            <a 
                                                href={`mailto:${warranty.requestedByEmail}`}
                                                className="text-base text-primary hover:underline"
                                            >
                                                {warranty.requestedByEmail}
                                            </a>
                                        ) : (
                                            <p className="text-base font-medium text-gray-400 dark:text-gray-500">-</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <HiOutlineUserGroup className="text-xl text-gray-400 dark:text-gray-500" />
                                    Assigned Team
                                </h2>
                                {isEditing ? (
                                    <Select
                                        isMulti
                                        options={userOptions}
                                        value={userOptions.filter(opt => (editFormData.assignedTo || []).includes(opt.value))}
                                        onChange={(selected) => {
                                            setEditFormData({ 
                                                ...editFormData, 
                                                assignedTo: selected ? selected.map(s => s.value) : [] 
                                            })
                                        }}
                                        placeholder="Select team members"
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={{
                                            menuPortal: (provided) => ({ ...provided, zIndex: 9999 }),
                                            menu: (provided) => ({ ...provided, zIndex: 9999 }),
                                        }}
                                    />
                                ) : (
                                    <div>
                                        {warranty.assignedTo && warranty.assignedTo.length > 0 ? (
                                            <div className="flex flex-wrap gap-3">
                                                {warranty.assignedTo.map((userId) => {
                                                    const user = getUserById(userId)
                                                    if (!user) return null
                                                    const displayName = getUserDisplayName(user)
                                                    return (
                                                        <div 
                                                            key={userId}
                                                            className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700"
                                                        >
                                                            <Avatar
                                                                size={32}
                                                                className={`${bgColor(displayName)} border-2 border-white dark:border-gray-700`}
                                                            >
                                                                {getUserInitials(user)}
                                                            </Avatar>
                                                            <span className="font-medium text-gray-900 dark:text-white">
                                                                {displayName}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-gray-400 dark:text-gray-500">No team members assigned</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <HiOutlineMail className="text-xl text-gray-400 dark:text-gray-500" />
                                    C.C Recipients
                                </h2>
                                {isEditing ? (
                                    <div className="space-y-2">
                                        {(editFormData.cc || []).map((ccUserId, index) => (
                                            <div key={index} className="flex gap-2">
                                                <Select
                                                    placeholder="Select CC recipient"
                                                    options={userOptions}
                                                    value={userOptions.find(opt => opt.value === ccUserId) || null}
                                                    onChange={(selected) => {
                                                        const newCc = [...(editFormData.cc || [])]
                                                        if (selected) {
                                                            newCc[index] = selected.value
                                                        } else {
                                                            newCc.splice(index, 1)
                                                        }
                                                        setEditFormData({ ...editFormData, cc: newCc })
                                                    }}
                                                    className="flex-1"
                                                    isClearable
                                                    menuPortalTarget={document.body}
                                                    menuPosition="fixed"
                                                    styles={{
                                                        menuPortal: (provided) => ({ ...provided, zIndex: 9999 }),
                                                        menu: (provided) => ({ ...provided, zIndex: 9999 }),
                                                    }}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="plain"
                                                    icon={<HiOutlineX />}
                                                    onClick={(e) => {
                                                        e.preventDefault()
                                                        e.stopPropagation()
                                                        const newCc = (editFormData.cc || []).filter((_, i) => i !== index)
                                                        setEditFormData({ ...editFormData, cc: newCc })
                                                    }}
                                                    size="sm"
                                                />
                                            </div>
                                        ))}
                                        <Button
                                            type="button"
                                            variant="twoTone"
                                            icon={<HiOutlinePlus />}
                                            onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                setEditFormData({ 
                                                    ...editFormData, 
                                                    cc: [...(editFormData.cc || []).filter(id => id !== null), null] 
                                                })
                                            }}
                                            size="sm"
                                        >
                                            Add CC Recipient
                                        </Button>
                                    </div>
                                ) : (
                                    <div>
                                        {warranty.cc && warranty.cc.length > 0 ? (
                                            <div className="flex flex-wrap gap-3">
                                                {warranty.cc.map((userId) => {
                                                    const user = getUserById(userId)
                                                    if (!user) return null
                                                    const displayName = getUserDisplayName(user)
                                                    return (
                                                        <div 
                                                            key={userId}
                                                            className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2 border border-blue-200 dark:border-blue-800"
                                                        >
                                                            <Avatar
                                                                size={32}
                                                                className={`${bgColor(displayName)} border-2 border-white dark:border-gray-700`}
                                                            >
                                                                {getUserInitials(user)}
                                                            </Avatar>
                                                            <span className="font-medium text-gray-900 dark:text-white">
                                                                {displayName}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-gray-400 dark:text-gray-500">No CC recipients</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <HiOutlineCalendar className="text-xl text-gray-400 dark:text-gray-500" />
                                    Timeline & Reminders
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
                                            Reminder Frequency
                                        </label>
                                        {isEditing ? (
                                            <Select
                                                options={reminderFrequencyOptions}
                                                value={reminderFrequencyOptions.find(opt => opt.value === editFormData.reminderFrequency)}
                                                onChange={(selected) => {
                                                    setEditFormData({ ...editFormData, reminderFrequency: selected?.value || '5days' })
                                                }}
                                                menuPortalTarget={document.body}
                                                menuPosition="fixed"
                                                styles={{
                                                    menuPortal: (provided) => ({ ...provided, zIndex: 9999 }),
                                                    menu: (provided) => ({ ...provided, zIndex: 9999 }),
                                                }}
                                            />
                                        ) : (
                                            <p className="text-base font-medium text-gray-900 dark:text-white">
                                                {warranty.reminderFrequency === '1day' ? '1 Day' :
                                                 warranty.reminderFrequency === '3days' ? '3 Days' :
                                                 warranty.reminderFrequency === '5days' ? '5 Days' :
                                                 warranty.reminderFrequency === '7days' ? '7 Days' :
                                                 warranty.reminderFrequency === 'weekly' ? '7 Days' : // Legacy support
                                                 '-'}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
                                            Expected Completion Date
                                        </label>
                                        {isEditing ? (
                                            <DatePicker
                                                inputtable
                                                inputtableBlurClose={false}
                                                inputFormat="DD/MM/YYYY"
                                                value={editFormData.expectedCompletionDate}
                                                onChange={(date) => {
                                                    setEditFormData({ ...editFormData, expectedCompletionDate: date })
                                                }}
                                                placeholder="Select expected completion date (optional)"
                                            />
                                        ) : (
                                            <p className="text-base font-medium text-gray-900 dark:text-white">
                                                {warranty.expectedCompletionDate 
                                                    ? formatDateOnly(warranty.expectedCompletionDate) 
                                                    : <span className="text-gray-400 dark:text-gray-500">Not set</span>}
                                            </p>
                                        )}
                                    </div>
                                    {warranty.status === 'completed' && warranty.completedAt && (
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
                                                Completed Date
                                            </label>
                                            <p className="text-base font-medium text-green-600 dark:text-green-400">
                                                {formatDate(warranty.completedAt)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Updates Tab */}
                    {activeTab === 'updates' && (
                    <div className="space-y-8 overflow-x-hidden">
                            {/* Add Update Form */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <HiOutlinePencil className="text-xl text-gray-400 dark:text-gray-500" />
                                    Add New Update
                                </h2>
                                <div className="flex flex-col md:flex-row gap-3">
                                    <textarea
                                        value={newUpdateText}
                                        onChange={(e) => {
                                            setNewUpdateText(e.target.value)
                                            // Auto-resize
                                            e.target.style.height = 'auto'
                                            e.target.style.height = `${Math.max(72, e.target.scrollHeight)}px`
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                                e.preventDefault()
                                                handleAddUpdate()
                                            }
                                        }}
                                        placeholder="Enter update note (Ctrl+Enter to submit)..."
                                        rows={3}
                                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none min-h-[72px]"
                                        style={{ minHeight: '72px' }}
                                    />
                                    <Button
                                        variant="solid"
                                        onClick={handleAddUpdate}
                                        loading={addingUpdate}
                                        disabled={!newUpdateText.trim()}
                                        className="px-6 self-start md:self-start w-full md:w-auto"
                                    >
                                        Add Update
                                    </Button>
                                </div>
                                
                                {/* CC Recipients for Update */}
                                <div className="mt-4">
                                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                                        C.C (Optional)
                                    </label>
                                    <div className="space-y-2">
                                        {updateCc.map((ccUserId, index) => (
                                            <div key={index} className="flex gap-2">
                                                <Select
                                                    placeholder="Select CC recipient"
                                                    options={userOptions}
                                                    value={userOptions.find(opt => opt.value === ccUserId) || null}
                                                    onChange={(selected) => {
                                                        const newCc = [...updateCc]
                                                        if (selected) {
                                                            newCc[index] = selected.value
                                                        } else {
                                                            newCc.splice(index, 1)
                                                        }
                                                        setUpdateCc(newCc)
                                                    }}
                                                    className="flex-1"
                                                    isClearable
                                                />
                                                <Button
                                                    type="button"
                                                    variant="plain"
                                                    icon={<HiOutlineX />}
                                                    onClick={(e) => {
                                                        e.preventDefault()
                                                        e.stopPropagation()
                                                        const newCc = updateCc.filter((_, i) => i !== index)
                                                        setUpdateCc(newCc)
                                                    }}
                                                    size="sm"
                                                />
                                            </div>
                                        ))}
                                        <Button
                                            type="button"
                                            variant="twoTone"
                                            icon={<HiOutlinePlus />}
                                            onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                setUpdateCc([...updateCc.filter(id => id !== null), null])
                                            }}
                                            size="sm"
                                        >
                                            Add CC Recipient
                                        </Button>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">CC recipients will receive email notifications for this update</p>
                                </div>
                                
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Press Ctrl+Enter to submit</p>
                            </div>

                            {/* Updates List */}
                            <div className="space-y-6 min-w-0">
                                {updates.length === 0 ? (
                                    <>
                                        {/* Created Warranty only (no updates yet) */}
                                        {warranty && (
                                            <div className="relative flex gap-2 md:gap-4">
                                                <div className="relative z-10 flex-shrink-0 hidden md:block md:ml-1">
                                                    <Avatar
                                                        size={40}
                                                        className={`${bgColor(getUserDisplayName(getUserById(warranty.createdBy)))} border-4 border-white dark:border-gray-900 shadow-md`}
                                                    >
                                                        {getUserInitials(getUserById(warranty.createdBy))}
                                                    </Avatar>
                                                </div>
                                                <Card className="flex-1 shadow-md min-w-0">
                                                    <div className="p-3 md:p-5">
                                                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0 mb-3">
                                                            <div className="flex flex-col md:flex-row md:items-center gap-2">
                                                                <span className="font-semibold text-gray-900 dark:text-white">
                                                                    {getUserDisplayName(getUserById(warranty.createdBy))}
                                                                </span>
                                                                <Tag className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 w-fit">
                                                                    Created Warranty
                                                                </Tag>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                                                <HiOutlineClock className="text-base" />
                                                                <span>{formatDate(warranty.createdAt)}</span>
                                                            </div>
                                                        </div>
                                                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 md:p-4">
                                                            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed break-words">
                                                                {warranty.description || <span className="text-gray-400 italic">No description provided</span>}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </Card>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {/* Latest Update (always on top, highlighted) */}
                                        <div className="relative">
                                            <div className="relative flex gap-2 md:gap-4">
                                                <div className="relative z-10 flex-shrink-0 hidden md:block md:ml-1">
                                                    <Avatar
                                                        size={40}
                                                        className={`${bgColor(getUserDisplayName(getUserById(updates[0].createdBy)))} border-4 border-white dark:border-gray-900 shadow-md ring-2 ring-primary`}
                                                    >
                                                        {getUserInitials(getUserById(updates[0].createdBy))}
                                                    </Avatar>
                                                </div>
                                                <Card className="flex-1 shadow-lg border-2 border-primary min-w-0">
                                                    <div className="p-3 md:p-5">
                                                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0 mb-3">
                                                            <div className="flex flex-col md:flex-row md:items-center gap-2">
                                                                <span className="font-semibold text-gray-900 dark:text-white">
                                                                    {updates[0].createdByName || getUserDisplayName(getUserById(updates[0].createdBy))}
                                                                </span>
                                                                <Tag className="bg-primary text-white w-fit">
                                                                    Latest Update
                                                                </Tag>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                                                <HiOutlineClock className="text-base" />
                                                                <span>{formatDate(updates[0].createdAt)}</span>
                                                            </div>
                                                        </div>
                                                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 md:p-4">
                                                            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed break-words">
                                                                {updates[0].note}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </Card>
                                            </div>
                                        </div>

                                        {/* Previous updates, newest to oldest, same visual style but without the "Latest" tag */}
                                        {updates.slice(1).map((update) => {
                                            const updateUser = getUserById(update.createdBy)
                                            const displayName = update.createdByName || getUserDisplayName(updateUser)
                                            const updateDate = formatDate(update.createdAt)

                                            return (
                                                <div key={update.id} className="relative flex gap-2 md:gap-4">
                                                    <div className="relative z-10 flex-shrink-0 hidden md:block md:ml-1">
                                                        <Avatar
                                                            size={40}
                                                            className={`${bgColor(displayName)} border-4 border-white dark:border-gray-900 shadow-md`}
                                                        >
                                                            {update.createdByName ? acronym(update.createdByName) : getUserInitials(updateUser)}
                                                        </Avatar>
                                                    </div>
                                                    <Card className="flex-1 shadow-md min-w-0">
                                                        <div className="p-3 md:p-5">
                                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0 mb-3">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-semibold text-gray-900 dark:text-white">
                                                                        {displayName}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                                                    <HiOutlineClock className="text-base" />
                                                                    <span>{updateDate}</span>
                                                                </div>
                                                            </div>
                                                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 md:p-4">
                                                                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed break-words">
                                                                    {update.note}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                </div>
                                            )
                                        })}

                                        {/* Original warranty request (created warranty) - always last */}
                                        {warranty && (
                                            <div className="relative flex gap-2 md:gap-4">
                                                <div className="relative z-10 flex-shrink-0 hidden md:block md:ml-1">
                                                    <Avatar
                                                        size={40}
                                                        className={`${bgColor(getUserDisplayName(getUserById(warranty.createdBy)))} border-4 border-white dark:border-gray-900 shadow-md`}
                                                    >
                                                        {getUserInitials(getUserById(warranty.createdBy))}
                                                    </Avatar>
                                                </div>
                                                <Card className="flex-1 shadow-md min-w-0">
                                                    <div className="p-3 md:p-5">
                                                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0 mb-3">
                                                            <div className="flex flex-col md:flex-row md:items-center gap-2">
                                                                <span className="font-semibold text-gray-900 dark:text-white">
                                                                    {getUserDisplayName(getUserById(warranty.createdBy))}
                                                                </span>
                                                                <Tag className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 w-fit">
                                                                    Created Warranty
                                                                </Tag>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                                                <HiOutlineClock className="text-base" />
                                                                <span>{formatDate(warranty.createdAt)}</span>
                                                            </div>
                                                        </div>
                                                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 md:p-4">
                                                            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed break-words">
                                                                {warranty.description || <span className="text-gray-400 italic">No description provided</span>}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </Card>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Activity Timeline (unified activity stream: creation, updates, attachments, etc.) */}
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                    Activity Timeline
                                </h2>
                                <ActivitiesTimeline entityType="warranty" entityId={warrantyId} />
                            </div>
                        </div>
                    )}

                    {/* Attachments Tab */}
                    {activeTab === 'attachments' && (
                        <AttachmentsManager entityType="warranty" entityId={warrantyId} />
                    )}
                </div>
            </Card>

            {/* Edit Modal - Only render when mounted to prevent duplicate registration */}

            {/* Complete Warranty Dialog */}
            <Dialog
                isOpen={showCompleteDialog}
                onClose={() => setShowCompleteDialog(false)}
                width={400}
            >
                <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Mark as Completed</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Are you sure you want to mark this warranty item as completed? This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="plain"
                            onClick={() => setShowCompleteDialog(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="solid"
                            onClick={handleCompleteWarranty}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            Mark as Completed
                        </Button>
                    </div>
                </div>
            </Dialog>
        </div>
    )
}

export default WarrantyDetail

