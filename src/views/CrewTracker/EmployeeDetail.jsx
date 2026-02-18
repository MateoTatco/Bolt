import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Card, Button, Input, Select, FormContainer, FormItem, Tag, Tooltip } from '@/components/ui'
import DatePickerRange from '@/components/ui/DatePicker/DatePickerRange'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { useCrewEmployeeStore } from '@/store/crewEmployeeStore'
import { HiOutlineArrowLeft, HiOutlinePencil, HiOutlineCheck, HiOutlineX, HiOutlineChatAlt2, HiOutlineTrash } from 'react-icons/hi'
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
        firstName: '',
        lastName: '',
        nickname: '',
        phone: '',
        email: '',
        language: 'en',
        active: true,
        timeOffRanges: [],
    })
    const [errors, setErrors] = useState({})
    const [saving, setSaving] = useState(false)
    const { updateEmployee } = useCrewEmployeeStore()
    const [exportingSchedule, setExportingSchedule] = useState(false)
    const [messageHistory, setMessageHistory] = useState([])
    const [messageHistoryLoading, setMessageHistoryLoading] = useState(true)
    const [messageHistoryError, setMessageHistoryError] = useState('')
    const [messageSearchQuery, setMessageSearchQuery] = useState('')

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
                        firstName: emp.firstName || '',
                        lastName: emp.lastName || '',
                        nickname: emp.nickname || '',
                        phone: emp.phone || '',
                        email: emp.email || '',
                        language: emp.language || 'en',
                        active: emp.active !== undefined ? emp.active : true,
                        timeOffRanges: emp.timeOffRanges || [],
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

    // Load and subscribe to crew messages for this employee
    useEffect(() => {
        if (!employeeId) {
            setMessageHistoryLoading(false)
            return
        }

        const loadOnce = async () => {
            setMessageHistoryLoading(true)
            setMessageHistoryError('')
            try {
                const response = await FirebaseDbService.crewMessages.getAll()
                if (response.success) {
                    const all = response.data || []
                    const forEmployee = all.filter((msg) => msg.employeeId === employeeId)
                    setMessageHistory(forEmployee)
                } else {
                    setMessageHistoryError(response.error || 'Failed to load messages')
                }
            } catch (error) {
                console.error('Failed to load crew messages for employee:', error)
                setMessageHistoryError(error?.message || 'Failed to load messages')
            } finally {
                setMessageHistoryLoading(false)
            }
        }

        loadOnce()

        const unsubscribe = FirebaseDbService.crewMessages.subscribe((messages) => {
            const forEmployee = (messages || []).filter((msg) => msg.employeeId === employeeId)
            setMessageHistory(forEmployee)
        })

        return () => {
            if (unsubscribe) unsubscribe()
        }
    }, [employeeId])

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
        
        if (!formData.firstName.trim()) {
            newErrors.firstName = 'First name is required'
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

            const firstName = formData.firstName.trim()
            const lastName = formData.lastName.trim()
            const nickname = formData.nickname.trim()
            const combinedNameBase = `${firstName} ${lastName}`.trim() || nickname || ''

            // Process time-off ranges
            const processedTimeOffRanges = (formData.timeOffRanges || []).map(range => ({
                start: range.start,
                end: range.end,
            }))

            const employeeData = {
                ...formData,
                firstName: firstName || null,
                lastName: lastName || null,
                nickname: nickname || null,
                // Maintain a combined name string for existing tables/search
                name: combinedNameBase
                    ? (nickname && (firstName || lastName) ? `${combinedNameBase} (${nickname})` : combinedNameBase)
                    : (employee?.name || null),
                phone: normalizedPhone,
                email: formData.email.trim() || null,
                timeOffRanges: processedTimeOffRanges,
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
                firstName: employee.firstName || '',
                lastName: employee.lastName || '',
                nickname: employee.nickname || '',
                phone: employee.phone || '',
                email: employee.email || '',
                language: employee.language || 'en',
                active: employee.active !== undefined ? employee.active : true,
                timeOffRanges: employee.timeOffRanges || [],
            })
        }
        setErrors({})
        setIsEditing(false)
    }

    const formatMessageDate = (ts) => {
        if (!ts) return ''
        let d
        if (ts.toDate) d = ts.toDate()
        else if (ts instanceof Date) d = ts
        else if (typeof ts === 'string') {
            const parsed = new Date(ts)
            d = Number.isNaN(parsed.getTime()) ? null : parsed
        }
        if (!d) return ''
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        const year = d.getFullYear()
        return `${month}/${day}/${year}`
    }

    const formatMessageTime = (ts) => {
        if (!ts) return ''
        let d
        if (ts.toDate) d = ts.toDate()
        else if (ts instanceof Date) d = ts
        else if (typeof ts === 'string') {
            const parsed = new Date(ts)
            d = Number.isNaN(parsed.getTime()) ? null : parsed
        }
        if (!d) return ''
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }

    // Message list for this employee (chronological, oldest first)
    const employeeMessages = useMemo(() => {
        const list = (messageHistory || []).filter((msg) => msg.employeeId === employeeId)
        return list.sort((a, b) => {
            const aTs = a.sentAt || a.date
            const bTs = b.sentAt || b.date
            const aTime = aTs?.toDate ? aTs.toDate().getTime() : (aTs instanceof Date ? aTs.getTime() : 0)
            const bTime = bTs?.toDate ? bTs.toDate().getTime() : (bTs instanceof Date ? bTs.getTime() : 0)
            return aTime - bTime
        })
    }, [messageHistory, employeeId])

    // Filter messages by search query (body, job name, address, date/time)
    const filteredEmployeeMessages = useMemo(() => {
        const q = (messageSearchQuery || '').trim().toLowerCase()
        if (!q) return employeeMessages
        return employeeMessages.filter((msg) => {
            const sentAt = msg.sentAt || msg.date
            const dateStr = sentAt ? `${formatMessageDate(sentAt)} ${formatMessageTime(sentAt)}` : ''
            const text = [
                msg.body,
                msg.tasks,
                msg.notes,
                msg.jobName,
                msg.jobAddress,
                dateStr,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
            return text.includes(q)
        })
    }, [employeeMessages, messageSearchQuery])

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

            // Prepare time-off ranges data
            const timeOffRows = []
            if (employee.timeOffRanges && Array.isArray(employee.timeOffRanges) && employee.timeOffRanges.length > 0) {
                employee.timeOffRanges.forEach((range, index) => {
                    let startDate = range.start
                    let endDate = range.end
                    
                    if (startDate?.toDate) startDate = startDate.toDate()
                    else if (typeof startDate === 'string') startDate = new Date(startDate)
                    
                    if (endDate?.toDate) endDate = endDate.toDate()
                    else if (typeof endDate === 'string') endDate = new Date(endDate)

                    timeOffRows.push({
                        'Time Off Range': `Range ${index + 1}`,
                        'Start Date': formatDateOnly(startDate),
                        'End Date': formatDateOnly(endDate),
                    })
                })
            }

            // Create workbook with multiple sheets
            const wb = XLSX.utils.book_new()
            
            // Schedule sheet
            if (exportRows.length > 0) {
                const ws = XLSX.utils.json_to_sheet(exportRows)
                XLSX.utils.book_append_sheet(wb, ws, 'Schedule')
            }

            // Time Off Ranges sheet
            if (timeOffRows.length > 0) {
                const wsTimeOff = XLSX.utils.json_to_sheet(timeOffRows)
                XLSX.utils.book_append_sheet(wb, wsTimeOff, 'Time Off Ranges')
            }

            if (exportRows.length === 0 && timeOffRows.length === 0) {
                alert('No schedule assignments or time-off ranges found for this employee.')
                return
            }

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
                        <h1 className="text-2xl font-bold">
                            {employee.firstName || employee.lastName
                                ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim()
                                : (employee.name || '-')}
                        </h1>
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
                                    label="First Name *"
                                    invalid={!!errors.firstName}
                                    errorMessage={errors.firstName}
                                >
                                    <Input
                                        value={formData.firstName}
                                        onChange={(e) => handleChange('firstName', e.target.value)}
                                    />
                                </FormItem>

                                <FormItem
                                    label="Last Name"
                                    invalid={!!errors.lastName}
                                    errorMessage={errors.lastName}
                                >
                                    <Input
                                        value={formData.lastName}
                                        onChange={(e) => handleChange('lastName', e.target.value)}
                                    />
                                </FormItem>

                                <FormItem
                                    label="Nickname / Role hint (optional)"
                                    invalid={!!errors.nickname}
                                    errorMessage={errors.nickname}
                                >
                                    <Input
                                        value={formData.nickname}
                                        onChange={(e) => handleChange('nickname', e.target.value)}
                                        placeholder="e.g. Painter, Door Jamie"
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

                            <FormItem label="Time Off Ranges">
                                <div className="space-y-3">
                                    {formData.timeOffRanges.map((range, index) => {
                                        let startDate = range.start
                                        let endDate = range.end
                                        
                                        if (startDate?.toDate) startDate = startDate.toDate()
                                        else if (typeof startDate === 'string') startDate = new Date(startDate)
                                        
                                        if (endDate?.toDate) endDate = endDate.toDate()
                                        else if (typeof endDate === 'string') endDate = new Date(endDate)

                                        return (
                                            <div key={index} className="flex items-start gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                                                <div className="flex-1">
                                                    <DatePickerRange
                                                        value={startDate && endDate ? [startDate, endDate] : (startDate ? [startDate, null] : undefined)}
                                                        onChange={(dates) => {
                                                            if (!dates || !Array.isArray(dates)) {
                                                                // Clear the range if dates is null/undefined
                                                                const newRanges = [...formData.timeOffRanges]
                                                                newRanges[index] = {
                                                                    start: null,
                                                                    end: null,
                                                                }
                                                                setFormData({ ...formData, timeOffRanges: newRanges })
                                                                return
                                                            }
                                                            const newRanges = [...formData.timeOffRanges]
                                                            // Only update when we have at least one date
                                                            if (dates.length >= 1 && dates[0]) {
                                                                if (dates.length >= 2 && dates[1]) {
                                                                    // Both dates selected - complete range
                                                                    newRanges[index] = {
                                                                        start: dates[0],
                                                                        end: dates[1],
                                                                    }
                                                                } else {
                                                                    // Only first date selected - partial range
                                                                    newRanges[index] = {
                                                                        start: dates[0],
                                                                        end: null,
                                                                    }
                                                                }
                                                                setFormData({ ...formData, timeOffRanges: newRanges })
                                                            }
                                                        }}
                                                        inputFormat="MM/DD/YYYY"
                                                        closePickerOnChange={true}
                                                    />
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="plain"
                                                    icon={<HiOutlineTrash />}
                                                    className="text-red-500 hover:text-red-600"
                                                    onClick={() => {
                                                        const newRanges = formData.timeOffRanges.filter((_, i) => i !== index)
                                                        setFormData({ ...formData, timeOffRanges: newRanges })
                                                    }}
                                                />
                                            </div>
                                        )
                                    })}
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            setFormData({
                                                ...formData,
                                                timeOffRanges: [
                                                    ...formData.timeOffRanges,
                                                    { start: null, end: null },
                                                ],
                                            })
                                        }}
                                    >
                                        Add Time Off Range
                                    </Button>
                                    {formData.timeOffRanges.length === 0 && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            No time-off ranges set. Click "Add Time Off Range" to add one.
                                        </p>
                                    )}
                                </div>
                            </FormItem>

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
                                    {employee.firstName || employee.lastName
                                        ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim()
                                        : (employee.name || '-')}
                                </p>
                                {employee.nickname && (
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        Nickname / role: {employee.nickname}
                                    </p>
                                )}
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

                            <div className="md:col-span-2">
                                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Time Off Ranges
                                </label>
                                <div className="mt-2 space-y-2">
                                    {employee.timeOffRanges && employee.timeOffRanges.length > 0 ? (
                                        employee.timeOffRanges.map((range, index) => {
                                            let startDate = range.start
                                            let endDate = range.end
                                            
                                            if (startDate?.toDate) startDate = startDate.toDate()
                                            else if (typeof startDate === 'string') startDate = new Date(startDate)
                                            
                                            if (endDate?.toDate) endDate = endDate.toDate()
                                            else if (typeof endDate === 'string') endDate = new Date(endDate)

                                            return (
                                                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded border border-gray-200 dark:border-gray-700">
                                                    <span className="text-sm text-gray-900 dark:text-gray-100">
                                                        {formatDateOnly(startDate)} - {formatDateOnly(endDate)}
                                                    </span>
                                                </div>
                                            )
                                        })
                                    ) : (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">No time-off ranges set</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {/* Message History */}
            <Card>
                <div className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2">
                            <HiOutlineChatAlt2 className="text-xl text-primary" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Message History
                            </h2>
                            {messageHistoryLoading && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">Loading...</span>
                            )}
                        </div>
                        <Input
                            placeholder="Search messages..."
                            value={messageSearchQuery}
                            onChange={(e) => setMessageSearchQuery(e.target.value)}
                            className="max-w-xs ml-auto"
                            size="sm"
                        />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Messages sent to this employee from the Crew Tracker (schedule or Messages tab).
                        Once the Twilio A2P campaign is approved, new SMS will appear here in real time.
                    </p>

                    {messageHistoryError && (
                        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-200">
                            {messageHistoryError}
                        </div>
                    )}

                    {!messageHistoryLoading && !messageHistoryError && employeeMessages.length === 0 && (
                        <div className="py-8 text-center rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                No messages yet for this employee.
                            </p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                                Messages will appear here after you send job assignments or direct messages from Crew Tracker.
                            </p>
                        </div>
                    )}

                    {!messageHistoryLoading && !messageHistoryError && employeeMessages.length > 0 && filteredEmployeeMessages.length === 0 && (
                        <div className="py-6 text-center rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                No messages match your search.
                            </p>
                        </div>
                    )}

                    {!messageHistoryLoading && filteredEmployeeMessages.length > 0 && (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                            {filteredEmployeeMessages.map((msg) => {
                                const isOutbound = msg.direction === 'outbound'
                                const sentAt = msg.sentAt || msg.date
                                const primaryText =
                                    msg.body ||
                                    msg.tasks ||
                                    msg.notes ||
                                    msg.jobName ||
                                    ''
                                const secondaryParts = []
                                if (msg.jobName && primaryText !== msg.jobName) {
                                    secondaryParts.push(`Job: ${msg.jobName}`)
                                }
                                if (msg.jobAddress) {
                                    secondaryParts.push(msg.jobAddress)
                                }

                                return (
                                    <div
                                        key={msg.id}
                                        className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs shadow-sm ${
                                                isOutbound
                                                    ? 'bg-primary text-white rounded-br-sm'
                                                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm border border-gray-200 dark:border-gray-700'
                                            }`}
                                        >
                                            {primaryText && (
                                                <div className="whitespace-pre-line leading-relaxed">
                                                    {primaryText}
                                                </div>
                                            )}
                                            {secondaryParts.length > 0 && (
                                                <div className="mt-1 opacity-90 text-[10px]">
                                                    {secondaryParts.join(' · ')}
                                                </div>
                                            )}
                                            <div
                                                className={`mt-1 text-[10px] flex justify-end ${
                                                    isOutbound ? 'text-white/85' : 'text-gray-500 dark:text-gray-400'
                                                }`}
                                            >
                                                {formatMessageTime(sentAt)} {formatMessageDate(sentAt)}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    )
}

export default EmployeeDetail

