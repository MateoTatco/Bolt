import AxiosBase from './axios/AxiosBase'

export const CrmService = {
    // Get all leads
    getLeads: () => {
        return AxiosBase.get('/api/leads')
    },

    // Get single lead
    getLead: (id) => {
        return AxiosBase.get(`/api/leads/${id}`)
    },

    // Create new lead
    createLead: (leadData) => {
        return AxiosBase.post('/api/leads', leadData)
    },

    // Update lead
    updateLead: (id, leadData) => {
        return AxiosBase.put(`/api/leads/${id}`, leadData)
    },

    // Delete lead
    deleteLead: (id) => {
        return AxiosBase.delete(`/api/leads/${id}`)
    }
}
