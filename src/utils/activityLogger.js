import { db } from '@/configs/firebase.config'
import { addDoc, collection, serverTimestamp, getDoc, doc } from 'firebase/firestore'
import { useSessionUser } from '@/store/authStore'
import { getAuth } from 'firebase/auth'
import { notifyActivityAdded, getCurrentUserId, getUsersToNotify } from '@/utils/notificationHelper'

const getCollectionName = (entityType) => {
    if (entityType === 'warranty') return 'warranties'
    return `${entityType}s`
}

export const getCurrentActor = () => {
    try {
        const state = useSessionUser.getState()
        const storeUser = state?.user || {}
        const authUser = getAuth().currentUser || {}

        const pickEmail = storeUser.email || authUser.email || ''
        const emailName = pickEmail ? pickEmail.split('@')[0] : ''

        const name =
            storeUser.userName ||
            storeUser.name ||
            authUser.displayName ||
            emailName ||
            'User'

        const email = pickEmail
        const avatar = storeUser.avatar || ''
        return { name, email, avatar }
    } catch {
        return { name: 'User', email: '' }
    }
}

export async function logActivity(entityType, entityId, payload) {
    if (!entityType || !entityId) return
    const actor = payload?.actor || getCurrentActor()
    const data = {
        type: payload?.type || 'info',
        message: payload?.message || '',
        actor,
        metadata: payload?.metadata || {},
        createdAt: serverTimestamp(),
    }
    try {
        const collectionName = getCollectionName(entityType)
        await addDoc(collection(db, collectionName, entityId, 'activities'), data)
        
        // Notify users about new activity
        const currentUserId = getCurrentUserId()
        if (currentUserId && payload?.message) {
            try {
                // Get entity name
                const collectionName = getCollectionName(entityType)
                const entityDoc = await getDoc(doc(db, collectionName, entityId))
                const entityData = entityDoc.data()
                const entityName = entityData?.companyName || entityData?.clientName || entityData?.projectName || entityData?.ProjectName || `${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`
                
                // Get users to notify
                const userIds = await getUsersToNotify(entityType, entityId)
                
                if (userIds.length > 0) {
                    await notifyActivityAdded({
                        userIds,
                        entityType,
                        entityId,
                        entityName,
                        activityMessage: payload.message,
                        activityType: payload.type || 'info',
                        createdBy: currentUserId,
                        metadata: payload.metadata || {}
                    })
                }
            } catch (notifyError) {
                console.error('Error notifying about activity:', notifyError)
                // Don't fail the activity logging if notification fails
            }
        }
    } catch (e) {
        console.error('logActivity failed', e)
    }
}

export default logActivity


