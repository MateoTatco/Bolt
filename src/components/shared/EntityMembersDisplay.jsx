import { useState, useEffect } from 'react'
import { Avatar, Tooltip } from '@/components/ui'
import { db } from '@/configs/firebase.config'
import { collection, getDocs, getDoc, doc } from 'firebase/firestore'

const EntityMembersDisplay = ({ entityType, entityId }) => {
    const [members, setMembers] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (entityId) {
            loadMembers()
        }
    }, [entityType, entityId])

    const loadMembers = async () => {
        setLoading(true)
        try {
            const memberIds = new Set()
            
            // Get entity-level members
            const entityRef = doc(db, `${entityType}s`, entityId)
            const entityDoc = await getDoc(entityRef)
            if (entityDoc.exists()) {
                const entityData = entityDoc.data()
                if (entityData.members && Array.isArray(entityData.members)) {
                    entityData.members.forEach(id => memberIds.add(id))
                }
            }
            
            // Get section-level members
            const sectionsRef = collection(db, `${entityType}s`, entityId, 'sections')
            const sectionsSnapshot = await getDocs(sectionsRef)
            sectionsSnapshot.forEach(doc => {
                const sectionData = doc.data()
                if (sectionData.members && Array.isArray(sectionData.members)) {
                    sectionData.members.forEach(id => memberIds.add(id))
                }
            })
            
            // Load user details for all member IDs
            const allMemberIds = Array.from(memberIds)
            if (allMemberIds.length > 0) {
                const usersRef = collection(db, 'users')
                const usersSnapshot = await getDocs(usersRef)
                const allUsers = usersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                
                const memberUsers = allUsers.filter(user => allMemberIds.includes(user.id))
                setMembers(memberUsers)
            } else {
                setMembers([])
            }
        } catch (error) {
            console.error('Error loading members:', error)
            setMembers([])
        } finally {
            setLoading(false)
        }
    }

    const getInitials = (name) => {
        if (!name) return '??'
        const parts = name.split(' ')
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase()
        }
        return name.substring(0, 2).toUpperCase()
    }

    const getAvatarColor = (name) => {
        if (!name) return 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-100'
        const colors = [
            'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-100',
            'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-100',
            'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-100',
            'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-100',
            'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-100',
            'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-100'
        ]
        const index = name.length % colors.length
        return colors[index]
    }

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-sm text-gray-500">
                Loading members...
            </div>
        )
    }

    if (members.length === 0) {
        return (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>No members assigned</span>
            </div>
        )
    }

    return (
        <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
                Members:
            </span>
            <div className="flex -space-x-2">
                {members.map((member, index) => {
                    // Show email if username is not set, otherwise show username
                    const displayName = member.userName || member.firstName || member.displayName || member.email?.split('@')[0] || member.email || 'Unknown User'
                    const email = member.email || ''
                    
                    return (
                        <Tooltip
                            key={member.id}
                            title={
                                <div>
                                    <div className="font-medium">{displayName}</div>
                                    {email && <div className="text-xs text-gray-300">{email}</div>}
                                </div>
                            }
                        >
                            <Avatar
                                className={`${getAvatarColor(displayName)} border-2 border-white dark:border-gray-800 hover:scale-110 transition-transform cursor-pointer`}
                                size="sm"
                            >
                                {getInitials(displayName)}
                            </Avatar>
                        </Tooltip>
                    )
                })}
            </div>
            {members.length > 5 && (
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                    +{members.length - 5} more
                </span>
            )}
        </div>
    )
}

export default EntityMembersDisplay

