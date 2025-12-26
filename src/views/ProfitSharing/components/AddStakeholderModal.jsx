import { useState, useEffect } from 'react'
import { Dialog, Input, Select, Button } from '@/components/ui'
import { HiOutlineX, HiOutlineInformationCircle, HiOutlineUserAdd } from 'react-icons/hi'
import { FirebaseDbService } from '@/services/FirebaseDbService'

const AddStakeholderModal = ({ isOpen, onClose, onSave, onSaveAndAddAnother }) => {
    const [formData, setFormData] = useState({
        fullName: '',
        linkedUserId: null,
        email: '',
        managerId: null,
    })
    const [showInfoBanner, setShowInfoBanner] = useState(true)
    const [showCancelDialog, setShowCancelDialog] = useState(false)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [allUsers, setAllUsers] = useState([])
    const [loadingUsers, setLoadingUsers] = useState(true)


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
                email: '',
                managerId: null,
            })
            setHasUnsavedChanges(false)
            setShowCancelDialog(false)
        }
    }, [isOpen])

    // Track unsaved changes
    useEffect(() => {
        const hasChanges = formData.fullName || formData.linkedUserId || formData.email || formData.managerId
        setHasUnsavedChanges(hasChanges)
    }, [formData])

    // User select options - Always show "First Name Last Name" format when available
    const userSelectOptions = allUsers.map(u => {
        let displayName = ''
        if (u.firstName && u.lastName) {
            displayName = `${u.firstName} ${u.lastName}`
        } else if (u.firstName) {
            displayName = u.firstName
        } else if (u.name) {
            displayName = u.name
        } else if (u.userName) {
            displayName = u.userName
        } else {
            displayName = u.email || 'Unknown'
        }
        return {
            value: u.id,
            label: displayName,
            email: u.email
        }
    })

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

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const resetForm = () => {
        setFormData({
            fullName: '',
            linkedUserId: null,
            email: '',
            managerId: null,
        })
        setHasUnsavedChanges(false)
    }

    const handleSave = async () => {
        if (formData.fullName && formData.email) {
            const success = await onSave({
                ...formData,
            })
            // Only reset form if save was successful
            if (success) {
                resetForm()
            }
        }
    }

    const handleSaveAndAddAnother = async () => {
        if (formData.fullName && formData.email) {
            const success = await onSaveAndAddAnother({
                ...formData,
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

    const isFormValid = formData.fullName && formData.email

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            width={600}
        >
            <div className="flex flex-col h-full max-h-[70vh] overflow-hidden">
                {/* Header - Fixed */}
                <div className="flex-shrink-0 p-6 pb-4">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <HiOutlineUserAdd className="w-5 h-5 text-primary" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Add Stakeholder</h3>
                    </div>

                    {/* Info Banner */}
                    {showInfoBanner && (
                        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-3">
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
                </div>

                {/* Form Fields - Scrollable */}
                <div className="flex-1 overflow-y-auto px-6">
                    <div className="space-y-4 pb-4">
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
                            Manager
                        </label>
                        <Select
                            options={userSelectOptions}
                            value={userSelectOptions.find(opt => opt.value === formData.managerId) || null}
                            onChange={(opt) => handleInputChange('managerId', opt?.value || null)}
                            placeholder="Select a manager from Bolt users..."
                            isSearchable
                            isLoading={loadingUsers}
                            isClearable
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Select the manager/supervisor for this stakeholder. Managers will be able to see their direct reports.
                        </p>
                    </div>
                    </div>
                </div>

                {/* Footer Buttons - Fixed */}
                <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
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

