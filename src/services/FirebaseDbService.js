import { 
    collection, 
    doc, 
    getDocs, 
    getDoc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy, 
    onSnapshot,
    serverTimestamp 
} from 'firebase/firestore'
import { db } from '@/configs/firebase.config'

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

        // Update lead
        update: async (id, leadData) => {
            try {
                // Ensure ID is a string
                const stringId = String(id)
                const leadRef = doc(db, 'leads', stringId)
                const updateData = { ...leadData }
                // Remove the id from updateData to avoid conflicts
                delete updateData.id
                await updateDoc(leadRef, {
                    ...updateData,
                    updatedAt: serverTimestamp()
                })
                return { success: true, data: { id: stringId, ...leadData } }
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
        }
    }
}
