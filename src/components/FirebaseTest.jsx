import { useState } from 'react'
import { Button, Card, Alert } from '@/components/ui'
import { FirebaseAuthService } from '@/services/FirebaseAuthService'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { migrateMockDataToFirebase } from '@/utils/migrateToFirebase'
import { migrateTasksMockData, resetAndMigrateTasks, clearTasksData } from '@/utils/migrateTasksMockData'

const FirebaseTest = () => {
    const [status, setStatus] = useState('')
    const [loading, setLoading] = useState(false)

    const testConnection = async () => {
        setLoading(true)
        setStatus('Testing Firebase connection...')
        
        try {
            // Test database connection
            const leadsResult = await FirebaseDbService.leads.getAll()
            if (leadsResult.success) {
                setStatus(`✅ Firebase connected! Found ${leadsResult.data.length} leads.`)
            } else {
                setStatus(`❌ Firebase connection failed: ${leadsResult.error}`)
            }
        } catch (error) {
            setStatus(`❌ Error: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    const migrateData = async () => {
        setLoading(true)
        setStatus('Migrating mock data to Firebase...')
        
        try {
            const result = await migrateMockDataToFirebase()
            if (result.success) {
                setStatus('✅ Data migration completed successfully!')
            } else {
                setStatus(`❌ Migration failed: ${result.error}`)
            }
        } catch (error) {
            setStatus(`❌ Error: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    const migrateTasksData = async () => {
        setLoading(true)
        setStatus('Migrating Tasks mock data to Firebase...')
        
        try {
            const result = await migrateTasksMockData()
            if (result.success) {
                setStatus('✅ Tasks mock data migration completed successfully!')
            } else {
                setStatus(`❌ Tasks migration failed: ${result.error}`)
            }
        } catch (error) {
            setStatus(`❌ Error: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    const resetTasksData = async () => {
        setLoading(true)
        setStatus('Resetting Tasks data...')
        
        try {
            const result = await resetAndMigrateTasks()
            if (result.success) {
                setStatus('✅ Tasks data reset and migrated successfully!')
            } else {
                setStatus(`❌ Tasks reset failed: ${result.error}`)
            }
        } catch (error) {
            setStatus(`❌ Error: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    const clearTasks = async () => {
        setLoading(true)
        setStatus('Clearing all Tasks data...')
        
        try {
            const result = await clearTasksData()
            if (result.success) {
                setStatus('✅ All Tasks data cleared successfully!')
            } else {
                setStatus(`❌ Clear Tasks failed: ${result.error}`)
            }
        } catch (error) {
            setStatus(`❌ Error: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="p-6 m-4">
            <h3 className="text-lg font-semibold mb-4">Firebase Integration Test</h3>
            
            {status && (
                <Alert className="mb-4" type={status.includes('✅') ? 'success' : 'danger'}>
                    {status}
                </Alert>
            )}
            
            <div className="space-y-3">
                <Button 
                    onClick={testConnection} 
                    loading={loading}
                    disabled={loading}
                >
                    Test Firebase Connection
                </Button>
                
                <Button 
                    onClick={migrateData} 
                    loading={loading}
                    disabled={loading}
                    variant="twoTone"
                >
                    Migrate Mock Data to Firebase
                </Button>
                
                <div className="border-t pt-3 mt-3">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Tasks Management</h4>
                    <div className="space-y-2">
                        <Button 
                            onClick={migrateTasksData} 
                            loading={loading}
                            disabled={loading}
                            variant="outline"
                            size="sm"
                        >
                            Add Tasks Mock Data
                        </Button>
                        
                        <Button 
                            onClick={resetTasksData} 
                            loading={loading}
                            disabled={loading}
                            variant="outline"
                            size="sm"
                        >
                            Reset Tasks Data
                        </Button>
                        
                        <Button 
                            onClick={clearTasks} 
                            loading={loading}
                            disabled={loading}
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                        >
                            Clear All Tasks
                        </Button>
                    </div>
                </div>
            </div>
            
            <div className="mt-4 text-sm text-gray-600">
                <p>Use these buttons to test your Firebase setup:</p>
                <ul className="list-disc list-inside mt-2">
                    <li>Test Connection: Verifies Firebase is properly configured</li>
                    <li>Migrate Data: Copies your mock data to Firestore</li>
                    <li>Add Tasks Mock Data: Adds sample tasks and sections to leads/clients</li>
                    <li>Reset Tasks Data: Clears and re-adds tasks mock data</li>
                    <li>Clear All Tasks: Removes all tasks and sections</li>
                </ul>
            </div>
        </Card>
    )
}

export default FirebaseTest
