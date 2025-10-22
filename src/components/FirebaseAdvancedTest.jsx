import React, { useState } from 'react'
import { Button, Card, Input, Select, Dialog, Alert, Badge } from '@/components/ui'
import { useCrmStore } from '@/store/crmStore'

const FirebaseAdvancedTest = () => {
    const [testResults, setTestResults] = useState([])
    const [loading, setLoading] = useState(false)
    const [showResults, setShowResults] = useState(false)
    
    const {
        advancedSearch,
        fullTextSearch,
        bulkCreate,
        bulkUpdate,
        bulkDelete,
        exportData,
        importData,
        getAnalytics,
        archiveOldRecords,
        leads,
        clients
    } = useCrmStore()

    const addTestResult = (test, result, error = null) => {
        setTestResults(prev => [...prev, {
            id: Date.now(),
            test,
            result,
            error,
            timestamp: new Date().toLocaleString()
        }])
    }

    const runTest = async (testName, testFunction) => {
        setLoading(true)
        try {
            console.log(`🧪 Running test: ${testName}`)
            const result = await testFunction()
            addTestResult(testName, 'SUCCESS', null)
            console.log(`✅ ${testName} passed:`, result)
        } catch (error) {
            addTestResult(testName, 'FAILED', error.message)
            console.error(`❌ ${testName} failed:`, error)
        } finally {
            setLoading(false)
        }
    }

    // Test 1: Advanced Search
    const testAdvancedSearch = async () => {
        return await advancedSearch({
            entityType: 'leads',
            filters: { 
                // Only use filters that exist in your data
                // status: 'active' // Comment out if no leads have 'active' status
            },
            sortBy: 'createdAt',
            sortOrder: 'desc',
            pageSize: 5
        })
    }

    // Test 2: Full Text Search
    const testFullTextSearch = async () => {
        return await fullTextSearch('company', 'leads')
    }

    // Test 3: Bulk Create
    const testBulkCreate = async () => {
        const testLeads = [
            {
                companyName: 'Test Company 1',
                leadContact: 'John Doe',
                email: 'john@testcompany1.com',
                phone: '123-456-7890',
                status: 'active',
                methodOfContact: 'email'
            },
            {
                companyName: 'Test Company 2',
                leadContact: 'Jane Smith',
                email: 'jane@testcompany2.com',
                phone: '098-765-4321',
                status: 'active',
                methodOfContact: 'phone'
            }
        ]
        return await bulkCreate(testLeads, 'leads')
    }

    // Test 4: Bulk Update
    const testBulkUpdate = async () => {
        if (leads.length < 2) {
            return { success: true, message: 'Skipped: Need at least 2 leads to test bulk update' }
        }
        
        // Get the first 2 leads that actually exist in Firebase
        const validLeads = leads.filter(lead => lead.id && lead.companyName)
        if (validLeads.length < 2) {
            return { success: true, message: 'Skipped: Need at least 2 valid leads to test bulk update' }
        }
        
        const updates = validLeads.slice(0, 2).map(lead => ({
            id: lead.id,
            data: { 
                status: 'test-updated', 
                updatedAt: new Date().toISOString(),
                testUpdate: true
            }
        }))
        
        return await bulkUpdate(updates, 'leads')
    }

    // Test 5: Bulk Delete
    const testBulkDelete = async () => {
        if (leads.length < 2) {
            return { success: true, message: 'Skipped: Need at least 2 leads to test bulk delete' }
        }
        
        // Only delete test leads to avoid deleting real data
        const testLeads = leads.filter(lead => 
            lead.companyName?.includes('Test Company') || 
            lead.companyName?.includes('Console Test') ||
            lead.companyName?.includes('Imported Company')
        )
        
        if (testLeads.length === 0) {
            return { success: true, message: 'Skipped: No test leads found to delete safely (this is good - protects your real data!)' }
        }
        
        const idsToDelete = testLeads.slice(0, 2).map(lead => lead.id)
        return await bulkDelete(idsToDelete, 'leads')
    }

    // Test 6: Export Data
    const testExportData = async () => {
        return await exportData('leads', 'json')
    }

    // Test 7: Import Data
    const testImportData = async () => {
        const testData = [
            {
                companyName: 'Imported Company 1',
                leadContact: 'Import User 1',
                email: 'import1@test.com',
                phone: '111-222-3333',
                status: 'active',
                methodOfContact: 'email'
            }
        ]
        return await importData(testData, 'leads', { validate: true })
    }

    // Test 8: Analytics
    const testAnalytics = async () => {
        return await getAnalytics('leads')
    }

    // Test 9: Archive Old Records
    const testArchiveOldRecords = async () => {
        return await archiveOldRecords('leads', 1) // Archive records older than 1 day
    }

    // Run All Tests
    const runAllTests = async () => {
        setTestResults([])
        setLoading(true)
        
        const tests = [
            { name: 'Advanced Search', fn: testAdvancedSearch },
            { name: 'Full Text Search', fn: testFullTextSearch },
            { name: 'Bulk Create', fn: testBulkCreate },
            { name: 'Bulk Update', fn: testBulkUpdate },
            { name: 'Bulk Delete', fn: testBulkDelete },
            { name: 'Export Data', fn: testExportData },
            { name: 'Import Data', fn: testImportData },
            { name: 'Analytics', fn: testAnalytics },
            { name: 'Archive Old Records', fn: testArchiveOldRecords }
        ]

        for (const test of tests) {
            await runTest(test.name, test.fn)
            // Small delay between tests
            await new Promise(resolve => setTimeout(resolve, 1000))
        }
        
        setLoading(false)
        setShowResults(true)
    }

    // Manual Test Functions
    const testAdvancedSearchManual = () => runTest('Advanced Search (Manual)', testAdvancedSearch)
    const testFullTextSearchManual = () => runTest('Full Text Search (Manual)', testFullTextSearch)
    const testBulkCreateManual = () => runTest('Bulk Create (Manual)', testBulkCreate)
    const testBulkUpdateManual = () => runTest('Bulk Update (Manual)', testBulkUpdate)
    const testBulkDeleteManual = () => runTest('Bulk Delete (Manual)', testBulkDelete)
    const testExportDataManual = () => runTest('Export Data (Manual)', testExportData)
    const testImportDataManual = () => runTest('Import Data (Manual)', testImportData)
    const testAnalyticsManual = () => runTest('Analytics (Manual)', testAnalytics)
    const testArchiveManual = () => runTest('Archive (Manual)', testArchiveOldRecords)

    return (
        <div className="space-y-6">
            <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Firebase Advanced Features Test Suite</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <Button 
                        onClick={runAllTests} 
                        disabled={loading}
                        className="w-full"
                    >
                        {loading ? 'Running Tests...' : 'Run All Tests'}
                    </Button>
                    
                    <Button 
                        onClick={() => setShowResults(!showResults)} 
                        variant="outline"
                        className="w-full"
                    >
                        {showResults ? 'Hide Results' : 'Show Results'}
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button onClick={testAdvancedSearchManual} disabled={loading} size="sm">
                        Test Advanced Search
                    </Button>
                    <Button onClick={testFullTextSearchManual} disabled={loading} size="sm">
                        Test Full Text Search
                    </Button>
                    <Button onClick={testBulkCreateManual} disabled={loading} size="sm">
                        Test Bulk Create
                    </Button>
                    <Button onClick={testBulkUpdateManual} disabled={loading} size="sm">
                        Test Bulk Update
                    </Button>
                    <Button onClick={testBulkDeleteManual} disabled={loading} size="sm">
                        Test Bulk Delete
                    </Button>
                    <Button onClick={testExportDataManual} disabled={loading} size="sm">
                        Test Export Data
                    </Button>
                    <Button onClick={testImportDataManual} disabled={loading} size="sm">
                        Test Import Data
                    </Button>
                    <Button onClick={testAnalyticsManual} disabled={loading} size="sm">
                        Test Analytics
                    </Button>
                    <Button onClick={testArchiveManual} disabled={loading} size="sm">
                        Test Archive
                    </Button>
                </div>
            </Card>

            {showResults && (
                <Card className="p-6">
                    <h4 className="text-md font-semibold mb-4">Test Results</h4>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {testResults.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">No test results yet</p>
                        ) : (
                            testResults.map((result) => (
                                <div key={result.id} className="flex items-center justify-between p-3 border rounded">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <Badge 
                                                className={result.result === 'SUCCESS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                                            >
                                                {result.result}
                                            </Badge>
                                            <span className="font-medium">{result.test}</span>
                                        </div>
                                        <p className="text-sm text-gray-500">{result.timestamp}</p>
                                        {result.error && (
                                            <p className="text-sm text-red-600 mt-1">{result.error}</p>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>
            )}

            <Card className="p-6">
                <h4 className="text-md font-semibold mb-4">Current Data Status</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{leads.length}</p>
                        <p className="text-sm text-gray-600">Total Leads</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{clients.length}</p>
                        <p className="text-sm text-gray-600">Total Clients</p>
                    </div>
                </div>
            </Card>
        </div>
    )
}

export default FirebaseAdvancedTest
