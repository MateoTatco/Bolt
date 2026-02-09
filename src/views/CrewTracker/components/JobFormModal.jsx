import React, { useState, useEffect } from 'react'
import { Dialog, Button, Input, Select, FormContainer, FormItem } from '@/components/ui'
import { HiOutlineX } from 'react-icons/hi'

const JobFormModal = ({ isOpen, onClose, job, onSave }) => {
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        active: true,
    })
    const [errors, setErrors] = useState({})
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (job) {
            setFormData({
                name: job.name || '',
                address: job.address || '',
                active: job.active !== undefined ? job.active : true,
            })
        } else {
            setFormData({
                name: '',
                address: '',
                active: true,
            })
        }
        setErrors({})
    }, [job, isOpen])

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        // Clear error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }))
        }
    }

    const validate = () => {
        const newErrors = {}
        
        if (!formData.name.trim()) {
            newErrors.name = 'Job name is required'
        }
        
        if (!formData.address.trim()) {
            newErrors.address = 'Address is required'
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
            const jobData = {
                ...formData,
                name: formData.name.trim(),
                address: formData.address.trim(),
            }

            await onSave(jobData)
            setLoading(false)
            onClose()
        } catch (error) {
            console.error('Error saving job:', error)
            setLoading(false)
        }
    }

    return (
        <Dialog isOpen={isOpen} onClose={onClose} width={600} closable={false}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                    {job ? 'Edit Job' : 'Add New Job'}
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
                    <FormItem
                        label="Job Name *"
                        invalid={!!errors.name}
                        errorMessage={errors.name}
                    >
                        <Input
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            placeholder="Enter job name"
                        />
                    </FormItem>

                    <FormItem
                        label="Address *"
                        invalid={!!errors.address}
                        errorMessage={errors.address}
                    >
                        <Input
                            value={formData.address}
                            onChange={(e) => handleChange('address', e.target.value)}
                            placeholder="Enter job address"
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
                            {job ? 'Update' : 'Create'}
                        </Button>
                    </div>
                </FormContainer>
            </form>
        </Dialog>
    )
}

export default JobFormModal

