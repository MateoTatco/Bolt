import { db } from '@/configs/firebase.config'
import { collection, getDocs } from 'firebase/firestore'

/**
 * Get all user IDs from Firestore
 * @returns {Promise<string[]>} Array of all user IDs
 */
export async function getAllUserIds() {
    try {
        const usersRef = collection(db, 'users')
        const usersSnapshot = await getDocs(usersRef)
        return usersSnapshot.docs.map(doc => doc.id)
    } catch (error) {
        console.error('Error getting all user IDs:', error)
        return []
    }
}

/**
 * Get all users from Firestore
 * @returns {Promise<Array>} Array of all users with their data
 */
export async function getAllUsers() {
    try {
        const usersRef = collection(db, 'users')
        const usersSnapshot = await getDocs(usersRef)
        return usersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }))
    } catch (error) {
        console.error('Error getting all users:', error)
        return []
    }
}

