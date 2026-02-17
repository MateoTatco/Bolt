import React, { useState, useEffect } from 'react'
import { Dialog, Button, Input, Select, FormContainer, FormItem } from '@/components/ui'
import { HiOutlineX } from 'react-icons/hi'

const EmployeeFormModal = ({ isOpen, onClose, employee, onSave }) => {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        nickname: '',
        phone: '',
        email: '',
        language: 'en',
        active: true,
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
        <Dialog isOpen={isOpen} onClose={onClose} width={600} closable={false}>
            <div className="flex items-center justify-between mb-4">
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

            <form onSubmit={handleSubmit}>
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

                    <div className="flex justify-end gap-2 mt-6">
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
                </FormContainer>
            </form>
        </Dialog>
    )
}

export default EmployeeFormModal

