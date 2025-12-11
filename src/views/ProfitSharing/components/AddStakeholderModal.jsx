import { useState, useEffect } from 'react'
import { Dialog, Input, Select, Button } from '@/components/ui'
import { HiOutlineX, HiOutlineInformationCircle, HiOutlineUserAdd } from 'react-icons/hi'

const AddStakeholderModal = ({ isOpen, onClose, onSave, onSaveAndAddAnother }) => {
    const [formData, setFormData] = useState({
        fullName: '',
        title: '',
        email: '',
        phone: '',
        employmentStatus: null,
        payType: null,
        payAmount: '',
    })
    const [showInfoBanner, setShowInfoBanner] = useState(true)

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

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData({
                fullName: '',
                title: '',
                email: '',
                phone: '',
                employmentStatus: null,
                payType: null,
                payAmount: '',
            })
        }
    }, [isOpen])

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
        } else {
            setFormData(prev => ({ ...prev, [field]: value }))
        }
    }

    const handleSave = () => {
        if (formData.fullName && formData.title && formData.email) {
            onSave({
                ...formData,
                payAmount: formData.payAmount ? parseFloat(formData.payAmount.replace(/,/g, '')) : 0,
            })
        }
    }

    const handleSaveAndAddAnother = () => {
        if (formData.fullName && formData.title && formData.email) {
            onSaveAndAddAnother({
                ...formData,
                payAmount: formData.payAmount ? parseFloat(formData.payAmount.replace(/,/g, '')) : 0,
            })
        }
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
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <HiOutlineUserAdd className="w-5 h-5 text-primary" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Add Stakeholder</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                        <HiOutlineX className="w-5 h-5" />
                    </button>
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
                        <Input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => handleInputChange('phone', e.target.value)}
                            placeholder="Phone number"
                        />
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
                        onClick={onClose}
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
        </Dialog>
    )
}

export default AddStakeholderModal

