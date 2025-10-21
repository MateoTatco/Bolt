import { create } from 'zustand'
import React from 'react'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { toast } from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { db } from '@/configs/firebase.config'
import { collection, onSnapshot, doc, query, orderBy, where } from 'firebase/firestore'

export const useCrmStore = create((set, get) => ({
    leads: [],
    clients: [],
    filters: {
        search: '',
        status: null,
        methodOfContact: null,
        responded: null,
        dateFrom: null,
        dateTo: null,
        type: null, // 'lead' | 'client'
    },
    view: 'list', // 'list' | 'board'
    selectedLeadId: null,
    loading: false,
    error: null,
    
    // Advanced Features State
    isOnline: navigator.onLine,
    lastSyncTime: null,
    pendingChanges: [], // For optimistic updates
    changeHistory: [], // For rollback functionality
    realtimeListeners: {
        leads: null,
        clients: null
    },
    conflictResolution: {
        strategy: 'last-write-wins', // 'last-write-wins' | 'merge' | 'manual'
        conflicts: []
    },

    setView: (view) => set({ view }),
    setSelectedLeadId: (id) => set({ selectedLeadId: id }),

    setFilters: (partial) => set((state) => ({
        filters: { ...state.filters, ...partial },
    })),

    // Load leads from Firebase
    loadLeads: async () => {
        set({ loading: true, error: null })
        try {
            const response = await FirebaseDbService.leads.getAll()
            if (response.success) {
                const normalized = response.data.map((l) => ({
                    ...l,
                    favorite: l.favorite || false,
                }))
                set({ leads: normalized, loading: false })
            } else {
                throw new Error(response.error)
            }
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    'Failed to load leads',
                ),
            )
        }
    },

    // Load clients from Firebase
    loadClients: async () => {
        set({ loading: true, error: null })
        try {
            const response = await FirebaseDbService.clients.getAll()
            if (response.success) {
                const normalized = response.data.map((c) => ({
                    ...c,
                    favorite: c.favorite || false,
                }))
                set({ clients: normalized, loading: false })
            } else {
                throw new Error(response.error)
            }
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    'Failed to load clients',
                ),
            )
        }
    },

    // Create new lead
    addLead: async (leadData) => {
        set({ loading: true, error: null })
        try {
            // Add to history for rollback
            get().addToHistory('create_lead', { id: 'temp', data: leadData })
            
            const response = await FirebaseDbService.leads.create(leadData)
            if (response.success) {
                const newLead = response.data
                
                set((state) => ({
                    leads: [...state.leads, newLead],
                    loading: false
                }))
                
                // Cache data for offline use
                get().cacheData()
                
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'success', duration: 2000, title: 'Success' },
                        'Lead created successfully!',
                    ),
                )
                return newLead
            } else {
                throw new Error(response.error)
            }
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    'Failed to create lead',
                ),
            )
            throw error
        }
    },

    // Update lead with optimistic updates
    updateLead: async (id, leadData, useOptimistic = true) => {
        set({ loading: true, error: null })
        
        // Store original data for rollback
        const originalLead = get().leads.find(l => l.id === id)
        if (originalLead) {
            get().addToHistory('update_lead', { 
                id, 
                originalData: originalLead,
                newData: leadData 
            })
        }
        
        let tempId = null
        
        try {
            // Optimistic update - update UI immediately
            if (useOptimistic) {
                tempId = `temp_${Date.now()}`
                get().optimisticUpdate('lead', id, leadData)
            }
            
            console.log('Updating lead:', id, leadData)
            const currentLead = get().leads.find(l => l.id === id)
            const expectedVersion = currentLead?.version || null
            const response = await FirebaseDbService.leads.update(id, leadData, expectedVersion)
            console.log('Update response:', response)
            
            if (response.success) {
                const updatedLead = response.data
                
                // Confirm optimistic update
                if (useOptimistic && tempId) {
                    get().confirmOptimisticUpdate(tempId)
                }
                
                set((state) => ({
                    leads: state.leads.map((l) => (l.id === id ? updatedLead : l)),
                    loading: false
                }))
                
                // Cache data for offline use
                get().cacheData()
                
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'success', duration: 2000, title: 'Success' },
                        'Lead updated successfully!',
                    ),
                )
                return updatedLead
            } else if (response.conflict) {
                // Revert optimistic update on conflict
                if (useOptimistic && tempId) {
                    get().revertOptimisticUpdate(tempId)
                }
                
                // Handle conflict
                const conflict = {
                    id: Math.random().toString(36),
                    entityType: 'lead',
                    entityId: id,
                    localData: leadData,
                    serverData: response.conflict.serverData,
                    timestamp: Date.now()
                }
                
                set((state) => ({
                    conflictResolution: {
                        ...state.conflictResolution,
                        conflicts: [...state.conflictResolution.conflicts, conflict]
                    },
                    loading: false
                }))
                
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'warning', duration: 5000, title: 'Conflict Detected' },
                        'Another user modified this lead. Please resolve the conflict.',
                    ),
                )
                
                return null
            } else {
                // Revert optimistic update on error
                if (useOptimistic && tempId) {
                    get().revertOptimisticUpdate(tempId)
                }
                
                console.error('Update failed:', response.error)
                throw new Error(response.error)
            }
        } catch (error) {
            // Revert optimistic update on error
            if (useOptimistic && tempId) {
                get().revertOptimisticUpdate(tempId)
            }
            
            console.error('Update error:', error)
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    `Failed to update lead: ${error.message}`,
                ),
            )
            throw error
        }
    },

    // Link lead to clients (replace full set)
    linkLeadToClients: async (leadId, clientIds) => {
        set({ loading: true, error: null })
        try {
            const prevClientIds = (get().leads.find((l) => l.id === leadId)?.clientIds) || []
            
            // Update lead clientIds and sync client leadIds locally
            set((state) => {
                const leads = state.leads.map((l) => (l.id === leadId ? { ...l, clientIds: [...clientIds] } : l))
                const clients = state.clients.map((c) => {
                    const hasLink = (clientIds || []).includes(c.id)
                    const nextLeadIds = new Set(c.leadIds || [])
                    if (hasLink) nextLeadIds.add(leadId)
                    else nextLeadIds.delete(leadId)
                    return { ...c, leadIds: Array.from(nextLeadIds) }
                })
                return { leads, clients }
            })
            
            // Persist lead and affected clients to Firebase
            const targetLead = get().leads.find((l) => l.id === leadId)
            if (targetLead) {
                await FirebaseDbService.leads.update(leadId, targetLead)
            }
            
            const affectedIds = Array.from(new Set([...(prevClientIds || []), ...(clientIds || [])]))
            for (const cid of affectedIds) {
                const client = get().clients.find((c) => c.id === cid)
                if (client) {
                    await FirebaseDbService.clients.update(cid, client)
                }
            }
            
            set({ loading: false })
            
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'success', duration: 2000, title: 'Success' },
                    'Client links updated successfully!',
                ),
            )
        } catch (error) {
            console.error('Link error:', error)
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    `Failed to update client links: ${error.message}`,
                ),
            )
            throw error
        }
    },

    // Delete lead
    deleteLead: async (id) => {
        set({ loading: true, error: null })
        try {
            // Store original data for rollback
            const originalLead = get().leads.find(l => l.id === id)
            if (originalLead) {
                get().addToHistory('delete_lead', { 
                    id, 
                    originalData: originalLead 
                })
            }
            
            console.log('Deleting lead:', id)
            const response = await FirebaseDbService.leads.delete(id)
            console.log('Delete response:', response)
            
            if (response.success) {
                set((state) => ({
                    leads: state.leads.filter((l) => l.id !== id),
                    loading: false
                }))
                
                // Cache data for offline use
                get().cacheData()
                
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'success', duration: 2000, title: 'Success' },
                        'Lead deleted successfully!',
                    ),
                )
            } else {
                console.error('Delete failed:', response.error)
                throw new Error(response.error)
            }
        } catch (error) {
            console.error('Delete error:', error)
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    `Failed to delete lead: ${error.message}`,
                ),
            )
            throw error
        }
    },

    // Toggle favorite (entity-aware: avoids ID collision between leads and clients)
    toggleFavorite: (id, entityType) => set((state) => {
        if (entityType === 'lead') {
            return {
                leads: state.leads.map((l) => (l.id === id ? { ...l, favorite: !l.favorite } : l)),
            }
        }
        if (entityType === 'client') {
            return {
                clients: state.clients.map((c) => (c.id === id ? { ...c, favorite: !c.favorite } : c)),
            }
        }
        return state
    }),

    // Create new client
    addClient: async (clientData) => {
        set({ loading: true, error: null })
        try {
            const response = await FirebaseDbService.clients.create(clientData)
            if (response.success) {
                const newClient = response.data
                
                set((state) => ({
                    clients: [...state.clients, newClient],
                    loading: false
                }))
                
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'success', duration: 2000, title: 'Success' },
                        'Client created successfully!',
                    ),
                )
                return newClient
            } else {
                throw new Error(response.error)
            }
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    'Failed to create client',
                ),
            )
            throw error
        }
    },

    // Update client
    updateClient: async (id, clientData) => {
        set({ loading: true, error: null })
        try {
            console.log('Updating client:', id, clientData)
            const response = await FirebaseDbService.clients.update(id, clientData)
            console.log('Update response:', response)
            
            if (response.success) {
                const updatedClient = response.data
                
                set((state) => ({
                    clients: state.clients.map((c) => (c.id === id ? updatedClient : c)),
                    loading: false
                }))
                
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'success', duration: 2000, title: 'Success' },
                        'Client updated successfully!',
                    ),
                )
                return updatedClient
            } else {
                console.error('Update failed:', response.error)
                throw new Error(response.error)
            }
        } catch (error) {
            console.error('Update error:', error)
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    `Failed to update client: ${error.message}`,
                ),
            )
            throw error
        }
    },

    // Delete client
    deleteClient: async (id) => {
        set({ loading: true, error: null })
        try {
            const response = await FirebaseDbService.clients.delete(id)
            if (response.success) {
                set((state) => ({
                    clients: state.clients.filter((c) => c.id !== id),
                    loading: false
                }))
                
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'success', duration: 2000, title: 'Success' },
                        'Client deleted successfully!',
                    ),
                )
            } else {
                throw new Error(response.error)
            }
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    'Failed to delete client',
                ),
            )
            throw error
        }
    },

    // ===== ADVANCED FEATURES =====

    // 1. ROLLBACK MECHANISMS
    addToHistory: (action, data, timestamp = Date.now()) => {
        set((state) => ({
            changeHistory: [
                ...state.changeHistory.slice(-49), // Keep last 50 changes
                { action, data, timestamp, id: Math.random().toString(36) }
            ]
        }))
    },

    rollbackChange: async (historyId) => {
        const state = get()
        const change = state.changeHistory.find(h => h.id === historyId)
        if (!change) return

        try {
            set({ loading: true })
            
            switch (change.action) {
                case 'create_lead':
                    await FirebaseDbService.leads.delete(change.data.id)
                    set((state) => ({
                        leads: state.leads.filter(l => l.id !== change.data.id),
                        changeHistory: state.changeHistory.filter(h => h.id !== historyId)
                    }))
                    break
                    
                case 'update_lead':
                    await FirebaseDbService.leads.update(change.data.id, change.data.originalData)
                    set((state) => ({
                        leads: state.leads.map(l => l.id === change.data.id ? change.data.originalData : l),
                        changeHistory: state.changeHistory.filter(h => h.id !== historyId)
                    }))
                    break
                    
                case 'delete_lead':
                    await FirebaseDbService.leads.create(change.data.originalData)
                    set((state) => ({
                        leads: [...state.leads, change.data.originalData],
                        changeHistory: state.changeHistory.filter(h => h.id !== historyId)
                    }))
                    break
                    
                // Similar for clients...
            }
            
            set({ loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'success', duration: 2000, title: 'Success' },
                    'Change rolled back successfully!',
                ),
            )
        } catch (error) {
            set({ loading: false, error: error.message })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    `Failed to rollback change: ${error.message}`,
                ),
            )
        }
    },

    // 2. REAL-TIME LISTENERS
    startRealtimeListeners: () => {
        const state = get()
        
        // Stop existing listeners
        if (state.realtimeListeners.leads) {
            state.realtimeListeners.leads()
        }
        if (state.realtimeListeners.clients) {
            state.realtimeListeners.clients()
        }

        // Start leads listener
        const leadsQuery = query(collection(db, 'leads'), orderBy('createdAt', 'desc'))
        const unsubscribeLeads = onSnapshot(leadsQuery, (snapshot) => {
            const leads = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                favorite: doc.data().favorite || false
            }))
            
            set({ leads, lastSyncTime: Date.now() })
        }, (error) => {
            console.error('Leads listener error:', error)
            set({ error: error.message })
        })

        // Start clients listener
        const clientsQuery = query(collection(db, 'clients'), orderBy('createdAt', 'desc'))
        const unsubscribeClients = onSnapshot(clientsQuery, (snapshot) => {
            const clients = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                favorite: doc.data().favorite || false
            }))
            
            set({ clients, lastSyncTime: Date.now() })
        }, (error) => {
            console.error('Clients listener error:', error)
            set({ error: error.message })
        })

        set({
            realtimeListeners: {
                leads: unsubscribeLeads,
                clients: unsubscribeClients
            }
        })
    },

    stopRealtimeListeners: () => {
        const state = get()
        if (state.realtimeListeners.leads) {
            state.realtimeListeners.leads()
        }
        if (state.realtimeListeners.clients) {
            state.realtimeListeners.clients()
        }
        set({
            realtimeListeners: { leads: null, clients: null }
        })
    },

    // 3. OFFLINE CACHING
    cacheData: () => {
        const state = get()
        const cacheData = {
            leads: state.leads,
            clients: state.clients,
            timestamp: Date.now(),
            version: '1.0'
        }
        localStorage.setItem('crm_offline_cache', JSON.stringify(cacheData))
    },

    loadFromCache: () => {
        try {
            const cached = localStorage.getItem('crm_offline_cache')
            if (cached) {
                const cacheData = JSON.parse(cached)
                const isStale = Date.now() - cacheData.timestamp > 24 * 60 * 60 * 1000 // 24 hours
                
                if (!isStale) {
                    set({
                        leads: cacheData.leads || [],
                        clients: cacheData.clients || []
                    })
                    return true
                }
            }
        } catch (error) {
            console.error('Cache load error:', error)
        }
        return false
    },

    // 4. CONFLICT RESOLUTION
    detectConflict: (localData, serverData) => {
        const conflicts = []
        
        // Check for timestamp conflicts
        if (localData.updatedAt && serverData.updatedAt) {
            const localTime = new Date(localData.updatedAt).getTime()
            const serverTime = new Date(serverData.updatedAt).getTime()
            
            if (Math.abs(localTime - serverTime) < 5000) { // 5 second window
                conflicts.push({
                    field: 'updatedAt',
                    local: localData.updatedAt,
                    server: serverData.updatedAt,
                    type: 'timestamp'
                })
            }
        }
        
        return conflicts
    },

    resolveConflict: (conflictId, resolution) => {
        set((state) => ({
            conflictResolution: {
                ...state.conflictResolution,
                conflicts: state.conflictResolution.conflicts.filter(c => c.id !== conflictId)
            }
        }))
    },

    // 5. OPTIMISTIC UPDATES
    optimisticUpdate: (entityType, id, data) => {
        const state = get()
        const tempId = `temp_${Date.now()}`
        
        // Add to pending changes
        set((state) => ({
            pendingChanges: [...state.pendingChanges, {
                id: tempId,
                entityType,
                entityId: id,
                data,
                timestamp: Date.now()
            }]
        }))

        // Update UI immediately
        if (entityType === 'lead') {
            set((state) => ({
                leads: state.leads.map(l => l.id === id ? { ...l, ...data } : l)
            }))
        } else if (entityType === 'client') {
            set((state) => ({
                clients: state.clients.map(c => c.id === id ? { ...c, ...data } : c)
            }))
        }
    },

    confirmOptimisticUpdate: (tempId) => {
        set((state) => ({
            pendingChanges: state.pendingChanges.filter(p => p.id !== tempId)
        }))
    },

    revertOptimisticUpdate: (tempId) => {
        const state = get()
        const change = state.pendingChanges.find(p => p.id === tempId)
        if (!change) return

        // Revert the UI change
        if (change.entityType === 'lead') {
            set((state) => ({
                leads: state.leads.map(l => l.id === change.entityId ? { ...l, ...change.data } : l)
            }))
        } else if (change.entityType === 'client') {
            set((state) => ({
                clients: state.clients.map(c => c.id === change.entityId ? { ...c, ...change.data } : c)
            }))
        }

        // Remove from pending
        set((state) => ({
            pendingChanges: state.pendingChanges.filter(p => p.id !== tempId)
        }))
    },

    // 6. ONLINE/OFFLINE DETECTION
    setOnlineStatus: (isOnline) => {
        set({ isOnline })
        if (isOnline) {
            // Sync pending changes when coming back online
            const state = get()
            if (state.pendingChanges.length > 0) {
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'info', duration: 3000, title: 'Sync' },
                        'Syncing pending changes...',
                    ),
                )
                // Trigger sync logic here
            }
        }
    },
}))


