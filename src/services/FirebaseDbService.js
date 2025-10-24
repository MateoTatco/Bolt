import { 
    collection, 
    doc, 
    getDocs, 
    getDoc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy, 
    onSnapshot,
    serverTimestamp,
    limit,
    startAfter,
    endBefore,
    limitToLast,
    writeBatch,
    getCountFromServer,
    startAt,
    endAt
} from 'firebase/firestore'
import { db } from '@/configs/firebase.config'

export const FirebaseDbService = {
    // LEADS COLLECTION
    leads: {
        // Get all leads
        getAll: async () => {
            try {
                const leadsRef = collection(db, 'leads')
                const snapshot = await getDocs(leadsRef)
                const leads = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                return { success: true, data: leads }
            } catch (error) {
                return { success: false, error: error.message }
            }
        },

        // Get single lead
        getById: async (id) => {
            try {
                // Ensure ID is a string
                const stringId = String(id)
                const leadRef = doc(db, 'leads', stringId)
                const leadSnap = await getDoc(leadRef)
                if (leadSnap.exists()) {
                    return { success: true, data: { id: leadSnap.id, ...leadSnap.data() } }
                } else {
                    return { success: false, error: 'Lead not found' }
                }
            } catch (error) {
                console.error('Firebase getById error:', error)
                return { success: false, error: error.message }
            }
        },

        // Create new lead
        create: async (leadData) => {
            try {
                const leadsRef = collection(db, 'leads')
                const docRef = await addDoc(leadsRef, {
                    ...leadData,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                })
                return { success: true, data: { id: docRef.id, ...leadData } }
            } catch (error) {
                return { success: false, error: error.message }
            }
        },

        // Update lead with conflict detection
        update: async (id, leadData, expectedVersion = null) => {
            try {
                // Ensure ID is a string
                const stringId = String(id)
                const leadRef = doc(db, 'leads', stringId)
                
                // Get current document for conflict detection
                const currentDoc = await getDoc(leadRef)
                if (!currentDoc.exists()) {
                    return { success: false, error: 'Lead not found' }
                }
                
                const currentData = currentDoc.data()
                
                // Check for conflicts if version is provided
                if (expectedVersion && currentData.version !== expectedVersion) {
                    return { 
                        success: false, 
                        error: 'Conflict detected - document was modified by another user',
                        conflict: {
                            localVersion: expectedVersion,
                            serverVersion: currentData.version,
                            serverData: currentData
                        }
                    }
                }
                
                const updateData = { ...leadData }
                // Remove the id from updateData to avoid conflicts
                delete updateData.id
                
                // Increment version for conflict detection
                const newVersion = (currentData.version || 0) + 1
                
                await updateDoc(leadRef, {
                    ...updateData,
                    updatedAt: serverTimestamp(),
                    version: newVersion,
                    lastModifiedBy: 'current-user' // This should be the actual user ID
                })
                
                return { 
                    success: true, 
                    data: { 
                        id: stringId, 
                        ...leadData, 
                        version: newVersion,
                        updatedAt: new Date().toISOString()
                    } 
                }
            } catch (error) {
                console.error('Firebase update error:', error)
                return { success: false, error: error.message }
            }
        },

        // Delete lead
        delete: async (id) => {
            try {
                // Ensure ID is a string
                const stringId = String(id)
                const leadRef = doc(db, 'leads', stringId)
                await deleteDoc(leadRef)
                return { success: true }
            } catch (error) {
                console.error('Firebase delete error:', error)
                return { success: false, error: error.message }
            }
        },

        // Real-time listener for leads
        subscribe: (callback) => {
            const leadsRef = collection(db, 'leads')
            return onSnapshot(leadsRef, (snapshot) => {
                const leads = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                callback(leads)
            })
        },

        // Advanced querying with filters, pagination, and sorting
        query: async (options = {}) => {
            try {
                const {
                    filters = {},
                    sortBy = 'createdAt',
                    sortOrder = 'desc',
                    pageSize = 10,
                    pageToken = null,
                    searchTerm = '',
                    dateRange = null
                } = options

                let q = query(collection(db, 'leads'))

                // Apply filters - only add filters for defined values
                if (filters.status && filters.status !== '') {
                    q = query(q, where('status', '==', filters.status))
                }
                if (filters.methodOfContact && filters.methodOfContact !== '') {
                    q = query(q, where('methodOfContact', '==', filters.methodOfContact))
                }
                if (filters.responded !== null && filters.responded !== undefined) {
                    q = query(q, where('responded', '==', filters.responded))
                }
                if (filters.favorite !== null && filters.favorite !== undefined) {
                    q = query(q, where('favorite', '==', filters.favorite))
                }

                // Apply date range filter
                if (dateRange && dateRange.from) {
                    q = query(q, where('createdAt', '>=', dateRange.from))
                }
                if (dateRange && dateRange.to) {
                    q = query(q, where('createdAt', '<=', dateRange.to))
                }

                // Apply sorting
                q = query(q, orderBy(sortBy, sortOrder))

                // Apply pagination
                if (pageToken) {
                    q = query(q, startAfter(pageToken))
                }
                q = query(q, limit(pageSize))

                const snapshot = await getDocs(q)
                const leads = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))

                // Get total count for pagination
                const countQuery = query(collection(db, 'leads'))
                const countSnapshot = await getCountFromServer(countQuery)
                const totalCount = countSnapshot.data().count

                return {
                    success: true,
                    data: leads,
                    pagination: {
                        totalCount,
                        pageSize,
                        hasNextPage: snapshot.docs.length === pageSize,
                        lastDoc: snapshot.docs[snapshot.docs.length - 1],
                        hasPrevPage: pageToken !== null
                    }
                }
            } catch (error) {
                console.error('Firebase query error:', error)
                return { success: false, error: error.message }
            }
        },

        // Search leads with full-text search simulation
        search: async (searchTerm, options = {}) => {
            try {
                const { limit: searchLimit = 20 } = options
                
                // Get all leads and filter client-side (Firestore doesn't support full-text search)
                const allLeads = await FirebaseDbService.leads.getAll()
                if (!allLeads.success) {
                    return allLeads
                }

                const searchLower = searchTerm.toLowerCase()
                const filteredLeads = allLeads.data.filter(lead => {
                const searchableFields = [
                    lead.companyName,
                    lead.leadContact,
                    lead.tatcoContact,
                    lead.email,
                    lead.phone,
                    lead.status,
                    lead.methodOfContact,
                    lead.projectMarket
                ].filter(Boolean).join(' ').toLowerCase()

                    return searchableFields.includes(searchLower)
                })

                return {
                    success: true,
                    data: filteredLeads.slice(0, searchLimit),
                    totalResults: filteredLeads.length
                }
            } catch (error) {
                console.error('Firebase search error:', error)
                return { success: false, error: error.message }
            }
        },

        // Batch operations
        batchCreate: async (leadsData) => {
            try {
                const batch = writeBatch(db)
                const leadsRef = collection(db, 'leads')
                const createdLeads = []

                leadsData.forEach(leadData => {
                    const docRef = doc(leadsRef)
                    batch.set(docRef, {
                        ...leadData,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                        version: 1
                    })
                    createdLeads.push({ id: docRef.id, ...leadData })
                })

                await batch.commit()
                return { success: true, data: createdLeads }
            } catch (error) {
                console.error('Firebase batch create error:', error)
                return { success: false, error: error.message }
            }
        },

        batchUpdate: async (updates) => {
            try {
                const batch = writeBatch(db)
                const validUpdates = []
                
                // Check if documents exist before adding to batch
                for (const { id, data } of updates) {
                    const leadRef = doc(db, 'leads', String(id))
                    const leadSnap = await getDoc(leadRef)
                    
                    if (leadSnap.exists()) {
                        batch.update(leadRef, {
                            ...data,
                            updatedAt: serverTimestamp()
                        })
                        validUpdates.push({ id, data })
                    } else {
                        console.warn(`Lead with ID ${id} not found, skipping update`)
                    }
                }

                if (validUpdates.length === 0) {
                    return { success: false, error: 'No valid documents found to update' }
                }

                await batch.commit()
                return { 
                    success: true, 
                    data: validUpdates,
                    skipped: updates.length - validUpdates.length
                }
            } catch (error) {
                console.error('Firebase batch update error:', error)
                return { success: false, error: error.message }
            }
        },

        batchDelete: async (ids) => {
            try {
                const batch = writeBatch(db)
                
                ids.forEach(id => {
                    const leadRef = doc(db, 'leads', String(id))
                    batch.delete(leadRef)
                })

                await batch.commit()
                return { success: true, deletedCount: ids.length }
            } catch (error) {
                console.error('Firebase batch delete error:', error)
                return { success: false, error: error.message }
            }
        },

        // Export data
        exportData: async (format = 'json') => {
            try {
                const result = await FirebaseDbService.leads.getAll()
                if (!result.success) {
                    return result
                }

                if (format === 'json') {
                    return {
                        success: true,
                        data: JSON.stringify(result.data, null, 2),
                        mimeType: 'application/json',
                        filename: `leads_export_${new Date().toISOString().split('T')[0]}.json`
                    }
                } else if (format === 'csv') {
                    const csvData = convertToCSV(result.data)
                    return {
                        success: true,
                        data: csvData,
                        mimeType: 'text/csv',
                        filename: `leads_export_${new Date().toISOString().split('T')[0]}.csv`
                    }
                }

                return { success: false, error: 'Unsupported format' }
            } catch (error) {
                console.error('Firebase export error:', error)
                return { success: false, error: error.message }
            }
        },

        // Import data
        importData: async (data, options = {}) => {
            try {
                const { validate = true, merge = false } = options
                
                if (validate) {
                    const validationResult = validateLeadsData(data)
                    if (!validationResult.valid) {
                        return { success: false, error: validationResult.errors }
                    }
                }

                if (merge) {
                    // Update existing leads, create new ones
                    const batch = writeBatch(db)
                    const leadsRef = collection(db, 'leads')
                    
                    for (const leadData of data) {
                        if (leadData.id) {
                            // Update existing
                            const leadRef = doc(db, 'leads', String(leadData.id))
                            batch.update(leadRef, {
                                ...leadData,
                                updatedAt: serverTimestamp()
                            })
                        } else {
                            // Create new
                            const docRef = doc(leadsRef)
                            batch.set(docRef, {
                                ...leadData,
                                createdAt: serverTimestamp(),
                                updatedAt: serverTimestamp(),
                                version: 1
                            })
                        }
                    }
                    
                    await batch.commit()
                } else {
                    // Create new leads only
                    return await FirebaseDbService.leads.batchCreate(data)
                }

                return { success: true, importedCount: data.length }
            } catch (error) {
                console.error('Firebase import error:', error)
                return { success: false, error: error.message }
            }
        }
    },

    // CLIENTS COLLECTION
    clients: {
        // Get all clients
        getAll: async () => {
            try {
                const clientsRef = collection(db, 'clients')
                const snapshot = await getDocs(clientsRef)
                const clients = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                return { success: true, data: clients }
            } catch (error) {
                return { success: false, error: error.message }
            }
        },

        // Get single client
        getById: async (id) => {
            try {
                // Ensure ID is a string
                const stringId = String(id)
                const clientRef = doc(db, 'clients', stringId)
                const clientSnap = await getDoc(clientRef)
                if (clientSnap.exists()) {
                    return { success: true, data: { id: clientSnap.id, ...clientSnap.data() } }
                } else {
                    return { success: false, error: 'Client not found' }
                }
            } catch (error) {
                console.error('Firebase getById error:', error)
                return { success: false, error: error.message }
            }
        },

        // Create new client
        create: async (clientData) => {
            try {
                const clientsRef = collection(db, 'clients')
                const docRef = await addDoc(clientsRef, {
                    ...clientData,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                })
                return { success: true, data: { id: docRef.id, ...clientData } }
            } catch (error) {
                return { success: false, error: error.message }
            }
        },

        // Update client
        update: async (id, clientData) => {
            try {
                // Ensure ID is a string
                const stringId = String(id)
                const clientRef = doc(db, 'clients', stringId)
                const updateData = { ...clientData }
                // Remove the id from updateData to avoid conflicts
                delete updateData.id
                await updateDoc(clientRef, {
                    ...updateData,
                    updatedAt: serverTimestamp()
                })
                return { success: true, data: { id: stringId, ...clientData } }
            } catch (error) {
                console.error('Firebase update error:', error)
                return { success: false, error: error.message }
            }
        },

        // Delete client
        delete: async (id) => {
            try {
                // Ensure ID is a string
                const stringId = String(id)
                const clientRef = doc(db, 'clients', stringId)
                await deleteDoc(clientRef)
                return { success: true }
            } catch (error) {
                console.error('Firebase delete error:', error)
                return { success: false, error: error.message }
            }
        },

        // Real-time listener for clients
        subscribe: (callback) => {
            const clientsRef = collection(db, 'clients')
            return onSnapshot(clientsRef, (snapshot) => {
                const clients = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                callback(clients)
            })
        },

        // Advanced querying with filters, pagination, and sorting
        query: async (options = {}) => {
            try {
                const {
                    filters = {},
                    sortBy = 'createdAt',
                    sortOrder = 'desc',
                    pageSize = 10,
                    pageToken = null,
                    searchTerm = '',
                    dateRange = null
                } = options

                let q = query(collection(db, 'clients'))

                // Apply filters - only add filters for defined values
                if (filters.status && filters.status !== '') {
                    q = query(q, where('status', '==', filters.status))
                }
                if (filters.favorite !== null && filters.favorite !== undefined) {
                    q = query(q, where('favorite', '==', filters.favorite))
                }

                // Apply date range filter
                if (dateRange && dateRange.from) {
                    q = query(q, where('createdAt', '>=', dateRange.from))
                }
                if (dateRange && dateRange.to) {
                    q = query(q, where('createdAt', '<=', dateRange.to))
                }

                // Apply sorting
                q = query(q, orderBy(sortBy, sortOrder))

                // Apply pagination
                if (pageToken) {
                    q = query(q, startAfter(pageToken))
                }
                q = query(q, limit(pageSize))

                const snapshot = await getDocs(q)
                const clients = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))

                // Get total count for pagination
                const countQuery = query(collection(db, 'clients'))
                const countSnapshot = await getCountFromServer(countQuery)
                const totalCount = countSnapshot.data().count

                return {
                    success: true,
                    data: clients,
                    pagination: {
                        totalCount,
                        pageSize,
                        hasNextPage: snapshot.docs.length === pageSize,
                        lastDoc: snapshot.docs[snapshot.docs.length - 1],
                        hasPrevPage: pageToken !== null
                    }
                }
            } catch (error) {
                console.error('Firebase query error:', error)
                return { success: false, error: error.message }
            }
        },

        // Search clients with full-text search simulation
        search: async (searchTerm, options = {}) => {
            try {
                const { limit: searchLimit = 20 } = options
                
                // Get all clients and filter client-side
                const allClients = await FirebaseDbService.clients.getAll()
                if (!allClients.success) {
                    return allClients
                }

                const searchLower = searchTerm.toLowerCase()
                const filteredClients = allClients.data.filter(client => {
                    const searchableFields = [
                        client.clientName,
                        client.contactPerson,
                        client.email,
                        client.phone,
                        client.status,
                        client.companyName
                    ].filter(Boolean).join(' ').toLowerCase()

                    return searchableFields.includes(searchLower)
                })

                return {
                    success: true,
                    data: filteredClients.slice(0, searchLimit),
                    totalResults: filteredClients.length
                }
            } catch (error) {
                console.error('Firebase search error:', error)
                return { success: false, error: error.message }
            }
        },

        // Batch operations
        batchCreate: async (clientsData) => {
            try {
                const batch = writeBatch(db)
                const clientsRef = collection(db, 'clients')
                const createdClients = []

                clientsData.forEach(clientData => {
                    const docRef = doc(clientsRef)
                    batch.set(docRef, {
                        ...clientData,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                        version: 1
                    })
                    createdClients.push({ id: docRef.id, ...clientData })
                })

                await batch.commit()
                return { success: true, data: createdClients }
            } catch (error) {
                console.error('Firebase batch create error:', error)
                return { success: false, error: error.message }
            }
        },

        batchUpdate: async (updates) => {
            try {
                const batch = writeBatch(db)
                const validUpdates = []
                
                // Check if documents exist before adding to batch
                for (const { id, data } of updates) {
                    const clientRef = doc(db, 'clients', String(id))
                    const clientSnap = await getDoc(clientRef)
                    
                    if (clientSnap.exists()) {
                        batch.update(clientRef, {
                            ...data,
                            updatedAt: serverTimestamp()
                        })
                        validUpdates.push({ id, data })
                    } else {
                        console.warn(`Client with ID ${id} not found, skipping update`)
                    }
                }

                if (validUpdates.length === 0) {
                    return { success: false, error: 'No valid documents found to update' }
                }

                await batch.commit()
                return { 
                    success: true, 
                    data: validUpdates,
                    skipped: updates.length - validUpdates.length
                }
            } catch (error) {
                console.error('Firebase batch update error:', error)
                return { success: false, error: error.message }
            }
        },

        batchDelete: async (ids) => {
            try {
                const batch = writeBatch(db)
                
                ids.forEach(id => {
                    const clientRef = doc(db, 'clients', String(id))
                    batch.delete(clientRef)
                })

                await batch.commit()
                return { success: true, deletedCount: ids.length }
            } catch (error) {
                console.error('Firebase batch delete error:', error)
                return { success: false, error: error.message }
            }
        },

        // Export data
        exportData: async (format = 'json') => {
            try {
                const result = await FirebaseDbService.clients.getAll()
                if (!result.success) {
                    return result
                }

                if (format === 'json') {
                    return {
                        success: true,
                        data: JSON.stringify(result.data, null, 2),
                        mimeType: 'application/json',
                        filename: `clients_export_${new Date().toISOString().split('T')[0]}.json`
                    }
                } else if (format === 'csv') {
                    const csvData = convertToCSV(result.data)
                    return {
                        success: true,
                        data: csvData,
                        mimeType: 'text/csv',
                        filename: `clients_export_${new Date().toISOString().split('T')[0]}.csv`
                    }
                }

                return { success: false, error: 'Unsupported format' }
            } catch (error) {
                console.error('Firebase export error:', error)
                return { success: false, error: error.message }
            }
        },

        // Import data
        importData: async (data, options = {}) => {
            try {
                const { validate = true, merge = false } = options
                
                if (validate) {
                    const validationResult = validateClientsData(data)
                    if (!validationResult.valid) {
                        return { success: false, error: validationResult.errors }
                    }
                }

                if (merge) {
                    // Update existing clients, create new ones
                    const batch = writeBatch(db)
                    const clientsRef = collection(db, 'clients')
                    
                    for (const clientData of data) {
                        if (clientData.id) {
                            // Update existing
                            const clientRef = doc(db, 'clients', String(clientData.id))
                            batch.update(clientRef, {
                                ...clientData,
                                updatedAt: serverTimestamp()
                            })
                        } else {
                            // Create new
                            const docRef = doc(clientsRef)
                            batch.set(docRef, {
                                ...clientData,
                                createdAt: serverTimestamp(),
                                updatedAt: serverTimestamp(),
                                version: 1
                            })
                        }
                    }
                    
                    await batch.commit()
                } else {
                    // Create new clients only
                    return await FirebaseDbService.clients.batchCreate(data)
                }

                return { success: true, importedCount: data.length }
            } catch (error) {
                console.error('Firebase import error:', error)
                return { success: false, error: error.message }
            }
        }
    }
}

