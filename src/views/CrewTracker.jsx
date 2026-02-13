import React, { useState, useEffect, useMemo, useRef } from 'react'
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
} from 'react-icons/hi'
import * as XLSX from 'xlsx'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { toast } from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import EmployeeFormModal from './CrewTracker/components/EmployeeFormModal'
import JobFormModal from './CrewTracker/components/JobFormModal'
import EmployeesTab from './CrewTracker/EmployeesTab'
import JobsTab from './CrewTracker/JobsTab'
import MessagesTab from './CrewTracker/MessagesTab'
import ScheduleTab from './CrewTracker/ScheduleTab'

const CrewTracker = () => {
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState('employees')
    const [jobSubTab, setJobSubTab] = useState('active') // 'active' | 'inactive'
    const [showEmployeeModal, setShowEmployeeModal] = useState(false)
    const [editingEmployee, setEditingEmployee] = useState(null)
    const [showJobModal, setShowJobModal] = useState(false)
    const [editingJob, setEditingJob] = useState(null)
    const [jobsImporting, setJobsImporting] = useState(false)
    const jobsFileInputRef = useRef(null)
    const [selectedJobIds, setSelectedJobIds] = useState([])
    const [bulkStatus, setBulkStatus] = useState('In Progress')

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

    // Schedule state (daily Excel-like grid)
    const [scheduleDate, setScheduleDate] = useState(new Date())
    const [scheduleAssignments, setScheduleAssignments] = useState([])
    const [scheduleLoading, setScheduleLoading] = useState(false)
    const [scheduleSaving, setScheduleSaving] = useState(false)
    const [scheduleError, setScheduleError] = useState('')
    const [scheduleSendSuccess, setScheduleSendSuccess] = useState('')

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

    // Ensure jobs are loaded at least once on mount so counts & options are correct,
    // even before visiting the Jobs or Schedule/Messages tabs.
    useEffect(() => {
        loadJobs()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

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

    // Load employees & jobs when on Messages or Schedule tab (for composer / schedule grid)
    useEffect(() => {
        if (activeTab === 'messages' || activeTab === 'schedule') {
            loadEmployees()
            loadJobs()
        }
    }, [activeTab, loadEmployees, loadJobs])

    // Load schedule assignments when Schedule tab or date changes
    useEffect(() => {
        const loadSchedule = async () => {
            if (activeTab !== 'schedule') return

            setScheduleLoading(true)
            setScheduleError('')
            try {
                const response = await FirebaseDbService.crewSchedules.getByDate(scheduleDate)
                if (response.success) {
                    const assignments = response.data?.assignments || []
                    const mappedAssignments = assignments.map((a) => ({
                        id: a.id,
                        employeeId: a.employeeId || '',
                        employeeName: a.employeeName || '',
                        jobId: a.jobId || '',
                        jobName: a.jobName || '',
                        jobAddress: a.jobAddress || '',
                        costCode: a.costCode || '',
                        w2Hours: a.w2Hours || '',
                        scheduledTasks: a.scheduledTasks || '',
                        addedTasks: a.addedTasks || '',
                        notes: a.notes || '',
                        tasksNotCompleted: a.tasksNotCompleted || '',
                        materialsNeeded: a.materialsNeeded || '',
                        // Exceptions & merge flags (defaults for older data)
                        exceptionAcknowledged: Boolean(a.exceptionAcknowledged),
                        unmergedFromJob: Boolean(a.unmergedFromJob),
                    }))

                    // Ensure at least 30 rows
                    const minRows = 30
                    while (mappedAssignments.length < minRows) {
                        mappedAssignments.push({
                            id: `local-${Date.now()}-${mappedAssignments.length}`,
                            employeeId: '',
                            employeeName: '',
                            jobId: '',
                            jobName: '',
                            jobAddress: '',
                            costCode: '',
                            w2Hours: '',
                            scheduledTasks: '',
                            addedTasks: '',
                            notes: '',
                            tasksNotCompleted: '',
                            materialsNeeded: '',
                            exceptionAcknowledged: false,
                            unmergedFromJob: false,
                        })
                    }

                    setScheduleAssignments(mappedAssignments)
                } else {
                    // Even on error, ensure 30 rows
                    const emptyRows = Array.from({ length: 30 }, (_, i) => ({
                        id: `local-${Date.now()}-${i}`,
                        employeeId: '',
                        employeeName: '',
                        jobId: '',
                        jobName: '',
                        jobAddress: '',
                        costCode: '',
                        w2Hours: '',
                        scheduledTasks: '',
                        addedTasks: '',
                        notes: '',
                        tasksNotCompleted: '',
                        materialsNeeded: '',
                        exceptionAcknowledged: false,
                        unmergedFromJob: false,
                    }))
                    setScheduleAssignments(emptyRows)
                    setScheduleError(response.error || 'Failed to load schedule for this date.')
                }
            } catch (error) {
                console.error('Failed to load crew schedule:', error)
                // Even on error, ensure 30 rows
                const emptyRows = Array.from({ length: 30 }, (_, i) => ({
                    id: `local-${Date.now()}-${i}`,
                    employeeId: '',
                    employeeName: '',
                    jobId: '',
                    jobName: '',
                    jobAddress: '',
                    costCode: '',
                    w2Hours: '',
                    scheduledTasks: '',
                    addedTasks: '',
                    notes: '',
                    tasksNotCompleted: '',
                    materialsNeeded: '',
                    exceptionAcknowledged: false,
                    unmergedFromJob: false,
                }))
                setScheduleAssignments(emptyRows)
                setScheduleError(error.message || 'Failed to load schedule for this date.')
            } finally {
                setScheduleLoading(false)
            }
        }

        loadSchedule()
    }, [activeTab, scheduleDate])

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

    // Helper: get day of week label
    const getDayOfWeek = (date) => {
        try {
            let dateObj
            if (date?.toDate) {
                dateObj = date.toDate()
            } else if (date instanceof Date) {
                dateObj = date
            } else if (typeof date === 'string') {
                dateObj = new Date(date)
            } else {
                return ''
            }
            return dateObj.toLocaleDateString('en-US', { weekday: 'long' })
        } catch {
            return ''
        }
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

    // Count active/inactive employees
    const activeEmployees = useMemo(() => {
        return employees.filter(emp => emp.active !== false)
    }, [employees])

    const inactiveEmployees = useMemo(() => {
        return employees.filter(emp => emp.active === false)
    }, [employees])

    const jobStatusOptions = [
        { value: 'Proposal', label: 'Proposal' },
        { value: 'In Progress', label: 'In Progress' },
        { value: 'Request', label: 'Request' },
        { value: 'Draft', label: 'Draft' },
        { value: 'Inactive', label: 'Inactive' },
    ]

    // Table columns for jobs
    const jobColumns = useMemo(() => [
        {
            header: 'Project',
            accessorKey: 'project',
            size: 160,
            cell: ({ row }) => {
                const job = row.original
                return (
                    <span className="text-sm font-medium">
                        {job.project || '-'}
                    </span>
                )
            },
        },
        {
            header: 'Name',
            accessorKey: 'name',
            size: 260,
            cell: ({ row }) => {
                const job = row.original
                return (
                    <Tooltip title={job.name || '-'}>
                        <span className="font-medium block max-w-[240px] truncate">
                            {job.name || '-'}
                        </span>
                    </Tooltip>
                )
            },
        },
        {
            header: 'Status',
            accessorKey: 'status',
            size: 160,
            cell: ({ row }) => {
                const job = row.original
                const status = job.status || (job.active === false ? 'Inactive' : 'In Progress')
                return (
                    <Select
                        className="min-w-[150px]"
                        options={jobStatusOptions}
                        value={jobStatusOptions.find(opt => opt.value === status) || jobStatusOptions[1]}
                        onChange={async (option) => {
                            if (!option) return
                            await updateJob(job.id, { status: option.value })
                        }}
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                        styles={{
                            menuPortal: (provided) => ({ ...provided, zIndex: 10000 }),
                            menu: (provided) => ({ ...provided, zIndex: 10000 }),
                        }}
                        components={{
                            IndicatorSeparator: () => null,
                        }}
                    />
                )
            },
        },
        {
            header: 'Work Location',
            accessorKey: 'address',
            size: 320,
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
                            className="text-sm text-primary hover:underline block max-w-[300px] truncate"
                        >
                            {address}
                        </a>
                    </Tooltip>
                )
            },
        },
        {
            header: 'Actions',
            accessorKey: 'actions',
            size: 180,
            cell: ({ row }) => {
                const job = row.original
                const status = job.status || (job.active === false ? 'Inactive' : 'In Progress')
                const isActive = status !== 'Inactive'
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
                        <Tag 
                            className={`ml-1 px-2 py-0.5 text-xs ${isActive 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                            }`}
                        >
                            {status}
                        </Tag>
                    </div>
                )
            },
        },
    ], [navigate, updateJob])

    // Filtered jobs - separate active and inactive
    const activeJobs = useMemo(() => {
        let filtered = jobs.filter(job => (job.status || (job.active === false ? 'Inactive' : 'In Progress')) !== 'Inactive')
        
        // Apply search filter if present (searches in project, name, address, and tasks)
        if (jobFilters.search && jobFilters.search.trim()) {
            const searchLower = jobFilters.search.toLowerCase().trim()
            filtered = filtered.filter(job => {
                const project = (job.project || '').toLowerCase()
                const name = (job.name || '').toLowerCase()
                const address = (job.address || '').toLowerCase()
                const tasks = (job.tasks || '').toLowerCase()
                
                return project.includes(searchLower) ||
                       name.includes(searchLower) ||
                       address.includes(searchLower) ||
                       tasks.includes(searchLower)
            })
        }
        
        return filtered
    }, [jobs, jobFilters.search])

    const inactiveJobs = useMemo(() => {
        let filtered = jobs.filter(job => (job.status || (job.active === false ? 'Inactive' : 'In Progress')) === 'Inactive')
        
        // Apply search filter if present (searches in project, name, address, and tasks)
        if (jobFilters.search && jobFilters.search.trim()) {
            const searchLower = jobFilters.search.toLowerCase().trim()
            filtered = filtered.filter(job => {
                const project = (job.project || '').toLowerCase()
                const name = (job.name || '').toLowerCase()
                const address = (job.address || '').toLowerCase()
                const tasks = (job.tasks || '').toLowerCase()
                
                return project.includes(searchLower) ||
                       name.includes(searchLower) ||
                       address.includes(searchLower) ||
                       tasks.includes(searchLower)
            })
        }
        
        return filtered
    }, [jobs, jobFilters.search])

    const filteredJobs = useMemo(() => {
        return jobSubTab === 'active' ? activeJobs : inactiveJobs
    }, [jobSubTab, activeJobs, inactiveJobs])

    const isJobSelected = (job) => selectedJobIds.includes(job.id)

    const handleJobCheckboxChange = (checked, job) => {
        setSelectedJobIds((prev) => {
            if (checked) {
                if (prev.includes(job.id)) return prev
                return [...prev, job.id]
            }
            return prev.filter((id) => id !== job.id)
        })
    }

    const handleJobSelectAllChange = (checked, rows) => {
        const ids = rows.map((r) => r.original.id)
        setSelectedJobIds((prev) => {
            if (checked) {
                const set = new Set([...prev, ...ids])
                return Array.from(set)
            }
            const pageSet = new Set(ids)
            return prev.filter((id) => !pageSet.has(id))
        })
    }

    // Job & employee options for messaging composer
    const jobOptionsForMessages = useMemo(() => {
        return jobs
            .filter(job => (job.status || (job.active === false ? 'Inactive' : 'In Progress')) !== 'Inactive')
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

    // ---------- Jobs import / export ----------

    const handleExportJobsToExcel = () => {
        try {
            if (!jobs || jobs.length === 0) {
                alert('No jobs to export.')
                return
            }

            const exportData = jobs.map((job) => ({
                'Project': job.project || '',
                'Name': job.name || '',
                'Status': job.status || (job.active === false ? 'Inactive' : 'In Progress'),
                'Work Location': job.address || '',
            }))

            const ws = XLSX.utils.json_to_sheet(exportData)
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'Jobs')

            XLSX.writeFile(wb, 'Crew_Jobs.xlsx')
        } catch (error) {
            console.error('Failed to export jobs to Excel:', error)
            alert('Failed to export jobs to Excel. Please try again.')
        }
    }

    const handleImportJobsFromExcelClick = () => {
        if (jobsFileInputRef.current) {
            jobsFileInputRef.current.value = ''
            jobsFileInputRef.current.click()
        }
    }

    const handleJobsFileChange = async (event) => {
        const file = event.target.files?.[0]
        if (!file) return

        setJobsImporting(true)
        try {
            const reader = new FileReader()
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result)
                    const workbook = XLSX.read(data, { type: 'array' })
                    const sheetName = workbook.SheetNames[0]
                    const worksheet = workbook.Sheets[sheetName]
                    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

                    if (!rows || rows.length === 0) {
                        toast.push(
                            React.createElement(
                                Notification,
                                { type: 'warning', duration: 2500, title: 'Jobs import' },
                                'The selected file does not contain any rows.',
                            ),
                        )
                        setJobsImporting(false)
                        return
                    }

                    // Build lookup maps for existing jobs
                    const byProject = new Map()
                    const byNameAddress = new Map()
                    jobs.forEach((job) => {
                        if (job.project) {
                            byProject.set(String(job.project).trim().toLowerCase(), job)
                        }
                        const key = `${(job.name || '').trim().toLowerCase()}|${(job.address || '').trim().toLowerCase()}`
                        if (key.trim() !== '|') {
                            byNameAddress.set(key, job)
                        }
                    })

                    let created = 0
                    let updated = 0

                    for (const row of rows) {
                        const projectRaw = row['Project']
                        const nameRaw = row['Name']
                        const statusRaw = row['Status']
                        const workLocationRaw = row['Work Location']

                        const name = (nameRaw || '').toString().trim()
                        const project = (projectRaw || '').toString().trim()
                        const address = (workLocationRaw || '').toString().trim()

                        if (!name && !project && !address) {
                            // Skip completely empty rows
                            // eslint-disable-next-line no-continue
                            continue
                        }

                        const statusText = (statusRaw || '').toString().trim()
                        const normalizedStatus = statusText || 'In Progress'
                        const active = normalizedStatus !== 'Inactive'

                        const jobData = {
                            project,
                            name,
                            address,
                            status: normalizedStatus,
                            active,
                        }

                        let existingJob = null
                        if (project) {
                            existingJob = byProject.get(project.toLowerCase()) || null
                        }
                        if (!existingJob && name) {
                            const key = `${name.toLowerCase()}|${address.toLowerCase()}`
                            existingJob = byNameAddress.get(key) || null
                        }

                        if (existingJob) {
                            await updateJob(existingJob.id, jobData, { silent: true })
                            updated += 1
                        } else {
                            await createJob(jobData, { silent: true })
                            created += 1
                        }
                    }

                    toast.push(
                        React.createElement(
                            Notification,
                            { type: 'success', duration: 4000, title: 'Jobs import completed' },
                            `${created} job(s) created, ${updated} job(s) updated.`,
                        ),
                    )
                } catch (error) {
                    console.error('Failed to import jobs from Excel:', error)
                    toast.push(
                        React.createElement(
                            Notification,
                            { type: 'danger', duration: 4000, title: 'Jobs import failed' },
                            'Failed to import jobs. Please make sure the columns are: Project, Name, Status, Work Location.',
                        ),
                    )
                } finally {
                    setJobsImporting(false)
                }
            }

            reader.readAsArrayBuffer(file)
        } catch (error) {
            console.error('Failed to read jobs import file:', error)
            setJobsImporting(false)
        }
    }

    const handleBulkDeleteJobs = async () => {
        if (selectedJobIds.length === 0) return
        if (!window.confirm(`Are you sure you want to delete ${selectedJobIds.length} job(s)? This action cannot be undone.`)) {
            return
        }
        let deleted = 0
        for (const id of selectedJobIds) {
            // eslint-disable-next-line no-await-in-loop
            const result = await deleteJob(id, { silent: true })
            if (result?.success) deleted += 1
        }
        setSelectedJobIds([])
        if (deleted > 0) {
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'success', duration: 3000, title: 'Jobs deleted' },
                    `${deleted} job(s) deleted successfully.`,
                ),
            )
        }
    }

    const handleBulkChangeStatus = async () => {
        if (selectedJobIds.length === 0) return
        let changed = 0
        for (const id of selectedJobIds) {
            // eslint-disable-next-line no-await-in-loop
            const result = await updateJob(id, { status: bulkStatus }, { silent: true })
            if (result?.success) changed += 1
        }
        if (changed > 0) {
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'success', duration: 3000, title: 'Status updated' },
                    `Status updated to "${bulkStatus}" for ${changed} job(s).`,
                ),
            )
        }
    }

    // ---------- Schedule helpers ----------

    const employeeOptionsForSchedule = useMemo(
        () =>
            employees.map((emp) => ({
                value: emp.id,
                label: emp.name || 'Unnamed',
            })),
        [employees],
    )

    const jobOptionsForSchedule = useMemo(
        () =>
            jobs.map((job) => ({
                value: job.id,
                label: job.name || 'Untitled Job',
            })),
        [jobs],
    )

    const handleAddScheduleRow = () => {
        setScheduleAssignments((prev) => [
            ...prev,
            {
                id: `local-${Date.now()}-${prev.length}`,
                employeeId: '',
                employeeName: '',
                jobId: '',
                jobName: '',
                jobAddress: '',
                costCode: '',
                w2Hours: '',
                scheduledTasks: '',
                addedTasks: '',
                notes: '',
                tasksNotCompleted: '',
                materialsNeeded: '',
                exceptionAcknowledged: false,
                unmergedFromJob: false,
            },
        ])
    }

    const handleRemoveScheduleRow = (index) => {
        setScheduleAssignments((prev) => {
            const filtered = prev.filter((_, i) => i !== index)
            // Ensure at least 30 rows
            const minRows = 30
            if (filtered.length < minRows) {
                // Add empty rows to reach minimum
                const needed = minRows - filtered.length
                const newRows = Array.from({ length: needed }, (_, i) => ({
                    id: `local-${Date.now()}-${filtered.length + i}`,
                    employeeId: '',
                    employeeName: '',
                    jobId: '',
                    jobName: '',
                    jobAddress: '',
                    costCode: '',
                    w2Hours: '',
                    scheduledTasks: '',
                    addedTasks: '',
                    notes: '',
                    tasksNotCompleted: '',
                    materialsNeeded: '',
                    exceptionAcknowledged: false,
                    unmergedFromJob: false,
                }))
                return [...filtered, ...newRows]
            }
            return filtered
        })
    }

    const updateScheduleRow = (index, changes) => {
        const isExceptionField =
            changes.addedTasks !== undefined ||
            changes.notes !== undefined ||
            changes.tasksNotCompleted !== undefined

        setScheduleAssignments((prev) =>
            prev.map((row, i) => {
                if (i !== index) return row
                const updated = { ...row, ...changes }
                // If job changed, clear merged fields to allow new values
                if (changes.jobId !== undefined) {
                    const job = jobs.find((j) => j.id === changes.jobId)
                    if (job) {
                        updated.jobName = job.name || ''
                        updated.jobAddress = job.address || ''
                    }
                }
                // Re-trigger exception when user edits Added Tasks, Notes, or Tasks Not Completed
                if (isExceptionField) {
                    updated.exceptionAcknowledged = false
                }
                return updated
            }),
        )
    }

    const handleExportScheduleToExcel = () => {
        try {
            const validAssignments = scheduleAssignments.filter(
                (row) => row.employeeId && row.jobId,
            )

            if (validAssignments.length === 0) {
                alert('No assignments to export. Please add at least one row with an employee and a job.')
                return
            }

            // Prepare export data
            const exportData = validAssignments.map((row) => {
                const employee = employees.find((e) => e.id === row.employeeId)
                const job = jobs.find((j) => j.id === row.jobId)

                return {
                    'Day': getDayOfWeek(scheduleDate),
                    'Date': formatDateOnly(scheduleDate),
                    'Employee Name': employee?.name || row.employeeName || '',
                    'Cost Code': row.costCode || '',
                    'W2 Hours Worked': row.w2Hours || '',
                    'Job Name': job?.name || row.jobName || '',
                    'Address': job?.address || row.jobAddress || '',
                    'Scheduled Tasks': row.scheduledTasks || '',
                    'Added Tasks': row.addedTasks || '',
                    'Notes': row.notes || '',
                    'Tasks Not Completed / Need More Time': row.tasksNotCompleted || '',
                    'Materials Needed': row.materialsNeeded || '',
                }
            })

            // Create workbook and worksheet
            const ws = XLSX.utils.json_to_sheet(exportData)
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'Schedule')

            // Generate filename with date
            const dateStr = formatDateOnly(scheduleDate).replace(/\//g, '-')
            const filename = `Crew_Schedule_${dateStr}.xlsx`

            // Write file and trigger download
            XLSX.writeFile(wb, filename)
        } catch (error) {
            console.error('Failed to export schedule to Excel:', error)
            alert('Failed to export schedule to Excel. Please try again.')
        }
    }

    const handleSaveSchedule = async () => {
        setScheduleError('')
        setScheduleSendSuccess('')

        const validAssignments = scheduleAssignments.filter(
            (row) => row.employeeId && row.jobId,
        )

        if (validAssignments.length === 0) {
            setScheduleError('Please add at least one row with an employee and a job before saving.')
            return
        }

        setScheduleSaving(true)
        try {
            // Enrich with denormalized employee/job data
            const assignmentsToSave = validAssignments.map((row) => {
                const employee = employees.find((e) => e.id === row.employeeId)
                const job = jobs.find((j) => j.id === row.jobId)

                return {
                    employeeId: row.employeeId,
                    employeeName: employee?.name || row.employeeName || '',
                    jobId: row.jobId,
                    jobName: job?.name || row.jobName || '',
                    jobAddress: job?.address || row.jobAddress || '',
                    costCode: row.costCode || '',
                    w2Hours: row.w2Hours || '',
                    scheduledTasks: row.scheduledTasks || '',
                    addedTasks: row.addedTasks || '',
                    notes: row.notes || '',
                    tasksNotCompleted: row.tasksNotCompleted || '',
                    materialsNeeded: row.materialsNeeded || '',
                    exceptionAcknowledged: Boolean(row.exceptionAcknowledged),
                    unmergedFromJob: Boolean(row.unmergedFromJob),
                }
            })

            const response = await FirebaseDbService.crewSchedules.saveAssignments(
                scheduleDate,
                assignmentsToSave,
            )

            if (!response.success) {
                setScheduleError(response.error || 'Failed to save schedule.')
            } else {
                setScheduleSendSuccess('Schedule saved successfully.')
            }
        } catch (error) {
            console.error('Failed to save crew schedule:', error)
            setScheduleError(error.message || 'Failed to save schedule.')
        } finally {
            setScheduleSaving(false)
        }
    }

    const handleSendScheduleMessages = async () => {
        setScheduleError('')
        setScheduleSendSuccess('')

        const validAssignments = scheduleAssignments.filter(
            (row) => row.employeeId && row.jobId,
        )

        if (validAssignments.length === 0) {
            setScheduleError('Please add at least one row with an employee and a job before sending messages.')
            return
        }

        setSendingMessages(true)
        try {
            const { getFunctions, httpsCallable } = await import('firebase/functions')
            const functions = getFunctions()
            const sendCrewMessageFn = httpsCallable(functions, 'sendCrewMessage')

            const dateLabel = formatDateOnly(scheduleDate)

            const results = []

            // Group by jobId to get merged data
            const jobGroups = new Map()
            validAssignments.forEach((row) => {
                if (!row.jobId) return
                if (!jobGroups.has(row.jobId)) {
                    jobGroups.set(row.jobId, [])
                }
                jobGroups.get(row.jobId).push(row)
            })

            for (const row of validAssignments) {
                const employee = employees.find((e) => e.id === row.employeeId)
                const job = jobs.find((j) => j.id === row.jobId)

                if (!employee || !employee.phone) {
                    results.push({
                        row,
                        success: false,
                        error: 'Missing employee phone number',
                    })
                    // Skip sending for this row
                    // eslint-disable-next-line no-continue
                    continue
                }

                if (!job || !job.address) {
                    results.push({
                        row,
                        success: false,
                        error: 'Missing job address',
                    })
                    // eslint-disable-next-line no-continue
                    continue
                }

                // Get merged data from first row in group (if multiple employees share job)
                const groupRows = jobGroups.get(row.jobId) || [row]
                const mergedRow = groupRows[0] // Use first row's merged fields

                const notesParts = []
                if (mergedRow.notes) {
                    notesParts.push(mergedRow.notes)
                }
                if (mergedRow.materialsNeeded) {
                    notesParts.push(`Materials: ${mergedRow.materialsNeeded}`)
                }
                if (mergedRow.tasksNotCompleted) {
                    notesParts.push(`Pending: ${mergedRow.tasksNotCompleted}`)
                }

                const payload = {
                    employeeIds: [employee.id],
                    jobName: job.name || row.jobName || 'Job',
                    jobAddress: job.address || mergedRow.jobAddress || '',
                    tasks: mergedRow.scheduledTasks || '',
                    date: dateLabel,
                    notes: notesParts.join(' | ') || '',
                }

                try {
                    // eslint-disable-next-line no-await-in-loop
                    const result = await sendCrewMessageFn(payload)
                    const data = result?.data || {}

                    if (data.failed && data.failed > 0) {
                        results.push({
                            row,
                            success: false,
                            error:
                                (data.results &&
                                    data.results.find((r) => !r.success)?.error) ||
                                'Failed to send',
                        })
                    } else {
                        results.push({ row, success: true })
                    }
                } catch (error) {
                    console.error('Failed to send schedule message for row:', row, error)
                    results.push({
                        row,
                        success: false,
                        error: error.message || 'Failed to send',
                    })
                }
            }

            const successCount = results.filter((r) => r.success).length
            const failureDetails = results.filter((r) => !r.success)

            if (failureDetails.length > 0) {
                const detailText = failureDetails
                    .map((fd) => {
                        const employee = employees.find((e) => e.id === fd.row.employeeId)
                        return `${employee?.name || 'Unknown'}: ${fd.error}`
                    })
                    .join('; ')
                setScheduleError(
                    `${failureDetails.length} message(s) failed. ${detailText}`,
                )
            } else {
                setScheduleError('')
            }

            setScheduleSendSuccess(
                successCount > 0
                    ? `${successCount} message(s) sent successfully from the schedule.`
                    : 'No messages were sent.',
            )
        } catch (error) {
            console.error('Failed to send crew schedule messages:', error)
            const errorMessage =
                error?.message || error?.code || 'Failed to send messages from schedule.'
            setScheduleError(errorMessage)
            setScheduleSendSuccess('')
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
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            <Select
                                className="min-w-[160px]"
                                options={jobStatusOptions}
                                value={jobStatusOptions.find(opt => opt.value === bulkStatus) || jobStatusOptions[1]}
                                onChange={(option) => {
                                    if (option) setBulkStatus(option.value)
                                }}
                                menuPortalTarget={document.body}
                                menuPosition="fixed"
                                styles={{
                                    menuPortal: (provided) => ({ ...provided, zIndex: 10000 }),
                                    menu: (provided) => ({ ...provided, zIndex: 10000 }),
                                }}
                            />
                            <Button
                                variant="twoTone"
                                disabled={selectedJobIds.length === 0}
                                onClick={handleBulkChangeStatus}
                                className="w-full sm:w-auto"
                            >
                                Apply Status ({selectedJobIds.length})
                            </Button>
                            <Button
                                variant="twoTone"
                                disabled={selectedJobIds.length === 0}
                                onClick={handleBulkDeleteJobs}
                                className="w-full sm:w-auto text-red-600"
                            >
                                Delete Selected
                            </Button>
                        </div>
                        <Button
                            variant="twoTone"
                            onClick={handleExportJobsToExcel}
                            className="w-full sm:w-auto"
                        >
                            Export Jobs
                        </Button>
                        <Button
                            variant="twoTone"
                            onClick={handleImportJobsFromExcelClick}
                            loading={jobsImporting}
                            className="w-full sm:w-auto"
                        >
                            Import Jobs
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
                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            ref={jobsFileInputRef}
                            onChange={handleJobsFileChange}
                            className="hidden"
                        />
                    </div>
                )}
            </div>

            {/* Tabs */}
            <Card>
                <div className="p-4 md:p-6 space-y-4">
                    {/* Tab Navigation */}
                    <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 items-center justify-between">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setActiveTab('employees')}
                                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
                                    activeTab === 'employees'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                                }`}
                            >
                                Employees
                                <Tag className="bg-primary/10 text-primary border-primary/20">
                                    {activeEmployees.length}
                                </Tag>
                            </button>
                            <button
                                onClick={() => setActiveTab('jobs')}
                                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
                                    activeTab === 'jobs'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                                }`}
                            >
                                Jobs
                                <Tag className="bg-primary/10 text-primary border-primary/20">
                                    {activeJobs.length + inactiveJobs.length}
                                </Tag>
                            </button>
                            <button
                                onClick={() => setActiveTab('schedule')}
                                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                                    activeTab === 'schedule'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                                }`}
                            >
                                Schedule
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
                        {/* Job sub-tabs and search on the right */}
                        {activeTab === 'jobs' && (
                            <div className="flex items-center gap-3">
                                <div className="flex-1 max-w-md min-w-[320px]">
                                    <Input
                                        placeholder="Search by project, name, address, or tasks..."
                                        value={jobFilters.search || ''}
                                        onChange={(e) => setJobFilters({ ...jobFilters, search: e.target.value })}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setJobSubTab('active')}
                                        className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
                                            jobSubTab === 'active'
                                                ? 'border-primary text-primary'
                                                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                                        }`}
                                    >
                                        Active Jobs
                                        <Tag className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-700">
                                            {activeJobs.length}
                                        </Tag>
                                    </button>
                                    <button
                                        onClick={() => setJobSubTab('inactive')}
                                        className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
                                            jobSubTab === 'inactive'
                                                ? 'border-primary text-primary'
                                                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                                        }`}
                                    >
                                        Inactive Jobs
                                        <Tag className="bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 border-gray-300 dark:border-gray-700">
                                            {inactiveJobs.length}
                                        </Tag>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'employees' && (
                        <EmployeesTab
                            filters={employeeFilters}
                            setFilters={setEmployeeFilters}
                            columns={employeeColumns}
                            data={filteredEmployees}
                            loading={employeesLoading}
                        />
                    )}

                    {activeTab === 'jobs' && (
                        <JobsTab
                            filters={jobFilters}
                            setFilters={setJobFilters}
                            columns={jobColumns}
                            data={filteredJobs}
                            loading={jobsLoading}
                            selectable
                            defaultPageSize={100}
                            onCheckBoxChange={handleJobCheckboxChange}
                            onIndeterminateCheckBoxChange={handleJobSelectAllChange}
                            checkboxChecked={isJobSelected}
                        />
                    )}

                    {activeTab === 'messages' && (
                        <MessagesTab
                            messageHistory={messageHistory}
                            messageHistoryLoading={messageHistoryLoading}
                            messageHistoryError={messageHistoryError}
                            formatDateOnly={formatDateOnly}
                        />
                    )}

                    {activeTab === 'schedule' && (
                        <ScheduleTab
                            scheduleError={scheduleError}
                            scheduleSendSuccess={scheduleSendSuccess}
                            scheduleDate={scheduleDate}
                            setScheduleDate={setScheduleDate}
                            getDayOfWeek={getDayOfWeek}
                            scheduleLoading={scheduleLoading}
                            handleAddScheduleRow={handleAddScheduleRow}
                            handleSaveSchedule={handleSaveSchedule}
                            scheduleSaving={scheduleSaving}
                            handleSendScheduleMessages={handleSendScheduleMessages}
                            sendingMessages={sendingMessages}
                            handleExportScheduleToExcel={handleExportScheduleToExcel}
                            scheduleAssignments={scheduleAssignments}
                            employeeOptionsForSchedule={employeeOptionsForSchedule}
                            jobOptionsForSchedule={jobOptionsForSchedule}
                            updateScheduleRow={updateScheduleRow}
                            handleRemoveScheduleRow={handleRemoveScheduleRow}
                            jobs={jobs}
                        />
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
