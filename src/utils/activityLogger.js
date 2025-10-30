import { db } from '@/configs/firebase.config'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { useSessionUser } from '@/store/authStore'
import { getAuth } from 'firebase/auth'

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
        await addDoc(collection(db, `${entityType}s`, entityId, 'activities'), data)
    } catch (e) {
        console.error('logActivity failed', e)
    }
}

export default logActivity