// Utility functions for data processing

// Convert data to CSV format
const convertToCSV = (data) => {
    if (!data || data.length === 0) return ''
    
    const headers = Object.keys(data[0])
    const csvHeaders = headers.join(',')
    
    const csvRows = data.map(row => {
        return headers.map(header => {
            const value = row[header]
            // Escape commas and quotes in CSV
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`
            }
            return value || ''
        }).join(',')
    })
    
    return [csvHeaders, ...csvRows].join('\n')
}

// Validate leads data structure
const validateLeadsData = (data) => {
    const errors = []
    const requiredFields = ['companyName', 'leadContact', 'email']
    
    if (!Array.isArray(data)) {
        return { valid: false, errors: ['Data must be an array'] }
    }
    
    data.forEach((lead, index) => {
        requiredFields.forEach(field => {
            if (!lead[field]) {
                errors.push(`Lead ${index + 1}: Missing required field '${field}'`)
            }
        })
        
        // Validate email format
        if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
            errors.push(`Lead ${index + 1}: Invalid email format`)
        }
        
        // Validate phone format (basic)
        if (lead.phone && !/^[\d\s\-\+\(\)]+$/.test(lead.phone)) {
            errors.push(`Lead ${index + 1}: Invalid phone format`)
        }
        
        // Validate tatcoContact is a string if provided
        if (lead.tatcoContact && typeof lead.tatcoContact !== 'string') {
            errors.push(`Lead ${index + 1}: Tatco Contact must be a string`)
        }
    })
    
    return { valid: errors.length === 0, errors }
}

// Validate clients data structure
const validateClientsData = (data) => {
    const errors = []
    const requiredFields = ['clientName', 'contactPerson', 'email']
    
    if (!Array.isArray(data)) {
        return { valid: false, errors: ['Data must be an array'] }
    }
    
    data.forEach((client, index) => {
        requiredFields.forEach(field => {
            if (!client[field]) {
                errors.push(`Client ${index + 1}: Missing required field '${field}'`)
            }
        })
        
        // Validate email format
        if (client.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email)) {
            errors.push(`Client ${index + 1}: Invalid email format`)
        }
        
        // Validate phone format (basic)
        if (client.phone && !/^[\d\s\-\+\(\)]+$/.test(client.phone)) {
            errors.push(`Client ${index + 1}: Invalid phone format`)
        }
    })
    
    return { valid: errors.length === 0, errors }
}

// Export utility functions
export { convertToCSV, validateLeadsData, validateClientsData }
