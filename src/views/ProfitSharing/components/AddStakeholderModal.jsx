import { useState, useEffect } from 'react'
import { Dialog, Input, Select, Button } from '@/components/ui'
import { HiOutlineX, HiOutlineInformationCircle, HiOutlineUserAdd } from 'react-icons/hi'
import { FirebaseDbService } from '@/services/FirebaseDbService'

const AddStakeholderModal = ({ isOpen, onClose, onSave, onSaveAndAddAnother }) => {
    const [formData, setFormData] = useState({
        fullName: '',
        linkedUserId: null,
        title: '',
        email: '',
        phone: '',
        employmentStatus: null,
        payType: null,
        payAmount: '',
    })
    const [showInfoBanner, setShowInfoBanner] = useState(true)
    const [showCancelDialog, setShowCancelDialog] = useState(false)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [allUsers, setAllUsers] = useState([])
    const [loadingUsers, setLoadingUsers] = useState(true)

    const employmentStatusOptions = [
        { value: 'full-time', label: 'Full time' },
        { value: 'part-time', label: 'Part Time' },
        { value: 'contract', label: 'Contract' },
        { value: 'intern', label: 'Intern' },
        { value: 'seasonal', label: 'Seasonal' },
    ]

    const payTypeOptions = [
        { value: 'salary', label: 'Salary' },
        { value: 'hourly', label: 'Hourly' },
    ]

    // Load users on mount
    useEffect(() => {
        loadUsers()
    }, [])

    const loadUsers = async () => {
        setLoadingUsers(true)
        try {
            const result = await FirebaseDbService.users.getAll()
            if (result.success) {
                setAllUsers(result.data)
            }
        } catch (error) {
            console.error('Error loading users:', error)
        } finally {
            setLoadingUsers(false)
        }
    }

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData({
                fullName: '',
                linkedUserId: null,
                title: '',
                email: '',
                phone: '',
                employmentStatus: null,
                payType: null,
                payAmount: '',
            })
            setHasUnsavedChanges(false)
            setShowCancelDialog(false)
        }
    }, [isOpen])

    // Track unsaved changes
    useEffect(() => {
        const hasChanges = formData.fullName || formData.linkedUserId || formData.title || formData.email || 
                          formData.phone || formData.employmentStatus || formData.payType || formData.payAmount
        setHasUnsavedChanges(hasChanges)
    }, [formData])

    // User select options
    const userSelectOptions = allUsers.map(u => ({
        value: u.id,
        label: u.name || (u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.email) || u.email,
        email: u.email
    }))

    const handleUserSelect = (option) => {
        if (option) {
            const selectedUser = allUsers.find(u => u.id === option.value)
            setFormData(prev => ({
                ...prev,
                linkedUserId: option.value,
                fullName: option.label,
                email: selectedUser?.email || prev.email
            }))
        } else {
            setFormData(prev => ({
                ...prev,
                linkedUserId: null
            }))
        }
    }

    const formatCurrencyInput = (value) => {
        // Remove all non-numeric characters except decimal point
        const numericValue = value.replace(/[^0-9.]/g, '')
        if (!numericValue) return ''
        const num = parseFloat(numericValue)
        if (isNaN(num)) return ''
        return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    }

    const handleInputChange = (field, value) => {
        if (field === 'payAmount') {
            setFormData(prev => ({ ...prev, [field]: formatCurrencyInput(value) }))
        } else if (field === 'phone') {
            // Only allow numbers (no + needed since we have +1 prefix)
            const sanitized = value.replace(/[^0-9]/g, '')
            setFormData(prev => ({ ...prev, [field]: sanitized }))
        } else {
            setFormData(prev => ({ ...prev, [field]: value }))
        }
    }

    const resetForm = () => {
        setFormData({
            fullName: '',
            linkedUserId: null,
            title: '',
            email: '',
            phone: '',
            employmentStatus: null,
            payType: null,
            payAmount: '',
        })
        setHasUnsavedChanges(false)
    }

    const handleSave = async () => {
        if (formData.fullName && formData.title && formData.email) {
            const success = await onSave({
                ...formData,
                payAmount: formData.payAmount ? parseFloat(formData.payAmount.replace(/,/g, '')) : 0,
            })
            // Only reset form if save was successful
            if (success) {
                resetForm()
            }
        }
    }

    const handleSaveAndAddAnother = async () => {
        if (formData.fullName && formData.title && formData.email) {
            const success = await onSaveAndAddAnother({
                ...formData,
                payAmount: formData.payAmount ? parseFloat(formData.payAmount.replace(/,/g, '')) : 0,
            })
            // Reset form but keep modal open (only if save was successful)
            if (success) {
                resetForm()
            }
        }
    }

    const handleCancel = () => {
        if (hasUnsavedChanges) {
            setShowCancelDialog(true)
        } else {
            onClose()
        }
    }

    const handleConfirmCancel = () => {
        resetForm()
        setShowCancelDialog(false)
        onClose()
    }

    const isFormValid = formData.fullName && formData.title && formData.email

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            width={600}
        >
            <div className="p-6">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <HiOutlineUserAdd className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Add Stakeholder</h3>
                </div>

                {/* Info Banner */}
                {showInfoBanner && (
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-3">
                        <HiOutlineInformationCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                Adding a stakeholder does not notify them. Stakeholders are only notified after clicking "Finalize Award".
                            </p>
                        </div>
                        <button
                            onClick={() => setShowInfoBanner(false)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 flex-shrink-0"
                        >
                            <HiOutlineX className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Form Fields */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Select User (from Bolt)
                        </label>
                        <Select
                            options={userSelectOptions}
                            value={userSelectOptions.find(opt => opt.value === formData.linkedUserId) || null}
                            onChange={handleUserSelect}
                            placeholder="Search and select a user..."
                            isSearchable
                            isLoading={loadingUsers}
                            isClearable
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Select an existing Bolt user or enter name manually below
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Full name
                        </label>
                        <Input
                            value={formData.fullName}
                            onChange={(e) => handleInputChange('fullName', e.target.value)}
                            placeholder="Full legal name"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Title
                        </label>
                        <Input
                            value={formData.title}
                            onChange={(e) => handleInputChange('title', e.target.value)}
                            placeholder="Their role in the company"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Email address
                        </label>
                        <Input
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            placeholder="Email address"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Phone
                        </label>
                        <div className="flex items-center">
                            <div className="flex items-center gap-1 px-3 h-10 bg-gray-100 dark:bg-gray-700 rounded-l-md border border-r-0 border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                <span>+1</span>
                            </div>
                            <Input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => handleInputChange('phone', e.target.value)}
                                placeholder="Phone number"
                                className="rounded-l-none flex-1"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Employment status
                        </label>
                        <Select
                            options={employmentStatusOptions}
                            value={employmentStatusOptions.find(opt => opt.value === formData.employmentStatus) || null}
                            onChange={(opt) => handleInputChange('employmentStatus', opt?.value || null)}
                            placeholder="Select..."
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Pay type
                        </label>
                        <Select
                            options={payTypeOptions}
                            value={payTypeOptions.find(opt => opt.value === formData.payType) || null}
                            onChange={(opt) => handleInputChange('payType', opt?.value || null)}
                            placeholder="Select..."
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Pay amount
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">
                                $
                            </span>
                            <Input
                                type="text"
                                value={formData.payAmount}
                                onChange={(e) => handleInputChange('payAmount', e.target.value)}
                                placeholder="Pay amount"
                                className="pl-8"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <Button
                        variant="plain"
                        onClick={handleCancel}
                        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                        Cancel
                    </Button>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="twoTone"
                            onClick={handleSaveAndAddAnother}
                            disabled={!isFormValid}
                        >
                            Save and add another
                        </Button>
                        <Button
                            variant="solid"
                            onClick={handleSave}
                            disabled={!isFormValid}
                        >
                            Save
                        </Button>
                    </div>
                </div>
            </div>

            {/* Cancel Confirmation Dialog */}
            <Dialog
                isOpen={showCancelDialog}
                onClose={() => setShowCancelDialog(false)}
                width={400}
            >
                <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Discard changes?
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                        You have unsaved changes. Are you sure you want to cancel?
                    </p>
                    <div className="flex items-center justify-end gap-3">
                        <Button
                            variant="plain"
                            onClick={() => setShowCancelDialog(false)}
                        >
                            Keep editing
                        </Button>
                        <Button
                            variant="solid"
                            color="red-600"
                            onClick={handleConfirmCancel}
                        >
                            Discard
                        </Button>
                    </div>
                </div>
            </Dialog>
        </Dialog>
    )
}

export default AddStakeholderModal

