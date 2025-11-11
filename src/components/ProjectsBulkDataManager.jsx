import React, { useState, useRef } from 'react'
import { Button, Dialog, Input, Select, Alert, Progress } from '@/components/ui'
import { useProjectsStore } from '@/store/projectsStore'
import { HiOutlineUpload, HiOutlineDownload, HiOutlineTrash } from 'react-icons/hi'

const ProjectsBulkDataManager = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('import')
    const [file, setFile] = useState(null)
    const [importOptions, setImportOptions] = useState({
        format: 'json',
        validate: true,
        merge: false
    })
    const [exportOptions, setExportOptions] = useState({
        format: 'json',
    })
    const [progress, setProgress] = useState(0)
    const [isProcessing, setIsProcessing] = useState(false)
    const fileInputRef = useRef(null)

    const {
        exportData,
        importData,
        bulkDeleteProjects,
        projects,
        loading
    } = useProjectsStore()

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
                const lines = text.split('\n').filter(line => line.trim())
                if (lines.length < 2) {
                    throw new Error('CSV file must have at least a header row and one data row')
                }
                
                const headers = lines[0].split(',').map(h => h.trim())
                data = lines.slice(1).map(line => {
                    const values = []
                    let current = ''
                    let inQuotes = false
                    
                    for (let i = 0; i < line.length; i++) {
                        const char = line[i]
                        if (char === '"') {
                            inQuotes = !inQuotes
                        } else if (char === ',' && !inQuotes) {
                            values.push(current.trim())
                            current = ''
                        } else {
                            current += char
                        }
                    }
                    values.push(current.trim())
                    
                    const obj = {}
                    headers.forEach((header, index) => {
                        let value = values[index] || ''
                        if (value.startsWith('"') && value.endsWith('"')) {
                            value = value.slice(1, -1)
                        }
                        if (value === 'true') value = true
                        if (value === 'false') value = false
                        // Try to parse numbers
                        if (!isNaN(value) && value !== '' && !isNaN(parseFloat(value))) {
                            value = parseFloat(value)
                        }
                        obj[header] = value
                    })
                    return obj
                }).filter(row => Object.values(row).some(value => value !== ''))
            }

            setProgress(50)

            const result = await importData(data, importOptions)
            
            if (result.success) {
                setProgress(100)
                alert(`Successfully imported ${result.importedCount} projects!`)
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
            const result = await exportData(exportOptions.format, exportOptions)
            
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
        if (projects.length === 0) {
            alert('No projects to delete')
            return
        }

        if (!window.confirm(`Are you sure you want to delete ALL ${projects.length} projects? This action cannot be undone.`)) {
            return
        }

        setIsProcessing(true)
        setProgress(0)

        try {
            const ids = projects.map(item => item.id)
            setProgress(50)
            
            const result = await bulkDeleteProjects(ids)
            
            if (result.success) {
                setProgress(100)
                alert(`Successfully deleted ${projects.length} projects!`)
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
        if (importOptions.format === 'json') {
            const template = [{
                ProjectNumber: 3100001,
                address: '3121 Melcat Dr',
                city: 'Oklahoma City',
                CompletionDate: '2024-10-21T00:00:00',
                CreatedAt: '2024-08-28T21:02:51',
                EstimatedValue: 25000,
                ProjectName: 'Mygrant Glass Demo',
                StartDate: '2024-09-23T00:00:00',
                State: 'OK',
                EstimatedCostAtCompletion: 25000,
                ClientReferenceId: 1000,
                ProjectRevisedContractAmount: 25000,
                Notes: '',
                ProjectProbability: 'Awarded',
                ProjectManager: 'Cindy Smith-Frawner',
                CommunicatedStartDate: '',
                CommunicatedFinishDate: '',
                ProjectedFinishDate: '2024-10-21T00:00:00',
                EstStart: '2025-03-01T00:00:00',
                EstFinish: '2025-04-09T00:00:00',
                EstDuration: 39,
                ActualFinishDate: '',
                ActualDuration: '',
                SuperId: '',
                Superintendent: '',
                BidDueDate: '2024-08-28T00:00:00',
                ProjectReviewDate: '',
                ProjectConceptionYear: 2024,
                BidType: 'new oportunity',
                Market: 'OKC',
                ProjectStatus: 'Not Awarded',
                ProjectStyle: '',
                EstimatedProjectProfit: '',
                ProfitCenterYear: 2024,
                SquareFeet: '',
                Archived: false,
                zip: '73179'
            }]

            const dataStr = JSON.stringify(template, null, 2)
            const dataBlob = new Blob([dataStr], { type: 'application/json' })
            const url = URL.createObjectURL(dataBlob)
            const link = document.createElement('a')
            link.href = url
            link.download = 'projects_template.json'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
        } else {
            const csvTemplate = 'ProjectNumber,address,city,CompletionDate,CreatedAt,EstimatedValue,ProjectName,StartDate,State,EstimatedCostAtCompletion,ClientReferenceId,ProjectRevisedContractAmount,Notes,ProjectProbability,ProjectManager,CommunicatedStartDate,CommunicatedFinishDate,ProjectedFinishDate,EstStart,EstFinish,EstDuration,ActualFinishDate,ActualDuration,SuperId,Superintendent,BidDueDate,ProjectReviewDate,ProjectConceptionYear,BidType,Market,ProjectStatus,ProjectStyle,EstimatedProjectProfit,ProfitCenterYear,SquareFeet,Archived,zip\n' +
                '3100001,"3121 Melcat Dr",Oklahoma City,2024-10-21T00:00:00,2024-08-28T21:02:51,25000,Mygrant Glass Demo,2024-09-23T00:00:00,OK,25000,1000,25000,,Awarded,Cindy Smith-Frawner,,,,2024-10-21T00:00:00,2025-03-01T00:00:00,2025-04-09T00:00:00,39,,,,,2024-08-28T00:00:00,,,2024,new oportunity,OKC,Not Awarded,,,2024,,false,73179'

            const dataBlob = new Blob([csvTemplate], { type: 'text/csv' })
            const url = URL.createObjectURL(dataBlob)
            const link = document.createElement('a')
            link.href = url
            link.download = 'projects_template.csv'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
        }
    }

    return (
        <Dialog isOpen={isOpen} onClose={onClose} width={800}>
            <div className="p-6 flex flex-col max-h-[90vh] md:max-h-none md:block">
                <div className="flex items-center justify-between mb-6 flex-col md:flex-row gap-4 md:gap-0">
                    <h3 className="text-lg font-semibold">Bulk Data Manager - Projects</h3>
                    <div className="flex items-center gap-2 w-full md:w-auto">
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
                
                <div className="flex-1 overflow-y-auto md:overflow-visible md:flex-none">

                {activeTab === 'import' && (
                    <div className="space-y-4">
                        <Alert type="info">
                            <div>
                                <strong>Import Projects</strong>
                                <p className="text-sm mt-1">
                                    Upload a JSON or CSV file to import projects. Download a template first to see the required format.
                                    {importOptions.format === 'csv' && (
                                        <span className="block mt-1 text-blue-600">
                                            💡 CSV is perfect for your team - just like Excel! Download the CSV template to get started.
                                        </span>
                                    )}
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
                                Download {importOptions.format.toUpperCase()} Template
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

                        <div className="flex justify-end gap-2 mt-4 md:mt-4 border-t border-gray-200 dark:border-gray-700 md:border-t-0 pt-4 md:pt-0">
                            <Button variant="outline" onClick={onClose}>Cancel</Button>
                            <Button
                                variant="solid"
                                onClick={handleImport}
                                disabled={!file || isProcessing}
                                className="flex items-center gap-2"
                            >
                                <HiOutlineUpload className="w-4 h-4" />
                                Import Projects
                            </Button>
                        </div>
                    </div>
                )}

                {activeTab === 'export' && (
                    <div className="space-y-4">
                        <Alert type="info">
                            <div>
                                <strong>Export Projects</strong>
                                <p className="text-sm mt-1">
                                    Export your projects data in JSON or CSV format.
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
                                    {projects.length} projects available for export
                                </p>
                            </div>
                        </div>

                        {isProcessing && (
                            <div className="space-y-2">
                                <Progress value={progress} />
                                <p className="text-sm text-center">Exporting... {progress}%</p>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 mt-4 md:mt-4 border-t border-gray-200 dark:border-gray-700 md:border-t-0 pt-4 md:pt-0">
                            <Button variant="outline" onClick={onClose}>Cancel</Button>
                            <Button
                                variant="solid"
                                onClick={handleExport}
                                disabled={isProcessing}
                                className="flex items-center gap-2"
                            >
                                <HiOutlineDownload className="w-4 h-4" />
                                Export Projects
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
                                    This will permanently delete ALL {projects.length} projects in your database. 
                                    This action cannot be undone. Make sure you have a backup before proceeding.
                                </p>
                            </div>
                        </Alert>

                        <div className="p-4 bg-red-50 border border-red-200 rounded">
                            <div className="flex items-center gap-2 mb-2">
                                <HiOutlineTrash className="w-5 h-5 text-red-600" />
                                <span className="font-medium text-red-800">Delete All Projects</span>
                            </div>
                            <p className="text-sm text-red-700">
                                This will delete {projects.length} projects permanently.
                            </p>
                        </div>

                        {isProcessing && (
                            <div className="space-y-2">
                                <Progress value={progress} />
                                <p className="text-sm text-center">Deleting... {progress}%</p>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 mt-4 md:mt-4 border-t border-gray-200 dark:border-gray-700 md:border-t-0 pt-4 md:pt-0">
                            <Button variant="outline" onClick={onClose}>Cancel</Button>
                            <Button
                                variant="solid"
                                onClick={handleBulkDelete}
                                disabled={isProcessing || projects.length === 0}
                                className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
                            >
                                <HiOutlineTrash className="w-4 h-4" />
                                Delete All Projects
                            </Button>
                        </div>
                    </div>
                )}
                </div>
            </div>
        </Dialog>
    )
}

export default ProjectsBulkDataManager

