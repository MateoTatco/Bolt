import { db } from '@/configs/firebase.config'
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { FirebaseDbService } from '@/services/FirebaseDbService'

/**
 * Sync all Firebase Auth users to Firestore
 * This function should be called by an admin or through a Cloud Function
 * For now, we'll create a helper that can be called manually
 * 
 * Note: This requires knowing the user IDs. In production, this should be done
 * via a Cloud Function that has Admin SDK access to list all Auth users.
 */
export async function syncAuthUsersToFirestore(userIds = []) {
    if (userIds.length === 0) {
        console.warn('No user IDs provided. Cannot sync users.')
        return { success: false, error: 'No user IDs provided' }
    }

    const results = {
        created: [],
        updated: [],
        errors: []
    }

    for (const userId of userIds) {
        try {
            const userRef = doc(db, 'users', userId)
            const userDoc = await getDoc(userRef)
            
            if (!userDoc.exists()) {
                // Create a basic user document
                await setDoc(userRef, {
                    email: '', // Will be updated when user signs in
                    userName: '',
                    firstName: '',
                    phoneNumber: '',
                    avatar: '',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                })
                results.created.push(userId)
                console.log(`Created Firestore document for user: ${userId}`)
            } else {
                results.updated.push(userId)
            }
        } catch (error) {
            console.error(`Error syncing user ${userId}:`, error)
            results.errors.push({ userId, error: error.message })
        }
    }

    return {
        success: results.errors.length === 0,
        results
    }
}

/**
 * Get all user IDs from Firestore and ensure they have proper documents
 */
export async function ensureAllUsersInFirestore() {
    try {
        const usersRef = collection(db, 'users')
        const usersSnapshot = await getDocs(usersRef)
        const existingUserIds = usersSnapshot.docs.map(doc => doc.id)
        
        console.log(`Found ${existingUserIds.length} users in Firestore`)
        return existingUserIds
    } catch (error) {
        console.error('Error ensuring users in Firestore:', error)
        return []
    }
}

