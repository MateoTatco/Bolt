import React, { useEffect, useState } from 'react'
import { Button, Card, Alert, Badge, Dialog, Input, Select } from '@/components/ui'
import { useCrmStore } from '@/store/crmStore'
import { ProcoreService } from '@/services/ProcoreService'

const AdvancedFeatures = () => {
    const {
        isOnline,
        lastSyncTime,
        pendingChanges,
        changeHistory,
        conflictResolution,
        startRealtimeListeners,
        stopRealtimeListeners,
        loadFromCache,
        cacheData,
        rollbackChange,
        resolveConflict,
        setOnlineStatus
    } = useCrmStore()

    const [showHistory, setShowHistory] = useState(false)
    const [showConflicts, setShowConflicts] = useState(false)
    const [showDevTools, setShowDevTools] = useState(false)
    const [showAzureSqlTools, setShowAzureSqlTools] = useState(false)
    const [investigationProjectNumber, setInvestigationProjectNumber] = useState('')
    const [investigationResults, setInvestigationResults] = useState(null)
    const [isInvestigating, setIsInvestigating] = useState(false)
    const [deleteConfirmText, setDeleteConfirmText] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)

    // Online/Offline detection
    useEffect(() => {
        const handleOnline = () => setOnlineStatus(true)
        const handleOffline = () => setOnlineStatus(false)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [setOnlineStatus])

    // Start real-time listeners on mount
    useEffect(() => {
        startRealtimeListeners()
        return () => stopRealtimeListeners()
    }, [startRealtimeListeners, stopRealtimeListeners])

    // Try to load from cache on mount
    useEffect(() => {
        if (!isOnline) {
            loadFromCache()
        }
    }, [isOnline, loadFromCache])

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleString()
    }

    const handleRollback = async (historyId) => {
        if (window.confirm('Are you sure you want to rollback this change?')) {
            await rollbackChange(historyId)
        }
    }

    const handleShowTatcoContact = () => {
        try {
            // Get current type from localStorage or default to 'lead'
            const currentType = localStorage.getItem('crmCurrentType') || 'lead'
            const storageSuffix = currentType === 'client' ? 'client' : 'lead'
            
            // Get current visible columns
            const rawVisible = localStorage.getItem(`crmVisibleColumns_${storageSuffix}`)
            const visibleColumns = rawVisible ? JSON.parse(rawVisible) : {}
            
            // Force visibility
            visibleColumns.tatcoContact = true
            localStorage.setItem(`crmVisibleColumns_${storageSuffix}`, JSON.stringify(visibleColumns))
            
            // Get current column order
            const rawOrder = localStorage.getItem(`crmColumnOrder_${storageSuffix}`)
            const columnOrder = rawOrder ? JSON.parse(rawOrder) : []
            
            // Force column order
            if (!columnOrder.includes('tatcoContact')) {
                const newOrder = [...columnOrder]
                const leadContactIndex = newOrder.indexOf('leadContact')
                if (leadContactIndex !== -1) {
                    newOrder.splice(leadContactIndex + 1, 0, 'tatcoContact')
                } else {
                    newOrder.unshift('tatcoContact')
                }
                localStorage.setItem(`crmColumnOrder_${storageSuffix}`, JSON.stringify(newOrder))
            }
            
            // Dispatch event to notify Home.jsx to refresh
            window.dispatchEvent(new CustomEvent('crmColumnsUpdated'))
            
            // Optionally reload the page to see changes immediately
            if (window.location.pathname === '/home') {
                window.location.reload()
            }
        } catch (error) {
            console.error('Error updating Tatco Contact column:', error)
        }
    }

    const handleInvestigateProject = async () => {
        if (!investigationProjectNumber.trim()) {
            alert('Please enter a project number')
            return
        }

        setIsInvestigating(true)
        setInvestigationResults(null)
        try {
            const results = await ProcoreService.investigateProjectInAzure(investigationProjectNumber.trim())
            setInvestigationResults(results)
            console.log('Investigation results:', results)
        } catch (error) {
            console.error('Error investigating project:', error)
            alert(`Error investigating project: ${error.message || 'Unknown error'}`)
        } finally {
            setIsInvestigating(false)
        }
    }

    const handleDeleteProject = async (projectName, archiveDate) => {
        if (!investigationProjectNumber.trim()) {
            alert('Project number is required')
            return
        }

        // Require explicit confirmation
        const confirmMessage = `⚠️ WARNING: This will permanently delete project records from Azure SQL Database!\n\n` +
            `Project Number: ${investigationProjectNumber}\n` +
            (projectName ? `Project Name: ${projectName}\n` : '') +
            (archiveDate ? `Archive Date: ${archiveDate}\n` : '') +
            `\nThis action cannot be undone. Type "DELETE" to confirm:`

        const userInput = prompt(confirmMessage)
        if (userInput !== 'DELETE') {
            alert('Deletion cancelled. You must type "DELETE" exactly to confirm.')
            return
        }

        setIsDeleting(true)
        try {
            const result = await ProcoreService.deleteProjectFromAzure({
                projectNumber: investigationProjectNumber.trim(),
                projectName: projectName || undefined,
                archiveDate: archiveDate || undefined,
                confirmDelete: true,
            })
            console.log('Deletion result:', result)
            alert(`✅ Successfully deleted ${result.deleted} record(s)`)
            
            // Refresh investigation results
            await handleInvestigateProject()
        } catch (error) {
            console.error('Error deleting project:', error)
            alert(`Error deleting project: ${error.message || 'Unknown error'}`)
        } finally {
            setIsDeleting(false)
        }
    }

    const handlePromoteProject = async (projectName, sourceArchiveDate) => {
        if (!investigationProjectNumber.trim()) {
            alert('Project number is required')
            return
        }

        if (!sourceArchiveDate) {
            alert('Source archive date is required')
            return
        }

        // Require explicit confirmation
        const confirmMessage = `🔄 PROMOTE PROJECT TO MOST RECENT DATE\n\n` +
            `This will copy the selected record to the most recent archive date.\n\n` +
            `Project Number: ${investigationProjectNumber}\n` +
            `Project Name: ${projectName}\n` +
            `From Archive Date: ${sourceArchiveDate}\n` +
            `\nType "PROMOTE" to confirm:`

        const userInput = prompt(confirmMessage)
        if (userInput !== 'PROMOTE') {
            alert('Promotion cancelled. You must type "PROMOTE" exactly to confirm.')
            return
        }

        setIsDeleting(true) // Reuse loading state
        try {
            const result = await ProcoreService.promoteProjectToRecentDate({
                projectNumber: investigationProjectNumber.trim(),
                sourceArchiveDate: sourceArchiveDate,
                sourceProjectName: projectName || undefined,
                confirmPromote: true,
            })
            console.log('Promotion result:', result)
            alert(`✅ Successfully promoted record to most recent archive date (${result.promotedToDate})`)
            
            // Refresh investigation results
            await handleInvestigateProject()
        } catch (error) {
            console.error('Error promoting project:', error)
            alert(`Error promoting project: ${error.message || 'Unknown error'}`)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* Dev Tools Buttons */}
            <div className="flex justify-end gap-2 mb-4">
                <Button 
                    onClick={() => setShowDevTools(!showDevTools)}
                    variant="twoTone"
                    size="sm"
                    className="text-xs"
                >
                    {showDevTools ? 'Hide Dev Tools' : 'Dev Only'}
                </Button>
                <Button 
                    onClick={handleShowTatcoContact}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                >
                    Show Tatco Contact
                </Button>
            </div>

            {/* Development Tools - Hidden by default */}
            {showDevTools && (
                <Card className="p-4">
                    <h3 className="text-lg font-semibold mb-4">Column Debug Info</h3>
                    <div className="space-y-2">
                        <p><strong>Current Type:</strong> {localStorage.getItem('crmCurrentType') || 'lead'}</p>
                        <p><strong>Column Order (Lead):</strong> {localStorage.getItem('crmColumnOrder_lead') || 'Not set'}</p>
                        <p><strong>Visible Columns (Lead):</strong> {localStorage.getItem('crmVisibleColumns_lead') || 'Not set'}</p>
                        <p><strong>Column Order (Client):</strong> {localStorage.getItem('crmColumnOrder_client') || 'Not set'}</p>
                        <p><strong>Visible Columns (Client):</strong> {localStorage.getItem('crmVisibleColumns_client') || 'Not set'}</p>
                    </div>
                </Card>
            )}

            {/* Azure SQL Project Investigation Tools */}
            <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Azure SQL Project Management</h3>
                    <Button 
                        onClick={() => setShowAzureSqlTools(!showAzureSqlTools)}
                        variant="twoTone"
                        size="sm"
                    >
                        {showAzureSqlTools ? 'Hide' : 'Show'} Tools
                    </Button>
                </div>
                
                {showAzureSqlTools && (
                    <div className="space-y-4">
                        <Alert type="warning">
                            <div>
                                <strong>⚠️ Warning:</strong> These tools allow you to investigate and delete projects from Azure SQL Database. 
                                Use with extreme caution. Deletions are permanent and cannot be undone.
                            </div>
                        </Alert>

                        {/* Investigation Section */}
                        <div className="space-y-3">
                            <h4 className="font-semibold">Investigate Project</h4>
                            <p className="text-sm text-gray-600">
                                Enter a project number to see all records (across all archive dates) in Azure SQL.
                            </p>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Enter project number (e.g., 135250002)"
                                    value={investigationProjectNumber}
                                    onChange={(e) => setInvestigationProjectNumber(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            handleInvestigateProject()
                                        }
                                    }}
                                />
                                <Button
                                    onClick={handleInvestigateProject}
                                    disabled={isInvestigating || !investigationProjectNumber.trim()}
                                    loading={isInvestigating}
                                >
                                    Investigate
                                </Button>
                            </div>
                        </div>

                        {/* Investigation Results */}
                        {investigationResults && (
                            <div className="mt-4 space-y-3">
                                <div>
                                    <h4 className="font-semibold">
                                        Most Recent Records ({investigationResults.totalRecords} record(s))
                                    </h4>
                                    <p className="text-xs text-gray-500 mt-1">
                                        These are the records that appear on Project Profitability page
                                        {investigationResults.mostRecentArchiveDate && 
                                            ` (Archive Date: ${investigationResults.mostRecentArchiveDate})`
                                        }
                                    </p>
                                </div>
                                
                                {investigationResults.records.length === 0 ? (
                                    <Alert type="warning">
                                        <p className="text-sm">
                                            ⚠️ No records found on the most recent archive date. 
                                            If you delete any records, this project will disappear from Project Profitability.
                                        </p>
                                    </Alert>
                                ) : (
                                    <div className="space-y-2 max-h-96 overflow-y-auto">
                                        {investigationResults.records.map((record, index) => (
                                            <Card key={index} className="p-3 border border-blue-200">
                                                <div className="space-y-2">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <p className="font-medium">
                                                                {String(record.projectName || 'Unknown')}
                                                                {record.hasDeleteInName && (
                                                                    <Badge className="ml-2 bg-red-100 text-red-800">
                                                                        HAS "DELETE"
                                                                    </Badge>
                                                                )}
                                                                <Badge className="ml-2 bg-blue-100 text-blue-800">
                                                                    Most Recent
                                                                </Badge>
                                                            </p>
                                                            <p className="text-sm text-gray-600">
                                                                Project #: {String(record.projectNumber || 'N/A')}
                                                            </p>
                                                            {record.projectManager && (
                                                                <p className="text-sm text-gray-600">
                                                                    Project Manager: {String(record.projectManager)}
                                                                </p>
                                                            )}
                                                            <p className="text-xs text-gray-500">
                                                                Archive Date: {(() => {
                                                                    const date = record.archiveDateOnly;
                                                                    if (!date) return 'N/A';
                                                                    if (typeof date === 'string') return date;
                                                                    if (date instanceof Date) return date.toISOString().split('T')[0];
                                                                    return String(date);
                                                                })()}
                                                            </p>
                                                            <div className="flex gap-2 mt-1">
                                                                <Badge className={record.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                                                    {record.isActive ? 'Active' : 'Inactive'}
                                                                </Badge>
                                                                {record.redTeamImport && (
                                                                    <Badge className="bg-purple-100 text-purple-800">
                                                                        Red Team
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="solid"
                                                            color="red"
                                                            onClick={() => handleDeleteProject(record.projectName, record.archiveDate)}
                                                            disabled={isDeleting}
                                                        >
                                                            Delete This Record
                                                        </Button>
                                                    </div>
                                                    <div className="text-xs text-gray-500 space-y-1">
                                                        <div>
                                                            Contract Amount: ${(record.contractAmount || 0).toLocaleString()} | 
                                                            Est Cost: ${(record.estCostAtCompletion || 0).toLocaleString()} | 
                                                            Projected Profit: ${(record.projectedProfit || 0).toLocaleString()}
                                                        </div>
                                                        <div>
                                                            Status: {String(record.contractStatus || 'N/A')} | 
                                                            Stage: {String(record.projectStage || 'N/A')}
                                                            {record.contractStartDate && ` | Start: ${record.contractStartDate}`}
                                                            {record.contractEndDate && ` | End: ${record.contractEndDate}`}
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                )}

                                {/* Other Records from Different Archive Dates */}
                                {investigationResults.otherRecords && investigationResults.otherRecords.length > 0 && (
                                    <div className="mt-4">
                                        <div>
                                            <h4 className="font-semibold">
                                                Other Records on Different Dates ({investigationResults.otherRecords.length} record(s))
                                            </h4>
                                            <p className="text-xs text-gray-500 mt-1">
                                                These records exist but are NOT on the most recent archive date, so they won't appear on Project Profitability.
                                                If you delete the most recent record, these older records will NOT automatically appear.
                                            </p>
                                        </div>
                                        <div className="space-y-2 max-h-64 overflow-y-auto mt-2">
                                            {investigationResults.otherRecords.map((record, index) => (
                                                <Card key={`other-${index}`} className="p-3 border border-gray-200 opacity-75">
                                                    <div className="space-y-2">
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex-1">
                                                                <p className="font-medium text-sm">
                                                                    {String(record.projectName || 'Unknown')}
                                                                    {record.hasDeleteInName && (
                                                                        <Badge className="ml-2 bg-red-100 text-red-800">
                                                                            HAS "DELETE"
                                                                        </Badge>
                                                                    )}
                                                                    <Badge className="ml-2 bg-gray-100 text-gray-800">
                                                                        Older Date
                                                                    </Badge>
                                                                </p>
                                                                <p className="text-xs text-gray-600">
                                                                    Project #: {String(record.projectNumber || 'N/A')}
                                                                </p>
                                                                {record.projectManager && (
                                                                    <p className="text-xs text-gray-600">
                                                                        Project Manager: {String(record.projectManager)}
                                                                    </p>
                                                                )}
                                                                <p className="text-xs text-gray-500">
                                                                    Archive Date: {(() => {
                                                                        const date = record.archiveDateOnly;
                                                                        if (!date) return 'N/A';
                                                                        if (typeof date === 'string') return date;
                                                                        if (date instanceof Date) return date.toISOString().split('T')[0];
                                                                        return String(date);
                                                                    })()}
                                                                </p>
                                                                <div className="flex gap-2 mt-1">
                                                                    <Badge className={record.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                                                        {record.isActive ? 'Active' : 'Inactive'}
                                                                    </Badge>
                                                                </div>
                                                                <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                                                                    <div>
                                                                        Contract: ${(record.contractAmount || 0).toLocaleString()} | 
                                                                        Est Cost: ${(record.estCostAtCompletion || 0).toLocaleString()} | 
                                                                        Profit: ${(record.projectedProfit || 0).toLocaleString()}
                                                                    </div>
                                                                    <div>
                                                                        {record.contractStatus && `Status: ${record.contractStatus} | `}
                                                                        {record.projectStage && `Stage: ${record.projectStage}`}
                                                                        {record.contractStartDate && ` | Start: ${record.contractStartDate}`}
                                                                        {record.contractEndDate && ` | End: ${record.contractEndDate}`}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                variant="solid"
                                                                color="blue"
                                                                onClick={() => handlePromoteProject(record.projectName, record.archiveDateOnly)}
                                                                disabled={isDeleting}
                                                            >
                                                                Promote to Recent
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h6 className="text-sm font-medium">Connection Status</h6>
                            <p className="text-xs text-gray-500">
                                {isOnline ? 'Online' : 'Offline'}
                            </p>
                        </div>
                        <Badge 
                            className={isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                        >
                            {isOnline ? '🟢' : '🔴'}
                        </Badge>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h6 className="text-sm font-medium">Last Sync</h6>
                            <p className="text-xs text-gray-500">
                                {lastSyncTime ? formatTime(lastSyncTime) : 'Never'}
                            </p>
                        </div>
                        <Button 
                            size="sm" 
                            onClick={cacheData}
                            disabled={!isOnline}
                        >
                            Cache
                        </Button>
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h6 className="text-sm font-medium">Pending Changes</h6>
                            <p className="text-xs text-gray-500">
                                {pendingChanges.length} changes
                            </p>
                        </div>
                        <Badge className="bg-yellow-100 text-yellow-800">
                            {pendingChanges.length}
                        </Badge>
                    </div>
                </Card>
            </div>

            {/* Advanced Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                    <h6 className="text-sm font-medium mb-3">Change History</h6>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">
                                {changeHistory.length} recent changes
                            </span>
                            <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => setShowHistory(true)}
                            >
                                View History
                            </Button>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <h6 className="text-sm font-medium mb-3">Conflict Resolution</h6>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">
                                {conflictResolution.conflicts.length} conflicts
                            </span>
                            <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => setShowConflicts(true)}
                                disabled={conflictResolution.conflicts.length === 0}
                            >
                                Resolve
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Offline Mode Alert */}
            {!isOnline && (
                <Alert type="warning">
                    <div className="flex items-center">
                        <span className="mr-2">⚠️</span>
                        <div>
                            <strong>Offline Mode</strong>
                            <p className="text-sm mt-1">
                                You're working offline. Changes will be synced when you're back online.
                            </p>
                        </div>
                    </div>
                </Alert>
            )}

            {/* Change History Dialog */}
            <Dialog
                isOpen={showHistory}
                onClose={() => setShowHistory(false)}
            >
                <div className="p-6">
                    <h5 className="text-xl font-semibold mb-4">Change History</h5>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                    {changeHistory.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No changes recorded</p>
                    ) : (
                        changeHistory.map((change) => (
                            <div key={change.id} className="flex items-center justify-between p-3 border rounded">
                                <div>
                                    <p className="text-sm font-medium capitalize">
                                        {change.action.replace('_', ' ')}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {formatTime(change.timestamp)}
                                    </p>
                                </div>
                                <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => handleRollback(change.id)}
                                >
                                    Rollback
                                </Button>
                            </div>
                        ))
                    )}
                    </div>
                </div>
            </Dialog>

            {/* Conflict Resolution Dialog */}
            <Dialog
                isOpen={showConflicts}
                onClose={() => setShowConflicts(false)}
            >
                <div className="p-6">
                    <h5 className="text-xl font-semibold mb-4">Resolve Conflicts</h5>
                    <div className="space-y-4">
                    {conflictResolution.conflicts.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No conflicts to resolve</p>
                    ) : (
                        conflictResolution.conflicts.map((conflict) => (
                            <div key={conflict.id} className="p-4 border rounded">
                                <h6 className="font-medium mb-2">Conflict in {conflict.field}</h6>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm text-gray-600">Local Version</label>
                                        <Input 
                                            value={conflict.local} 
                                            readOnly 
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm text-gray-600">Server Version</label>
                                        <Input 
                                            value={conflict.server} 
                                            readOnly 
                                            className="mt-1"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-4">
                                    <Button 
                                        size="sm"
                                        onClick={() => resolveConflict(conflict.id, 'local')}
                                    >
                                        Use Local
                                    </Button>
                                    <Button 
                                        size="sm"
                                        onClick={() => resolveConflict(conflict.id, 'server')}
                                    >
                                        Use Server
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                    </div>
                </div>
            </Dialog>
        </div>
    )
}

export default AdvancedFeatures
