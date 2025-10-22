/**
 * Firebase Advanced Features Testing Guide
 * 
 * This file contains testing functions you can run in the browser console
 * to test all the new Firebase Service Implementation features.
 */

import { useCrmStore } from '@/store/crmStore'

// Get the store instance for testing
const getStore = () => useCrmStore.getState()

/**
 * TESTING GUIDE - Run these in browser console:
 * 
 * 1. Open your app in the browser
 * 2. Open Developer Tools (F12)
 * 3. Go to Console tab
 * 4. Copy and paste these test functions one by one
 */

// Test 1: Advanced Search
window.testAdvancedSearch = async () => {
    console.log('🧪 Testing Advanced Search...')
    try {
        const result = await getStore().advancedSearch({
            entityType: 'leads',
            filters: { 
                // Only use filters that exist in your data
                // status: 'active' // Comment out if no leads have 'active' status
            },
            sortBy: 'createdAt',
            sortOrder: 'desc',
            pageSize: 5
        })
        console.log('✅ Advanced Search Result:', result)
        return result
    } catch (error) {
        console.error('❌ Advanced Search Failed:', error)
        throw error
    }
}

// Test 2: Full Text Search
window.testFullTextSearch = async () => {
    console.log('🧪 Testing Full Text Search...')
    try {
        const result = await getStore().fullTextSearch('company', 'leads')
        console.log('✅ Full Text Search Result:', result)
        return result
    } catch (error) {
        console.error('❌ Full Text Search Failed:', error)
        throw error
    }
}

// Test 3: Bulk Create
window.testBulkCreate = async () => {
    console.log('🧪 Testing Bulk Create...')
    try {
        const testLeads = [
            {
                companyName: 'Console Test Company 1',
                leadContact: 'Console Test User 1',
                email: 'console1@test.com',
                phone: '111-222-3333',
                status: 'active',
                methodOfContact: 'email'
            },
            {
                companyName: 'Console Test Company 2',
                leadContact: 'Console Test User 2',
                email: 'console2@test.com',
                phone: '444-555-6666',
                status: 'active',
                methodOfContact: 'phone'
            }
        ]
        const result = await getStore().bulkCreate(testLeads, 'leads')
        console.log('✅ Bulk Create Result:', result)
        return result
    } catch (error) {
        console.error('❌ Bulk Create Failed:', error)
        throw error
    }
}

// Test 4: Bulk Update
window.testBulkUpdate = async () => {
    console.log('🧪 Testing Bulk Update...')
    try {
        const leads = getStore().leads
        if (leads.length < 2) {
            console.log('⚠️ Skipped: Need at least 2 leads to test bulk update')
            return { success: true, message: 'Skipped: Need at least 2 leads to test bulk update' }
        }
        
        // Get the first 2 leads that actually exist in Firebase
        const validLeads = leads.filter(lead => lead.id && lead.companyName)
        if (validLeads.length < 2) {
            console.log('⚠️ Skipped: Need at least 2 valid leads to test bulk update')
            return { success: true, message: 'Skipped: Need at least 2 valid leads to test bulk update' }
        }
        
        const updates = validLeads.slice(0, 2).map(lead => ({
            id: lead.id,
            data: { 
                status: 'console-updated', 
                updatedAt: new Date().toISOString(),
                consoleTest: true
            }
        }))
        
        const result = await getStore().bulkUpdate(updates, 'leads')
        console.log('✅ Bulk Update Result:', result)
        return result
    } catch (error) {
        console.error('❌ Bulk Update Failed:', error)
        throw error
    }
}

// Test 5: Bulk Delete
window.testBulkDelete = async () => {
    console.log('🧪 Testing Bulk Delete...')
    try {
        const leads = getStore().leads
        if (leads.length < 2) {
            console.log('⚠️ Skipped: Need at least 2 leads to test bulk delete')
            return { success: true, message: 'Skipped: Need at least 2 leads to test bulk delete' }
        }
        
        // Only delete test leads to avoid deleting real data
        const testLeads = leads.filter(lead => 
            lead.companyName?.includes('Console Test') || 
            lead.companyName?.includes('Test Company')
        )
        
        if (testLeads.length === 0) {
            console.log('⚠️ Skipped: No test leads found to delete safely (this is good - protects your real data!)')
            return { success: true, message: 'Skipped: No test leads found to delete safely (this is good - protects your real data!)' }
        }
        
        const idsToDelete = testLeads.slice(0, 2).map(lead => lead.id)
        const result = await getStore().bulkDelete(idsToDelete, 'leads')
        console.log('✅ Bulk Delete Result:', result)
        return result
    } catch (error) {
        console.error('❌ Bulk Delete Failed:', error)
        throw error
    }
}

// Test 6: Export Data
window.testExportData = async () => {
    console.log('🧪 Testing Export Data...')
    try {
        const result = await getStore().exportData('leads', 'json')
        console.log('✅ Export Data Result:', result)
        return result
    } catch (error) {
        console.error('❌ Export Data Failed:', error)
        throw error
    }
}

// Test 7: Import Data
window.testImportData = async () => {
    console.log('🧪 Testing Import Data...')
    try {
        const testData = [
            {
                companyName: 'Console Import Company',
                leadContact: 'Console Import User',
                email: 'console-import@test.com',
                phone: '999-888-7777',
                status: 'active',
                methodOfContact: 'email'
            }
        ]
        const result = await getStore().importData(testData, 'leads', { validate: true })
        console.log('✅ Import Data Result:', result)
        return result
    } catch (error) {
        console.error('❌ Import Data Failed:', error)
        throw error
    }
}

