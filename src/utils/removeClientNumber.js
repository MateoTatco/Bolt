import { FirebaseDbService } from '@/services/FirebaseDbService'

/**
 * Migration script to remove clientNumber field from existing clients in Firebase
 */
export const removeClientNumberFromClients = async () => {
    try {
        console.log('🔄 Starting clientNumber removal migration...')
        
        // Get all existing clients
        const clientsResult = await FirebaseDbService.clients.getAll()
        if (!clientsResult.success) {
            console.error('❌ Failed to fetch clients:', clientsResult.error)
            return { success: false, error: clientsResult.error }
        }
        
        const clients = clientsResult.data
        console.log(`📊 Found ${clients.length} clients to check`)
        
        let updatedCount = 0
        let skippedCount = 0
        
        for (const client of clients) {
            // Check if this client has clientNumber field
            if (client.clientNumber !== undefined) {
                console.log(`🔄 Removing clientNumber from client ${client.id}: ${client.clientNumber}`)
                
                // Create update payload without clientNumber
                const { clientNumber, ...clientWithoutNumber } = client
                
                const updateResult = await FirebaseDbService.clients.update(client.id, {
                    clientName: clientWithoutNumber.clientName,
                    clientType: clientWithoutNumber.clientType,
                    address: clientWithoutNumber.address,
                    city: clientWithoutNumber.city,
                    state: clientWithoutNumber.state,
                    zip: clientWithoutNumber.zip,
                    tags: clientWithoutNumber.tags,
                    notes: clientWithoutNumber.notes,
                    favorite: clientWithoutNumber.favorite
                })
                
                if (updateResult.success) {
                    updatedCount++
                    console.log(`✅ Removed clientNumber from client ${client.id}`)
                } else {
                    console.error(`❌ Failed to update client ${client.id}:`, updateResult.error)
                }
            } else {
                skippedCount++
                console.log(`⏭️ Skipped client ${client.id} (no clientNumber field)`)
            }
        }
        
        console.log(`🎉 Migration completed!`)
        console.log(`✅ Updated: ${updatedCount} clients`)
        console.log(`⏭️ Skipped: ${skippedCount} clients`)
        
        return { 
            success: true, 
            updated: updatedCount, 
            skipped: skippedCount,
            total: clients.length 
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Clear all clients and re-migrate from mock data without clientNumber
 */
export const resetAndMigrateClients = async () => {
    try {
        console.log('🔄 Resetting and re-migrating clients without clientNumber...')
        
        // Get all clients and delete them
        const clientsResult = await FirebaseDbService.clients.getAll()
        if (clientsResult.success) {
            const clients = clientsResult.data
            console.log(`🗑️ Deleting ${clients.length} existing clients...`)
            
            for (const client of clients) {
                await FirebaseDbService.clients.delete(client.id)
            }
        }
        
        // Import the updated mock data
        const { clientsData } = await import('@/mock/data/clientsData')
        console.log(`📥 Importing ${clientsData.length} clients without clientNumber...`)
        
        let importedCount = 0
        for (const clientData of clientsData) {
            // Remove the id field to let Firebase generate new ones
            const { id, ...clientWithoutId } = clientData
            
            const result = await FirebaseDbService.clients.create(clientWithoutId)
            if (result.success) {
                importedCount++
            }
        }
        
        console.log(`✅ Successfully imported ${importedCount} clients without clientNumber`)
        return { success: true, imported: importedCount }
        
    } catch (error) {
        console.error('❌ Reset and migration failed:', error)
        return { success: false, error: error.message }
    }
}

// Make functions available globally for console testing
if (typeof window !== 'undefined') {
    window.removeClientNumberFromClients = removeClientNumberFromClients
    window.resetAndMigrateClients = resetAndMigrateClients
}

