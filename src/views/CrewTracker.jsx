import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Button, Card, Input, Select, Tag, Tooltip } from '@/components/ui'
import DataTable from '@/components/shared/DataTable'
import { useCrewEmployeeStore } from '@/store/crewEmployeeStore'
import { useCrewJobStore } from '@/store/crewJobStore'
import { 
    HiOutlinePlus, 
    HiOutlineEye, 
    HiOutlinePencil, 
    HiOutlineTrash,
    HiOutlineRefresh 
} from 'react-icons/hi'
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
            size: 250,
            cell: ({ row }) => {
                const job = row.original
                return (
                    <span className="font-medium">{job.name || '-'}</span>
                )
            },
        },
        {
            header: 'Address',
            accessorKey: 'address',
            size: 300,
            cell: ({ row }) => {
                const address = row.original.address
                if (!address) return <span className="text-sm text-gray-400">-</span>
                const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
                return (
                    <a
                        href={googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                    >
                        {address}
                    </a>
                )
            },
        },
        {
            header: 'Tasks',
            accessorKey: 'tasks',
            size: 200,
            cell: ({ row }) => {
                const tasks = row.original.tasks
                if (!tasks) return <span className="text-gray-400">-</span>
                return (
                    <span className="text-sm line-clamp-2" title={tasks}>
                        {tasks}
                    </span>
                )
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
    ], [navigate, updateJob])

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
                        <div className="pt-4">
                            <p className="text-gray-600 dark:text-gray-400">
                                Messages history coming soon...
                            </p>
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
