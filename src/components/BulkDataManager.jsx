import React, { useState, useRef } from 'react'
import { Button, Card, Dialog, Input, Select, Alert, Progress } from '@/components/ui'
import { useCrmStore } from '@/store/crmStore'
import { HiOutlineUpload, HiOutlineDownload, HiOutlineTrash, HiOutlineCheck } from 'react-icons/hi'

const BulkDataManager = ({ isOpen, onClose, entityType = 'leads' }) => {
    const [activeTab, setActiveTab] = useState('import')
    const [file, setFile] = useState(null)
    const [importOptions, setImportOptions] = useState({
        format: 'json',
        validate: true,
        merge: false
    })
    const [exportOptions, setExportOptions] = useState({
        format: 'json',
        filters: {},
        dateRange: null
    })
    const [progress, setProgress] = useState(0)
    const [isProcessing, setIsProcessing] = useState(false)
    const fileInputRef = useRef(null)

    const {
        exportData,
        importData,
        bulkDelete,
        leads,
        clients,
        loading
    } = useCrmStore()

    const currentData = entityType === 'leads' ? leads : clients

    const handleFileSelect = (event) => {
        const selectedFile = event.target.files[0]
        if (selectedFile) {
            setFile(selectedFile)
        }
    }

    const handleImport = async () => {
        if (!file) return

        setIsProcessing(true)
        setProgress(0)

        try {
            const text = await file.text()
            let data

            if (importOptions.format === 'json') {
                data = JSON.parse(text)
            } else if (importOptions.format === 'csv') {
                // Simple CSV parsing (you might want to use a proper CSV library)
                const lines = text.split('\n')
                const headers = lines[0].split(',')
                data = lines.slice(1).map(line => {
                    const values = line.split(',')
                    const obj = {}
                    headers.forEach((header, index) => {
                        obj[header.trim()] = values[index]?.trim() || ''
                    })
                    return obj
                }).filter(row => Object.values(row).some(value => value))
            }

            setProgress(50)

            const result = await importData(data, entityType, importOptions)
            
            if (result.success) {
                setProgress(100)
                alert(`Successfully imported ${result.importedCount} ${entityType}!`)
                onClose()
            } else {
                throw new Error(result.error)
            }
        } catch (error) {
            alert(`Import failed: ${error.message}`)
        } finally {
            setIsProcessing(false)
            setProgress(0)
        }
    }

    const handleExport = async () => {
        setIsProcessing(true)
        setProgress(0)

        try {
            setProgress(50)
            const result = await exportData(entityType, exportOptions.format, exportOptions)
            
            if (result.success) {
                setProgress(100)
                alert(`Data exported successfully as ${exportOptions.format.toUpperCase()}!`)
            } else {
                throw new Error(result.error)
            }
        } catch (error) {
            alert(`Export failed: ${error.message}`)
        } finally {
            setIsProcessing(false)
            setProgress(0)
        }
    }

    const handleBulkDelete = async () => {
        if (currentData.length === 0) {
            alert('No data to delete')
            return
        }

        if (!window.confirm(`Are you sure you want to delete ALL ${currentData.length} ${entityType}? This action cannot be undone.`)) {
            return
        }

        setIsProcessing(true)
        setProgress(0)

        try {
            const ids = currentData.map(item => item.id)
            setProgress(50)
            
            const result = await bulkDelete(ids, entityType)
            
            if (result.success) {
                setProgress(100)
                alert(`Successfully deleted ${result.deletedCount} ${entityType}!`)
                onClose()
            } else {
                throw new Error(result.error)
            }
        } catch (error) {
            alert(`Bulk delete failed: ${error.message}`)
        } finally {
            setIsProcessing(false)
            setProgress(0)
        }
    }

    const downloadTemplate = () => {
        const template = entityType === 'leads' ? [
            {
                companyName: 'Example Company',
                leadContact: 'John Doe',
                email: 'john@example.com',
                phone: '123-456-7890',
                status: 'new',
                methodOfContact: 'email',
                projectMarket: 'us'
            }
        ] : [
            {
                clientName: 'Example Client',
                clientNumber: 'CLI-001',
                clientType: 'Individual',
                address: '123 Main St',
                city: 'New York',
                state: 'NY',
                zip: '10001'
            }
        ]

        const dataStr = JSON.stringify(template, null, 2)
        const dataBlob = new Blob([dataStr], { type: 'application/json' })
        const url = URL.createObjectURL(dataBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${entityType}_template.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    return (
        <Dialog isOpen={isOpen} onClose={onClose} width={800}>
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold">
                        Bulk Data Manager - {entityType.charAt(0).toUpperCase() + entityType.slice(1)}s
                    </h3>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={activeTab === 'import' ? 'solid' : 'twoTone'}
                            size="sm"
                            onClick={() => setActiveTab('import')}
                        >
                            Import
                        </Button>
                        <Button
                            variant={activeTab === 'export' ? 'solid' : 'twoTone'}
                            size="sm"
                            onClick={() => setActiveTab('export')}
                        >
                            Export
                        </Button>
                        <Button
                            variant={activeTab === 'delete' ? 'solid' : 'twoTone'}
                            size="sm"
                            onClick={() => setActiveTab('delete')}
                            className="text-red-600"
                        >
                            Delete All
                        </Button>
                    </div>
                </div>

                {activeTab === 'import' && (
                    <div className="space-y-4">
                        <Alert type="info">
                            <div>
                                <strong>Import {entityType.charAt(0).toUpperCase() + entityType.slice(1)}s</strong>
                                <p className="text-sm mt-1">
                                    Upload a JSON or CSV file to import {entityType}. Download a template first to see the required format.
                                </p>
                            </div>
                        </Alert>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium mb-2 block">File Format</label>
                                <Select
                                    options={[
                                        { value: 'json', label: 'JSON' },
                                        { value: 'csv', label: 'CSV' }
                                    ]}
                                    value={{ value: importOptions.format, label: importOptions.format.toUpperCase() }}
                                    onChange={(opt) => setImportOptions(prev => ({ ...prev, format: opt.value }))}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-2 block">Import Options</label>
                                <div className="space-y-2">
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={importOptions.validate}
                                            onChange={(e) => setImportOptions(prev => ({ ...prev, validate: e.target.checked }))}
                                            className="mr-2"
                                        />
                                        Validate data
                                    </label>
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={importOptions.merge}
                                            onChange={(e) => setImportOptions(prev => ({ ...prev, merge: e.target.checked }))}
                                            className="mr-2"
                                        />
                                        Merge with existing
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <Button
                                variant="outline"
                                onClick={downloadTemplate}
                                className="flex items-center gap-2"
                            >
                                <HiOutlineDownload className="w-4 h-4" />
                                Download Template
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2"
                            >
                                <HiOutlineUpload className="w-4 h-4" />
                                Select File
                            </Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json,.csv"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                        </div>

                        {file && (
                            <div className="p-3 bg-gray-50 rounded">
                                <p className="text-sm font-medium">Selected file: {file.name}</p>
                                <p className="text-xs text-gray-600">Size: {(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                        )}

                        {isProcessing && (
                            <div className="space-y-2">
                                <Progress value={progress} />
                                <p className="text-sm text-center">Processing... {progress}%</p>
                            </div>
                        )}

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={onClose}>Cancel</Button>
                            <Button
                                variant="solid"
                                onClick={handleImport}
                                disabled={!file || isProcessing}
                                className="flex items-center gap-2"
                            >
                                <HiOutlineUpload className="w-4 h-4" />
                                Import {entityType.charAt(0).toUpperCase() + entityType.slice(1)}s
                            </Button>
                        </div>
                    </div>
                )}

                {activeTab === 'export' && (
                    <div className="space-y-4">
                        <Alert type="info">
                            <div>
                                <strong>Export {entityType.charAt(0).toUpperCase() + entityType.slice(1)}s</strong>
                                <p className="text-sm mt-1">
                                    Export your {entityType} data in JSON or CSV format. You can apply filters to export specific data.
                                </p>
                            </div>
                        </Alert>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium mb-2 block">Export Format</label>
                                <Select
                                    options={[
                                        { value: 'json', label: 'JSON' },
                                        { value: 'csv', label: 'CSV' }
                                    ]}
                                    value={{ value: exportOptions.format, label: exportOptions.format.toUpperCase() }}
                                    onChange={(opt) => setExportOptions(prev => ({ ...prev, format: opt.value }))}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-2 block">Current Data</label>
                                <p className="text-sm text-gray-600">
                                    {currentData.length} {entityType} available for export
                                </p>
                            </div>
                        </div>

                        {isProcessing && (
                            <div className="space-y-2">
                                <Progress value={progress} />
                                <p className="text-sm text-center">Exporting... {progress}%</p>
                            </div>
                        )}

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={onClose}>Cancel</Button>
                            <Button
                                variant="solid"
                                onClick={handleExport}
                                disabled={isProcessing}
                                className="flex items-center gap-2"
                            >
                                <HiOutlineDownload className="w-4 h-4" />
                                Export {entityType.charAt(0).toUpperCase() + entityType.slice(1)}s
                            </Button>
                        </div>
                    </div>
                )}

                {activeTab === 'delete' && (
                    <div className="space-y-4">
                        <Alert type="warning">
                            <div>
                                <strong>⚠️ Danger Zone</strong>
                                <p className="text-sm mt-1">
                                    This will permanently delete ALL {currentData.length} {entityType} in your database. 
                                    This action cannot be undone. Make sure you have a backup before proceeding.
                                </p>
                            </div>
                        </Alert>

                        <div className="p-4 bg-red-50 border border-red-200 rounded">
                            <div className="flex items-center gap-2 mb-2">
                                <HiOutlineTrash className="w-5 h-5 text-red-600" />
                                <span className="font-medium text-red-800">Delete All {entityType.charAt(0).toUpperCase() + entityType.slice(1)}s</span>
                            </div>
                            <p className="text-sm text-red-700">
                                This will delete {currentData.length} {entityType} permanently.
                            </p>
                        </div>

                        {isProcessing && (
                            <div className="space-y-2">
                                <Progress value={progress} />
                                <p className="text-sm text-center">Deleting... {progress}%</p>
                            </div>
                        )}

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={onClose}>Cancel</Button>
                            <Button
                                variant="solid"
                                onClick={handleBulkDelete}
                                disabled={isProcessing || currentData.length === 0}
                                className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
                            >
                                <HiOutlineTrash className="w-4 h-4" />
                                Delete All {entityType.charAt(0).toUpperCase() + entityType.slice(1)}s
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Dialog>
    )
}

export default BulkDataManager

