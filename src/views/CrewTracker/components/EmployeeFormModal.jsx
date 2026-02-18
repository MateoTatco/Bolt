import React, { useState, useEffect } from 'react'
import { Dialog, Button, Input, Select, FormContainer, FormItem } from '@/components/ui'
import DatePickerRange from '@/components/ui/DatePicker/DatePickerRange'
import { HiOutlineX, HiOutlineTrash } from 'react-icons/hi'

const EmployeeFormModal = ({ isOpen, onClose, employee, onSave }) => {
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
    const [loading, setLoading] = useState(false)

    useEffect(() => {
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
        } else {
            setFormData({
                firstName: '',
                lastName: '',
                nickname: '',
                phone: '',
                email: '',
                language: 'en',
                active: true,
                timeOffRanges: [],
            })
        }
        setErrors({})
    }, [employee, isOpen])

    // Validate phone number (US format: +1XXXXXXXXXX or XXXXXXXXXX)
    const validatePhone = (phone) => {
        if (!phone) return 'Phone number is required'
        // Remove all non-digit characters for validation
        const digitsOnly = phone.replace(/\D/g, '')
        if (digitsOnly.length < 10 || digitsOnly.length > 11) {
            return 'Phone number must be 10-11 digits'
        }
        return null
    }

    // Validate email
    const validateEmail = (email) => {
        if (!email) return null // Email is optional
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return 'Invalid email format'
        }
        return null
    }

    // Format phone number as user types
    const formatPhoneNumber = (value) => {
        // Remove all non-digit characters
        const digitsOnly = value.replace(/\D/g, '')
        
        // Format as (XXX) XXX-XXXX
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
            // Format phone number
            const formatted = formatPhoneNumber(value)
            setFormData(prev => ({ ...prev, [field]: formatted }))
            // Clear error when user starts typing
            if (errors.phone) {
                setErrors(prev => ({ ...prev, phone: null }))
            }
        } else {
            setFormData(prev => ({ ...prev, [field]: value }))
            // Clear error when user starts typing
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
        
        const phoneError = validatePhone(formData.phone)
        if (phoneError) {
            newErrors.phone = phoneError
        }
        
        const emailError = validateEmail(formData.email)
        if (emailError) {
            newErrors.email = emailError
        }
        
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        e.stopPropagation()
        
        if (!validate()) {
            return
        }

        setLoading(true)
        try {
            // Normalize phone number (remove formatting, add +1 if needed)
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

            // Process time-off ranges - keep as is (Firebase will handle Timestamp conversion)
            const processedTimeOffRanges = (formData.timeOffRanges || []).map(range => ({
                start: range.start,
                end: range.end,
            }))

            const employeeData = {
                ...formData,
                firstName: firstName || null,
                lastName: lastName || null,
                nickname: nickname || null,
                // Keep legacy combined name for existing views/search
                name: combinedNameBase
                    ? (nickname && (firstName || lastName) ? `${combinedNameBase} (${nickname})` : combinedNameBase)
                    : employee?.name || null,
                phone: normalizedPhone,
                email: formData.email.trim() || null,
                timeOffRanges: processedTimeOffRanges,
            }

            await onSave(employeeData)
            setLoading(false)
            onClose()
        } catch (error) {
            console.error('Error saving employee:', error)
            setLoading(false)
        }
    }

    return (
        <Dialog 
            isOpen={isOpen} 
            onClose={onClose} 
            width={600} 
            closable={false}
            style={{
                content: {
                    maxHeight: '80vh',
                    display: 'flex',
                    flexDirection: 'column',
                }
            }}
        >
            <div className="flex flex-col h-full max-h-[80vh] overflow-hidden">
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <h3 className="text-lg font-semibold">
                        {employee ? 'Edit Employee' : 'Add New Employee'}
                    </h3>
                    <Button
                        size="sm"
                        variant="plain"
                        icon={<HiOutlineX />}
                        onClick={onClose}
                    />
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                        <FormContainer>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormItem
                            label="First Name *"
                            invalid={!!errors.firstName}
                            errorMessage={errors.firstName}
                        >
                            <Input
                                value={formData.firstName}
                                onChange={(e) => handleChange('firstName', e.target.value)}
                                placeholder="Enter first name"
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
                                placeholder="Enter last name"
                            />
                        </FormItem>
                    </div>

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
                            placeholder="(555) 123-4567"
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
                            placeholder="employee@example.com"
                        />
                    </FormItem>

                    <FormItem label="Language">
                        <Select
                            options={[
                                { value: 'en', label: 'English' },
                                { value: 'es', label: 'Spanish' },
                            ]}
                            value={(() => {
                                const langOptions = [
                                    { value: 'en', label: 'English' },
                                    { value: 'es', label: 'Spanish' },
                                ]
                                return langOptions.find(opt => opt.value === formData.language) || langOptions[0]
                            })()}
                            onChange={(option) => {
                                if (option) {
                                    handleChange('language', option.value)
                                }
                            }}
                            menuPortalTarget={document.body}
                            menuPosition="fixed"
                            styles={{
                                menuPortal: (provided) => ({ ...provided, zIndex: 10000 }),
                                menu: (provided) => ({ ...provided, zIndex: 10000 }),
                            }}
                        />
                    </FormItem>

                    <FormItem label="Status">
                        <Select
                            options={[
                                { value: true, label: 'Active' },
                                { value: false, label: 'Inactive' },
                            ]}
                            value={(() => {
                                const statusOptions = [
                                    { value: true, label: 'Active' },
                                    { value: false, label: 'Inactive' },
                                ]
                                return statusOptions.find(opt => opt.value === formData.active) || statusOptions[0]
                            })()}
                            onChange={(option) => {
                                if (option) {
                                    handleChange('active', option.value)
                                }
                            }}
                            menuPortalTarget={document.body}
                            menuPosition="fixed"
                            styles={{
                                menuPortal: (provided) => ({ ...provided, zIndex: 10000 }),
                                menu: (provided) => ({ ...provided, zIndex: 10000 }),
                            }}
                        />
                    </FormItem>

                    <FormItem label="Time Off Ranges">
                        <div className="space-y-3">
                            {formData.timeOffRanges.map((range, index) => {
                                let startDate = range.start
                                let endDate = range.end
                                
                                // Convert Firestore Timestamp to Date if needed
                                if (startDate?.toDate) startDate = startDate.toDate()
                                else if (typeof startDate === 'string') startDate = new Date(startDate)
                                
                                if (endDate?.toDate) endDate = endDate.toDate()
                                else if (typeof endDate === 'string') endDate = new Date(endDate)

                                return (
                                    <div key={index} className="flex items-start gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Date Range
                                            </label>
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
                                            className="text-red-500 hover:text-red-600 mt-6"
                                            onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
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
                    </FormContainer>
                    </div>
                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-900 sticky bottom-0">
                        <Button type="button" variant="plain" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            variant="solid"
                            type="submit"
                            loading={loading}
                        >
                            {employee ? 'Update' : 'Create'}
                        </Button>
                    </div>
                </form>
            </div>
        </Dialog>
    )
}

export default EmployeeFormModal

