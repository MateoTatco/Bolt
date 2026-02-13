import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router'
import { Card, Button, Input, Select, FormContainer, FormItem, Tag, Alert, Avatar, DatePicker } from '@/components/ui'
import { 
    HiOutlineArrowLeft, 
    HiOutlinePencil, 
    HiOutlineCheck, 
    HiOutlineX,
    HiOutlineClock,
    HiOutlinePaperClip,
    HiOutlineDocumentText,
    HiOutlineOfficeBuilding,
    HiOutlineUserGroup,
    HiOutlineCheckCircle,
    HiOutlineCalendar,
    HiOutlineDownload,
    HiOutlineSearch,
    HiOutlineFilter,
} from 'react-icons/hi'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { useCrewJobStore } from '@/store/crewJobStore'
import { useCrewEmployeeStore } from '@/store/crewEmployeeStore'
import ActivitiesTimeline from '@/components/Activities/ActivitiesTimeline'
import AttachmentsManager from '@/components/Attachments/AttachmentsManager'
import { toast } from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { collection, query, orderBy, onSnapshot, doc } from 'firebase/firestore'
import { db } from '@/configs/firebase.config'
import { Timestamp } from 'firebase/firestore'
import { getCurrentUserId } from '@/utils/notificationHelper'
import acronym from '@/utils/acronym'
import useRandomBgColor from '@/utils/hooks/useRandomBgColor'
import * as XLSX from 'xlsx'