// Test 8: Analytics
window.testAnalytics = async () => {
    console.log('🧪 Testing Analytics...')
    try {
        const result = await getStore().getAnalytics('leads')
        console.log('✅ Analytics Result:', result)
        return result
    } catch (error) {
        console.error('❌ Analytics Failed:', error)
        throw error
    }
}

// Test 9: Archive Old Records
window.testArchiveOldRecords = async () => {
    console.log('🧪 Testing Archive Old Records...')
    try {
        const result = await getStore().archiveOldRecords('leads', 1) // Archive records older than 1 day
        console.log('✅ Archive Old Records Result:', result)
        return result
    } catch (error) {
        console.error('❌ Archive Old Records Failed:', error)
        throw error
    }
}

// Run All Tests
window.runAllFirebaseTests = async () => {
    console.log('🚀 Running All Firebase Advanced Tests...')
    const tests = [
        { name: 'Advanced Search', fn: window.testAdvancedSearch },
        { name: 'Full Text Search', fn: window.testFullTextSearch },
        { name: 'Bulk Create', fn: window.testBulkCreate },
        { name: 'Bulk Update', fn: window.testBulkUpdate },
        { name: 'Bulk Delete', fn: window.testBulkDelete },
        { name: 'Export Data', fn: window.testExportData },
        { name: 'Import Data', fn: window.testImportData },
        { name: 'Analytics', fn: window.testAnalytics },
        { name: 'Archive Old Records', fn: window.testArchiveOldRecords }
    ]

    const results = []
    
    for (const test of tests) {
        try {
            console.log(`\n🧪 Running: ${test.name}`)
            const result = await test.fn()
            results.push({ test: test.name, status: 'PASSED', result })
            console.log(`✅ ${test.name} PASSED`)
        } catch (error) {
            results.push({ test: test.name, status: 'FAILED', error: error.message })
            console.log(`❌ ${test.name} FAILED:`, error.message)
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    console.log('\n📊 Test Results Summary:')
    console.table(results)
    
    const passed = results.filter(r => r.status === 'PASSED').length
    const failed = results.filter(r => r.status === 'FAILED').length
    
    console.log(`\n✅ Passed: ${passed}`)
    console.log(`❌ Failed: ${failed}`)
    console.log(`📈 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`)
    
    return results
}

// Helper function to check current data
window.checkCurrentData = () => {
    const store = getStore()
    console.log('📊 Current Data Status:')
    console.log(`Leads: ${store.leads.length}`)
    console.log(`Clients: ${store.clients.length}`)
    console.log('Leads:', store.leads)
    console.log('Clients:', store.clients)
    return { leads: store.leads.length, clients: store.clients.length }
}

// Helper function to clear test data
window.clearTestData = async () => {
    console.log('🧹 Clearing Test Data...')
    try {
        const leads = getStore().leads
        const testLeads = leads.filter(lead => 
            lead.companyName?.includes('Console Test') || 
            lead.companyName?.includes('Test Company') ||
            lead.companyName?.includes('Console Import')
        )
        
        if (testLeads.length > 0) {
            const idsToDelete = testLeads.map(lead => lead.id)
            await getStore().bulkDelete(idsToDelete, 'leads')
            console.log(`✅ Cleared ${testLeads.length} test leads`)
        } else {
            console.log('ℹ️ No test data found to clear')
        }
    } catch (error) {
        console.error('❌ Failed to clear test data:', error)
    }
}

// Helper function to create test data for testing
window.createTestData = async () => {
    console.log('🔧 Creating Test Data...')
    try {
        const testLeads = [
            {
                companyName: 'Test Company Alpha',
                leadContact: 'Test User Alpha',
                email: 'alpha@test.com',
                phone: '111-111-1111',
                status: 'active',
                methodOfContact: 'email'
            },
            {
                companyName: 'Test Company Beta',
                leadContact: 'Test User Beta',
                email: 'beta@test.com',
                phone: '222-222-2222',
                status: 'active',
                methodOfContact: 'phone'
            }
        ]
        
        const result = await getStore().bulkCreate(testLeads, 'leads')
        console.log('✅ Test data created:', result)
        return result
    } catch (error) {
        console.error('❌ Failed to create test data:', error)
    }
}

console.log(`
🔥 Firebase Advanced Features Testing Guide
===========================================

Available Test Functions:
• testAdvancedSearch() - Test advanced search functionality
• testFullTextSearch() - Test full-text search
• testBulkCreate() - Test bulk create operations
• testBulkUpdate() - Test bulk update operations
• testBulkDelete() - Test bulk delete operations
• testExportData() - Test data export functionality
• testImportData() - Test data import functionality
• testAnalytics() - Test analytics and reporting
• testArchiveOldRecords() - Test archive functionality
• runAllFirebaseTests() - Run all tests at once
• checkCurrentData() - Check current data status
• createTestData() - Create test data for testing
• clearTestData() - Clear test data

Example Usage:
1. createTestData() - First create some test data
2. runAllFirebaseTests() - Then run all tests
3. checkCurrentData() - Check your data
4. clearTestData() - Clean up when done
`)

export default {
    testAdvancedSearch: window.testAdvancedSearch,
    testFullTextSearch: window.testFullTextSearch,
    testBulkCreate: window.testBulkCreate,
    testBulkUpdate: window.testBulkUpdate,
    testBulkDelete: window.testBulkDelete,
    testExportData: window.testExportData,
    testImportData: window.testImportData,
    testAnalytics: window.testAnalytics,
    testArchiveOldRecords: window.testArchiveOldRecords,
    runAllFirebaseTests: window.runAllFirebaseTests,
    checkCurrentData: window.checkCurrentData,
    clearTestData: window.clearTestData
}
