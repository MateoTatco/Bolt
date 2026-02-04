import { 
    collection, 
    doc, 
    getDocs, 
    getDoc, 
    addDoc, 
    updateDoc, 
    setDoc,
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
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import logActivity from '@/utils/activityLogger'

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
    },

    // PROJECTS COLLECTION
    projects: {
        // Get all projects
        getAll: async () => {
            try {
                const projectsRef = collection(db, 'projects')
                // Order by createdAt descending (newest first)
                const q = query(projectsRef, orderBy('createdAt', 'desc'))
                const snapshot = await getDocs(q)
                const projects = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                return { success: true, data: projects }
            } catch (error) {
                // If orderBy fails (e.g., no createdAt field), fall back to unsorted
                try {
                    const projectsRef = collection(db, 'projects')
                    const snapshot = await getDocs(projectsRef)
                    const projects = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }))
                    // Sort by createdAt if available, otherwise by id
                    projects.sort((a, b) => {
                        const aTime = a.createdAt?.toMillis?.() || a.createdAt || 0
                        const bTime = b.createdAt?.toMillis?.() || b.createdAt || 0
                        return bTime - aTime // Descending (newest first)
                    })
                    return { success: true, data: projects }
                } catch (fallbackError) {
                    return { success: false, error: error.message }
                }
            }
        },

        // Get single project
        getById: async (id) => {
            try {
                const stringId = String(id)
                const projectRef = doc(db, 'projects', stringId)
                const projectSnap = await getDoc(projectRef)
                if (projectSnap.exists()) {
                    return { success: true, data: { id: projectSnap.id, ...projectSnap.data() } }
                } else {
                    return { success: false, error: 'Project not found' }
                }
            } catch (error) {
                console.error('Firebase getById error:', error)
                return { success: false, error: error.message }
            }
        },

        // Create new project
        create: async (projectData) => {
            try {
                await ensureAuthUser()
                const projectsRef = collection(db, 'projects')
                const docRef = await addDoc(projectsRef, {
                    ...projectData,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                })
                return { success: true, data: { id: docRef.id, ...projectData } }
            } catch (error) {
                return { success: false, error: error.message }
            }
        },

        // Update project
        update: async (id, projectData) => {
            try {
                const stringId = String(id)
                const projectRef = doc(db, 'projects', stringId)
                const updateData = { ...projectData }
                delete updateData.id
                await updateDoc(projectRef, {
                    ...updateData,
                    updatedAt: serverTimestamp()
                })
                return { success: true, data: { id: stringId, ...projectData } }
            } catch (error) {
                console.error('Firebase update error:', error)
                return { success: false, error: error.message }
            }
        },

        // Delete project
        delete: async (id) => {
            try {
                const stringId = String(id)
                const projectRef = doc(db, 'projects', stringId)
                await deleteDoc(projectRef)
                return { success: true }
            } catch (error) {
                console.error('Firebase delete error:', error)
                return { success: false, error: error.message }
            }
        },

        // Real-time listener for projects
        subscribe: (callback) => {
            const projectsRef = collection(db, 'projects')
            return onSnapshot(
                projectsRef, 
                (snapshot) => {
                    const projects = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }))
                    callback(projects)
                },
                (error) => {
                    console.error('Projects listener error:', error)
                    // Return empty array on error instead of crashing
                    callback([])
                }
            )
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

                let q = query(collection(db, 'projects'))

                // Apply filters
                if (filters.market && filters.market !== '') {
                    q = query(q, where('Market', '==', filters.market))
                }
                if (filters.projectStatus && filters.projectStatus !== '') {
                    q = query(q, where('ProjectStatus', '==', filters.projectStatus))
                }
                if (filters.projectProbability && filters.projectProbability !== '') {
                    q = query(q, where('ProjectProbability', '==', filters.projectProbability))
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

                // Apply sorting - use createdAt as safe default to avoid index errors
                // Firestore requires composite indexes for multiple where + orderBy on different fields
                try {
                    q = query(q, orderBy('createdAt', sortOrder || 'desc'))
                } catch (sortError) {
                    console.warn('Sort error, using default:', sortError)
                    q = query(q, orderBy('createdAt', 'desc'))
                }

                // Apply pagination
                if (pageToken) {
                    q = query(q, startAfter(pageToken))
                }
                q = query(q, limit(pageSize))

                const snapshot = await getDocs(q)
                const projects = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))

                // Get total count for pagination
                const countQuery = query(collection(db, 'projects'))
                const countSnapshot = await getCountFromServer(countQuery)
                const totalCount = countSnapshot.data().count

                return {
                    success: true,
                    data: projects,
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

        // Search projects with full-text search simulation
        search: async (searchTerm, options = {}) => {
            try {
                const { limit: searchLimit = 20 } = options
                
                const allProjects = await FirebaseDbService.projects.getAll()
                if (!allProjects.success) {
                    return allProjects
                }

                const searchLower = searchTerm.toLowerCase()
                const filteredProjects = allProjects.data.filter(project => {
                    const searchableFields = [
                        project.ProjectNumber?.toString(),
                        project.ProjectName,
                        project.city,
                        project.State,
                        project.ProjectManager
                    ].filter(Boolean).join(' ').toLowerCase()

                    return searchableFields.includes(searchLower)
                })

                return {
                    success: true,
                    data: filteredProjects.slice(0, searchLimit),
                    totalResults: filteredProjects.length
                }
            } catch (error) {
                console.error('Firebase search error:', error)
                return { success: false, error: error.message }
            }
        },

        // Batch operations
        batchCreate: async (projectsData) => {
            try {
                await ensureAuthUser()
                const batch = writeBatch(db)
                const projectsRef = collection(db, 'projects')
                const createdProjects = []

                projectsData.forEach(projectData => {
                    const docRef = doc(projectsRef)
                    batch.set(docRef, {
                        ...projectData,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                        version: 1
                    })
                    createdProjects.push({ id: docRef.id, ...projectData })
                })

                await batch.commit()
                return { success: true, data: createdProjects }
            } catch (error) {
                console.error('Firebase batch create error:', error)
                return { success: false, error: error.message }
            }
        },

        batchUpdate: async (updates) => {
            try {
                const batch = writeBatch(db)
                const validUpdates = []
                
                for (const { id, data } of updates) {
                    const projectRef = doc(db, 'projects', String(id))
                    const projectSnap = await getDoc(projectRef)
                    
                    if (projectSnap.exists()) {
                        batch.update(projectRef, {
                            ...data,
                            updatedAt: serverTimestamp()
                        })
                        validUpdates.push({ id, data })
                    } else {
                        console.warn(`Project with ID ${id} not found, skipping update`)
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
                    const projectRef = doc(db, 'projects', String(id))
                    batch.delete(projectRef)
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
                const result = await FirebaseDbService.projects.getAll()
                if (!result.success) {
                    return result
                }

                if (format === 'json') {
                    return {
                        success: true,
                        data: JSON.stringify(result.data, null, 2),
                        mimeType: 'application/json',
                        filename: `projects_export_${new Date().toISOString().split('T')[0]}.json`
                    }
                } else if (format === 'csv') {
                    const csvData = convertToCSV(result.data)
                    return {
                        success: true,
                        data: csvData,
                        mimeType: 'text/csv',
                        filename: `projects_export_${new Date().toISOString().split('T')[0]}.csv`
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
                await ensureAuthUser()
                const { validate = true, merge = false } = options
                
                if (validate) {
                    // Basic validation - can be expanded
                    if (!Array.isArray(data)) {
                        return { success: false, error: 'Data must be an array' }
                    }
                }

                if (merge) {
                    const batch = writeBatch(db)
                    const projectsRef = collection(db, 'projects')
                    
                    for (const projectData of data) {
                        if (projectData.id) {
                            const projectRef = doc(db, 'projects', String(projectData.id))
                            batch.update(projectRef, {
                                ...projectData,
                                updatedAt: serverTimestamp()
                            })
                        } else {
                            const docRef = doc(projectsRef)
                            batch.set(docRef, {
                                ...projectData,
                                createdAt: serverTimestamp(),
                                updatedAt: serverTimestamp(),
                                version: 1
                            })
                        }
                    }
                    
                    await batch.commit()
                } else {
                    return await FirebaseDbService.projects.batchCreate(data)
                }

                return { success: true, importedCount: data.length }
            } catch (error) {
                console.error('Firebase import error:', error)
                return { success: false, error: error.message }
            }
        }
    },

    // USERS COLLECTION
    users: {
        // Get all users
        getAll: async () => {
            try {
                const usersRef = collection(db, 'users')
                const q = query(usersRef, orderBy('email'))
                const snapshot = await getDocs(q)
                const users = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                return { success: true, data: users }
            } catch (error) {
                console.error('Firebase get all users error:', error)
                return { success: false, error: error.message }
            }
        },

        // Get user profile by ID
        getById: async (userId) => {
            try {
                const userRef = doc(db, 'users', userId)
                const userSnap = await getDoc(userRef)
                if (userSnap.exists()) {
                    return { success: true, data: { id: userSnap.id, ...userSnap.data() } }
                } else {
                    return { success: false, error: 'User not found' }
                }
            } catch (error) {
                return { success: false, error: error.message }
            }
        },

        // Create or update user profile
        upsert: async (userId, userData) => {
            try {
                await ensureAuthUser()
                
                const userRef = doc(db, 'users', userId)
                const userSnap = await getDoc(userRef)
                
                const dataToSave = {
                    ...userData,
                    updatedAt: serverTimestamp()
                }
                
                if (userSnap.exists()) {
                    // Update existing user
                    await updateDoc(userRef, dataToSave)
                } else {
                    // Create new user profile
                    await setDoc(userRef, {
                        ...dataToSave,
                        createdAt: serverTimestamp()
                    })
                }
                
                return { success: true, data: { id: userId, ...userData } }
            } catch (error) {
                console.error('User upsert error:', error)
                return { success: false, error: error.message, errorCode: error.code }
            }
        },

        // Update user profile
        update: async (userId, userData) => {
            try {
                await ensureAuthUser()
                const userRef = doc(db, 'users', userId)
                await updateDoc(userRef, {
                    ...userData,
                    updatedAt: serverTimestamp()
                })
                return { success: true, data: { id: userId, ...userData } }
            } catch (error) {
                return { success: false, error: error.message }
            }
        },

        // Delete user profile
        delete: async (userId) => {
            try {
                await ensureAuthUser()
                const userRef = doc(db, 'users', userId)
                await deleteDoc(userRef)
                return { success: true }
            } catch (error) {
                console.error('User delete error:', error)
                return { success: false, error: error.message }
            }
        },
    },

    // NOTIFICATIONS COLLECTION
    notifications: {
        // Create a new notification
        create: async (notificationData) => {
            try {
                await ensureAuthUser()
                const notificationsRef = collection(db, 'notifications')
                const docRef = await addDoc(notificationsRef, {
                    ...notificationData,
                    read: false,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                })
                return { success: true, data: { id: docRef.id, ...notificationData } }
            } catch (error) {
                console.error('Notification create error:', error)
                return { success: false, error: error.message }
            }
        },

        // Get notifications for a user
        getUserNotifications: async (userId, options = {}) => {
            try {
                const {
                    limit: notificationLimit = 50,
                    startAfter: startAfterDoc = null,
                    readStatus = null // null = all, true = read only, false = unread only
                } = options

                let q = query(
                    collection(db, 'notifications'),
                    where('userId', '==', userId),
                    orderBy('createdAt', 'desc')
                )

                if (readStatus !== null) {
                    q = query(q, where('read', '==', readStatus))
                }

                if (startAfterDoc) {
                    q = query(q, startAfter(startAfterDoc))
                }

                q = query(q, limit(notificationLimit))

                const snapshot = await getDocs(q)
                const notifications = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))

                return {
                    success: true,
                    data: notifications,
                    hasMore: snapshot.docs.length === notificationLimit,
                    lastDoc: snapshot.docs[snapshot.docs.length - 1] || null
                }
            } catch (error) {
                console.error('Get notifications error:', error)
                return { success: false, error: error.message }
            }
        },

        // Get unread count for a user
        getUnreadCount: async (userId) => {
            try {
                const q = query(
                    collection(db, 'notifications'),
                    where('userId', '==', userId),
                    where('read', '==', false)
                )
                const snapshot = await getCountFromServer(q)
                return { success: true, count: snapshot.data().count }
            } catch (error) {
                console.error('Get unread count error:', error)
                return { success: false, error: error.message, count: 0 }
            }
        },

        // Mark notification as read
        markAsRead: async (notificationId) => {
            try {
                await ensureAuthUser()
                const notificationRef = doc(db, 'notifications', notificationId)
                await updateDoc(notificationRef, {
                    read: true,
                    updatedAt: serverTimestamp()
                })
                return { success: true }
            } catch (error) {
                console.error('Mark as read error:', error)
                return { success: false, error: error.message }
            }
        },

        // Mark all notifications as read for a user
        markAllAsRead: async (userId) => {
            try {
                await ensureAuthUser()
                const q = query(
                    collection(db, 'notifications'),
                    where('userId', '==', userId),
                    where('read', '==', false)
                )
                const snapshot = await getDocs(q)
                const batch = writeBatch(db)
                
                snapshot.docs.forEach((doc) => {
                    batch.update(doc.ref, {
                        read: true,
                        updatedAt: serverTimestamp()
                    })
                })

                await batch.commit()
                return { success: true, updatedCount: snapshot.docs.length }
            } catch (error) {
                console.error('Mark all as read error:', error)
                return { success: false, error: error.message }
            }
        },

        // Delete a notification
        delete: async (notificationId) => {
            try {
                await ensureAuthUser()
                const notificationRef = doc(db, 'notifications', notificationId)
                await deleteDoc(notificationRef)
                return { success: true }
            } catch (error) {
                console.error('Delete notification error:', error)
                return { success: false, error: error.message }
            }
        },

        // Delete all notifications for a user
        deleteAll: async (userId) => {
            try {
                await ensureAuthUser()
                const q = query(
                    collection(db, 'notifications'),
                    where('userId', '==', userId)
                )
                const snapshot = await getDocs(q)
                const batch = writeBatch(db)
                
                snapshot.docs.forEach((doc) => {
                    batch.delete(doc.ref)
                })

                await batch.commit()
                return { success: true, deletedCount: snapshot.docs.length }
            } catch (error) {
                console.error('Delete all notifications error:', error)
                return { success: false, error: error.message }
            }
        },

        // Real-time listener for user notifications
        subscribe: (userId, callback, options = {}) => {
            try {
                const {
                    limit: notificationLimit = 50,
                    readStatus = null
                } = options

                let q = query(
                    collection(db, 'notifications'),
                    where('userId', '==', userId),
                    orderBy('createdAt', 'desc')
                )

                if (readStatus !== null) {
                    q = query(q, where('read', '==', readStatus))
                }

                q = query(q, limit(notificationLimit))

                return onSnapshot(
                    q,
                    (snapshot) => {
                        const notifications = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }))
                        callback(notifications)
                    },
                    (error) => {
                        console.error('Notifications subscription error:', error)
                        callback([])
                    }
                )
            } catch (error) {
                console.error('Subscribe notifications error:', error)
                return () => {} // Return empty unsubscribe function
            }
        },
    },

    // USER INVITATIONS COLLECTION (for admin-created invites from Bolt UI)
    userInvitations: {
        // Create a new invitation
        create: async (invitationData) => {
            try {
                await ensureAuthUser()
                const invitesRef = collection(db, 'userInvitations')
                const docRef = await addDoc(invitesRef, {
                    ...invitationData,
                    status: invitationData.status || 'pending',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                })
                return { success: true, data: { id: docRef.id, ...invitationData } }
            } catch (error) {
                // Silently handle permission errors - invitation record is optional
                if (error.code === 'permission-denied' || error.message?.includes('permission')) {
                    return { success: false, error: error.message, silent: true }
                }
                // Only log non-permission errors
                console.warn('User invitation create error (non-critical):', error.message)
                return { success: false, error: error.message }
            }
        },

        // Get all invitations (optionally filtered by status)
        getAll: async (options = {}) => {
            const { status = null } = options
            try {
                const invitesRef = collection(db, 'userInvitations')
                let q = invitesRef
                if (status) {
                    q = query(invitesRef, where('status', '==', status))
                }
                const snapshot = await getDocs(q)
                const invites = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                }))
                return { success: true, data: invites }
            } catch (error) {
                console.error('User invitations getAll error:', error)
                return { success: false, error: error.message }
            }
        },

        // Update an invitation (e.g., mark as completed/cancelled)
        update: async (id, data) => {
            try {
                await ensureAuthUser()
                const stringId = String(id)
                const inviteRef = doc(db, 'userInvitations', stringId)
                await updateDoc(inviteRef, {
                    ...data,
                    updatedAt: serverTimestamp(),
                })
                return { success: true, data: { id: stringId, ...data } }
            } catch (error) {
                console.error('User invitation update error:', error)
                return { success: false, error: error.message }
            }
        },
    },

    // STAKEHOLDERS COLLECTION
    stakeholders: {
        // Get all stakeholders
        getAll: async () => {
            try {
                const stakeholdersRef = collection(db, 'stakeholders')
                const snapshot = await getDocs(stakeholdersRef)
                const stakeholders = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                return { success: true, data: stakeholders }
            } catch (error) {
                console.error('Firebase get all stakeholders error:', error)
                return { success: false, error: error.message }
            }
        },

        // Get single stakeholder
        getById: async (id) => {
            try {
                const stringId = String(id)
                const stakeholderRef = doc(db, 'stakeholders', stringId)
                const stakeholderSnap = await getDoc(stakeholderRef)
                if (stakeholderSnap.exists()) {
                    return { success: true, data: { id: stakeholderSnap.id, ...stakeholderSnap.data() } }
                } else {
                    return { success: false, error: 'Stakeholder not found' }
                }
            } catch (error) {
                console.error('Firebase get stakeholder by id error:', error)
                return { success: false, error: error.message }
            }
        },

        // Create new stakeholder
        create: async (stakeholderData) => {
            try {
                const stakeholdersRef = collection(db, 'stakeholders')
                const docRef = await addDoc(stakeholdersRef, {
                    ...stakeholderData,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                })
                return { success: true, data: { id: docRef.id, ...stakeholderData } }
            } catch (error) {
                console.error('Firebase create stakeholder error:', error)
                return { success: false, error: error.message }
            }
        },

        // Update stakeholder
        update: async (id, stakeholderData) => {
            try {
                const stringId = String(id)
                const stakeholderRef = doc(db, 'stakeholders', stringId)
                await updateDoc(stakeholderRef, {
                    ...stakeholderData,
                    updatedAt: serverTimestamp()
                })
                return { success: true, data: { id: stringId, ...stakeholderData } }
            } catch (error) {
                console.error('Firebase update stakeholder error:', error)
                return { success: false, error: error.message }
            }
        },

        // Delete stakeholder
        delete: async (id) => {
            try {
                const stringId = String(id)
                const stakeholderRef = doc(db, 'stakeholders', stringId)
                await deleteDoc(stakeholderRef)
                return { success: true }
            } catch (error) {
                console.error('Firebase delete stakeholder error:', error)
                return { success: false, error: error.message }
            }
        },
    },

    // COMPANIES COLLECTION
    companies: {
        // Get all companies
        getAll: async () => {
            try {
                const companiesRef = collection(db, 'companies')
                const q = query(companiesRef, orderBy('name'))
                const snapshot = await getDocs(q)
                const companies = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                return { success: true, data: companies }
            } catch (error) {
                console.error('Firebase get all companies error:', error)
                return { success: false, error: error.message }
            }
        },

        // Get single company
        getById: async (id) => {
            try {
                const stringId = String(id)
                const companyRef = doc(db, 'companies', stringId)
                const companySnap = await getDoc(companyRef)
                if (companySnap.exists()) {
                    return { success: true, data: { id: companySnap.id, ...companySnap.data() } }
                } else {
                    return { success: false, error: 'Company not found' }
                }
            } catch (error) {
                console.error('Firebase get company by id error:', error)
                return { success: false, error: error.message }
            }
        },

        // Create new company
        create: async (companyData) => {
            try {
                await ensureAuthUser()
                const companiesRef = collection(db, 'companies')
                const docRef = await addDoc(companiesRef, {
                    ...companyData,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                })
                return { success: true, data: { id: docRef.id, ...companyData } }
            } catch (error) {
                console.error('Firebase create company error:', error)
                return { success: false, error: error.message }
            }
        },

        // Update company
        update: async (id, companyData) => {
            try {
                await ensureAuthUser()
                const stringId = String(id)
                const companyRef = doc(db, 'companies', stringId)
                await updateDoc(companyRef, {
                    ...companyData,
                    updatedAt: serverTimestamp()
                })
                return { success: true, data: { id: stringId, ...companyData } }
            } catch (error) {
                console.error('Firebase update company error:', error)
                return { success: false, error: error.message }
            }
        },

        // Delete company
        delete: async (id) => {
            try {
                await ensureAuthUser()
                const stringId = String(id)
                const companyRef = doc(db, 'companies', stringId)
                await deleteDoc(companyRef)
                return { success: true }
            } catch (error) {
                console.error('Firebase delete company error:', error)
                return { success: false, error: error.message }
            }
        },
    },

    // PROFIT SHARING ACCESS COLLECTION
    profitSharingAccess: {
        // Get all access records
        getAll: async () => {
            try {
                const accessRef = collection(db, 'profitSharingAccess')
                const q = query(accessRef, orderBy('userName'))
                const snapshot = await getDocs(q)
                const records = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                return { success: true, data: records }
            } catch (error) {
                console.error('Firebase get all profit sharing access error:', error)
                return { success: false, error: error.message }
            }
        },

        // Get access by company
        getByCompany: async (companyId) => {
            try {
                const accessRef = collection(db, 'profitSharingAccess')
                const q = query(accessRef, where('companyId', '==', companyId))
                const snapshot = await getDocs(q)
                const records = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                // Sort client-side to avoid composite index
                records.sort((a, b) => (a.userName || '').localeCompare(b.userName || ''))
                return { success: true, data: records }
            } catch (error) {
                console.error('Firebase get profit sharing access by company error:', error)
                return { success: false, error: error.message }
            }
        },

        // Get access by user ID
        getByUserId: async (userId) => {
            try {
                const accessRef = collection(db, 'profitSharingAccess')
                const q = query(accessRef, where('userId', '==', userId))
                const snapshot = await getDocs(q)
                const records = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                return { success: true, data: records }
            } catch (error) {
                console.error('Firebase get profit sharing access by user error:', error)
                return { success: false, error: error.message }
            }
        },

        // Create access record
        create: async (accessData) => {
            try {
                await ensureAuthUser()
                const accessRef = collection(db, 'profitSharingAccess')
                const docRef = await addDoc(accessRef, {
                    ...accessData,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                })
                return { success: true, data: { id: docRef.id, ...accessData } }
            } catch (error) {
                console.error('Firebase create profit sharing access error:', error)
                return { success: false, error: error.message }
            }
        },

        // Update access record
        update: async (id, accessData) => {
            try {
                await ensureAuthUser()
                const stringId = String(id)
                const accessRef = doc(db, 'profitSharingAccess', stringId)
                await updateDoc(accessRef, {
                    ...accessData,
                    updatedAt: serverTimestamp()
                })
                return { success: true, data: { id: stringId, ...accessData } }
            } catch (error) {
                console.error('Firebase update profit sharing access error:', error)
                return { success: false, error: error.message }
            }
        },

        // Delete access record
        delete: async (id) => {
            try {
                await ensureAuthUser()
                const stringId = String(id)
                const accessRef = doc(db, 'profitSharingAccess', stringId)
                await deleteDoc(accessRef)
                return { success: true }
            } catch (error) {
                console.error('Firebase delete profit sharing access error:', error)
                return { success: false, error: error.message }
            }
        },
    },

    // WARRANTIES COLLECTION
    warranties: {
        // Get all warranties
        getAll: async (filters = {}) => {
            try {
                await ensureAuthUser()
                let q = query(collection(db, 'warranties'))
                
                // Filter by companyId (for multi-company support) - always apply this first
                if (filters.companyId) {
                    q = query(q, where('companyId', '==', filters.companyId))
                }
                
                // Filter by status if provided
                if (filters.status) {
                    q = query(q, where('status', '==', filters.status))
                }
                
                // Filter by assignedTo if provided (note: can't combine with status filter without index)
                if (filters.assignedTo && !filters.status) {
                    q = query(q, where('assignedTo', 'array-contains', filters.assignedTo))
                }
                
                // Order by createdAt descending (newest first)
                // This requires a composite index if both companyId and status filters are used
                try {
                    q = query(q, orderBy('createdAt', 'desc'))
                } catch (error) {
                    // If orderBy fails (index not ready), fall back to unsorted
                    console.warn('Warranty orderBy error, using unsorted:', error)
                }
                
                const snapshot = await getDocs(q)
                let warranties = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                
                // Client-side filtering for assignedTo if status filter is also used
                if (filters.assignedTo && filters.status) {
                    warranties = warranties.filter(w => 
                        w.assignedTo && w.assignedTo.includes(filters.assignedTo)
                    )
                }
                
                // Client-side sorting if orderBy failed
                if (!filters.status || !filters.companyId) {
                    warranties.sort((a, b) => {
                        const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || a.createdAt || 0
                        const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || b.createdAt || 0
                        return bTime - aTime // Descending (newest first)
                    })
                }
                
                return { success: true, data: warranties }
            } catch (error) {
                console.error('Firebase get all warranties error:', error)
                // If index error, try without orderBy and sort client-side
                if (error.message && error.message.includes('index')) {
                    try {
                        let q = query(collection(db, 'warranties'))
                        if (filters.companyId) {
                            q = query(q, where('companyId', '==', filters.companyId))
                        }
                        if (filters.status) {
                            q = query(q, where('status', '==', filters.status))
                        }
                        const snapshot = await getDocs(q)
                        let warranties = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }))
                        
                        // Client-side filtering for assignedTo
                        if (filters.assignedTo) {
                            warranties = warranties.filter(w => 
                                w.assignedTo && w.assignedTo.includes(filters.assignedTo)
                            )
                        }
                        
                        // Client-side sorting
                        warranties.sort((a, b) => {
                            const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || a.createdAt || 0
                            const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || b.createdAt || 0
                            return bTime - aTime
                        })
                        
                        return { success: true, data: warranties }
                    } catch (fallbackError) {
                        return { success: false, error: error.message }
                    }
                }
                return { success: false, error: error.message }
            }
        },

        // Get single warranty
        getById: async (id) => {
            try {
                await ensureAuthUser()
                const stringId = String(id)
                const warrantyRef = doc(db, 'warranties', stringId)
                const warrantySnap = await getDoc(warrantyRef)
                if (warrantySnap.exists()) {
                    return { success: true, data: { id: warrantySnap.id, ...warrantySnap.data() } }
                } else {
                    return { success: false, error: 'Warranty not found' }
                }
            } catch (error) {
                console.error('Firebase get warranty by id error:', error)
                return { success: false, error: error.message }
            }
        },

        // Create new warranty
        create: async (warrantyData) => {
            try {
                await ensureAuthUser()
                const warrantiesRef = collection(db, 'warranties')
                const docRef = await addDoc(warrantiesRef, {
                    ...warrantyData,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                })
                return { success: true, data: { id: docRef.id, ...warrantyData } }
            } catch (error) {
                console.error('Firebase create warranty error:', error)
                return { success: false, error: error.message }
            }
        },

        // Update warranty
        update: async (id, warrantyData) => {
            try {
                await ensureAuthUser()
                const stringId = String(id)
                const warrantyRef = doc(db, 'warranties', stringId)
                const updateData = { ...warrantyData }
                delete updateData.id
                await updateDoc(warrantyRef, {
                    ...updateData,
                    updatedAt: serverTimestamp()
                })
                return { success: true, data: { id: stringId, ...warrantyData } }
            } catch (error) {
                console.error('Firebase update warranty error:', error)
                return { success: false, error: error.message }
            }
        },

        // Delete warranty
        delete: async (id) => {
            try {
                await ensureAuthUser()
                const stringId = String(id)
                const warrantyRef = doc(db, 'warranties', stringId)
                await deleteDoc(warrantyRef)
                return { success: true }
            } catch (error) {
                console.error('Firebase delete warranty error:', error)
                return { success: false, error: error.message }
            }
        },

        // Real-time listener for warranties
        subscribe: (callback, filters = {}) => {
            try {
                let q = query(collection(db, 'warranties'))
                
                // Filter by companyId first (required for index)
                if (filters.companyId) {
                    q = query(q, where('companyId', '==', filters.companyId))
                }
                
                // Filter by status if provided
                if (filters.status) {
                    q = query(q, where('status', '==', filters.status))
                }
                
                // Order by createdAt (requires composite index)
                try {
                    q = query(q, orderBy('createdAt', 'desc'))
                } catch (error) {
                    console.warn('Warranty subscribe orderBy error (index may not be ready):', error)
                    // Continue without orderBy - will sort client-side
                }
                
                return onSnapshot(
                    q,
                    (snapshot) => {
                        let warranties = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }))
                        
                        // Client-side filtering for assignedTo if needed
                        if (filters.assignedTo) {
                            warranties = warranties.filter(w => 
                                w.assignedTo && w.assignedTo.includes(filters.assignedTo)
                            )
                        }
                        
                        // Client-side sorting if orderBy wasn't applied
                        warranties.sort((a, b) => {
                            const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || a.createdAt || 0
                            const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || b.createdAt || 0
                            return bTime - aTime
                        })
                        
                        callback(warranties)
                    },
                    (error) => {
                        console.error('Warranties listener error:', error)
                        // Return empty array on error instead of crashing
                        callback([])
                    }
                )
            } catch (error) {
                console.error('Warranty subscribe setup error:', error)
                // Return a no-op unsubscribe function
                return () => {}
            }
        },

        // Get warranty updates (subcollection)
        getUpdates: async (warrantyId) => {
            try {
                await ensureAuthUser()
                const updatesRef = collection(db, 'warranties', warrantyId, 'updates')
                const q = query(updatesRef, orderBy('createdAt', 'desc'))
                const snapshot = await getDocs(q)
                const updates = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                return { success: true, data: updates }
            } catch (error) {
                console.error('Firebase get warranty updates error:', error)
                return { success: false, error: error.message }
            }
        },

        // Add update to warranty (subcollection)
        addUpdate: async (warrantyId, updateData) => {
            try {
                await ensureAuthUser()
                const updatesRef = collection(db, 'warranties', warrantyId, 'updates')
                const now = serverTimestamp()
                const docRef = await addDoc(updatesRef, {
                    ...updateData,
                    createdAt: now
                })
                
                // Update warranty's lastUpdateDate and lastUpdateText
                const warrantyRef = doc(db, 'warranties', warrantyId)
                await updateDoc(warrantyRef, {
                    lastUpdateDate: now,
                    lastUpdateText: updateData.note || '',
                    updatedAt: now
                })

                // Log activity entry for this update so it appears in the unified activity timeline
                try {
                    await logActivity('warranty', warrantyId, {
                        type: 'update',
                        message: 'added an update',
                        metadata: {
                            note: updateData.note || '',
                        },
                    })
                } catch (activityError) {
                    // Don't fail the update flow if activity logging fails
                    console.error('Failed to log warranty update activity', activityError)
                }

                // Notify users about warranty update (in-app notifications)
                try {
                    const { notifyWarrantyUpdated } = await import('@/utils/notificationHelper')
                    const warrantyDoc = await getDoc(doc(db, 'warranties', warrantyId))
                    if (warrantyDoc.exists()) {
                        const warrantyData = warrantyDoc.data()
                        const warrantyName = warrantyData?.projectName || warrantyData?.description || 'Warranty'
                        await notifyWarrantyUpdated({
                            warrantyId,
                            warrantyName,
                            updatedBy: updateData.createdBy || null
                        })
                    }
                } catch (notifyError) {
                    console.error('Failed to notify warranty update', notifyError)
                    // Don't fail the update if notification fails
                }

                // Send email notifications for warranty update
                try {
                    const warrantyDoc = await getDoc(doc(db, 'warranties', warrantyId))
                    if (warrantyDoc.exists()) {
                        const warrantyData = warrantyDoc.data()
                        const warrantyName = warrantyData?.projectName || warrantyData?.description || 'Warranty'
                        
                        // Get user IDs for email recipients
                        const emailUserIds = new Set()
                        if (Array.isArray(warrantyData?.assignedTo)) {
                            warrantyData.assignedTo.forEach(id => emailUserIds.add(id))
                        }
                        if (Array.isArray(warrantyData?.cc)) {
                            warrantyData.cc.forEach(id => emailUserIds.add(id))
                        }
                        // Add CC recipients from the update if provided
                        if (Array.isArray(updateData?.cc)) {
                            updateData.cc.forEach(id => emailUserIds.add(id))
                        }
                        
                        // Get emails from user IDs
                        const { getUserEmailsByUserIds } = await import('@/utils/userHelper')
                        const recipientEmails = await getUserEmailsByUserIds(Array.from(emailUserIds))
                        
                        // Add requestedByEmail if provided
                        // DISABLED: Requesters no longer receive email notifications (internal tool only)
                        // if (warrantyData?.requestedByEmail && warrantyData.requestedByEmail.includes('@')) {
                        //     recipientEmails.push(warrantyData.requestedByEmail)
                        // }
                        
                        // Remove duplicates
                        const uniqueEmails = [...new Set(recipientEmails)]
                        
                        if (uniqueEmails.length > 0) {
                            // Call Cloud Function to send emails
                            const { getFunctions, httpsCallable } = await import('firebase/functions')
                            const functions = getFunctions()
                            const sendEmailFunction = httpsCallable(functions, 'sendWarrantyNotificationEmail')
                            
                            await sendEmailFunction({
                                warrantyId,
                                warrantyName,
                                projectName: warrantyData?.projectName || '',
                                description: warrantyData?.description || '',
                                requestedBy: warrantyData?.requestedBy || '',
                                requestedByEmail: warrantyData?.requestedByEmail || null,
                                recipientEmails: uniqueEmails,
                                notificationType: 'updated',
                                updateNote: updateData.note || '', // Include update note in email
                                warrantyUrl: `https://www.mybolt.pro/warranty-tracker/${warrantyId}`
                            })
                        }
                    }
                } catch (emailError) {
                    console.error('Failed to send warranty update emails', emailError)
                    // Don't fail the update if email fails
                }
                
                return { success: true, data: { id: docRef.id, ...updateData } }
            } catch (error) {
                console.error('Firebase add warranty update error:', error)
                return { success: false, error: error.message }
            }
        },
    },

    // CREW EMPLOYEES COLLECTION
    crewEmployees: {
        // Get all employees
        getAll: async (filters = {}) => {
            try {
                let q = query(collection(db, 'crewEmployees'))
                
                // Filter by active status if provided
                if (filters.active !== undefined && filters.active !== null) {
                    q = query(q, where('active', '==', filters.active))
                }
                
                // Try to order by name, but handle index errors gracefully
                let snapshot
                try {
                    q = query(q, orderBy('name', 'asc'))
                    snapshot = await getDocs(q)
                } catch (orderError) {
                    // If orderBy fails (likely due to missing index), fetch without orderBy
                    // and sort client-side
                    console.warn('OrderBy failed, fetching without order and sorting client-side:', orderError)
                    snapshot = await getDocs(q)
                }
                
                let employees = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                
                // Client-side sort if orderBy wasn't applied
                employees.sort((a, b) => {
                    const nameA = (a.name || '').toLowerCase()
                    const nameB = (b.name || '').toLowerCase()
                    return nameA.localeCompare(nameB)
                })
                
                return { success: true, data: employees }
            } catch (error) {
                console.error('Firebase get all crew employees error:', error)
                return { success: false, error: error.message }
            }
        },

        // Get single employee
        getById: async (id) => {
            try {
                const employeeRef = doc(db, 'crewEmployees', id)
                const employeeSnap = await getDoc(employeeRef)
                if (employeeSnap.exists()) {
                    return { success: true, data: { id: employeeSnap.id, ...employeeSnap.data() } }
                } else {
                    return { success: false, error: 'Employee not found' }
                }
            } catch (error) {
                console.error('Firebase get crew employee by id error:', error)
                return { success: false, error: error.message }
            }
        },

        // Create new employee
        create: async (employeeData) => {
            try {
                const employeesRef = collection(db, 'crewEmployees')
                const docRef = await addDoc(employeesRef, {
                    ...employeeData,
                    active: employeeData.active !== undefined ? employeeData.active : true,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                })
                return { success: true, data: { id: docRef.id, ...employeeData } }
            } catch (error) {
                console.error('Firebase create crew employee error:', error)
                return { success: false, error: error.message }
            }
        },

        // Update employee
        update: async (id, employeeData) => {
            try {
                const employeeRef = doc(db, 'crewEmployees', id)
                await updateDoc(employeeRef, {
                    ...employeeData,
                    updatedAt: serverTimestamp()
                })
                return { success: true, data: { id, ...employeeData } }
            } catch (error) {
                console.error('Firebase update crew employee error:', error)
                return { success: false, error: error.message }
            }
        },

        // Delete employee
        delete: async (id) => {
            try {
                const employeeRef = doc(db, 'crewEmployees', id)
                await deleteDoc(employeeRef)
                return { success: true }
            } catch (error) {
                console.error('Firebase delete crew employee error:', error)
                return { success: false, error: error.message }
            }
        },

        // Subscribe to real-time updates
        subscribe: (callback, filters = {}) => {
            try {
                let q = query(collection(db, 'crewEmployees'))
                
                if (filters.active !== undefined && filters.active !== null) {
                    q = query(q, where('active', '==', filters.active))
                }
                
                // Try to add orderBy, but handle gracefully if it fails
                let finalQuery = q
                try {
                    finalQuery = query(q, orderBy('name', 'asc'))
                } catch (orderError) {
                    // If orderBy fails, use query without orderBy
                    console.warn('OrderBy failed in subscription, will sort client-side:', orderError)
                    finalQuery = q
                }
                
                return onSnapshot(finalQuery, (snapshot) => {
                    let employees = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }))
                    
                    // Client-side sort if orderBy wasn't applied
                    employees.sort((a, b) => {
                        const nameA = (a.name || '').toLowerCase()
                        const nameB = (b.name || '').toLowerCase()
                        return nameA.localeCompare(nameB)
                    })
                    
                    callback(employees)
                }, (error) => {
                    console.error('Firebase crew employees subscription error:', error)
                    callback([])
                })
            } catch (error) {
                console.error('Firebase crew employees subscribe error:', error)
                return () => {} // Return empty unsubscribe function
            }
        },
    },

    // Crew Jobs collection
    crewJobs: {
        // Get all jobs
        getAll: async (filters = {}) => {
            try {
                let q = query(collection(db, 'crewJobs'))
                
                // Apply filters if provided
                if (filters.active !== undefined && filters.active !== null) {
                    q = query(q, where('active', '==', filters.active))
                }
                
                // Try to add orderBy, but handle gracefully if it fails
                let snapshot
                try {
                    q = query(q, orderBy('name', 'asc'))
                    snapshot = await getDocs(q)
                } catch (orderError) {
                    console.warn('OrderBy failed, fetching without order and sorting client-side:', orderError)
                    snapshot = await getDocs(q)
                }
                
                let jobs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                
                // Client-side sort if orderBy wasn't applied
                jobs.sort((a, b) => {
                    const nameA = (a.name || '').toLowerCase()
                    const nameB = (b.name || '').toLowerCase()
                    return nameA.localeCompare(nameB)
                })
                
                return { success: true, data: jobs }
            } catch (error) {
                console.error('Firebase get all crew jobs error:', error)
                return { success: false, error: error.message }
            }
        },

        // Get single job
        getById: async (id) => {
            try {
                const jobRef = doc(db, 'crewJobs', id)
                const jobSnap = await getDoc(jobRef)
                if (jobSnap.exists()) {
                    return { success: true, data: { id: jobSnap.id, ...jobSnap.data() } }
                } else {
                    return { success: false, error: 'Job not found' }
                }
            } catch (error) {
                console.error('Firebase get crew job by id error:', error)
                return { success: false, error: error.message }
            }
        },

        // Create new job
        create: async (jobData) => {
            try {
                const jobsRef = collection(db, 'crewJobs')
                const docRef = await addDoc(jobsRef, {
                    ...jobData,
                    active: jobData.active !== undefined ? jobData.active : true,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                })
                return { success: true, data: { id: docRef.id, ...jobData } }
            } catch (error) {
                console.error('Firebase create crew job error:', error)
                return { success: false, error: error.message }
            }
        },

        // Update job
        update: async (id, jobData) => {
            try {
                const jobRef = doc(db, 'crewJobs', id)
                await updateDoc(jobRef, {
                    ...jobData,
                    updatedAt: serverTimestamp()
                })
                return { success: true, data: { id, ...jobData } }
            } catch (error) {
                console.error('Firebase update crew job error:', error)
                return { success: false, error: error.message }
            }
        },

        // Delete job
        delete: async (id) => {
            try {
                const jobRef = doc(db, 'crewJobs', id)
                await deleteDoc(jobRef)
                return { success: true }
            } catch (error) {
                console.error('Firebase delete crew job error:', error)
                return { success: false, error: error.message }
            }
        },

        // Subscribe to real-time updates
        subscribe: (callback, filters = {}) => {
            try {
                let q = query(collection(db, 'crewJobs'))
                
                if (filters.active !== undefined && filters.active !== null) {
                    q = query(q, where('active', '==', filters.active))
                }
                
                // Try to add orderBy, but handle gracefully if it fails
                let finalQuery = q
                try {
                    finalQuery = query(q, orderBy('name', 'asc'))
                } catch (orderError) {
                    // If orderBy fails, use query without orderBy
                    console.warn('OrderBy failed in subscription, will sort client-side:', orderError)
                    finalQuery = q
                }
                
                return onSnapshot(finalQuery, (snapshot) => {
                    let jobs = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }))
                    
                    // Client-side sort if orderBy wasn't applied
                    jobs.sort((a, b) => {
                        const nameA = (a.name || '').toLowerCase()
                        const nameB = (b.name || '').toLowerCase()
                        return nameA.localeCompare(nameB)
                    })
                    
                    callback(jobs)
                }, (error) => {
                    console.error('Firebase crew jobs subscription error:', error)
                    callback([])
                })
            } catch (error) {
                console.error('Firebase crew jobs subscribe error:', error)
                return () => {} // Return empty unsubscribe function
            }
        },

        // Add update to job (subcollection)
        addUpdate: async (jobId, updateData) => {
            try {
                await ensureAuthUser()
                const updatesRef = collection(db, 'crewJobs', jobId, 'updates')
                const now = serverTimestamp()
                const docRef = await addDoc(updatesRef, {
                    ...updateData,
                    createdAt: now
                })
                
                // Update job's lastUpdateDate and lastUpdateText
                const jobRef = doc(db, 'crewJobs', jobId)
                await updateDoc(jobRef, {
                    lastUpdateDate: now,
                    lastUpdateText: updateData.note || '',
                    updatedAt: now
                })

                // Log activity entry for this update
                try {
                    await logActivity('crewJob', jobId, {
                        type: 'update',
                        message: 'added an update',
                        metadata: {
                            note: updateData.note || '',
                        },
                    })
                } catch (activityError) {
                    console.error('Failed to log job update activity', activityError)
                }

                return { success: true, data: { id: docRef.id, ...updateData } }
            } catch (error) {
                console.error('Firebase add job update error:', error)
                return { success: false, error: error.message }
            }
        },
    },
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

// Ensure we have an authenticated user before performing writes
const ensureAuthUser = async () => {
    try {
        const auth = getAuth()
        if (auth.currentUser) return auth.currentUser
        const enableAnon = import.meta.env.VITE_ENABLE_ANON_SIGNIN === 'true' || import.meta.env.DEV
        if (!enableAnon) {
            // Wait briefly for any in-flight sign-in
            await new Promise((resolve) => {
                const unsub = onAuthStateChanged(auth, () => { unsub(); resolve() })
            })
            return auth.currentUser
        }
        await signInAnonymously(auth)
        return auth.currentUser
    } catch {
        // Swallow to avoid breaking flows; Firestore will still enforce rules
        return null
    }
}

// Export utility functions
export { convertToCSV, validateLeadsData, validateClientsData }
