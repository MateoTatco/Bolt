import { useState } from 'react'
import { Button, Card, Alert } from '@/components/ui'
import { FirebaseAuthService } from '@/services/FirebaseAuthService'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { migrateMockDataToFirebase } from '@/utils/migrateToFirebase'

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
            </div>
            
            <div className="mt-4 text-sm text-gray-600">
                <p>Use these buttons to test your Firebase setup:</p>
                <ul className="list-disc list-inside mt-2">
                    <li>Test Connection: Verifies Firebase is properly configured</li>
                    <li>Migrate Data: Copies your mock data to Firestore</li>
                </ul>
            </div>
        </Card>
    )
}

export default FirebaseTest
