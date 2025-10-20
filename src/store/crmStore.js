import { create } from 'zustand'
import React from 'react'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { toast } from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'

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
            const response = await FirebaseDbService.leads.create(leadData)
            if (response.success) {
                const newLead = response.data
                
                set((state) => ({
                    leads: [...state.leads, newLead],
                    loading: false
                }))
                
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

    // Update lead
    updateLead: async (id, leadData) => {
        set({ loading: true, error: null })
        try {
            console.log('Updating lead:', id, leadData)
            const response = await FirebaseDbService.leads.update(id, leadData)
            console.log('Update response:', response)
            
            if (response.success) {
                const updatedLead = response.data
                
                set((state) => ({
                    leads: state.leads.map((l) => (l.id === id ? updatedLead : l)),
                    loading: false
                }))
                
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'success', duration: 2000, title: 'Success' },
                        'Lead updated successfully!',
                    ),
                )
                return updatedLead
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
            console.log('Deleting lead:', id)
            const response = await FirebaseDbService.leads.delete(id)
            console.log('Delete response:', response)
            
            if (response.success) {
                set((state) => ({
                    leads: state.leads.filter((l) => l.id !== id),
                    loading: false
                }))
                
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
}))


