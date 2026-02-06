import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Button, Card, Input, Select, Tag, Tooltip, DatePicker, Alert } from '@/components/ui'
import DataTable from '@/components/shared/DataTable'
import { useCrewEmployeeStore } from '@/store/crewEmployeeStore'
import { useCrewJobStore } from '@/store/crewJobStore'
import { 
    HiOutlinePlus, 
    HiOutlineEye, 
    HiOutlinePencil, 
    HiOutlineTrash,
    HiOutlineRefresh,
    HiOutlineChatAlt2,
    HiOutlineStatusOnline,
    HiOutlineExclamationCircle,
    HiOutlineClock
} from 'react-icons/hi'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import EmployeeFormModal from './CrewTracker/components/EmployeeFormModal'
import JobFormModal from './CrewTracker/components/JobFormModal'

const CrewTracker = () => {
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState('employees')
    const [jobSubTab, setJobSubTab] = useState('active') // 'active' | 'inactive'
    const [showEmployeeModal, setShowEmployeeModal] = useState(false)
    const [editingEmployee, setEditingEmployee] = useState(null)
    const [showJobModal, setShowJobModal] = useState(false)
    const [editingJob, setEditingJob] = useState(null)

    // Messaging state
    const [selectedJobIdForMessage, setSelectedJobIdForMessage] = useState(null)
    const [selectedEmployeeIdsForMessage, setSelectedEmployeeIdsForMessage] = useState([])
    const [messageDate, setMessageDate] = useState(new Date())
    const [messageNotes, setMessageNotes] = useState('')
    const [messageLanguage, setMessageLanguage] = useState('auto') // 'auto' | 'en' | 'es'
    const [sendingMessages, setSendingMessages] = useState(false)
    const [sendError, setSendError] = useState('')
    const [sendSuccess, setSendSuccess] = useState('')
    const [messageHistory, setMessageHistory] = useState([])
    const [messageHistoryLoading, setMessageHistoryLoading] = useState(false)
    const [messageHistoryError, setMessageHistoryError] = useState('')

    const {
        employees,
        filters: employeeFilters,
        loading: employeesLoading,
        loadEmployees,
        setFilters: setEmployeeFilters,
        setupRealtimeListener: setupEmployeeRealtimeListener,
        cleanupRealtimeListener: cleanupEmployeeRealtimeListener,
        createEmployee,
        updateEmployee,
        deleteEmployee,
    } = useCrewEmployeeStore()

    const {
        jobs,
        filters: jobFilters,
        loading: jobsLoading,
        loadJobs,
        setFilters: setJobFilters,
        setupRealtimeListener: setupJobRealtimeListener,
        cleanupRealtimeListener: cleanupJobRealtimeListener,
        createJob,
        updateJob,
        deleteJob,
    } = useCrewJobStore()

    // Helper: format date as MM/DD/YYYY
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
            const month = String(dateObj.getMonth() + 1).padStart(2, '0')
            const day = String(dateObj.getDate()).padStart(2, '0')
            const year = dateObj.getFullYear()
            return `${month}/${day}/${year}`
        } catch {
            return '-'
        }
    }

    // Load employees and setup real-time listener
    useEffect(() => {
        if (activeTab === 'employees') {
            loadEmployees()
            setupEmployeeRealtimeListener()
            
            return () => {
                cleanupEmployeeRealtimeListener()
            }
        }
    }, [activeTab, employeeFilters.active])

    // Reload when search filter changes
    useEffect(() => {
        if (activeTab === 'employees') {
            loadEmployees()
        }
    }, [employeeFilters.search])

    // Load employees when on jobs tab (for Assigned Employees column)
    useEffect(() => {
        if (activeTab === 'jobs') {
            loadEmployees()
        }
    }, [activeTab, loadEmployees])

    // Load jobs and setup real-time listener - load all jobs
    useEffect(() => {
        if (activeTab === 'jobs') {
            // Load all jobs (no active filter, keep search)
            const currentSearch = jobFilters.search
            setJobFilters({ active: null, search: currentSearch })
            // Small delay to ensure filter is set before loading
            setTimeout(() => {
                loadJobs()
            }, 0)
            setupJobRealtimeListener()
            
            return () => {
                cleanupJobRealtimeListener()
            }
        }
    }, [activeTab])

    // Reload when search filter changes
    useEffect(() => {
        if (activeTab === 'jobs') {
            loadJobs()
        }
    }, [jobFilters.search])

    // Load employees & jobs when on Messages tab (for composer)
    useEffect(() => {
        if (activeTab === 'messages') {
            loadEmployees()
            loadJobs()
        }
    }, [activeTab, loadEmployees, loadJobs])

    // Load message history (with realtime updates) when Messages tab is active
    useEffect(() => {
        if (activeTab !== 'messages') {
            return
        }

        const loadHistoryOnce = async () => {
            setMessageHistoryLoading(true)
            setMessageHistoryError('')
            try {
                const response = await FirebaseDbService.crewMessages.getAll()
                if (response.success) {
                    setMessageHistory(response.data || [])
                } else {
                    setMessageHistoryError(response.error || 'Failed to load message history')
                }
            } catch (error) {
                console.error('Failed to load crew message history:', error)
                setMessageHistoryError(error.message || 'Failed to load message history')
            } finally {
                setMessageHistoryLoading(false)
            }
        }

        loadHistoryOnce()

        const unsubscribe = FirebaseDbService.crewMessages.subscribe((messages) => {
            setMessageHistory(messages || [])
        })

        return () => {
            if (unsubscribe) {
                unsubscribe()
            }
        }
    }, [activeTab])

    // Format phone number for display
    const formatPhoneDisplay = (phone) => {
        if (!phone) return '-'
        // Remove +1 prefix if present
        const cleaned = phone.replace(/^\+1/, '').replace(/\D/g, '')
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
        }
        return phone
    }

    // Handle create/edit employee
    const handleSaveEmployee = async (employeeData) => {
        if (editingEmployee) {
            await updateEmployee(editingEmployee.id, employeeData)
        } else {
            await createEmployee(employeeData)
        }
        setEditingEmployee(null)
    }

    // Handle edit employee
    const handleEditEmployee = (employee) => {
        setEditingEmployee(employee)
        setShowEmployeeModal(true)
    }

    // Handle delete employee
    const handleDeleteEmployee = async (employeeId) => {
        if (window.confirm('Are you sure you want to delete this employee? This action cannot be undone.')) {
            await deleteEmployee(employeeId)
        }
    }

    // Handle create/edit job
    const handleSaveJob = async (jobData) => {
        if (editingJob) {
            await updateJob(editingJob.id, jobData)
        } else {
            await createJob(jobData)
        }
        setEditingJob(null)
    }

    // Handle edit job
    const handleEditJob = (job) => {
        setEditingJob(job)
        setShowJobModal(true)
    }

    // Handle delete job
    const handleDeleteJob = async (jobId) => {
        if (window.confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
            await deleteJob(jobId)
        }
    }

    // Table columns for employees
    const employeeColumns = useMemo(() => [
        {
            header: 'Name',
            accessorKey: 'name',
            size: 200,
            cell: ({ row }) => {
                const employee = row.original
                return (
                    <div className="flex flex-col">
                        <span className="font-medium">{employee.name || '-'}</span>
                        {employee.email && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {employee.email}
                            </span>
                        )}
                    </div>
                )
            },
        },
        {
            header: 'Phone',
            accessorKey: 'phone',
            size: 150,
            cell: ({ row }) => {
                return <span>{formatPhoneDisplay(row.original.phone)}</span>
            },
        },
        {
            header: 'Language',
            accessorKey: 'language',
            size: 120,
            cell: ({ row }) => {
                const employee = row.original
                const language = employee.language || 'en'
                return (
                    <Tag 
                        className={`cursor-pointer ${language === 'es' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : ''}`}
                        onClick={async () => {
                            await updateEmployee(employee.id, { language: language === 'en' ? 'es' : 'en' })
                        }}
                    >
                        {language === 'es' ? 'Spanish' : 'English'}
                    </Tag>
                )
            },
        },
        {
            header: 'Status',
            accessorKey: 'active',
            size: 100,
            cell: ({ row }) => {
                const employee = row.original
                const isActive = employee.active !== false
                return (
                    <Tag 
                        className={`cursor-pointer ${isActive 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                        }`}
                        onClick={async () => {
                            await updateEmployee(employee.id, { active: !isActive })
                        }}
                    >
                        {isActive ? 'Active' : 'Inactive'}
                    </Tag>
                )
            },
        },
        {
            header: 'Actions',
            accessorKey: 'actions',
            size: 150,
            cell: ({ row }) => {
                const employee = row.original
                return (
                    <div className="flex items-center gap-2">
                        <Tooltip title="View Details">
                            <Button
                                size="sm"
                                variant="plain"
                                icon={<HiOutlineEye />}
                                onClick={() => navigate(`/crew-tracker/employees/${employee.id}`)}
                            />
                        </Tooltip>
                        <Tooltip title="Edit">
                            <Button
                                size="sm"
                                variant="plain"
                                icon={<HiOutlinePencil />}
                                onClick={() => handleEditEmployee(employee)}
                            />
                        </Tooltip>
                        <Tooltip title="Delete">
                            <Button
                                size="sm"
                                variant="plain"
                                icon={<HiOutlineTrash />}
                                onClick={() => handleDeleteEmployee(employee.id)}
                                className="text-red-600 hover:text-red-700"
                            />
                        </Tooltip>
                    </div>
                )
            },
        },
    ], [navigate, updateEmployee])

    // Filtered employees
    const filteredEmployees = useMemo(() => {
        return employees
    }, [employees])

    // Table columns for jobs
    const jobColumns = useMemo(() => [
        {
            header: 'Job Name',
            accessorKey: 'name',
            size: 300,
            cell: ({ row }) => {
                const job = row.original
                return (
                    <Tooltip title={job.name || '-'}>
                        <span className="font-medium block max-w-[280px] truncate">{job.name || '-'}</span>
                    </Tooltip>
                )
            },
        },
        {
            header: 'Address',
            accessorKey: 'address',
            size: 350,
            cell: ({ row }) => {
                const address = row.original.address
                if (!address) return <span className="text-sm text-gray-400">-</span>
                const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
                return (
                    <Tooltip title={address}>
                        <a
                            href={googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline block max-w-[330px] truncate"
                        >
                            {address}
                        </a>
                    </Tooltip>
                )
            },
        },
        {
            header: 'Tasks',
            accessorKey: 'tasks',
            size: 400,
            cell: ({ row }) => {
                const tasks = row.original.tasks
                if (!tasks) return <span className="text-sm text-gray-400">-</span>
                // Truncate if too long
                const maxLength = 80
                const displayText = tasks.length > maxLength 
                    ? `${tasks.substring(0, maxLength)}...` 
                    : tasks
                return (
                    <Tooltip title={tasks}>
                        <span className="text-sm block max-w-[380px] truncate">
                            {displayText}
                        </span>
                    </Tooltip>
                )
            },
        },
        {
            header: 'Assigned Employees',
            accessorKey: 'assignedEmployees',
            size: 250,
            cell: ({ row }) => {
                const job = row.original
                const assignedIds = job.assignedEmployees || []
                if (assignedIds.length === 0) return <span className="text-sm text-gray-400">-</span>
                const assignedNames = assignedIds
                    .map(id => {
                        const emp = employees.find(e => e.id === id)
                        return emp ? emp.name : null
                    })
                    .filter(Boolean)
                const displayText = assignedNames.join(', ')
                return (
                    <Tooltip title={displayText}>
                        <span className="text-sm block max-w-[230px] truncate">
                            {displayText || '-'}
                        </span>
                    </Tooltip>
                )
            },
        },
        {
            header: 'Updates',
            accessorKey: 'updates',
            size: 400,
            cell: ({ row }) => {
                const job = row.original
                const lastUpdate = job.lastUpdateDate
                const lastUpdateText = job.lastUpdateText || ''
                
                if (!lastUpdate) {
                    return <span className="text-sm text-gray-400">No updates</span>
                }
                
                // Format date only (no time) helper
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
                        const month = String(dateObj.getMonth() + 1).padStart(2, '0')
                        const day = String(dateObj.getDate()).padStart(2, '0')
                        const year = dateObj.getFullYear()
                        return `${month}/${day}/${year}`
                    } catch {
                        return '-'
                    }
                }
                
                // Truncate text if too long
                const maxLength = 80
                const displayText = lastUpdateText.length > maxLength 
                    ? `${lastUpdateText.substring(0, maxLength)}...` 
                    : lastUpdateText || 'Update'
                
                return (
                    <Tooltip
                        title={
                            <div>
                                <div className="font-semibold mb-1">{formatDateOnly(lastUpdate)}</div>
                                {lastUpdateText && <div className="text-sm">{lastUpdateText}</div>}
                            </div>
                        }
                    >
                        <div className="cursor-pointer">
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                {formatDateOnly(lastUpdate)}
                            </div>
                            <div className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[380px]">
                                {displayText}
                            </div>
                        </div>
                    </Tooltip>
                )
            },
        },
        {
            header: 'Expected Completion',
            accessorKey: 'expectedCompletionDate',
            size: 150,
            cell: ({ row }) => {
                const date = row.original.expectedCompletionDate
                if (!date) return <span className="text-sm text-gray-400">-</span>
                try {
                    let dateObj
                    if (date?.toDate) {
                        dateObj = date.toDate()
                    } else if (date instanceof Date) {
                        dateObj = date
                    } else if (typeof date === 'string') {
                        dateObj = new Date(date)
                    } else {
                        return <span className="text-sm text-gray-400">-</span>
                    }
                    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
                    const day = String(dateObj.getDate()).padStart(2, '0')
                    const year = dateObj.getFullYear()
                    return <span className="text-sm">{month}/{day}/{year}</span>
                } catch {
                    return <span className="text-sm text-gray-400">-</span>
                }
            },
        },
        {
            header: 'Status',
            accessorKey: 'active',
            size: 100,
            cell: ({ row }) => {
                const job = row.original
                const isActive = job.active !== false
                return (
                    <Tag 
                        className={`cursor-pointer ${isActive 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                        }`}
                        onClick={async () => {
                            await updateJob(job.id, { active: !isActive })
                        }}
                    >
                        {isActive ? 'Active' : 'Inactive'}
                    </Tag>
                )
            },
        },
        {
            header: 'Actions',
            accessorKey: 'actions',
            size: 150,
            cell: ({ row }) => {
                const job = row.original
                return (
                    <div className="flex items-center gap-2">
                        <Tooltip title="View Details">
                            <Button
                                size="sm"
                                variant="plain"
                                icon={<HiOutlineEye />}
                                onClick={() => navigate(`/crew-tracker/jobs/${job.id}`)}
                            />
                        </Tooltip>
                        <Tooltip title="Edit">
                            <Button
                                size="sm"
                                variant="plain"
                                icon={<HiOutlinePencil />}
                                onClick={() => handleEditJob(job)}
                            />
                        </Tooltip>
                        <Tooltip title="Delete">
                            <Button
                                size="sm"
                                variant="plain"
                                icon={<HiOutlineTrash />}
                                onClick={() => handleDeleteJob(job.id)}
                                className="text-red-600 hover:text-red-700"
                            />
                        </Tooltip>
                    </div>
                )
            },
        },
    ], [navigate, updateJob, employees])

    // Filtered jobs - separate active and inactive
    const activeJobs = useMemo(() => {
        return jobs.filter(job => job.active !== false)
    }, [jobs])

    const inactiveJobs = useMemo(() => {
        return jobs.filter(job => job.active === false)
    }, [jobs])

    const filteredJobs = useMemo(() => {
        return jobSubTab === 'active' ? activeJobs : inactiveJobs
    }, [jobSubTab, activeJobs, inactiveJobs])

    // Job & employee options for messaging composer
    const jobOptionsForMessages = useMemo(() => {
        return jobs
            .filter(job => job.active !== false)
            .map(job => ({
                value: job.id,
                label: job.address ? `${job.name || 'Untitled Job'} — ${job.address}` : (job.name || 'Untitled Job'),
            }))
    }, [jobs])

    const employeeOptionsForMessages = useMemo(() => {
        return employees
            .filter(emp => emp.active !== false && emp.phone)
            .map(emp => ({
                value: emp.id,
                label: `${emp.name || 'Unnamed'} (${formatPhoneDisplay(emp.phone)})${emp.language === 'es' ? ' — ES' : ' — EN'}`,
            }))
    }, [employees])

    const selectedJobForMessage = useMemo(
        () => jobs.find(job => job.id === selectedJobIdForMessage) || null,
        [jobs, selectedJobIdForMessage]
    )

    // When job selection changes, default employees & notes from job
    useEffect(() => {
        if (!selectedJobForMessage) return
        const assigned = selectedJobForMessage.assignedEmployees || []
        setSelectedEmployeeIdsForMessage(assigned)

        // If no custom notes yet, suggest notes based on tasks
        if (!messageNotes && selectedJobForMessage.tasks) {
            setMessageNotes(selectedJobForMessage.tasks)
        }
    }, [selectedJobForMessage]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleSendMessages = async () => {
        if (!selectedJobForMessage) {
            setSendError('Please select a job to send messages for.')
            setSendSuccess('')
            return
        }
        if (!selectedEmployeeIdsForMessage || selectedEmployeeIdsForMessage.length === 0) {
            setSendError('Please select at least one employee to send messages to.')
            setSendSuccess('')
            return
        }
        if (!messageDate) {
            setSendError('Please select a date for this assignment.')
            setSendSuccess('')
            return
        }

        setSendingMessages(true)
        setSendError('')
        setSendSuccess('')

        try {
            const { getFunctions, httpsCallable } = await import('firebase/functions')
            const functions = getFunctions()
            const sendCrewMessageFn = httpsCallable(functions, 'sendCrewMessage')

            const payload = {
                employeeIds: selectedEmployeeIdsForMessage,
                jobName: selectedJobForMessage.name,
                jobAddress: selectedJobForMessage.address,
                tasks: selectedJobForMessage.tasks || '',
                date: formatDateOnly(messageDate),
                notes: messageNotes || '',
            }

            if (messageLanguage && messageLanguage !== 'auto') {
                payload.language = messageLanguage
            }

            console.log('[SMS] Sending payload:', payload)
            const result = await sendCrewMessageFn(payload)
            const data = result?.data || {}

            console.log('[SMS] Function response:', data)

            if (data.failed > 0) {
                // Show detailed error if some failed
                const failedResults = (data.results || []).filter(r => !r.success)
                const errorDetails = failedResults.map(r => 
                    `${r.employeeName || 'Unknown'}: ${r.error || 'Failed'}`
                ).join('; ')
                setSendError(
                    `${data.failed} message(s) failed. ${errorDetails}`
                )
            } else {
                setSendError('')
            }

            setSendSuccess(
                data.message ||
                `Messages sent. ${data.sent || 0} succeeded${data.failed ? `, ${data.failed} failed` : ''}.`
            )
        } catch (error) {
            console.error('[SMS] Failed to send crew messages:', error)
            const errorMessage = error?.message || error?.code || 'Failed to send messages. Please try again.'
            setSendError(`Error: ${errorMessage}. Check browser console and Firebase Functions logs for details.`)
            setSendSuccess('')
        } finally {
            setSendingMessages(false)
        }
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0">
                <div>
                    <h1 className="text-2xl font-bold">Crew Tracker</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Manage your crew assignments and send daily job information via SMS
                    </p>
                </div>
                {activeTab === 'employees' && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <Button
                            variant="solid"
                            icon={<HiOutlinePlus />}
                            onClick={() => {
                                setEditingEmployee(null)
                                setShowEmployeeModal(true)
                            }}
                            className="w-full sm:w-auto"
                        >
                            Add Employee
                        </Button>
                        <Button
                            variant="twoTone"
                            icon={<HiOutlineRefresh />}
                            onClick={loadEmployees}
                            loading={employeesLoading}
                            className="w-full sm:w-auto"
                        >
                            Refresh
                        </Button>
                    </div>
                )}
                {activeTab === 'jobs' && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <Button
                            variant="solid"
                            icon={<HiOutlinePlus />}
                            onClick={() => {
                                setEditingJob(null)
                                setShowJobModal(true)
                            }}
                            className="w-full sm:w-auto"
                        >
                            Add Job
                        </Button>
                        <Button
                            variant="twoTone"
                            icon={<HiOutlineRefresh />}
                            onClick={loadJobs}
                            loading={jobsLoading}
                            className="w-full sm:w-auto"
                        >
                            Refresh
                        </Button>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <Card>
                <div className="p-4 md:p-6 space-y-4">
                    {/* Tab Navigation */}
                    <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => setActiveTab('employees')}
                            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                                activeTab === 'employees'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                            }`}
                        >
                            Employees ({employees.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('jobs')}
                            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                                activeTab === 'jobs'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                            }`}
                        >
                            Jobs ({activeJobs.length + inactiveJobs.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('messages')}
                            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                                activeTab === 'messages'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                            }`}
                        >
                            Messages
                        </button>
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'employees' && (
                        <>
                            {/* Filters */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                <div>
                                    <Input
                                        placeholder="Search employees..."
                                        value={employeeFilters.search}
                                        onChange={(e) => setEmployeeFilters({ search: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Select
                                        placeholder="Filter by status"
                                        options={[
                                            { value: null, label: 'All Employees' },
                                            { value: true, label: 'Active Only' },
                                            { value: false, label: 'Inactive Only' },
                                        ]}
                                        value={employeeFilters.active}
                                        onChange={(option) => setEmployeeFilters({ active: option.value })}
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                        styles={{
                                            menuPortal: (provided) => ({ ...provided, zIndex: 9999 }),
                                            menu: (provided) => ({ ...provided, zIndex: 9999 }),
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Employees Table */}
                            <div className="pt-4">
                                <DataTable
                                    columns={employeeColumns}
                                    data={filteredEmployees}
                                    loading={employeesLoading}
                                    skeletonAvatarColumns={[0]}
                                    skeletonAvatarProps={{ size: 32 }}
                                />
                            </div>
                        </>
                    )}

                    {activeTab === 'jobs' && (
                        <>
                            {/* Job Sub-Tabs */}
                            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 mb-4">
                                <button
                                    onClick={() => setJobSubTab('active')}
                                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                                        jobSubTab === 'active'
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                                    }`}
                                >
                                    Active Jobs ({activeJobs.length})
                                </button>
                                <button
                                    onClick={() => setJobSubTab('inactive')}
                                    className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                                        jobSubTab === 'inactive'
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                                    }`}
                                >
                                    Inactive Jobs ({inactiveJobs.length})
                                </button>
                            </div>

                            {/* Filters */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                <div>
                                    <Input
                                        placeholder="Search jobs..."
                                        value={jobFilters.search}
                                        onChange={(e) => setJobFilters({ search: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Jobs Table */}
                            <div className="pt-4">
                                <DataTable
                                    columns={jobColumns}
                                    data={filteredJobs}
                                    loading={jobsLoading}
                                />
                            </div>
                        </>
                    )}

                    {activeTab === 'messages' && (
                        <div className="pt-4 space-y-6">
                            <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <HiOutlineChatAlt2 className="text-xl" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        Send job details via SMS
                                    </h2>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        Select a job and crew members to send a concise assignment text with date, address,
                                        Google Maps link, and tasks in English or Spanish.
                                    </p>
                                </div>
                            </div>

                            {/* Alerts */}
                            {sendError && (
                                <Alert type="danger" showIcon>
                                    {sendError}
                                </Alert>
                            )}
                            {sendSuccess && (
                                <Alert type="success" showIcon>
                                    {sendSuccess}
                                </Alert>
                            )}
                            {messageHistoryError && (
                                <Alert type="danger" showIcon>
                                    {messageHistoryError}
                                </Alert>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Composer */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Job
                                        </label>
                                        <Select
                                            placeholder="Select a job"
                                            options={jobOptionsForMessages}
                                            value={jobOptionsForMessages.find(opt => opt.value === selectedJobIdForMessage) || null}
                                            onChange={(option) => {
                                                setSelectedJobIdForMessage(option ? option.value : null)
                                            }}
                                            isClearable
                                            menuPortalTarget={document.body}
                                            menuPosition="fixed"
                                            styles={{
                                                menuPortal: (provided) => ({ ...provided, zIndex: 10000 }),
                                                menu: (provided) => ({ ...provided, zIndex: 10000 }),
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Crew members
                                        </label>
                                        <Select
                                            placeholder="Select one or more employees"
                                            isMulti
                                            options={employeeOptionsForMessages}
                                            value={employeeOptionsForMessages.filter(opt =>
                                                selectedEmployeeIdsForMessage.includes(opt.value)
                                            )}
                                            onChange={(selected) => {
                                                const ids = selected ? selected.map(s => s.value) : []
                                                setSelectedEmployeeIdsForMessage(ids)
                                            }}
                                            closeMenuOnSelect={false}
                                            menuPortalTarget={document.body}
                                            menuPosition="fixed"
                                            styles={{
                                                menuPortal: (provided) => ({ ...provided, zIndex: 10000 }),
                                                menu: (provided) => ({ ...provided, zIndex: 10000 }),
                                            }}
                                        />
                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                            Only active employees with a phone number appear here.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Date
                                            </label>
                                            <DatePicker
                                                inputtable
                                                inputtableBlurClose={false}
                                                inputFormat="MM/DD/YYYY"
                                                value={messageDate}
                                                onChange={(date) => setMessageDate(date)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Language
                                            </label>
                                            <Select
                                                options={[
                                                    { value: 'auto', label: 'Per employee preference (default)' },
                                                    { value: 'en', label: 'Force English' },
                                                    { value: 'es', label: 'Force Spanish' },
                                                ]}
                                                value={
                                                    [
                                                        { value: 'auto', label: 'Per employee preference (default)' },
                                                        { value: 'en', label: 'Force English' },
                                                        { value: 'es', label: 'Force Spanish' },
                                                    ].find(opt => opt.value === messageLanguage)
                                                }
                                                onChange={(option) => setMessageLanguage(option?.value || 'auto')}
                                                menuPortalTarget={document.body}
                                                menuPosition="fixed"
                                                styles={{
                                                    menuPortal: (provided) => ({ ...provided, zIndex: 10000 }),
                                                    menu: (provided) => ({ ...provided, zIndex: 10000 }),
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Notes (optional)
                                        </label>
                                        <Input
                                            textArea
                                            rows={4}
                                            placeholder="Extra instructions, gate codes, or meeting points..."
                                            value={messageNotes}
                                            onChange={(e) => setMessageNotes(e.target.value)}
                                        />
                                    </div>

                                    {/* Preview */}
                                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-4 text-sm text-gray-700 dark:text-gray-200">
                                        <div className="flex items-center gap-2 mb-2">
                                            <HiOutlineStatusOnline className="text-primary" />
                                            <span className="font-semibold">Preview (English)</span>
                                        </div>
                                        <p className="whitespace-pre-line leading-relaxed text-xs sm:text-sm">
                                            {selectedJobForMessage ? (
                                                [
                                                    '📋 Job Assignment',
                                                    '',
                                                    `📅 Date: ${formatDateOnly(messageDate)}`,
                                                    `🏗️ Job: ${selectedJobForMessage.name || '-'}`,
                                                    `📍 Location: ${selectedJobForMessage.address || '-'}`,
                                                    selectedJobForMessage.tasks
                                                        ? `📝 Tasks: ${selectedJobForMessage.tasks}`
                                                        : '📝 Tasks: See details on site',
                                                    messageNotes ? `📌 Notes: ${messageNotes}` : null,
                                                ]
                                                    .filter(Boolean)
                                                    .join('\n')
                                            ) : (
                                                'Select a job and crew members to see the message preview.'
                                            )}
                                        </p>
                                    </div>

                                    <div className="flex justify-end">
                                        <Button
                                            variant="solid"
                                            icon={<HiOutlineChatAlt2 />}
                                            loading={sendingMessages}
                                            disabled={sendingMessages}
                                            onClick={handleSendMessages}
                                        >
                                            Send SMS
                                        </Button>
                                    </div>
                                </div>

                                {/* Message history */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <HiOutlineClock className="text-lg text-gray-400 dark:text-gray-500" />
                                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                                Recent messages
                                            </h3>
                                        </div>
                                        {messageHistoryLoading && (
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                Loading...
                                            </span>
                                        )}
                                    </div>

                                    {(!messageHistory || messageHistory.length === 0) && !messageHistoryLoading ? (
                                        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 px-4 py-8 text-center">
                                            <HiOutlineExclamationCircle className="mb-2 text-2xl text-gray-300 dark:text-gray-600" />
                                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                No messages sent yet
                                            </p>
                                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-xs">
                                                Once you start sending job assignments, they will appear here with status
                                                and recipients.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                                            {messageHistory.map((msg) => {
                                                const sentAt = msg.sentAt || msg.date
                                                const status = msg.status || 'sent'
                                                const results = Array.isArray(msg.results) ? msg.results : []
                                                const sentCount = results.filter(r => r.success).length
                                                const failedCount = results.filter(r => !r.success).length
                                                const totalRecipients = (msg.recipients && msg.recipients.length) || results.length || 0

                                                return (
                                                    <div
                                                        key={msg.id}
                                                        className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-3 text-xs sm:text-sm"
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div>
                                                                <div className="font-medium text-gray-900 dark:text-white truncate max-w-[220px]">
                                                                    {msg.jobName || 'Job assignment'}
                                                                </div>
                                                                {msg.jobAddress && (
                                                                    <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[220px]">
                                                                        {msg.jobAddress}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col items-end gap-1">
                                                                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                                                    {formatDateOnly(sentAt)}
                                                                </span>
                                                                <span
                                                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                                                        status === 'sent'
                                                                            ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                                                            : status === 'partial'
                                                                            ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                                                                            : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                                    }`}
                                                                >
                                                                    {status === 'sent'
                                                                        ? 'Sent'
                                                                        : status === 'partial'
                                                                        ? 'Partial'
                                                                        : status || 'Unknown'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600 dark:text-gray-400">
                                                            {totalRecipients > 0 && (
                                                                <span>
                                                                    Recipients: {sentCount}/{totalRecipients} sent
                                                                    {failedCount ? `, ${failedCount} failed` : ''}
                                                                </span>
                                                            )}
                                                            {msg.tasks && (
                                                                <span className="truncate max-w-[220px]">
                                                                    Tasks: {msg.tasks}
                                                                </span>
                                                            )}
                                                            {msg.notes && (
                                                                <span className="truncate max-w-[220px]">
                                                                    Notes: {msg.notes}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {/* Employee Form Modal */}
            <EmployeeFormModal
                isOpen={showEmployeeModal}
                onClose={() => {
                    setShowEmployeeModal(false)
                    setEditingEmployee(null)
                }}
                employee={editingEmployee}
                onSave={handleSaveEmployee}
            />

            {/* Job Form Modal */}
            <JobFormModal
                isOpen={showJobModal}
                onClose={() => {
                    setShowJobModal(false)
                    setEditingJob(null)
                }}
                job={editingJob}
                onSave={handleSaveJob}
            />
        </div>
    )
}

export default CrewTracker
