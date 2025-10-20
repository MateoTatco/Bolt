import { FirebaseDbService } from '@/services/FirebaseDbService'
import { leadsData } from '@/mock/data/leadsData'
import { clientsData } from '@/mock/data/clientsData'

// This script migrates mock data to Firebase
// Run this once to populate your Firestore with initial data

export const migrateMockDataToFirebase = async () => {
    console.log('Starting migration to Firebase...')
    
    try {
        // Migrate leads
        console.log('Migrating leads...')
        for (const lead of leadsData) {
            // Remove the numeric ID and let Firebase generate a string ID
            const { id, ...leadData } = lead
            const result = await FirebaseDbService.leads.create(leadData)
            if (result.success) {
                console.log(`✅ Migrated lead: ${lead.companyName}`)
            } else {
                console.error(`❌ Failed to migrate lead: ${lead.companyName}`, result.error)
            }
        }
        
        // Migrate clients
        console.log('Migrating clients...')
        for (const client of clientsData) {
            // Remove the numeric ID and let Firebase generate a string ID
            const { id, ...clientData } = client
            const result = await FirebaseDbService.clients.create(clientData)
            if (result.success) {
                console.log(`✅ Migrated client: ${client.clientName}`)
            } else {
                console.error(`❌ Failed to migrate client: ${client.clientName}`, result.error)
            }
        }
        
        console.log('✅ Migration completed successfully!')
        return { success: true }
    } catch (error) {
        console.error('❌ Migration failed:', error)
        return { success: false, error: error.message }
    }
}

// Helper function to clear all data (use with caution!)
export const clearFirebaseData = async () => {
    console.log('⚠️ Clearing all Firebase data...')
    
    try {
        // Get all leads and delete them
        const leadsResult = await FirebaseDbService.leads.getAll()
        if (leadsResult.success) {
            for (const lead of leadsResult.data) {
                await FirebaseDbService.leads.delete(lead.id)
                console.log(`🗑️ Deleted lead: ${lead.companyName}`)
            }
        }
        
        // Get all clients and delete them
        const clientsResult = await FirebaseDbService.clients.getAll()
        if (clientsResult.success) {
            for (const client of clientsResult.data) {
                await FirebaseDbService.clients.delete(client.id)
                console.log(`🗑️ Deleted client: ${client.clientName}`)
            }
        }
        
        console.log('✅ All data cleared!')
        return { success: true }
    } catch (error) {
        console.error('❌ Failed to clear data:', error)
        return { success: false, error: error.message }
    }
}
