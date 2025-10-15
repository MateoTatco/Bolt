import { mock } from '../MockAdapter'
import { clientsData } from '../data/clientsData'

// Store clients in localStorage for persistence
const getStoredClients = () => {
    const stored = localStorage.getItem('crm_clients')
    return stored ? JSON.parse(stored) : clientsData
}

const saveClients = (clients) => {
    localStorage.setItem('crm_clients', JSON.stringify(clients))
}

// GET /api/clients - Get all clients
mock.onGet('/api/clients').reply(() => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const clients = getStoredClients()
            resolve([200, { data: clients, total: clients.length }])
        }, 300)
    })
})

// GET /api/clients/:id - Get single client
mock.onGet(/\/api\/clients\/\d+/).reply((config) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const clients = getStoredClients()
            const id = parseInt(config.url.split('/').pop())
            const client = clients.find(c => c.id === id)
            
            if (client) {
                resolve([200, { data: client }])
            } else {
                resolve([404, { message: 'Client not found' }])
            }
        }, 200)
    })
})

// POST /api/clients - Create new client
mock.onPost('/api/clients').reply((config) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            try {
                const newClient = JSON.parse(config.data)
                const clients = getStoredClients()
                
                // Generate new ID
                const newId = clients.length ? Math.max(...clients.map(c => c.id)) + 1 : 1
                
                const clientWithId = {
                    ...newClient,
                    id: newId,
                    favorite: false,
                    createdAt: new Date().toISOString().slice(0,10),
                    updatedAt: new Date().toISOString().slice(0,10)
                }
                
                const updatedClients = [...clients, clientWithId]
                saveClients(updatedClients)
                
                resolve([201, { 
                    data: clientWithId, 
                    message: 'Client created successfully' 
                }])
            } catch (error) {
                resolve([400, { message: 'Invalid client data' }])
            }
        }, 500)
    })
})

// PUT /api/clients/:id - Update client
mock.onPut(/\/api\/clients\/\d+/).reply((config) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            try {
                const updatedClient = JSON.parse(config.data)
                const id = parseInt(config.url.split('/').pop())
                const clients = getStoredClients()
                
                const clientIndex = clients.findIndex(c => c.id === id)
                if (clientIndex === -1) {
                    resolve([404, { message: 'Client not found' }])
                    return
                }
                
                const clientWithUpdates = {
                    ...clients[clientIndex],
                    ...updatedClient,
                    id,
                    updatedAt: new Date().toISOString().slice(0,10)
                }
                
                const updatedClients = [...clients]
                updatedClients[clientIndex] = clientWithUpdates
                saveClients(updatedClients)
                
                resolve([200, { 
                    data: clientWithUpdates, 
                    message: 'Client updated successfully' 
                }])
            } catch (error) {
                resolve([400, { message: 'Invalid client data' }])
            }
        }, 400)
    })
})

// DELETE /api/clients/:id - Delete client
mock.onDelete(/\/api\/clients\/\d+/).reply((config) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const id = parseInt(config.url.split('/').pop())
            const clients = getStoredClients()
            
            const clientIndex = clients.findIndex(c => c.id === id)
            if (clientIndex === -1) {
                resolve([404, { message: 'Client not found' }])
                return
            }
            
            const updatedClients = clients.filter(c => c.id !== id)
            saveClients(updatedClients)
            
            resolve([200, { message: 'Client deleted successfully' }])
        }, 300)
    })
})

