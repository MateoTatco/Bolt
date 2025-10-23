import { FirebaseDbService } from '@/services/FirebaseDbService'

/**
 * Migration script to update existing leads in Firebase to use new market options
 * Maps old market values to new ones: OKC, DFW, ORL
 */
export const migrateMarketOptions = async () => {
    try {
        console.log('🔄 Starting market options migration...')
        
        // Get all existing leads
        const leadsResult = await FirebaseDbService.leads.getAll()
        if (!leadsResult.success) {
            console.error('❌ Failed to fetch leads:', leadsResult.error)
            return { success: false, error: leadsResult.error }
        }
        
        const leads = leadsResult.data
        console.log(`📊 Found ${leads.length} leads to check`)
        
        // Mapping from old values to new values
        const marketMapping = {
            'construction': 'okc',
            'manufacturing': 'dfw', 
            'saas': 'okc',
            'retail': 'okc',
            'healthcare': 'dfw',
            'finance': 'okc',
            'technology': 'okc',
            'energy': 'orl',
            'education': 'orl',
            'logistics': 'dfw',
            'agriculture': 'orl',
            'media': 'okc',
            'other': 'okc'
        }
        
        let updatedCount = 0
        let skippedCount = 0
        
        for (const lead of leads) {
            const currentMarket = lead.projectMarket
            
            // Check if this lead needs updating
            if (currentMarket && marketMapping[currentMarket]) {
                const newMarket = marketMapping[currentMarket]
                
                console.log(`🔄 Updating lead ${lead.id}: ${currentMarket} → ${newMarket}`)
                
                const updateResult = await FirebaseDbService.leads.update(lead.id, {
                    projectMarket: newMarket
                })
                
                if (updateResult.success) {
                    updatedCount++
                    console.log(`✅ Updated lead ${lead.id}`)
                } else {
                    console.error(`❌ Failed to update lead ${lead.id}:`, updateResult.error)
                }
            } else {
                skippedCount++
                console.log(`⏭️ Skipped lead ${lead.id} (market: ${currentMarket})`)
            }
        }
        
        console.log(`🎉 Migration completed!`)
        console.log(`✅ Updated: ${updatedCount} leads`)
        console.log(`⏭️ Skipped: ${skippedCount} leads`)
        
        return { 
            success: true, 
            updated: updatedCount, 
            skipped: skippedCount,
            total: leads.length 
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Clear all leads and re-migrate from mock data with new market options
 */
export const resetAndMigrateLeads = async () => {
    try {
        console.log('🔄 Resetting and re-migrating leads with new market options...')
        
        // Get all leads and delete them
        const leadsResult = await FirebaseDbService.leads.getAll()
        if (leadsResult.success) {
            const leads = leadsResult.data
            console.log(`🗑️ Deleting ${leads.length} existing leads...`)
            
            for (const lead of leads) {
                await FirebaseDbService.leads.delete(lead.id)
            }
        }
        
        // Import the updated mock data
        const { leadsData } = await import('@/mock/data/leadsData')
        console.log(`📥 Importing ${leadsData.length} leads with new market options...`)
        
        let importedCount = 0
        for (const leadData of leadsData) {
            // Remove the id field to let Firebase generate new ones
            const { id, ...leadWithoutId } = leadData
            
            const result = await FirebaseDbService.leads.create(leadWithoutId)
            if (result.success) {
                importedCount++
            }
        }
        
        console.log(`✅ Successfully imported ${importedCount} leads with new market options`)
        return { success: true, imported: importedCount }
        
    } catch (error) {
        console.error('❌ Reset and migration failed:', error)
        return { success: false, error: error.message }
    }
}

// Make functions available globally for console testing
if (typeof window !== 'undefined') {
    window.migrateMarketOptions = migrateMarketOptions
    window.resetAndMigrateLeads = resetAndMigrateLeads
}
