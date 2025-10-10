import { mock } from '../MockAdapter'
import { leadsData } from '../data/leadsData'

// Store leads in localStorage for persistence
const getStoredLeads = () => {
    const stored = localStorage.getItem('crm_leads')
    return stored ? JSON.parse(stored) : leadsData
}

const saveLeads = (leads) => {
    localStorage.setItem('crm_leads', JSON.stringify(leads))
}

// GET /api/leads - Get all leads
mock.onGet('/api/leads').reply(() => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const leads = getStoredLeads()
            resolve([200, { data: leads, total: leads.length }])
        }, 300)
    })
})

// GET /api/leads/:id - Get single lead
mock.onGet(/\/api\/leads\/\d+/).reply((config) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const leads = getStoredLeads()
            const id = parseInt(config.url.split('/').pop())
            const lead = leads.find(l => l.id === id)
            
            if (lead) {
                resolve([200, { data: lead }])
            } else {
                resolve([404, { message: 'Lead not found' }])
            }
        }, 200)
    })
})

// POST /api/leads - Create new lead
mock.onPost('/api/leads').reply((config) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            try {
                const newLead = JSON.parse(config.data)
                const leads = getStoredLeads()
                
                // Generate new ID
                const newId = leads.length ? Math.max(...leads.map(l => l.id)) + 1 : 1
                
                const leadWithId = {
                    ...newLead,
                    id: newId,
                    createdAt: new Date().toISOString().slice(0,10),
                    updatedAt: new Date().toISOString().slice(0,10)
                }
                
                const updatedLeads = [...leads, leadWithId]
                saveLeads(updatedLeads)
                
                resolve([201, { 
                    data: leadWithId, 
                    message: 'Lead created successfully' 
                }])
            } catch (error) {
                resolve([400, { message: 'Invalid lead data' }])
            }
        }, 500)
    })
})

// PUT /api/leads/:id - Update lead
mock.onPut(/\/api\/leads\/\d+/).reply((config) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            try {
                const updatedLead = JSON.parse(config.data)
                const id = parseInt(config.url.split('/').pop())
                const leads = getStoredLeads()
                
                const leadIndex = leads.findIndex(l => l.id === id)
                if (leadIndex === -1) {
                    resolve([404, { message: 'Lead not found' }])
                    return
                }
                
                const leadWithUpdates = {
                    ...leads[leadIndex],
                    ...updatedLead,
                    id,
                    updatedAt: new Date().toISOString().slice(0,10)
                }
                
                const updatedLeads = [...leads]
                updatedLeads[leadIndex] = leadWithUpdates
                saveLeads(updatedLeads)
                
                resolve([200, { 
                    data: leadWithUpdates, 
                    message: 'Lead updated successfully' 
                }])
            } catch (error) {
                resolve([400, { message: 'Invalid lead data' }])
            }
        }, 400)
    })
})

// DELETE /api/leads/:id - Delete lead
mock.onDelete(/\/api\/leads\/\d+/).reply((config) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const id = parseInt(config.url.split('/').pop())
            const leads = getStoredLeads()
            
            const leadIndex = leads.findIndex(l => l.id === id)
            if (leadIndex === -1) {
                resolve([404, { message: 'Lead not found' }])
                return
            }
            
            const updatedLeads = leads.filter(l => l.id !== id)
            saveLeads(updatedLeads)
            
            resolve([200, { message: 'Lead deleted successfully' }])
        }, 300)
    })
})

