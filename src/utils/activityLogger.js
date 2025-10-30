import { db } from '@/configs/firebase.config'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { useSessionUser } from '@/store/authStore'

export const getCurrentActor = () => {
    // Read from zustand store (app user profile)
    try {
        const state = useSessionUser.getState()
        const user = state?.user || {}
        const name = user.userName || user.name || 'Unknown User'
        const email = user.email || ''
        const avatar = user.avatar || ''
        return { name, email, avatar }
    } catch {
        return { name: 'Unknown User', email: '' }
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
        await addDoc(collection(db, `${entityType}s`, entityId, 'activities'), data)
    } catch (e) {
        console.error('logActivity failed', e)
    }
}

export default logActivity


