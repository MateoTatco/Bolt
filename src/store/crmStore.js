import { create } from 'zustand'
import { CrmService } from '@/services/CrmService'
import { toast } from '@/components/ui/toast'

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
            toast.push('Failed to load leads', { type: 'error' })
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
            
            toast.push('Lead created successfully!', { type: 'success' })
            return newLead
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push('Failed to create lead', { type: 'error' })
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
            
            toast.push('Lead updated successfully!', { type: 'success' })
            return updatedLead
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push('Failed to update lead', { type: 'error' })
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
            
            toast.push('Lead deleted successfully!', { type: 'success' })
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push('Failed to delete lead', { type: 'error' })
            throw error
        }
    },

    // Toggle favorite (local state only for now)
    toggleFavorite: (id) => set((state) => ({
        leads: state.leads.map((l) => (l.id === id ? { ...l, favorite: !l.favorite } : l)),
    })),
}))


