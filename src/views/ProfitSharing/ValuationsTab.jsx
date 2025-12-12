import { useState, useEffect } from 'react'
import { Card, Button, Table, Tag, Drawer, Input, Select, DatePicker, Notification, toast } from '@/components/ui'
import { HiOutlinePlus, HiOutlineCheckCircle, HiOutlineEye, HiOutlinePencil, HiOutlineTrash, HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineMinus } from 'react-icons/hi'
import { db } from '@/configs/firebase.config'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore'
import React from 'react'

const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value)
}

const formatCurrencyWithDecimals = (value) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value)
}

const formatNumber = (value) => {
    return new Intl.NumberFormat('en-US').format(value)
}

const ValuationsTab = () => {
    const [valuations, setValuations] = useState([])
    const [loading, setLoading] = useState(true)
    const [showAddDrawer, setShowAddDrawer] = useState(false)
    const [editingValuation, setEditingValuation] = useState(null)
    const [formData, setFormData] = useState({
        valuationDate: null,
        source: null,
        fmv: '',
        pricePerShare: '',
        totalShares: '',
        notes: '',
    })

    useEffect(() => {
        loadValuations()
    }, [])

    const loadValuations = async () => {
        setLoading(true)
        try {
            const valuationsRef = collection(db, 'valuations')
            const q = query(valuationsRef, orderBy('valuationDate', 'desc'))
            const querySnapshot = await getDocs(q)
            const valuationsData = []
            querySnapshot.forEach((doc) => {
                const data = doc.data()
                valuationsData.push({
                    id: doc.id,
                    ...data,
                    valuationDate: data.valuationDate?.toDate ? data.valuationDate.toDate() : (data.valuationDate ? new Date(data.valuationDate) : null),
                    updatedDate: data.updatedDate?.toDate ? data.updatedDate.toDate() : (data.updatedDate ? new Date(data.updatedDate) : null),
                })
            })
            setValuations(valuationsData)
        } catch (error) {
            console.error('Error loading valuations:', error)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "danger", duration: 2000, title: "Error" },
                    "Failed to load valuations"
                )
            )
        } finally {
            setLoading(false)
        }
    }

    const getActiveValuation = () => {
        return valuations.find(v => v.status === 'Active') || valuations[0] || null
    }

    const getPreviousValuation = () => {
        const active = getActiveValuation()
        if (!active) return null
        const activeIndex = valuations.findIndex(v => v.id === active.id)
        return valuations[activeIndex + 1] || null
    }

    const calculateChange = () => {
        const active = getActiveValuation()
        const previous = getPreviousValuation()
        if (!active || !previous) return null
        return {
            amount: active.fmv - previous.fmv,
            percentage: ((active.fmv - previous.fmv) / previous.fmv) * 100
        }
    }

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const resetForm = () => {
        setFormData({
            valuationDate: null,
            source: null,
            fmv: '',
            pricePerShare: '',
            totalShares: '',
            notes: '',
        })
        setEditingValuation(null)
    }

    const handleOpenAdd = () => {
        resetForm()
        setShowAddDrawer(true)
    }

    const handleOpenEdit = (valuation) => {
        setEditingValuation(valuation)
        setFormData({
            valuationDate: valuation.valuationDate ? (valuation.valuationDate instanceof Date ? valuation.valuationDate : new Date(valuation.valuationDate)) : null,
            source: valuation.source || null,
            fmv: valuation.fmv ? String(valuation.fmv) : '',
            pricePerShare: valuation.pricePerShare ? String(valuation.pricePerShare) : '',
            totalShares: valuation.totalShares ? String(valuation.totalShares) : '',
            notes: valuation.notes || '',
        })
        setShowAddDrawer(true)
    }

    const handleSave = async () => {
        try {
            if (!formData.valuationDate || !formData.source || !formData.fmv) {
                toast.push(
                    React.createElement(
                        Notification,
                        { type: "warning", duration: 2000, title: "Validation" },
                        "Please fill in all required fields"
                    )
                )
                return
            }

            const valuationData = {
                valuationDate: formData.valuationDate instanceof Date ? formData.valuationDate : new Date(formData.valuationDate),
                source: formData.source,
                fmv: parseFloat(formData.fmv.replace(/,/g, '')) || 0,
                pricePerShare: formData.pricePerShare ? parseFloat(formData.pricePerShare.replace(/,/g, '')) : null,
                totalShares: formData.totalShares ? parseFloat(formData.totalShares.replace(/,/g, '')) : null,
                notes: formData.notes || '',
                updatedDate: serverTimestamp(),
            }

            if (editingValuation) {
                // Update existing
                const valuationRef = doc(db, 'valuations', editingValuation.id)
                
                // If setting this as Active, set all others to Historical
                if (formData.source && !editingValuation.status) {
                    // Check if we should set status
                    const shouldSetActive = true // You can add logic here
                    if (shouldSetActive) {
                        valuationData.status = 'Active'
                        // Set all other Active valuations to Historical
                        const activeValuations = valuations.filter(v => v.status === 'Active' && v.id !== editingValuation.id)
                        for (const val of activeValuations) {
                            const valRef = doc(db, 'valuations', val.id)
                            await updateDoc(valRef, { status: 'Historical' })
                        }
                    }
                }
                
                await updateDoc(valuationRef, valuationData)
                toast.push(
                    React.createElement(
                        Notification,
                        { type: "success", duration: 2000, title: "Success" },
                        "Valuation updated successfully"
                    )
                )
            } else {
                // Create new
                valuationData.status = 'Active' // New valuations are Active by default
                valuationData.createdAt = serverTimestamp()
                
                // Set all other Active valuations to Historical
                const activeValuations = valuations.filter(v => v.status === 'Active')
                for (const val of activeValuations) {
                    const valRef = doc(db, 'valuations', val.id)
                    await updateDoc(valRef, { status: 'Historical' })
                }
                
                const valuationsRef = collection(db, 'valuations')
                await addDoc(valuationsRef, valuationData)
                toast.push(
                    React.createElement(
                        Notification,
                        { type: "success", duration: 2000, title: "Success" },
                        "Valuation added successfully"
                    )
                )
            }

            await loadValuations()
            setShowAddDrawer(false)
            resetForm()
            window.dispatchEvent(new Event('valuationsUpdated'))
        } catch (error) {
            console.error('Error saving valuation:', error)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "danger", duration: 2000, title: "Error" },
                    "Failed to save valuation"
                )
            )
        }
    }

    const handleDelete = async (valuationId) => {
        if (!window.confirm('Are you sure you want to delete this valuation?')) {
            return
        }

        try {
            const valuationRef = doc(db, 'valuations', valuationId)
            await deleteDoc(valuationRef)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "success", duration: 2000, title: "Success" },
                    "Valuation deleted successfully"
                )
            )
            await loadValuations()
            window.dispatchEvent(new Event('valuationsUpdated'))
        } catch (error) {
            console.error('Error deleting valuation:', error)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "danger", duration: 2000, title: "Error" },
                    "Failed to delete valuation"
                )
            )
        }
    }

    const activeValuation = getActiveValuation()
    const change = calculateChange()

    const sourceOptions = [
        { value: 'Manual', label: 'Manual' },
        { value: 'Third-party', label: 'Third-party' },
        { value: 'Calculated', label: 'Calculated' },
    ]

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Valuations</h2>
                    <Button 
                        variant="solid" 
                        size="sm"
                        icon={<HiOutlinePlus />}
                        onClick={handleOpenAdd}
                    >
                        Add valuation
                    </Button>
                </div>

                {/* Current Value Card */}
                {activeValuation ? (
                    <Card className="p-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Current value</h3>
                                    <HiOutlineCheckCircle className="w-4 h-4 text-green-500" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                                    {formatCurrency(activeValuation.fmv)}
                                </div>
                                {change && (
                                    <div className="flex items-center gap-2">
                                        {change.amount > 0 ? (
                                            <>
                                                <HiOutlineTrendingUp className="w-4 h-4 text-green-500" />
                                                <span className="text-sm text-green-600 dark:text-green-400">
                                                    +{formatCurrency(Math.abs(change.amount))} ({change.percentage > 0 ? '+' : ''}{change.percentage.toFixed(2)}%)
                                                </span>
                                            </>
                                        ) : change.amount < 0 ? (
                                            <>
                                                <HiOutlineTrendingDown className="w-4 h-4 text-red-500" />
                                                <span className="text-sm text-red-600 dark:text-red-400">
                                                    {formatCurrency(change.amount)} ({change.percentage.toFixed(2)}%)
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <HiOutlineMinus className="w-4 h-4 text-gray-500" />
                                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                                    No change
                                                </span>
                                            </>
                                        )}
                                    </div>
                                )}
                                {!change && (
                                    <div className="text-sm text-gray-500 dark:text-gray-400">No previous valuation</div>
                                )}
                            </div>
                            {/* Placeholder for chart - you can add a real chart component here */}
                            <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                                <span className="text-xs text-gray-400 dark:text-gray-500">Valuation trend chart</span>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <Card className="p-6">
                        <div className="text-center py-8">
                            <div className="text-gray-400 dark:text-gray-500 text-lg">No active valuation</div>
                            <div className="text-gray-400 dark:text-gray-500 text-sm mt-2">Add your first valuation to get started</div>
                        </div>
                    </Card>
                )}

                {/* History Table */}
                <Card className="p-0">
                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="text-gray-400 dark:text-gray-500">Loading valuations...</div>
                        </div>
                    ) : valuations.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="text-gray-400 dark:text-gray-500 text-lg">No valuations recorded yet</div>
                            <div className="text-gray-400 dark:text-gray-500 text-sm mt-2">Track company valuation over time</div>
                        </div>
                    ) : (
                        <Table>
                            <Table.THead>
                                <Table.Tr>
                                    <Table.Th>Updated Date</Table.Th>
                                    <Table.Th>Valuation Date</Table.Th>
                                    <Table.Th>Source</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                    <Table.Th>FMV</Table.Th>
                                    <Table.Th>Price per Share</Table.Th>
                                    <Table.Th>Total Shares</Table.Th>
                                    <Table.Th>Actions</Table.Th>
                                </Table.Tr>
                            </Table.THead>
                            <Table.TBody>
                                {valuations.map((valuation) => (
                                    <Table.Tr key={valuation.id}>
                                        <Table.Td>
                                            <span className="text-sm text-gray-900 dark:text-white">
                                                {valuation.updatedDate 
                                                    ? valuation.updatedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                                                    : 'N/A'}
                                            </span>
                                        </Table.Td>
                                        <Table.Td>
                                            <span className="text-sm text-gray-900 dark:text-white">
                                                {valuation.valuationDate 
                                                    ? valuation.valuationDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                                                    : 'N/A'}
                                            </span>
                                        </Table.Td>
                                        <Table.Td>
                                            <Tag className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                                {valuation.source || 'N/A'}
                                            </Tag>
                                        </Table.Td>
                                        <Table.Td>
                                            {valuation.status === 'Active' ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                    <span className="text-sm text-gray-900 dark:text-white">Active</span>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-500 dark:text-gray-400">Historical</span>
                                            )}
                                        </Table.Td>
                                        <Table.Td>
                                            <span className="text-sm text-gray-900 dark:text-white font-medium">
                                                {formatCurrency(valuation.fmv)}
                                            </span>
                                        </Table.Td>
                                        <Table.Td>
                                            <span className="text-sm text-gray-900 dark:text-white">
                                                {valuation.pricePerShare ? formatCurrencyWithDecimals(valuation.pricePerShare) : '—'}
                                            </span>
                                        </Table.Td>
                                        <Table.Td>
                                            <span className="text-sm text-gray-900 dark:text-white">
                                                {valuation.totalShares ? formatNumber(valuation.totalShares) : '—'}
                                            </span>
                                        </Table.Td>
                                        <Table.Td>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="plain"
                                                    size="sm"
                                                    icon={<HiOutlinePencil />}
                                                    onClick={() => handleOpenEdit(valuation)}
                                                    className="text-gray-400 hover:text-primary"
                                                />
                                                <Button
                                                    variant="plain"
                                                    size="sm"
                                                    icon={<HiOutlineTrash />}
                                                    onClick={() => handleDelete(valuation.id)}
                                                    className="text-gray-400 hover:text-red-500"
                                                />
                                            </div>
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.TBody>
                        </Table>
                    )}
                </Card>
            </div>

            {/* Add/Edit Valuation Drawer */}
            <Drawer
                isOpen={showAddDrawer}
                onClose={() => {
                    setShowAddDrawer(false)
                    resetForm()
                }}
                title={editingValuation ? "Edit Valuation" : "Add Valuation"}
                width={600}
            >
                <div className="flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Valuation Date *
                            </label>
                            <DatePicker
                                value={formData.valuationDate ? (formData.valuationDate instanceof Date ? formData.valuationDate : new Date(formData.valuationDate)) : null}
                                onChange={(date) => handleInputChange('valuationDate', date)}
                                placeholder="Select a date..."
                                inputFormat="MM/DD/YYYY"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Source *
                            </label>
                            <Select
                                options={sourceOptions}
                                value={sourceOptions.find(opt => opt.value === formData.source) || null}
                                onChange={(opt) => handleInputChange('source', opt?.value || null)}
                                placeholder="Select..."
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Fair Market Value (FMV) *
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">
                                    $
                                </span>
                                <Input
                                    type="text"
                                    value={formData.fmv ? formData.fmv.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/[^0-9]/g, '')
                                        handleInputChange('fmv', value)
                                    }}
                                    placeholder="0"
                                    className="pl-8"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Price per Share
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">
                                    $
                                </span>
                                <Input
                                    type="text"
                                    value={formData.pricePerShare ? formData.pricePerShare.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/[^0-9.]/g, '')
                                        handleInputChange('pricePerShare', value)
                                    }}
                                    placeholder="0.00"
                                    className="pl-8"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Total Shares
                            </label>
                            <Input
                                type="text"
                                value={formData.totalShares ? formData.totalShares.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                                onChange={(e) => {
                                    const value = e.target.value.replace(/[^0-9]/g, '')
                                    handleInputChange('totalShares', value)
                                }}
                                placeholder="0"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Notes
                            </label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => handleInputChange('notes', e.target.value)}
                                placeholder="Add any additional notes..."
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
                            />
                        </div>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 p-6 flex items-center justify-end gap-3">
                        <Button
                            variant="plain"
                            onClick={() => {
                                setShowAddDrawer(false)
                                resetForm()
                            }}
                            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="solid"
                            onClick={handleSave}
                        >
                            {editingValuation ? 'Update' : 'Add'} Valuation
                        </Button>
                    </div>
                </div>
            </Drawer>
        </>
    )
}

export default ValuationsTab
