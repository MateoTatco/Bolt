import { create } from 'zustand'
import React from 'react'
import { CrmService } from '@/services/CrmService'
import { toast } from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'

export const useCrmStore = create((set, get) => ({
    leads: [],
    filters: {
        search: '',
        status: null,
        methodOfContact: null,
        responded: null,
        dateFrom: null,
        dateTo: null,
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
            set({ leads: response.data.data, loading: false })
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

    // Toggle favorite (local state only for now)
    toggleFavorite: (id) => set((state) => ({
        leads: state.leads.map((l) => (l.id === id ? { ...l, favorite: !l.favorite } : l)),
    })),
}))


