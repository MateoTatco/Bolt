import React, { useState, useEffect, useMemo } from 'react'
import { Dialog, Button, Input, Select, FormContainer, FormItem } from '@/components/ui'
import { useProjectsStore } from '@/store/projectsStore'
import { useWarrantyStore } from '@/store/warrantyStore'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { components } from 'react-select'

const reminderFrequencyOptions = [
    { value: 'none', label: 'No Reminders' },
    { value: '3days', label: 'Every 3 Days' },
    { value: '5days', label: 'Every 5 Days' },
    { value: 'weekly', label: 'Weekly' },
]

// Custom ValueContainer for multi-select
const CustomValueContainer = ({ children, ...props }) => {
    const { getValue, selectProps } = props
    const selected = getValue()
    const hasValue = selected && selected.length > 0
    
    if (selectProps.isMulti && hasValue) {
        const childrenArray = React.Children.toArray(children)
        const input = childrenArray[childrenArray.length - 2]
        const indicators = childrenArray[childrenArray.length - 1]
        
        if (selected.length === 1) {
            return (
                <div className="select-value-container" style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', overflow: 'hidden', minHeight: '38px', maxHeight: '38px' }}>
                    <div className="select-single-value" style={{ 
                        flex: '1 1 auto',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        paddingRight: '8px'
                    }}>
                        {selected[0].label}
                    </div>
                    {input}
                    {indicators}
                </div>
            )
        } else {
            return (
                <div className="select-value-container" style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', overflow: 'hidden', minHeight: '38px', maxHeight: '38px' }}>
                    <div className="select-single-value" style={{ 
                        flex: '1 1 auto',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        paddingRight: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}>
                        <span>{selected.length} selected</span>
                        <span className="px-1.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 rounded">
                            {selected.length}
                        </span>
                    </div>
                    {input}
                    {indicators}
                </div>
            )
        }
    }
    
    return <components.ValueContainer {...props}>{children}</components.ValueContainer>
}

// Custom MultiValue to hide multi-value tags
const CustomMultiValue = () => {
    return null
}

// Custom Option with checkmark
const CustomOption = (props) => {
    const { innerProps, label, isSelected } = props
    
    return (
        <div
            className={`
                select-option
                ${!isSelected && 'hover:text-gray-800 dark:hover:text-gray-100'}
                ${isSelected && 'text-primary bg-primary-subtle'}
            `}
            {...innerProps}
        >
            <span className="ml-2 flex-1">{label}</span>
            {isSelected && (
                <span className="text-primary text-lg">✓</span>
            )}
        </div>
    )
}

const CreateWarrantyModal = ({ isOpen, onClose, warrantyToEdit = null }) => {
    const [formData, setFormData] = useState({
        projectId: null,
        projectName: '',
        description: '',
        requestedBy: '',
        requestedByEmail: '',
        assignedTo: [],
        reminderFrequency: '5days',
        startDate: null,
    })
    
    const [errors, setErrors] = useState({})
    const [loading, setLoading] = useState(false)
    const [projects, setProjects] = useState([])
    const [users, setUsers] = useState([])
    const [loadingProjects, setLoadingProjects] = useState(true)
    const [loadingUsers, setLoadingUsers] = useState(true)
    
    const { addWarranty, updateWarranty } = useWarrantyStore()
    // Subscribe to projects store reactively - will update when projects change
    const projectsFromStore = useProjectsStore((state) => state.projects) || []
    const loadProjects = useProjectsStore((state) => state.loadProjects)
    
    // Track projects count to detect changes
    const projectsCount = projectsFromStore.length

    // Load projects from Master Tracker - reload when modal opens or projects change
    useEffect(() => {
        if (!isOpen) return
        
        const loadProjectsData = async () => {
            setLoadingProjects(true)
            try {
                // Always ensure projects are loaded
                if (projectsFromStore.length === 0) {
                    await loadProjects()
                }
            } catch (error) {
                console.error('Failed to load projects:', error)
            } finally {
                setLoadingProjects(false)
            }
        }
        loadProjectsData()
    }, [isOpen, loadProjects])
    
    // Update projects list when store changes (includes all projects, even archived)
    // Filter out projects without valid names and ensure reactive updates
    useEffect(() => {
        if (!isOpen) return
        
        // Filter out projects without a valid ProjectName
        const validProjects = (projectsFromStore || [])
            .filter(p => {
                const projectName = p.ProjectName || p.projectName
                return projectName && projectName.trim() !== ''
            })
            .sort((a, b) => {
                const nameA = (a.ProjectName || a.projectName || '').toLowerCase()
                const nameB = (b.ProjectName || b.projectName || '').toLowerCase()
                return nameA.localeCompare(nameB)
            })
        setProjects(validProjects)
    }, [isOpen, projectsFromStore, projectsCount]) // projectsCount ensures updates when projects are added/removed

    // Load users for assignedTo
    useEffect(() => {
        const loadUsersData = async () => {
            setLoadingUsers(true)
            try {
                const response = await FirebaseDbService.users.getAll()
                if (response.success) {
                    setUsers(response.data || [])
                }
            } catch (error) {
                console.error('Failed to load users:', error)
            } finally {
                setLoadingUsers(false)
            }
        }
        loadUsersData()
    }, [])

    // Load warranty data if editing
    useEffect(() => {
        if (warrantyToEdit && isOpen) {
            setFormData({
                projectId: warrantyToEdit.projectId || null,
                projectName: warrantyToEdit.projectName || '',
                description: warrantyToEdit.description || '',
                requestedBy: warrantyToEdit.requestedBy || '',
                requestedByEmail: warrantyToEdit.requestedByEmail || '',
                assignedTo: warrantyToEdit.assignedTo || [],
                reminderFrequency: warrantyToEdit.reminderFrequency || '5days',
                startDate: warrantyToEdit.startDate ? (warrantyToEdit.startDate.toDate ? warrantyToEdit.startDate.toDate() : new Date(warrantyToEdit.startDate)) : null,
            })
        } else if (isOpen && !warrantyToEdit) {
            // Reset form for new warranty
            setFormData({
                projectId: null,
                projectName: '',
                description: '',
                requestedBy: '',
                requestedByEmail: '',
                assignedTo: [],
                reminderFrequency: '5days',
                startDate: null,
            })
        }
        setErrors({})
    }, [warrantyToEdit, isOpen])

    // Project options for select
    const projectOptions = useMemo(() => {
        // Filter out any projects without valid names (shouldn't happen after filtering above, but double-check)
        return projects
            .filter(project => {
                const projectName = project.ProjectName || project.projectName
                return projectName && projectName.trim() !== ''
            })
            .map(project => {
                const projectName = project.ProjectName || project.projectName
                const isArchived = project.Archived || project.archived
                return {
                    value: project.id,
                    label: isArchived ? `${projectName} (Archived)` : projectName,
                    project: project,
                }
            })
    }, [projects])

    // User options for assignedTo
    const userOptions = useMemo(() => {
        return users.map(user => {
            const displayName = user.userName || 
                               user.firstName || 
                               user.lastName || 
                               user.displayName || 
                               user.email?.split('@')[0] || 
                               'Unknown User'
            return {
                value: user.id || user.uid,
                label: displayName,
                email: user.email || '',
            }
        })
    }, [users])

    // Validate form
    const validateForm = () => {
        const newErrors = {}
        
        if (!formData.projectName || formData.projectName.trim() === '') {
            newErrors.projectName = 'Project name is required'
        }
        
        if (!formData.description || formData.description.trim() === '') {
            newErrors.description = 'Description is required'
        }
        
        if (!formData.requestedBy || formData.requestedBy.trim() === '') {
            newErrors.requestedBy = 'Requested by is required'
        }
        
        if (formData.assignedTo.length === 0) {
            newErrors.assignedTo = 'At least one assignee is required'
        }
        
        if (formData.requestedByEmail && formData.requestedByEmail.trim() !== '') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(formData.requestedByEmail)) {
                newErrors.requestedByEmail = 'Invalid email format'
            }
        }
        
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault()
        
        if (!validateForm()) {
            return
        }
        
        setLoading(true)
        try {
            const warrantyData = {
                projectId: formData.projectId,
                projectName: formData.projectName.trim(),
                description: formData.description.trim(),
                requestedBy: formData.requestedBy.trim(),
                requestedByEmail: formData.requestedByEmail.trim() || null,
                assignedTo: formData.assignedTo,
                reminderFrequency: formData.reminderFrequency,
                startDate: formData.startDate,
            }
            
            if (warrantyToEdit) {
                await updateWarranty(warrantyToEdit.id, warrantyData)
            } else {
                await addWarranty(warrantyData)
            }
            
            onClose()
        } catch (error) {
            console.error('Error saving warranty:', error)
            // Error is already handled by the store
        } finally {
            setLoading(false)
        }
    }

    // Handle project selection
    const handleProjectChange = (selectedOption) => {
        if (selectedOption) {
            setFormData({
                ...formData,
                projectId: selectedOption.value,
                projectName: selectedOption.label,
            })
            setErrors({ ...errors, projectName: null })
        } else {
            setFormData({
                ...formData,
                projectId: null,
                projectName: '',
            })
        }
    }

    return (
        <Dialog isOpen={isOpen} onClose={onClose} width={800}>
            <div className="p-6">
                <div className="mb-6">
                    <h5 className="text-xl font-semibold">
                        {warrantyToEdit ? 'Edit Warranty Item' : 'Create New Warranty Item'}
                    </h5>
                </div>

                <FormContainer>
                    <form onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            {/* Project Selection */}
                            <FormItem
                                label="Project"
                                asterisk
                                invalid={!!errors.projectName}
                                errorMessage={errors.projectName}
                            >
                                <Select
                                    placeholder="Select a project from Master Tracker"
                                    options={projectOptions}
                                    value={projectOptions.find(opt => opt.value === formData.projectId) || null}
                                    onChange={handleProjectChange}
                                    isLoading={loadingProjects}
                                    isClearable
                                />
                            </FormItem>

                            {/* Description */}
                            <FormItem
                                label="Description"
                                asterisk
                                invalid={!!errors.description}
                                errorMessage={errors.description}
                            >
                                <Input
                                    as="textarea"
                                    rows={4}
                                    value={formData.description}
                                    onChange={(e) => {
                                        setFormData({ ...formData, description: e.target.value })
                                        setErrors({ ...errors, description: null })
                                    }}
                                    placeholder="Describe the warranty issue..."
                                />
                            </FormItem>

                            {/* Requested By */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormItem
                                    label="Requested By"
                                    asterisk
                                    invalid={!!errors.requestedBy}
                                    errorMessage={errors.requestedBy}
                                >
                                    <Input
                                        value={formData.requestedBy}
                                        onChange={(e) => {
                                            setFormData({ ...formData, requestedBy: e.target.value })
                                            setErrors({ ...errors, requestedBy: null })
                                        }}
                                        placeholder="Name of requester"
                                    />
                                </FormItem>

                                <FormItem
                                    label="Requested By Email"
                                    invalid={!!errors.requestedByEmail}
                                    errorMessage={errors.requestedByEmail}
                                >
                                    <Input
                                        type="email"
                                        value={formData.requestedByEmail}
                                        onChange={(e) => {
                                            setFormData({ ...formData, requestedByEmail: e.target.value })
                                            setErrors({ ...errors, requestedByEmail: null })
                                        }}
                                        placeholder="email@example.com (optional)"
                                    />
                                </FormItem>
                            </div>

                            {/* Assigned To */}
                            <FormItem
                                label="Assigned To"
                                asterisk
                                invalid={!!errors.assignedTo}
                                errorMessage={errors.assignedTo}
                            >
                                <Select
                                    placeholder="Select assignees"
                                    isMulti
                                    options={userOptions}
                                    value={userOptions.filter(opt => formData.assignedTo.includes(opt.value))}
                                    onChange={(selected) => {
                                        const userIds = selected ? selected.map(s => s.value) : []
                                        setFormData({ ...formData, assignedTo: userIds })
                                        setErrors({ ...errors, assignedTo: null })
                                    }}
                                    isLoading={loadingUsers}
                                    components={{
                                        ValueContainer: CustomValueContainer,
                                        MultiValue: CustomMultiValue,
                                        Option: CustomOption,
                                    }}
                                />
                            </FormItem>

                            {/* Reminder Frequency */}
                            <FormItem label="Reminder Frequency">
                                <Select
                                    options={reminderFrequencyOptions}
                                    value={reminderFrequencyOptions.find(opt => opt.value === formData.reminderFrequency) || null}
                                    onChange={(selected) => {
                                        setFormData({ ...formData, reminderFrequency: selected?.value || '5days' })
                                    }}
                                />
                            </FormItem>
                        </div>

                        {/* Form Actions */}
                        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <Button
                                variant="plain"
                                onClick={onClose}
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="solid"
                                type="submit"
                                loading={loading}
                            >
                                {warrantyToEdit ? 'Update Warranty' : 'Create Warranty'}
                            </Button>
                        </div>
                    </form>
                </FormContainer>
            </div>
        </Dialog>
    )
}

export default CreateWarrantyModal

