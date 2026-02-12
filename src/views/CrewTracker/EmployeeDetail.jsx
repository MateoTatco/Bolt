import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Card, Button, Input, Select, FormContainer, FormItem, Tag, Tooltip } from '@/components/ui'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { useCrewEmployeeStore } from '@/store/crewEmployeeStore'
import { HiOutlineArrowLeft, HiOutlinePencil, HiOutlineCheck, HiOutlineX } from 'react-icons/hi'
import { toast } from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import * as XLSX from 'xlsx'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/configs/firebase.config'

const EmployeeDetail = () => {
    const { employeeId } = useParams()
    const navigate = useNavigate()
    const [employee, setEmployee] = useState(null)
    const [loading, setLoading] = useState(true)
    const [isEditing, setIsEditing] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        language: 'en',
        active: true,
    })
    const [errors, setErrors] = useState({})
    const [saving, setSaving] = useState(false)
    const { updateEmployee } = useCrewEmployeeStore()
    const [exportingSchedule, setExportingSchedule] = useState(false)

    // Load employee data
    useEffect(() => {
        const loadEmployee = async () => {
            setLoading(true)
            try {
                const response = await FirebaseDbService.crewEmployees.getById(employeeId)
                if (response.success) {
                    const emp = response.data
                    setEmployee(emp)
                    setFormData({
                        name: emp.name || '',
                        phone: emp.phone || '',
                        email: emp.email || '',
                        language: emp.language || 'en',
                        active: emp.active !== undefined ? emp.active : true,
                    })
                } else {
                    toast.push(
                        React.createElement(
                            Notification,
                            { type: 'danger', duration: 2500, title: 'Error' },
                            'Employee not found',
                        ),
                    )
                    navigate('/crew-tracker')
                }
            } catch (error) {
                console.error('Error loading employee:', error)
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'danger', duration: 2500, title: 'Error' },
                        'Failed to load employee',
                    ),
                )
            } finally {
                setLoading(false)
            }
        }

        if (employeeId) {
            loadEmployee()
        }
    }, [employeeId, navigate])

    // Format phone number for display
    const formatPhoneDisplay = (phone) => {
        if (!phone) return '-'
        const cleaned = phone.replace(/^\+1/, '').replace(/\D/g, '')
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
        }
        return phone
    }

    // Format phone number as user types
    const formatPhoneNumber = (value) => {
        const digitsOnly = value.replace(/\D/g, '')
        if (digitsOnly.length <= 3) {
            return digitsOnly
        } else if (digitsOnly.length <= 6) {
            return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`
        } else {
            return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6, 10)}`
        }
    }

    const handleChange = (field, value) => {
        if (field === 'phone') {
            const formatted = formatPhoneNumber(value)
            setFormData(prev => ({ ...prev, [field]: formatted }))
            if (errors.phone) {
                setErrors(prev => ({ ...prev, phone: null }))
            }
        } else {
            setFormData(prev => ({ ...prev, [field]: value }))
            if (errors[field]) {
                setErrors(prev => ({ ...prev, [field]: null }))
            }
        }
    }

    const validate = () => {
        const newErrors = {}
        
        if (!formData.name.trim()) {
            newErrors.name = 'Name is required'
        }
        
        if (!formData.phone) {
            newErrors.phone = 'Phone number is required'
        } else {
            const digitsOnly = formData.phone.replace(/\D/g, '')
            if (digitsOnly.length < 10 || digitsOnly.length > 11) {
                newErrors.phone = 'Phone number must be 10-11 digits'
            }
        }
        
        if (formData.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(formData.email)) {
                newErrors.email = 'Invalid email format'
            }
        }
        
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSave = async () => {
        if (!validate()) {
            return
        }

        setSaving(true)
        try {
            // Normalize phone number
            let normalizedPhone = formData.phone.replace(/\D/g, '')
            if (normalizedPhone.length === 10) {
                normalizedPhone = `+1${normalizedPhone}`
            } else if (normalizedPhone.length === 11 && normalizedPhone.startsWith('1')) {
                normalizedPhone = `+${normalizedPhone}`
            } else if (!normalizedPhone.startsWith('+')) {
                normalizedPhone = `+${normalizedPhone}`
            }

            const employeeData = {
                ...formData,
                phone: normalizedPhone,
                email: formData.email.trim() || null,
            }

            await updateEmployee(employeeId, employeeData)
            setIsEditing(false)
            
            // Reload employee data
            const response = await FirebaseDbService.crewEmployees.getById(employeeId)
            if (response.success) {
                setEmployee(response.data)
            }
        } catch (error) {
            console.error('Error saving employee:', error)
        } finally {
            setSaving(false)
        }
    }

    const handleCancel = () => {
        if (employee) {
            setFormData({
                name: employee.name || '',
                phone: employee.phone || '',
                email: employee.email || '',
                language: employee.language || 'en',
                active: employee.active !== undefined ? employee.active : true,
            })
        }
        setErrors({})
        setIsEditing(false)
    }

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

    const safeFileNamePart = (str) => {
        if (!str) return 'employee'
        return String(str).replace(/[^a-z0-9_\-]+/gi, '_').substring(0, 50)
    }

    const handleExportScheduleToExcel = async () => {
        if (!employee) return
        setExportingSchedule(true)
        try {
            const schedulesRef = collection(db, 'crewSchedules')
            const schedulesSnap = await getDocs(schedulesRef)

            const exportRows = []

            // For each schedule (date), load assignments and filter by this employee
            // Note: this iterates through all days with schedules; acceptable for expected scale.
            // If data grows large, we can optimize with indexes or range filters.
            for (const scheduleDoc of schedulesSnap.docs) {
                const scheduleData = scheduleDoc.data()
                let jsDate
                if (scheduleData.date?.toDate) {
                    jsDate = scheduleData.date.toDate()
                } else {
                    // Fallback: parse from document ID (YYYY-MM-DD)
                    jsDate = new Date(scheduleDoc.id)
                }

                const assignmentsRef = collection(db, 'crewSchedules', scheduleDoc.id, 'assignments')
                const assignmentsSnap = await getDocs(assignmentsRef)

                assignmentsSnap.forEach((assignmentDoc) => {
                    const a = assignmentDoc.data()
                    if (a.employeeId !== employeeId) return

                    exportRows.push({
                        'Date': formatDateOnly(jsDate),
                        'Day': jsDate.toLocaleDateString('en-US', { weekday: 'long' }),
                        'Employee Name': a.employeeName || employee.name || '',
                        'Cost Code': a.costCode || '',
                        'W2 Hours Worked': a.w2Hours || '',
                        'Job Name': a.jobName || '',
                        'Address': a.jobAddress || '',
                        'Scheduled Tasks': a.scheduledTasks || '',
                        'Added Tasks': a.addedTasks || '',
                        'Notes': a.notes || '',
                        'Tasks Not Completed / Need More Time': a.tasksNotCompleted || '',
                        'Materials Needed': a.materialsNeeded || '',
                    })
                })
            }

            if (exportRows.length === 0) {
                alert('No schedule assignments found for this employee.')
                return
            }

            const ws = XLSX.utils.json_to_sheet(exportRows)
            const wb = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(wb, ws, 'Schedule')

            const employeePart = safeFileNamePart(employee.name || employeeId)
            const today = new Date().toISOString().split('T')[0]
            const filename = `Employee_Schedule_${employeePart}_${today}.xlsx`

            XLSX.writeFile(wb, filename)
        } catch (error) {
            console.error('Failed to export employee schedule to Excel:', error)
            alert('Failed to export employee schedule. Please try again.')
        } finally {
            setExportingSchedule(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading employee...</p>
                </div>
            </div>
        )
    }

    if (!employee) {
        return null
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button
                        variant="plain"
                        icon={<HiOutlineArrowLeft />}
                        onClick={() => navigate('/crew-tracker')}
                    />
                    <div>
                        <h1 className="text-2xl font-bold">{employee.name}</h1>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                            Employee Details
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {!isEditing && (
                        <Button
                            variant="solid"
                            icon={<HiOutlinePencil />}
                            onClick={() => setIsEditing(true)}
                        >
                            Edit
                        </Button>
                    )}
                    <Button
                        variant="twoTone"
                        loading={exportingSchedule}
                        onClick={handleExportScheduleToExcel}
                    >
                        Export schedule to Excel
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <Card>
                <div className="p-6">
                    {isEditing ? (
                        <FormContainer>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormItem
                                    label="Name *"
                                    invalid={!!errors.name}
                                    errorMessage={errors.name}
                                >
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => handleChange('name', e.target.value)}
                                    />
                                </FormItem>

                                <FormItem
                                    label="Phone Number *"
                                    invalid={!!errors.phone}
                                    errorMessage={errors.phone}
                                >
                                    <Input
                                        value={formData.phone}
                                        onChange={(e) => handleChange('phone', e.target.value)}
                                        maxLength={14}
                                    />
                                </FormItem>

                                <FormItem
                                    label="Email"
                                    invalid={!!errors.email}
                                    errorMessage={errors.email}
                                >
                                    <Input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => handleChange('email', e.target.value)}
                                    />
                                </FormItem>

                                <FormItem label="Language">
                                    <Select
                                        options={[
                                            { value: 'en', label: 'English' },
                                            { value: 'es', label: 'Spanish' },
                                        ]}
                                        value={formData.language}
                                        onChange={(option) => handleChange('language', option.value)}
                                    />
                                </FormItem>

                                <FormItem label="Status">
                                    <Select
                                        options={[
                                            { value: true, label: 'Active' },
                                            { value: false, label: 'Inactive' },
                                        ]}
                                        value={formData.active}
                                        onChange={(option) => handleChange('active', option.value)}
                                    />
                                </FormItem>
                            </div>

                            <div className="flex justify-end gap-2 mt-6">
                                <Button
                                    variant="plain"
                                    icon={<HiOutlineX />}
                                    onClick={handleCancel}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="solid"
                                    icon={<HiOutlineCheck />}
                                    onClick={handleSave}
                                    loading={saving}
                                >
                                    Save Changes
                                </Button>
                            </div>
                        </FormContainer>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Name
                                </label>
                                <p className="mt-1 text-gray-900 dark:text-gray-100">
                                    {employee.name || '-'}
                                </p>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Phone Number
                                </label>
                                <p className="mt-1 text-gray-900 dark:text-gray-100">
                                    {formatPhoneDisplay(employee.phone)}
                                </p>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Email
                                </label>
                                <p className="mt-1 text-gray-900 dark:text-gray-100">
                                    {employee.email || '-'}
                                </p>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Language
                                </label>
                                <div className="mt-1">
                                    <Tag className={employee.language === 'es' 
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                        : ''
                                    }>
                                        {employee.language === 'es' ? 'Spanish' : 'English'}
                                    </Tag>
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Status
                                </label>
                                <div className="mt-1">
                                    <Tag className={employee.active !== false
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                        : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                                    }>
                                        {employee.active !== false ? 'Active' : 'Inactive'}
                                    </Tag>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {/* Message History Section - Coming Soon */}
            <Card>
                <div className="p-6">
                    <h2 className="text-lg font-semibold mb-4">Message History</h2>
                    <p className="text-gray-600 dark:text-gray-400">
                        Message history will be displayed here once messaging is implemented.
                    </p>
                </div>
            </Card>
        </div>
    )
}

export default EmployeeDetail

