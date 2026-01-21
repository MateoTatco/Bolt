import { db } from '@/configs/firebase.config'
import { collection, getDocs, query, where } from 'firebase/firestore'

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
 * Get user IDs by email addresses
 * @param {string[]} emails - Array of email addresses
 * @returns {Promise<string[]>} Array of user IDs matching the emails
 */
export async function getUserIdsByEmails(emails) {
    try {
        if (!emails || emails.length === 0) return []
        
        const usersRef = collection(db, 'users')
        const userIds = []
        
        // Query for each email (Firestore doesn't support 'in' queries with more than 10 items easily)
        // For 2 emails, we can use 'in' query
        if (emails.length <= 10) {
            const q = query(usersRef, where('email', 'in', emails))
            const snapshot = await getDocs(q)
            snapshot.docs.forEach(doc => {
                userIds.push(doc.id)
            })
        } else {
            // If more than 10 emails, query in batches
            for (let i = 0; i < emails.length; i += 10) {
                const batch = emails.slice(i, i + 10)
                const q = query(usersRef, where('email', 'in', batch))
                const snapshot = await getDocs(q)
                snapshot.docs.forEach(doc => {
                    userIds.push(doc.id)
                })
            }
        }
        
        return userIds
    } catch (error) {
        console.error('Error getting user IDs by emails:', error)
        return []
    }
}

/**
 * Get user emails from user IDs
 * @param {string[]} userIds - Array of user IDs
 * @returns {Promise<string[]>} Array of email addresses (filtered to remove null/undefined)
 */
export async function getUserEmailsByUserIds(userIds) {
    try {
        if (!userIds || userIds.length === 0) return []
        
        const { FirebaseDbService } = await import('@/services/FirebaseDbService')
        const emails = []
        
        // Get user data for each user ID
        for (const userId of userIds) {
            if (!userId) continue
            try {
                const userResult = await FirebaseDbService.users.getById(userId)
                if (userResult.success && userResult.data && userResult.data.email) {
                    emails.push(userResult.data.email)
                }
            } catch (error) {
                console.error(`Error getting email for user ${userId}:`, error)
                // Continue with other users
            }
        }
        
        // Remove duplicates and filter out invalid emails
        return [...new Set(emails)].filter(email => email && email.includes('@'))
    } catch (error) {
        console.error('Error getting user emails:', error)
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

