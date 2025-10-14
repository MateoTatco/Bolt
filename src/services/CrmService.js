import AxiosBase from './axios/AxiosBase'

export const CrmService = {
    // Get all leads
    getLeads: () => {
        return AxiosBase.get('/leads')
    },

    // Get single lead
    getLead: (id) => {
        return AxiosBase.get(`/leads/${id}`)
    },

    // Create new lead
    createLead: (leadData) => {
        return AxiosBase.post('/leads', leadData)
    },

    // Update lead
    updateLead: (id, leadData) => {
        return AxiosBase.put(`/leads/${id}`, leadData)
    },

    // Delete lead
    deleteLead: (id) => {
        return AxiosBase.delete(`/leads/${id}`)
    },

    // Client endpoints
    // Get all clients
    getClients: () => {
        return AxiosBase.get('/clients')
    },

    // Get single client
    getClient: (id) => {
        return AxiosBase.get(`/clients/${id}`)
    },

    // Create new client
    createClient: (clientData) => {
        return AxiosBase.post('/clients', clientData)
    },

    // Update client
    updateClient: (id, clientData) => {
        return AxiosBase.put(`/clients/${id}`, clientData)
    },

    // Delete client
    deleteClient: (id) => {
        return AxiosBase.delete(`/clients/${id}`)
    }
}