const JobDetail = () => {
    const { jobId } = useParams()
    const navigate = useNavigate()
    const location = useLocation()
    const [job, setJob] = useState(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('overview')
    const [updates, setUpdates] = useState([])
    const [newUpdateText, setNewUpdateText] = useState('')
    const [addingUpdate, setAddingUpdate] = useState(false)
    const [alertBanner, setAlertBanner] = useState({ visible: false, kind: 'saved' })
    const [isEditing, setIsEditing] = useState(false)
    const [editFormData, setEditFormData] = useState({})
    const [saving, setSaving] = useState(false)
    const [employees, setEmployees] = useState([])
    const [users, setUsers] = useState([])
    
    // Filter state for Updates tab
    const [updateSearchText, setUpdateSearchText] = useState('')
    const [updateDateFrom, setUpdateDateFrom] = useState(null)
    const [updateDateTo, setUpdateDateTo] = useState(null)
    const [updateCreatorFilter, setUpdateCreatorFilter] = useState(null)
    
    const { updateJob } = useCrewJobStore()
    const { employees: allEmployees, loadEmployees } = useCrewEmployeeStore()
    const bgColor = useRandomBgColor()

    // Load users for display
    useEffect(() => {
        const loadUsers = async () => {
            try {
                const response = await FirebaseDbService.users.getAll()
                if (response.success) {
                    setUsers(response.data || [])
                }
            } catch (error) {
                console.error('Failed to load users:', error)
            }
        }
        loadUsers()
    }, [])

    // Load employees
    useEffect(() => {
        loadEmployees()
    }, [loadEmployees])

    useEffect(() => {
        if (allEmployees.length > 0) {
            setEmployees(allEmployees)
        }
    }, [allEmployees])

    // Load job data
    useEffect(() => {
        const loadJob = async () => {
            if (!jobId) return
            setLoading(true)
            try {
                const response = await FirebaseDbService.crewJobs.getById(jobId)
                if (response.success) {
                    setJob(response.data)
                } else {
                    console.error('Failed to load job:', response.error)
                    setTimeout(() => {
                        navigate('/crew-tracker')
                    }, 2000)
                }
            } catch (error) {
                console.error('Error loading job:', error)
            } finally {
                setLoading(false)
            }
        }
        loadJob()
    }, [jobId, navigate])

    // Setup real-time listener for job
    useEffect(() => {
        if (!jobId) return
        const jobRef = doc(db, 'crewJobs', jobId)
        const unsubscribe = onSnapshot(jobRef, (snap) => {
            if (snap.exists()) {
                setJob({ id: snap.id, ...snap.data() })
            }
        }, (error) => {
            console.error('Job listener error:', error)
        })
        return () => unsubscribe()
    }, [jobId])

    // Setup real-time listener for updates
    useEffect(() => {
        if (!jobId) return
        const updatesRef = collection(db, 'crewJobs', jobId, 'updates')
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
    }, [jobId])

    // Initialize edit form data when entering edit mode
    useEffect(() => {
        if (isEditing && job) {
            setEditFormData({
                name: job.name || '',
                address: job.address || '',
                tasks: job.tasks || '',
                status: job.status || (job.active === false ? 'Inactive' : 'In Progress'),
                assignedEmployees: job.assignedEmployees || [],
                expectedCompletionDate: job.expectedCompletionDate?.toDate ? job.expectedCompletionDate.toDate() : (job.expectedCompletionDate || null),
            })
        }
    }, [isEditing, job])

    // Handle tab query parameter
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const tab = params.get('tab')
        if (tab && ['overview', 'updates', 'attachments'].includes(tab)) {
            setActiveTab(tab)
        }
    }, [location.search])

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

    // Get employee by ID
    const getEmployeeById = (employeeId) => {
        return employees.find(emp => emp.id === employeeId)
    }

    // Get user by ID
    const getUserById = (userId) => {
        return users.find(u => u.id === userId || u.uid === userId)
    }

    // Get user display name
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

    const safeFileNamePart = (str) => {
        if (!str) return 'job'
        return String(str).replace(/[^a-z0-9_\-]+/gi, '_').substring(0, 50)
    }

    // Employee options for selects
    const employeeOptions = useMemo(() => {
        return employees
            .filter(emp => emp.active !== false)
            .map(emp => ({
                value: emp.id,
                label: emp.name,
            }))
    }, [employees])

    // Handle add update
    const handleAddUpdate = async () => {
        if (!newUpdateText.trim() || !jobId) return
        
        setAddingUpdate(true)
        try {
            const currentUserId = getCurrentUserId()
            const currentUser = currentUserId ? getUserById(currentUserId) : null
            const displayName = currentUser ? getUserDisplayName(currentUser) : 'Unknown User'
            
            const updateData = {
                note: newUpdateText.trim(),
                createdBy: currentUserId || 'unknown',
                createdByName: displayName,
            }
            
            const response = await FirebaseDbService.crewJobs.addUpdate(jobId, updateData)
            if (response.success) {
                setNewUpdateText('')
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

    // Handle save inline edits
    const handleSaveEdit = async () => {
        if (!jobId) return
        setSaving(true)
        try {
            const jobData = {
                name: editFormData.name.trim(),
                address: editFormData.address.trim(),
                tasks: (editFormData.tasks || '').trim() || null,
                status: editFormData.status || (job.status || (job.active === false ? 'Inactive' : 'In Progress')),
                assignedEmployees: editFormData.assignedEmployees || [],
                expectedCompletionDate: editFormData.expectedCompletionDate 
                    ? (editFormData.expectedCompletionDate instanceof Date 
                        ? Timestamp.fromDate(editFormData.expectedCompletionDate) 
                        : editFormData.expectedCompletionDate)
                    : null,
            }
            await updateJob(jobId, jobData)
            setIsEditing(false)
            setAlertBanner({ visible: true, kind: 'saved', message: 'Job updated successfully' })
            setTimeout(() => setAlertBanner(b => ({ ...b, visible: false })), 3000)
        } catch (error) {
            console.error('Failed to save job:', error)
            setAlertBanner({ visible: true, kind: 'danger', message: 'Failed to save job' })
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

    // Filter updates based on search criteria
    const filteredUpdates = useMemo(() => {
        let filtered = [...updates]

        // Text search filter
        if (updateSearchText.trim()) {
            const searchLower = updateSearchText.toLowerCase()
            filtered = filtered.filter(update => {
                const note = (update.note || '').toLowerCase()
                const creatorName = (update.createdByName || '').toLowerCase()
                const updateUser = getUserById(update.createdBy)
                const displayName = getUserDisplayName(updateUser).toLowerCase()
                return note.includes(searchLower) || creatorName.includes(searchLower) || displayName.includes(searchLower)
            })
        }

        // Date range filter
        if (updateDateFrom || updateDateTo) {
            filtered = filtered.filter(update => {
                if (!update.createdAt) return false
                const updateDate = update.createdAt.toDate ? update.createdAt.toDate() : new Date(update.createdAt)
                
                if (updateDateFrom) {
                    const fromDate = new Date(updateDateFrom)
                    fromDate.setHours(0, 0, 0, 0)
                    if (updateDate < fromDate) return false
                }
                
                if (updateDateTo) {
                    const toDate = new Date(updateDateTo)
                    toDate.setHours(23, 59, 59, 999)
                    if (updateDate > toDate) return false
                }
                
                return true
            })
        }

        // Creator filter
        if (updateCreatorFilter) {
            filtered = filtered.filter(update => {
                return update.createdBy === updateCreatorFilter
            })
        }

        return filtered
    }, [updates, updateSearchText, updateDateFrom, updateDateTo, updateCreatorFilter, getUserById, getUserDisplayName])

    // Get unique creators for filter dropdown
    const updateCreators = useMemo(() => {
        const creatorMap = new Map()
        updates.forEach(update => {
            const updateUser = getUserById(update.createdBy)
            const storedName = update.createdByName
            const displayName = (storedName && storedName !== 'User')
                ? storedName
                : getUserDisplayName(updateUser)
            const userId = update.createdBy
            
            if (userId && !creatorMap.has(userId)) {
                creatorMap.set(userId, {
                    value: userId,
                    label: displayName,
                })
            }
        })
        return Array.from(creatorMap.values()).sort((a, b) => a.label.localeCompare(b.label))
    }, [updates, getUserById, getUserDisplayName])

    const handleExportUpdatesToExcel = () => {
        try {
            // Export filtered updates if filters are active, otherwise all updates
            const updatesToExport = filteredUpdates.length < updates.length ? filteredUpdates : updates

            if (!job && updatesToExport.length === 0) {
                alert('Nothing to export for this job.')
                return
            }

            const exportRows = []

            // Include job creation as a baseline row (only if no date filter or job creation is in range)
            if (job) {
                let includeJobCreation = true
                if (updateDateFrom || updateDateTo) {
                    const jobDate = job.createdAt?.toDate ? job.createdAt.toDate() : new Date(job.createdAt)
                    if (updateDateFrom) {
                        const fromDate = new Date(updateDateFrom)
                        fromDate.setHours(0, 0, 0, 0)
                        if (jobDate < fromDate) includeJobCreation = false
                    }
                    if (updateDateTo) {
                        const toDate = new Date(updateDateTo)
                        toDate.setHours(23, 59, 59, 999)
                        if (jobDate > toDate) includeJobCreation = false
                    }
                }
                
                if (includeJobCreation && (!updateCreatorFilter || job.createdBy === updateCreatorFilter)) {
                    const creatorUser = getUserById(job.createdBy)
                    const creatorName = getUserDisplayName(creatorUser)
                    exportRows.push({
                        'Job Name': job.name || 'Job',
                        'Update Type': 'Job Created',
                        'Note': `Job created: ${job.name || ''}`.trim(),
                        'Created By': creatorName,
                        'Created At': formatDate(job.createdAt),
                    })
                }
            }

            // Add each update entry
            updatesToExport.forEach((update) => {
                const updateUser = getUserById(update.createdBy)
                const storedName = update.createdByName
                const displayName =
                    storedName && storedName !== 'User'
                        ? storedName
                        : getUserDisplayName(updateUser)

                exportRows.push({
                    'Job Name': job?.name || 'Job',
                    'Update Type': 'Update',
                    'Note': update.note || '',
                    'Created By': displayName,
                    'Created At': formatDate(update.createdAt),
                })
            })

            if (exportRows.length === 0) {
                alert('No updates match the current filters.')
                return
            }

            const ws = XLSX.utils.json_to_sheet(exportRows)
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'Updates')

            const jobPart = safeFileNamePart(job?.name || jobId)
            const today = new Date().toISOString().split('T')[0]
            const filterSuffix = (updateSearchText || updateDateFrom || updateDateTo || updateCreatorFilter) ? '_filtered' : ''
            const filename = `Job_Updates_${jobPart}_${today}${filterSuffix}.xlsx`

            XLSX.writeFile(wb, filename)
        } catch (error) {
            console.error('Failed to export job updates to Excel:', error)
            alert('Failed to export job updates. Please try again.')
        }
    }

    const clearUpdateFilters = () => {
        setUpdateSearchText('')
        setUpdateDateFrom(null)
        setUpdateDateTo(null)
        setUpdateCreatorFilter(null)
    }

    const hasActiveFilters = updateSearchText.trim() || updateDateFrom || updateDateTo || updateCreatorFilter

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="text-lg font-semibold text-gray-500">Loading job...</div>
                </div>
            </div>
        )
    }

    if (!job) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="text-lg font-semibold text-gray-500">Job not found</div>
                    <Button onClick={() => navigate('/crew-tracker')} className="mt-4">
                        Back to Crew Tracker
                    </Button>
                </div>
            </div>
        )
    }

    const currentStatus = job.status || (job.active === false ? 'Inactive' : 'In Progress')
    const statusClass = currentStatus === 'Inactive'
        ? 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'

    const googleMapsUrl = job.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}` : null

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
                    onClick={() => navigate('/crew-tracker')}
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                >
                    Back
                </Button>
                <div className="flex items-center gap-2">
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

            {/* Header - Job Name and Info */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div>
                    {isEditing ? (
                        <Input
                            value={editFormData.name || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                            placeholder="Job Name"
                            className="text-3xl md:text-4xl font-bold mb-3"
                        />
                    ) : (
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3">
                            {job.name || 'Job'}
                        </h1>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                        <Tag className={`${statusClass} px-4 py-1.5 text-sm font-semibold rounded-full`}>
                            {job.active !== false ? 'Active' : 'Inactive'}
                        </Tag>
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <HiOutlineClock className="text-base" />
                            <span>Created {formatDate(job.createdAt)}</span>
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
                                navigate(`/crew-tracker/jobs/${jobId}?tab=overview`, { replace: true })
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
                                navigate(`/crew-tracker/jobs/${jobId}?tab=updates`, { replace: true })
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
                                navigate(`/crew-tracker/jobs/${jobId}?tab=attachments`, { replace: true })
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
                            {/* Address Section */}
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                    <HiOutlineOfficeBuilding className="text-xl text-gray-400 dark:text-gray-500" />
                                    Address
                                </h2>
                                {isEditing ? (
                                    <Input
                                        value={editFormData.address || ''}
                                        onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                                        placeholder="Enter job address"
                                    />
                                ) : (
                                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                                        {job.address ? (
                                            <a
                                                href={googleMapsUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary hover:underline text-base"
                                            >
                                                {job.address}
                                            </a>
                                        ) : (
                                            <span className="text-gray-400 italic">No address provided</span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Scheduled Tasks Section */}
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                    <HiOutlineDocumentText className="text-xl text-gray-400 dark:text-gray-500" />
                                    Scheduled Tasks
                                </h2>
                                {isEditing ? (
                                    <Input
                                        textArea
                                        value={editFormData.tasks || ''}
                                        onChange={(e) => setEditFormData({ ...editFormData, tasks: e.target.value })}
                                        placeholder="Enter scheduled tasks..."
                                        rows={5}
                                    />
                                ) : (
                                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                                            {job.tasks || <span className="text-gray-400 italic">No tasks provided</span>}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Assigned Employees Section */}
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <HiOutlineUserGroup className="text-xl text-gray-400 dark:text-gray-500" />
                                    Assigned Employees
                                </h2>
                                {isEditing ? (
                                    <Select
                                        isMulti
                                        options={employeeOptions}
                                        value={employeeOptions.filter(opt => (editFormData.assignedEmployees || []).includes(opt.value))}
                                        onChange={(selected) => {
                                            setEditFormData({ 
                                                ...editFormData, 
                                                assignedEmployees: selected ? selected.map(s => s.value) : [] 
                                            })
                                        }}
                                        placeholder="Select employees (active only)"
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={{
                                            menuPortal: (provided) => ({ ...provided, zIndex: 9999 }),
                                            menu: (provided) => ({ ...provided, zIndex: 9999 }),
                                        }}
                                    />
                                ) : (
                                    <div>
                                        {job.assignedEmployees && job.assignedEmployees.length > 0 ? (
                                            <div className="flex flex-wrap gap-3">
                                                {job.assignedEmployees.map((employeeId) => {
                                                    const employee = getEmployeeById(employeeId)
                                                    if (!employee) return null
                                                    return (
                                                        <div 
                                                            key={employeeId}
                                                            className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700"
                                                        >
                                                            <Avatar
                                                                size={32}
                                                                className={`${bgColor(employee.name)} border-2 border-white dark:border-gray-700`}
                                                            >
                                                                {acronym(employee.name)}
                                                            </Avatar>
                                                            <span className="font-medium text-gray-900 dark:text-white">
                                                                {employee.name}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-gray-400 dark:text-gray-500">No employees assigned</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Expected Completion Date Section */}
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <HiOutlineCalendar className="text-xl text-gray-400 dark:text-gray-500" />
                                    Expected Completion Date
                                </h2>
                                {isEditing ? (
                                    <DatePicker
                                        inputtable
                                        inputtableBlurClose={false}
                                        inputFormat="MM/DD/YYYY"
                                        value={editFormData.expectedCompletionDate}
                                        onChange={(date) => {
                                            setEditFormData({ ...editFormData, expectedCompletionDate: date })
                                        }}
                                        placeholder="Select expected completion date (optional)"
                                    />
                                ) : (
                                    <p className="text-base font-medium text-gray-900 dark:text-white">
                                        {job.expectedCompletionDate 
                                            ? formatDateOnly(job.expectedCompletionDate) 
                                            : <span className="text-gray-400 dark:text-gray-500">Not set</span>}
                                    </p>
                                )}
                            </div>

                            {/* Status Section */}
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <HiOutlineCheckCircle className="text-xl text-gray-400 dark:text-gray-500" />
                                    Status
                                </h2>
                                {isEditing ? (
                                    <Select
                                        options={[
                                            { value: 'Proposal', label: 'Proposal' },
                                            { value: 'In Progress', label: 'In Progress' },
                                            { value: 'Request', label: 'Request' },
                                            { value: 'Draft', label: 'Draft' },
                                            { value: 'Inactive', label: 'Inactive' },
                                        ]}
                                        value={(() => {
                                            const options = [
                                                { value: 'Proposal', label: 'Proposal' },
                                                { value: 'In Progress', label: 'In Progress' },
                                                { value: 'Request', label: 'Request' },
                                                { value: 'Draft', label: 'Draft' },
                                                { value: 'Inactive', label: 'Inactive' },
                                            ]
                                            const currentValue = editFormData.status || currentStatus
                                            return options.find(opt => opt.value === currentValue) || options[1]
                                        })()}
                                        onChange={(selected) => {
                                            if (selected) {
                                                setEditFormData({ ...editFormData, status: selected.value })
                                            }
                                        }}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={{
                                            menuPortal: (provided) => ({ ...provided, zIndex: 9999 }),
                                            menu: (provided) => ({ ...provided, zIndex: 9999 }),
                                        }}
                                    />
                                ) : (
                                    <Tag className={statusClass}>
                                        {currentStatus}
                                    </Tag>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Updates Tab */}
                    {activeTab === 'updates' && (
                        <div className="space-y-8 overflow-x-hidden">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                                    Job updates {filteredUpdates.length !== updates.length && (
                                        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                                            ({filteredUpdates.length} of {updates.length})
                                        </span>
                                    )}
                                </h2>
                                <Button
                                    variant="twoTone"
                                    size="sm"
                                    icon={<HiOutlineDownload />}
                                    onClick={handleExportUpdatesToExcel}
                                >
                                    Export to Excel
                                </Button>
                            </div>

                            {/* Search and Filter Controls */}
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-700/50 p-4 space-y-4 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <HiOutlineFilter className="text-lg text-blue-600 dark:text-blue-400" />
                                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">Filter Updates</h3>
                                    {hasActiveFilters && (
                                        <Button
                                            variant="plain"
                                            size="sm"
                                            onClick={clearUpdateFilters}
                                            className="ml-auto text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                                        >
                                            Clear Filters
                                        </Button>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                                            Search Text
                                        </label>
                                        <Input
                                            placeholder="Search in notes..."
                                            value={updateSearchText}
                                            onChange={(e) => setUpdateSearchText(e.target.value)}
                                            prefix={<HiOutlineSearch className="text-blue-500" />}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                                            From Date
                                        </label>
                                        <DatePicker
                                            inputtable
                                            inputtableBlurClose={false}
                                            inputFormat="MM/DD/YYYY"
                                            value={updateDateFrom}
                                            onChange={(date) => setUpdateDateFrom(date)}
                                            placeholder="Start date"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                                            To Date
                                        </label>
                                        <DatePicker
                                            inputtable
                                            inputtableBlurClose={false}
                                            inputFormat="MM/DD/YYYY"
                                            value={updateDateTo}
                                            onChange={(date) => setUpdateDateTo(date)}
                                            placeholder="End date"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                                            Created By
                                        </label>
                                        <Select
                                            isClearable
                                            placeholder="All creators"
                                            options={updateCreators}
                                            value={updateCreators.find(opt => opt.value === updateCreatorFilter) || null}
                                            onChange={(option) => setUpdateCreatorFilter(option?.value || null)}
                                            menuPortalTarget={document.body}
                                            menuPosition="fixed"
                                            styles={{
                                                menuPortal: (provided) => ({ ...provided, zIndex: 9999 }),
                                                menu: (provided) => ({ ...provided, zIndex: 9999 }),
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

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
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Press Ctrl+Enter to submit</p>
                            </div>

                            {/* Updates List */}
                            <div className="space-y-6 min-w-0">
                                {filteredUpdates.length === 0 && updates.length > 0 ? (
                                    <div className="text-center py-8">
                                        <p className="text-gray-500 dark:text-gray-400">
                                            No updates match the current filters.
                                        </p>
                                        <Button
                                            variant="plain"
                                            size="sm"
                                            onClick={clearUpdateFilters}
                                            className="mt-2"
                                        >
                                            Clear Filters
                                        </Button>
                                    </div>
                                ) : filteredUpdates.length === 0 ? (
                                    <>
                                        {job && (() => {
                                            const creatorUser = getUserById(job.createdBy)
                                            const creatorName = getUserDisplayName(creatorUser)
                                            return (
                                                <div className="relative flex gap-2 md:gap-4">
                                                    <div className="relative z-10 flex-shrink-0 hidden md:block md:ml-1">
                                                        <Avatar
                                                            size={40}
                                                            className={`${bgColor(creatorName)} border-4 border-white dark:border-gray-900 shadow-md`}
                                                        >
                                                            {getUserInitials(creatorUser)}
                                                        </Avatar>
                                                    </div>
                                                    <Card className="flex-1 shadow-md min-w-0">
                                                        <div className="p-3 md:p-5">
                                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0 mb-3">
                                                                <div className="flex flex-col md:flex-row md:items-center gap-2">
                                                                    <span className="font-semibold text-gray-900 dark:text-white">
                                                                        {creatorName}
                                                                    </span>
                                                                    <Tag className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 w-fit">
                                                                        Job Created
                                                                    </Tag>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                                                    <HiOutlineClock className="text-base" />
                                                                    <span>{formatDate(job.createdAt)}</span>
                                                                </div>
                                                            </div>
                                                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 md:p-4">
                                                                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed break-words">
                                                                    Job created: {job.name}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                </div>
                                            )
                                        })()}
                                    </>
                                ) : (
                                    <>
                                        {/* Latest Update (if filtered list has items) */}
                                        {filteredUpdates.length > 0 && (() => {
                                            const latestUpdate = filteredUpdates[0]
                                            const updateUser = getUserById(latestUpdate.createdBy)
                                            const storedName = latestUpdate.createdByName
                                            const displayName = (storedName && storedName !== 'User') 
                                                ? storedName 
                                                : getUserDisplayName(updateUser)
                                            const isLatestInAll = updates.length > 0 && latestUpdate.id === updates[0].id
                                            
                                            return (
                                                <div className="relative">
                                                    <div className="relative flex gap-2 md:gap-4">
                                                        <div className="relative z-10 flex-shrink-0 hidden md:block md:ml-1">
                                                            <Avatar
                                                                size={40}
                                                                className={`${bgColor(displayName)} border-4 border-white dark:border-gray-900 shadow-md ${isLatestInAll ? 'ring-2 ring-primary' : ''}`}
                                                            >
                                                                {acronym(displayName)}
                                                            </Avatar>
                                                        </div>
                                                        <Card className={`flex-1 min-w-0 ${isLatestInAll ? 'shadow-lg border-2 border-primary' : 'shadow-md'}`}>
                                                            <div className="p-3 md:p-5">
                                                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0 mb-3">
                                                                    <div className="flex flex-col md:flex-row md:items-center gap-2">
                                                                        <span className="font-semibold text-gray-900 dark:text-white">
                                                                            {displayName}
                                                                        </span>
                                                                        {isLatestInAll && (
                                                                            <Tag className="bg-primary text-white w-fit">
                                                                                Latest Update
                                                                            </Tag>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                                                        <HiOutlineClock className="text-base" />
                                                                        <span>{formatDate(latestUpdate.createdAt)}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 md:p-4">
                                                                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed break-words">
                                                                        {latestUpdate.note}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </Card>
                                                    </div>
                                                </div>
                                            )
                                        })()}

                                        {/* Previous updates */}
                                        {filteredUpdates.slice(1).map((update) => {
                                            const updateUser = getUserById(update.createdBy)
                                            const storedName = update.createdByName
                                            // If stored name is "User" or empty, use actual user lookup
                                            const displayName = (storedName && storedName !== 'User') 
                                                ? storedName 
                                                : getUserDisplayName(updateUser)
                                            return (
                                                <div key={update.id} className="relative flex gap-2 md:gap-4">
                                                    <div className="relative z-10 flex-shrink-0 hidden md:block md:ml-1">
                                                        <Avatar
                                                            size={40}
                                                            className={`${bgColor(displayName)} border-4 border-white dark:border-gray-900 shadow-md`}
                                                        >
                                                            {acronym(displayName)}
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
                                                                    <span>{formatDate(update.createdAt)}</span>
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

                                        {/* Original job creation (show if it passes filters) */}
                                        {job && (() => {
                                            // Check if job creation should be shown based on filters
                                            let showJobCreation = true
                                            
                                            // Date range filter
                                            if (updateDateFrom || updateDateTo) {
                                                const jobDate = job.createdAt?.toDate ? job.createdAt.toDate() : new Date(job.createdAt)
                                                if (updateDateFrom) {
                                                    const fromDate = new Date(updateDateFrom)
                                                    fromDate.setHours(0, 0, 0, 0)
                                                    if (jobDate < fromDate) showJobCreation = false
                                                }
                                                if (updateDateTo) {
                                                    const toDate = new Date(updateDateTo)
                                                    toDate.setHours(23, 59, 59, 999)
                                                    if (jobDate > toDate) showJobCreation = false
                                                }
                                            }
                                            
                                            // Creator filter
                                            if (updateCreatorFilter && job.createdBy !== updateCreatorFilter) {
                                                showJobCreation = false
                                            }
                                            
                                            // Text search filter
                                            if (updateSearchText.trim()) {
                                                const searchLower = updateSearchText.toLowerCase()
                                                const jobName = (job.name || '').toLowerCase()
                                                const creatorUser = getUserById(job.createdBy)
                                                const creatorName = getUserDisplayName(creatorUser).toLowerCase()
                                                if (!jobName.includes(searchLower) && !creatorName.includes(searchLower)) {
                                                    showJobCreation = false
                                                }
                                            }
                                            
                                            if (!showJobCreation) return null
                                            
                                            const creatorUser = getUserById(job.createdBy)
                                            const creatorName = getUserDisplayName(creatorUser)
                                            return (
                                                <div key="job-creation" className="relative flex gap-2 md:gap-4">
                                                    <div className="relative z-10 flex-shrink-0 hidden md:block md:ml-1">
                                                        <Avatar
                                                            size={40}
                                                            className={`${bgColor(creatorName)} border-4 border-white dark:border-gray-900 shadow-md`}
                                                        >
                                                            {getUserInitials(creatorUser)}
                                                        </Avatar>
                                                    </div>
                                                    <Card className="flex-1 shadow-md min-w-0">
                                                        <div className="p-3 md:p-5">
                                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0 mb-3">
                                                                <div className="flex flex-col md:flex-row md:items-center gap-2">
                                                                    <span className="font-semibold text-gray-900 dark:text-white">
                                                                        {creatorName}
                                                                    </span>
                                                                    <Tag className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 w-fit">
                                                                        Job Created
                                                                    </Tag>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                                                    <HiOutlineClock className="text-base" />
                                                                    <span>{formatDate(job.createdAt)}</span>
                                                                </div>
                                                            </div>
                                                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 md:p-4">
                                                                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed break-words">
                                                                    Job created: {job.name}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                </div>
                                            )
                                        })()}
                                    </>
                                )}
                            </div>

                            {/* Activity Timeline */}
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                    Activity Timeline
                                </h2>
                                <ActivitiesTimeline entityType="crewJob" entityId={jobId} />
                            </div>
                        </div>
                    )}

                    {/* Attachments Tab */}
                    {activeTab === 'attachments' && (
                        <AttachmentsManager entityType="crewJob" entityId={jobId} />
                    )}
                </div>
            </Card>
        </div>
    )
}

export default JobDetail
