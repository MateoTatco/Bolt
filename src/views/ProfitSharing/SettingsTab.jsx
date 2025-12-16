import { useState, useEffect } from 'react'
import { Card, Button, Input, Table, Dialog, Notification, toast, Select, Tag } from '@/components/ui'
import DataTable from '@/components/shared/DataTable'
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineCheck, HiOutlineX } from 'react-icons/hi'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { useSelectedCompany } from '@/hooks/useSelectedCompany'
import { db } from '@/configs/firebase.config'
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore'

const DEFAULT_COMPANY_NAME = 'Tatco OKC'

const SettingsTab = () => {
    const { selectedCompanyId, setSelectedCompany, loading: loadingSelected } = useSelectedCompany()
    const [companies, setCompanies] = useState([])
    const [loading, setLoading] = useState(true)
    const [showAddDialog, setShowAddDialog] = useState(false)
    const [editingCompany, setEditingCompany] = useState(null)
    const [showDeleteDialog, setShowDeleteDialog] = useState(null)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        locationOfBusiness: '',
        legalAddress: ''
    })

    useEffect(() => {
        loadCompanies()
    }, [])

    const loadCompanies = async () => {
        setLoading(true)
        try {
            const result = await FirebaseDbService.companies.getAll()
            
            if (result.success) {
                // Sort companies: selected first, then by name
                const sorted = result.data.sort((a, b) => {
                    if (a.id === selectedCompanyId) return -1
                    if (b.id === selectedCompanyId) return 1
                    return (a.name || '').localeCompare(b.name || '')
                })
                setCompanies(sorted)
                
                // If no companies exist, create default "Tatco OKC"
                if (result.data.length === 0) {
                    await createDefaultCompany()
                    // Reload after creating
                    const reloadResult = await FirebaseDbService.companies.getAll()
                    if (reloadResult.success) {
                        setCompanies(reloadResult.data)
                    }
                }
            } else {
                console.error('Failed to load companies:', result.error)
                setCompanies([])
            }
        } catch (error) {
            console.error('Error loading companies:', error)
            toast.push(
                <Notification type="danger" duration={2000} title="Error">
                    Failed to load companies: {error.message}
                </Notification>
            )
            setCompanies([])
        } finally {
            setLoading(false)
        }
    }

    const createDefaultCompany = async () => {
        try {
            const defaultCompanyData = {
                name: DEFAULT_COMPANY_NAME,
                locationOfBusiness: '',
                legalAddress: ''
            }
            const result = await FirebaseDbService.companies.create(defaultCompanyData)
            if (result.success) {
                // Auto-select the default company if none is selected
                if (!selectedCompanyId) {
                    await setSelectedCompany(result.data.id)
                }
            }
        } catch (error) {
            console.error('Error creating default company:', error)
        }
    }

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleAdd = () => {
        setEditingCompany(null)
        setFormData({
            name: '',
            locationOfBusiness: '',
            legalAddress: ''
        })
        setShowAddDialog(true)
    }

    const handleEdit = (company) => {
        setEditingCompany(company)
        setFormData({
            name: company.name || '',
            locationOfBusiness: company.locationOfBusiness || '',
            legalAddress: company.legalAddress || ''
        })
        setShowAddDialog(true)
    }

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.push(
                <Notification type="warning" duration={2000} title="Validation">
                    Company name is required
                </Notification>
            )
            return
        }

        setSaving(true)
        try {
            if (editingCompany) {
                // Update existing
                const result = await FirebaseDbService.companies.update(editingCompany.id, formData)
                if (result.success) {
                    toast.push(
                        <Notification type="success" duration={2000} title="Success">
                            Company updated successfully
                        </Notification>
                    )
                    await loadCompanies()
                    setShowAddDialog(false)
                } else {
                    throw new Error(result.error || 'Failed to update company')
                }
            } else {
                // Create new
                const result = await FirebaseDbService.companies.create(formData)
                if (result.success) {
                    toast.push(
                        <Notification type="success" duration={2000} title="Success">
                            Company created successfully
                        </Notification>
                    )
                    await loadCompanies()
                    
                    // Auto-select the newly created company if no company is currently selected
                    if (!selectedCompanyId) {
                        await setSelectedCompany(result.data.id)
                        toast.push(
                            <Notification type="info" duration={2000} title="Company Selected">
                                {formData.name} has been automatically selected
                            </Notification>
                        )
                    }
                    
                    setShowAddDialog(false)
                } else {
                    throw new Error(result.error || 'Failed to create company')
                }
            }
        } catch (error) {
            console.error('Error saving company:', error)
            toast.push(
                <Notification type="danger" duration={2000} title="Error">
                    {error.message || 'Failed to save company'}
                </Notification>
            )
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (company) => {
        setSaving(true)
        try {
            const result = await FirebaseDbService.companies.delete(company.id)
            if (result.success) {
                toast.push(
                    <Notification type="success" duration={2000} title="Success">
                        Company deleted successfully
                    </Notification>
                )
                
                // If deleted company was selected, switch to default
                if (selectedCompanyId === company.id) {
                    const defaultCompany = companies.find(c => c.name === DEFAULT_COMPANY_NAME)
                    if (defaultCompany) {
                        await setSelectedCompany(defaultCompany.id)
                    }
                }
                
                await loadCompanies()
                setShowDeleteDialog(null)
            } else {
                throw new Error(result.error || 'Failed to delete company')
            }
        } catch (error) {
            console.error('Error deleting company:', error)
            toast.push(
                <Notification type="danger" duration={2000} title="Error">
                    {error.message || 'Failed to delete company'}
                </Notification>
            )
        } finally {
            setSaving(false)
        }
    }

    const handleSelectCompany = async (companyId) => {
        await setSelectedCompany(companyId)
        toast.push(
            <Notification type="success" duration={2000} title="Success">
                Company selected
            </Notification>
        )
    }

    const columns = [
        {
            header: 'Company Name',
            accessorKey: 'name',
            cell: ({ row }) => (
                <div className="font-medium">{row.original.name}</div>
            )
        },
        {
            header: 'Location of Business',
            accessorKey: 'locationOfBusiness',
            cell: ({ row }) => (
                <div className="text-gray-600 dark:text-gray-400">
                    {row.original.locationOfBusiness || '-'}
                </div>
            )
        },
        {
            header: 'Legal Address',
            accessorKey: 'legalAddress',
            cell: ({ row }) => (
                <div className="text-gray-600 dark:text-gray-400">
                    {row.original.legalAddress || '-'}
                </div>
            )
        },
        {
            header: 'Status',
            accessorKey: 'status',
            cell: ({ row }) => {
                const isSelected = selectedCompanyId === row.original.id
                return (
                    <div className="flex items-center gap-2">
                        {isSelected && (
                            <Tag className="bg-primary text-white">
                                <HiOutlineCheck className="mr-1" />
                                Active
                            </Tag>
                        )}
                    </div>
                )
            }
        },
        {
            header: 'Actions',
            accessorKey: 'actions',
            cell: ({ row }) => {
                const company = row.original
                const isDefault = company.name === DEFAULT_COMPANY_NAME
                const isSelected = selectedCompanyId === company.id
                
                return (
                    <div className="flex items-center gap-2">
                        {!isSelected && (
                            <Button
                                size="sm"
                                variant="plain"
                                icon={<HiOutlineCheck />}
                                onClick={() => handleSelectCompany(company.id)}
                            >
                                Select
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant="plain"
                            icon={<HiOutlinePencil />}
                            onClick={() => handleEdit(company)}
                        >
                            Edit
                        </Button>
                        <Button
                            size="sm"
                            variant="plain"
                            icon={<HiOutlineTrash />}
                            onClick={() => setShowDeleteDialog(company)}
                            className="text-red-600 hover:text-red-700"
                        >
                            Delete
                        </Button>
                    </div>
                )
            }
        }
    ]

    if (loading || loadingSelected) {
        return (
            <div className="space-y-6">
                <div className="flex items-center space-x-3">
                    <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Settings</h2>
                </div>
                <Card className="p-6">
                    <div className="text-center py-12">
                        <div className="text-gray-400 dark:text-gray-500 text-lg">Loading...</div>
                    </div>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Settings</h2>
                </div>
                <Button
                    icon={<HiOutlinePlus />}
                    onClick={handleAdd}
                >
                    Add Company
                </Button>
            </div>

            <Card className="p-6">
                <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2">Company Management</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Manage companies for profit sharing. Select a company to filter all data across Overview, Plans, Stakeholders, Valuations, and Milestones tabs.
                    </p>
                </div>

                {companies.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="text-gray-400 dark:text-gray-500 text-lg">No companies found</div>
                                <div className="text-gray-400 dark:text-gray-500 text-sm mt-2">Create your first company to get started</div>
                                <Button
                                    className="mt-4"
                                    icon={<HiOutlinePlus />}
                                    onClick={handleAdd}
                                >
                                    Create First Company
                                </Button>
                            </div>
                ) : (
                    <div className="overflow-x-auto">
                        <DataTable
                            columns={columns}
                            data={companies}
                            loading={false}
                        />
                    </div>
                )}
            </Card>

            {/* Add/Edit Dialog */}
            <Dialog
                isOpen={showAddDialog}
                onClose={() => setShowAddDialog(false)}
                width={600}
            >
                <div className="p-6">
                    <h3 className="text-xl font-semibold mb-4">
                        {editingCompany ? 'Edit Company' : 'Add Company'}
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Company Name *
                            </label>
                            <Input
                                value={formData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                placeholder="Enter company name"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Location of Business
                            </label>
                            <Input
                                value={formData.locationOfBusiness}
                                onChange={(e) => handleInputChange('locationOfBusiness', e.target.value)}
                                placeholder="Enter location of business"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Legal Address
                            </label>
                            <Input
                                value={formData.legalAddress}
                                onChange={(e) => handleInputChange('legalAddress', e.target.value)}
                                placeholder="Enter legal address"
                                textArea
                                rows={3}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <Button
                            variant="plain"
                            onClick={() => setShowAddDialog(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            loading={saving}
                        >
                            {editingCompany ? 'Update' : 'Create'}
                        </Button>
                    </div>
                </div>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                isOpen={!!showDeleteDialog}
                onClose={() => setShowDeleteDialog(null)}
                width={400}
            >
                <div className="p-6">
                    <h3 className="text-xl font-semibold mb-4">Delete Company</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Are you sure you want to delete "{showDeleteDialog?.name}"? This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="plain"
                            onClick={() => setShowDeleteDialog(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="solid"
                            color="red"
                            onClick={() => handleDelete(showDeleteDialog)}
                            loading={saving}
                        >
                            Delete
                        </Button>
                    </div>
                </div>
            </Dialog>
        </div>
    )
}

export default SettingsTab
