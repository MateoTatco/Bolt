import { FirebaseDbService } from './FirebaseDbService'
import { convertToCSV, validateLeadsData, validateClientsData } from './FirebaseDbService'

/**
 * Enhanced Firebase Service with advanced features
 * Combines all Firebase operations with advanced querying, batch operations, and data management
 */
export const EnhancedFirebaseService = {
    // ===== ADVANCED QUERYING =====
    
    // Advanced search with multiple criteria
    advancedSearch: async (searchParams) => {
        try {
            const {
                entityType = 'leads', // 'leads' | 'clients'
                searchTerm = '',
                filters = {},
                sortBy = 'createdAt',
                sortOrder = 'desc',
                pageSize = 20,
                pageToken = null,
                dateRange = null
            } = searchParams

            const service = entityType === 'leads' ? FirebaseDbService.leads : FirebaseDbService.clients
            
            // Use the advanced query method
            const result = await service.query({
                filters,
                sortBy,
                sortOrder,
                pageSize,
                pageToken,
                searchTerm,
                dateRange
            })

            return result
        } catch (error) {
            console.error('Enhanced search error:', error)
            return { success: false, error: error.message }
        }
    },

    // Full-text search across all fields
    fullTextSearch: async (searchTerm, entityType = 'leads', options = {}) => {
        try {
            const service = entityType === 'leads' ? FirebaseDbService.leads : FirebaseDbService.clients
            return await service.search(searchTerm, options)
        } catch (error) {
            console.error('Full-text search error:', error)
            return { success: false, error: error.message }
        }
    },

    // ===== BATCH OPERATIONS =====
    
    // Bulk create leads or clients
    bulkCreate: async (data, entityType = 'leads') => {
        try {
            const service = entityType === 'leads' ? FirebaseDbService.leads : FirebaseDbService.clients
            
            // Validate data before creating
            const validator = entityType === 'leads' ? validateLeadsData : validateClientsData
            const validation = validator(data)
            
            if (!validation.valid) {
                return { success: false, error: validation.errors }
            }

            return await service.batchCreate(data)
        } catch (error) {
            console.error('Bulk create error:', error)
            return { success: false, error: error.message }
        }
    },

    // Bulk update leads or clients
    bulkUpdate: async (updates, entityType = 'leads') => {
        try {
            const service = entityType === 'leads' ? FirebaseDbService.leads : FirebaseDbService.clients
            return await service.batchUpdate(updates)
        } catch (error) {
            console.error('Bulk update error:', error)
            return { success: false, error: error.message }
        }
    },

    // Bulk delete leads or clients
    bulkDelete: async (ids, entityType = 'leads') => {
        try {
            const service = entityType === 'leads' ? FirebaseDbService.leads : FirebaseDbService.clients
            return await service.batchDelete(ids)
        } catch (error) {
            console.error('Bulk delete error:', error)
            return { success: false, error: error.message }
        }
    },

    // ===== DATA EXPORT/IMPORT =====
    
    // Export data in multiple formats
    exportData: async (entityType = 'leads', format = 'json', options = {}) => {
        try {
            const { filters = {}, dateRange = null } = options
            const service = entityType === 'leads' ? FirebaseDbService.leads : FirebaseDbService.clients
            
            // If filters are provided, use advanced query
            if (Object.keys(filters).length > 0 || dateRange) {
                const queryResult = await service.query({
                    filters,
                    dateRange,
                    pageSize: 1000 // Large page size for export
                })
                
                if (!queryResult.success) {
                    return queryResult
                }
                
                // Convert to export format
                if (format === 'json') {
                    return {
                        success: true,
                        data: JSON.stringify(queryResult.data, null, 2),
                        mimeType: 'application/json',
                        filename: `${entityType}_export_${new Date().toISOString().split('T')[0]}.json`
                    }
                } else if (format === 'csv') {
                    const csvData = convertToCSV(queryResult.data)
                    return {
                        success: true,
                        data: csvData,
                        mimeType: 'text/csv',
                        filename: `${entityType}_export_${new Date().toISOString().split('T')[0]}.csv`
                    }
                }
            } else {
                // Use standard export
                return await service.exportData(format)
            }
        } catch (error) {
            console.error('Export data error:', error)
            return { success: false, error: error.message }
        }
    },

    // Import data with validation and options
    importData: async (data, entityType = 'leads', options = {}) => {
        try {
            const { validate = true, merge = false, overwrite = false } = options
            const service = entityType === 'leads' ? FirebaseDbService.leads : FirebaseDbService.clients
            
            return await service.importData(data, { validate, merge })
        } catch (error) {
            console.error('Import data error:', error)
            return { success: false, error: error.message }
        }
    },

    // ===== ANALYTICS AND REPORTING =====
    
    // Get analytics data
    getAnalytics: async (entityType = 'leads', dateRange = null) => {
        try {
            const service = entityType === 'leads' ? FirebaseDbService.leads : FirebaseDbService.clients
            
            // Get all data for analytics
            const result = await service.getAll()
            if (!result.success) {
                return result
            }

            const data = result.data
            const now = new Date()
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

            // Filter by date range if provided
            let filteredData = data
            if (dateRange) {
                filteredData = data.filter(item => {
                    const createdAt = new Date(item.createdAt?.toDate?.() || item.createdAt)
                    return createdAt >= dateRange.from && createdAt <= dateRange.to
                })
            }

            // Calculate analytics
            const analytics = {
                total: filteredData.length,
                thisMonth: filteredData.filter(item => {
                    const createdAt = new Date(item.createdAt?.toDate?.() || item.createdAt)
                    return createdAt >= thirtyDaysAgo
                }).length,
                byStatus: {},
                byMethod: {},
                byMonth: {},
                averageResponseTime: 0,
                conversionRate: 0
            }

            // Group by status
            filteredData.forEach(item => {
                const status = item.status || 'Unknown'
                analytics.byStatus[status] = (analytics.byStatus[status] || 0) + 1
            })

            // Group by method of contact
            filteredData.forEach(item => {
                const method = item.methodOfContact || 'Unknown'
                analytics.byMethod[method] = (analytics.byMethod[method] || 0) + 1
            })

            // Group by month
            filteredData.forEach(item => {
                const createdAt = new Date(item.createdAt?.toDate?.() || item.createdAt)
                const monthKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`
                analytics.byMonth[monthKey] = (analytics.byMonth[monthKey] || 0) + 1
            })

            return {
                success: true,
                data: analytics,
                dateRange: dateRange || { from: thirtyDaysAgo, to: now }
            }
        } catch (error) {
            console.error('Analytics error:', error)
            return { success: false, error: error.message }
        }
    },

    // ===== DATA MANAGEMENT =====
    
    // Archive old records
    archiveOldRecords: async (entityType = 'leads', daysOld = 365) => {
        try {
            const service = entityType === 'leads' ? FirebaseDbService.leads : FirebaseDbService.clients
            const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)
            
            // Get all records
            const result = await service.getAll()
            if (!result.success) {
                return result
            }

            // Filter old records
            const oldRecords = result.data.filter(item => {
                const createdAt = new Date(item.createdAt?.toDate?.() || item.createdAt)
                return createdAt < cutoffDate
            })

            if (oldRecords.length === 0) {
                return { success: true, archivedCount: 0, message: 'No old records to archive' }
            }

            // Create archive collection
            const archiveService = entityType === 'leads' ? 
                FirebaseDbService.leads : FirebaseDbService.clients

            // Move to archive (this would require creating an archive collection)
            // For now, we'll just mark them as archived
            const archiveUpdates = oldRecords.map(record => ({
                id: record.id,
                data: { ...record, archived: true, archivedAt: new Date() }
            }))

            const archiveResult = await archiveService.batchUpdate(archiveUpdates)
            
            return {
                success: true,
                archivedCount: oldRecords.length,
                data: archiveResult
            }
        } catch (error) {
            console.error('Archive error:', error)
            return { success: false, error: error.message }
        }
    },

    // ===== UTILITY FUNCTIONS =====
    
    // Download file helper
    downloadFile: (data, filename, mimeType) => {
        const blob = new Blob([data], { type: mimeType })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
    },

    // Parse CSV file
    parseCSV: (csvText) => {
        const lines = csvText.split('\n')
        const headers = lines[0].split(',')
        const data = []

        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                const values = lines[i].split(',')
                const row = {}
                headers.forEach((header, index) => {
                    row[header.trim()] = values[index]?.trim() || ''
                })
                data.push(row)
            }
        }

        return data
    },

    // Validate file format
    validateFile: (file, allowedTypes = ['json', 'csv']) => {
        const fileExtension = file.name.split('.').pop().toLowerCase()
        return allowedTypes.includes(fileExtension)
    }
}

export default EnhancedFirebaseService

