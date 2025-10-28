import { collection, addDoc, doc, getDocs, query, where, deleteDoc } from 'firebase/firestore'
import { db } from '@/configs/firebase.config'

// Mock data for tasks and sections
const mockSections = [
    {
        name: 'Development',
        order: 0,
        members: ['admin', 'brett', 'simon'],
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        name: 'Bug Fixes',
        order: 1,
        members: ['admin', 'robb'],
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        name: 'Testing',
        order: 2,
        members: ['simon', 'robb'],
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        name: 'Documentation',
        order: 3,
        members: ['brett'],
        createdAt: new Date(),
        updatedAt: new Date()
    }
]

const mockTasks = [
    // Development tasks
    {
        name: 'Implement user authentication system',
        status: 'in_progress',
        priority: 'high',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
        assignee: 'brett',
        sectionId: 'development', // Will be replaced with actual section ID
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin'
    },
    {
        name: 'Create responsive dashboard layout',
        status: 'pending',
        priority: 'medium',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        assignee: 'simon',
        sectionId: 'development',
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin'
    },
    {
        name: 'Set up database schema',
        status: 'completed',
        priority: 'high',
        dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        assignee: 'brett',
        sectionId: 'development',
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin'
    },
    
    // Bug Fix tasks
    {
        name: 'Fix login form validation error',
        status: 'pending',
        priority: 'high',
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day from now
        assignee: 'robb',
        sectionId: 'bug-fixes',
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin'
    },
    {
        name: 'Resolve mobile navigation issue',
        status: 'in_progress',
        priority: 'medium',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
        assignee: 'admin',
        sectionId: 'bug-fixes',
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin'
    },
    {
        name: 'Fix data export functionality',
        status: 'completed',
        priority: 'low',
        dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        assignee: 'robb',
        sectionId: 'bug-fixes',
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin'
    },
    
    // Testing tasks
    {
        name: 'Unit tests for authentication module',
        status: 'pending',
        priority: 'medium',
        dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days from now
        assignee: 'simon',
        sectionId: 'testing',
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin'
    },
    {
        name: 'Integration testing for API endpoints',
        status: 'in_progress',
        priority: 'high',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
        assignee: 'robb',
        sectionId: 'testing',
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin'
    },
    
    // Documentation tasks
    {
        name: 'Write API documentation',
        status: 'pending',
        priority: 'low',
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days from now
        assignee: 'brett',
        sectionId: 'documentation',
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin'
    },
    {
        name: 'Create user manual',
        status: 'pending',
        priority: 'medium',
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
        assignee: 'brett',
        sectionId: 'documentation',
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'admin'
    }
]

// Function to migrate mock tasks data to Firebase
export const migrateTasksMockData = async () => {
    try {
        console.log('🚀 Starting Tasks mock data migration...')
        
        // Get all leads and clients
        const leadsSnapshot = await getDocs(collection(db, 'leads'))
        const clientsSnapshot = await getDocs(collection(db, 'clients'))
        
        const leads = leadsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        const clients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        
        console.log(`📊 Found ${leads.length} leads and ${clients.length} clients`)
        
        // Process leads
        for (const lead of leads) { // Process ALL leads, not just first 3
            console.log(`📝 Adding tasks to lead: ${lead.companyName}`)
            
            // Create sections for this lead
            const sectionIds = {}
            for (const section of mockSections) {
                const sectionRef = await addDoc(collection(db, 'leads', lead.id, 'sections'), section)
                sectionIds[section.name.toLowerCase().replace(' ', '-')] = sectionRef.id
                console.log(`✅ Created section: ${section.name}`)
            }
            
            // Create tasks for this lead
            for (const task of mockTasks) {
                const taskData = {
                    ...task,
                    sectionId: sectionIds[task.sectionId] || sectionIds['development']
                }
                await addDoc(collection(db, 'leads', lead.id, 'tasks'), taskData)
            }
            console.log(`✅ Added ${mockTasks.length} tasks to lead: ${lead.companyName}`)
        }
        
        // Process clients
        for (const client of clients) { // Process ALL clients, not just first 2
            console.log(`📝 Adding tasks to client: ${client.clientName}`)
            
            // Create sections for this client
            const sectionIds = {}
            for (const section of mockSections) {
                const sectionRef = await addDoc(collection(db, 'clients', client.id, 'sections'), section)
                sectionIds[section.name.toLowerCase().replace(' ', '-')] = sectionRef.id
                console.log(`✅ Created section: ${section.name}`)
            }
            
            // Create tasks for this client
            for (const task of mockTasks) {
                const taskData = {
                    ...task,
                    sectionId: sectionIds[task.sectionId] || sectionIds['development']
                }
                await addDoc(collection(db, 'clients', client.id, 'tasks'), taskData)
            }
            console.log(`✅ Added ${mockTasks.length} tasks to client: ${client.clientName}`)
        }
        
        console.log('🎉 Tasks mock data migration completed successfully!')
        return { success: true, message: 'Tasks mock data migrated successfully' }
        
    } catch (error) {
        console.error('❌ Error migrating tasks mock data:', error)
        return { success: false, error: error.message }
    }
}

// Function to clear all tasks data (for testing)
export const clearTasksData = async () => {
    try {
        console.log('🗑️ Clearing all tasks data...')
        
        // Get all leads and clients
        const leadsSnapshot = await getDocs(collection(db, 'leads'))
        const clientsSnapshot = await getDocs(collection(db, 'clients'))
        
        const leads = leadsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        const clients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        
        // Clear tasks and sections for leads
        for (const lead of leads) {
            const tasksSnapshot = await getDocs(collection(db, 'leads', lead.id, 'tasks'))
            const sectionsSnapshot = await getDocs(collection(db, 'leads', lead.id, 'sections'))
            
            // Delete all tasks
            for (const taskDoc of tasksSnapshot.docs) {
                await deleteDoc(doc(db, 'leads', lead.id, 'tasks', taskDoc.id))
            }
            
            // Delete all sections
            for (const sectionDoc of sectionsSnapshot.docs) {
                await deleteDoc(doc(db, 'leads', lead.id, 'sections', sectionDoc.id))
            }
        }
        
        // Clear tasks and sections for clients
        for (const client of clients) {
            const tasksSnapshot = await getDocs(collection(db, 'clients', client.id, 'tasks'))
            const sectionsSnapshot = await getDocs(collection(db, 'clients', client.id, 'sections'))
            
            // Delete all tasks
            for (const taskDoc of tasksSnapshot.docs) {
                await deleteDoc(doc(db, 'clients', client.id, 'tasks', taskDoc.id))
            }
            
            // Delete all sections
            for (const sectionDoc of sectionsSnapshot.docs) {
                await deleteDoc(doc(db, 'clients', client.id, 'sections', sectionDoc.id))
            }
        }
        
        console.log('✅ All tasks data cleared successfully!')
        return { success: true, message: 'All tasks data cleared successfully' }
        
    } catch (error) {
        console.error('❌ Error clearing tasks data:', error)
        return { success: false, error: error.message }
    }
}

// Function to reset and migrate tasks data
export const resetAndMigrateTasks = async () => {
    try {
        console.log('🔄 Resetting and migrating tasks data...')
        
        // First clear existing data
        await clearTasksData()
        
        // Then migrate new data
        const result = await migrateTasksMockData()
        
        return result
        
    } catch (error) {
        console.error('❌ Error resetting and migrating tasks data:', error)
        return { success: false, error: error.message }
    }
}
