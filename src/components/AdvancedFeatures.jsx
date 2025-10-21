import React, { useEffect, useState } from 'react'
import { Button, Card, Alert, Badge, Dialog, Input, Select } from '@/components/ui'
import { useCrmStore } from '@/store/crmStore'

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

    return (
        <div className="space-y-4">
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
