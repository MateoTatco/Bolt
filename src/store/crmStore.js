import { create } from 'zustand'
import React from 'react'
import { CrmService } from '@/services/CrmService'
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

    // Load leads from API
    loadLeads: async () => {
        set({ loading: true, error: null })
        try {
            const response = await CrmService.getLeads()
            const normalized = (response.data?.data || []).map((l) => ({
                ...l,
                favorite: false,
            }))
            set({ leads: normalized, loading: false })
        } catch (error) {
            set({ error: error.message, loading: false })
            // Show a proper Notification component to satisfy toast wrapper expectations
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    'Failed to load leads',
                ),
            )
        }
    },

    // Load clients from API
    loadClients: async () => {
        set({ loading: true, error: null })
        try {
            const response = await CrmService.getClients()
            const normalized = (response.data?.data || []).map((c) => ({
                ...c,
                favorite: false,
            }))
            set({ clients: normalized, loading: false })
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
            const response = await CrmService.createLead(leadData)
            const newLead = response.data.data
            
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
            const response = await CrmService.updateLead(id, leadData)
            const updatedLead = response.data.data
            
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
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    'Failed to update lead',
                ),
            )
            throw error
        }
    },

    // Delete lead
    deleteLead: async (id) => {
        set({ loading: true, error: null })
        try {
            await CrmService.deleteLead(id)
            
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
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    'Failed to delete lead',
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
            const response = await CrmService.createClient(clientData)
            const newClient = response.data.data
            
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
            const response = await CrmService.updateClient(id, clientData)
            const updatedClient = response.data.data
            
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
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    'Failed to update client',
                ),
            )
            throw error
        }
    },

    // Delete client
    deleteClient: async (id) => {
        set({ loading: true, error: null })
        try {
            await CrmService.deleteClient(id)
            
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


