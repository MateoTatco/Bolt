import { useState, useEffect } from 'react'
import { Button, Dialog, Avatar, Checkbox } from '@/components/ui'
import { HiOutlineUserAdd, HiOutlineX } from 'react-icons/hi'
import { db, auth } from '@/configs/firebase.config'
import { collection, getDocs, getDoc, updateDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import React from 'react'
import { createNotification, getCurrentUserId } from '@/utils/notificationHelper'
import { NOTIFICATION_TYPES } from '@/constants/notification.constant'

const EntityMembersManager = ({ entityType, entityId, entityName, onMembersUpdated }) => {
    const [isOpen, setIsOpen] = useState(false)
    const [availableUsers, setAvailableUsers] = useState([])
    const [selectedMembers, setSelectedMembers] = useState([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    // Load available users and current members
    useEffect(() => {
        if (isOpen && entityId) {
            loadUsersAndMembers()
        }
    }, [isOpen, entityId])

    const loadUsersAndMembers = async () => {
        setLoading(true)
        try {
            // Load all users from Firestore
            const usersRef = collection(db, 'users')
            const usersSnapshot = await getDocs(usersRef)
            const firestoreUsers = usersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            
            // Also get users from Firebase Auth (requires admin SDK or listUsers)
            // For now, we'll ensure all Firestore users are included
            // If some users are missing from Firestore, we'll create placeholder entries
            const usersMap = new Map()
            
            // Add all Firestore users
            firestoreUsers.forEach(user => {
                usersMap.set(user.id, user)
            })
            
            // Try to get Auth users (this requires admin SDK, so we'll handle it differently)
            // For now, ensure we have all users that exist in Firestore
            const allUsers = Array.from(usersMap.values())
            
            // Sort by email for consistency
            allUsers.sort((a, b) => {
                const emailA = (a.email || '').toLowerCase()
                const emailB = (b.email || '').toLowerCase()
                return emailA.localeCompare(emailB)
            })
            
            setAvailableUsers(allUsers)

            // Load current members from entity
            const entityRef = doc(db, `${entityType}s`, entityId)
            const entityDoc = await getDoc(entityRef)
            if (entityDoc.exists()) {
                const entityData = entityDoc.data()
                setSelectedMembers(entityData.members || [])
            }
        } catch (error) {
            console.error('Error loading users and members:', error)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "danger", duration: 3000, title: "Error" },
                    "Failed to load users"
                )
            )
        } finally {
            setLoading(false)
        }
    }

    const handleToggleMember = (userId) => {
        setSelectedMembers(prev => {
            if (prev.includes(userId)) {
                return prev.filter(id => id !== userId)
            } else {
                return [...prev, userId]
            }
        })
    }

    const handleAddAllUsers = () => {
        const allUserIds = availableUsers.map(user => user.id)
        setSelectedMembers(allUserIds)
    }

    const handleRemoveAll = () => {
        setSelectedMembers([])
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            // Get previous members to detect new additions
            const entityRef = doc(db, `${entityType}s`, entityId)
            const entityDoc = await getDoc(entityRef)
            const previousMembers = entityDoc.exists() ? (entityDoc.data().members || []) : []
            
            // Find newly added members
            const newMembers = selectedMembers.filter(id => !previousMembers.includes(id))
            const currentUserId = getCurrentUserId()
            
            await updateDoc(entityRef, {
                members: selectedMembers,
                updatedAt: new Date()
            })

            // Notify newly added members
            if (newMembers.length > 0 && currentUserId) {
                const entityData = entityDoc.data()
                const entityName = entityData?.companyName || entityData?.clientName || entityData?.projectName || entityData?.ProjectName || entityName || `${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`
                
                await Promise.all(
                    newMembers.map(userId =>
                        createNotification({
                            userId,
                            type: NOTIFICATION_TYPES.SYSTEM,
                            title: 'Added to ' + entityType.charAt(0).toUpperCase() + entityType.slice(1),
                            message: `You have been added to ${entityName}`,
                            entityType,
                            entityId,
                            relatedUserId: currentUserId,
                            metadata: {
                                entityName,
                                action: 'member_added'
                            }
                        })
                    )
                )
            }

            toast.push(
                React.createElement(
                    Notification,
                    { type: "success", duration: 2000, title: "Success" },
                    "Members updated successfully!"
                )
            )

            if (onMembersUpdated) {
                onMembersUpdated(selectedMembers)
            }

            setIsOpen(false)
        } catch (error) {
            console.error('Error saving members:', error)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "danger", duration: 3000, title: "Error" },
                    "Failed to save members. Please try again."
                )
            )
        } finally {
            setSaving(false)
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

    return (
        <>
            <Button
                variant="twoTone"
                icon={<HiOutlineUserAdd />}
                onClick={() => setIsOpen(true)}
                size="sm"
            >
                Manage Members
            </Button>

            <Dialog
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                width={600}
            >
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                Manage Members
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Select members who should receive notifications for {entityName}
                            </p>
                        </div>
                        <Button
                            variant="plain"
                            icon={<HiOutlineX />}
                            onClick={() => setIsOpen(false)}
                        />
                    </div>

                    {loading ? (
                        <div className="text-center py-8 text-gray-500">Loading users...</div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                    {selectedMembers.length} of {availableUsers.length} users selected
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="twoTone"
                                        onClick={handleAddAllUsers}
                                    >
                                        Add All Users
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="plain"
                                        onClick={handleRemoveAll}
                                    >
                                        Remove All
                                    </Button>
                                </div>
                            </div>

                            <div className="max-h-96 overflow-y-auto space-y-2 mb-6">
                                {availableUsers.map(user => {
                                    const isSelected = selectedMembers.includes(user.id)
                                    // Show email if username is not set, otherwise show username
                                    const displayName = user.userName || user.firstName || user.displayName || user.email?.split('@')[0] || user.email || 'Unknown User'
                                    const displayEmail = user.email || ''
                                    
                                    return (
                                        <div
                                            key={user.id}
                                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                                                isSelected
                                                    ? 'bg-primary/10 border-primary dark:bg-primary/20'
                                                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                                            }`}
                                        >
                                            <Checkbox
                                                checked={isSelected}
                                                onChange={() => handleToggleMember(user.id)}
                                            />
                                            <Avatar
                                                className={getAvatarColor(displayName)}
                                                size="sm"
                                            >
                                                {getInitials(displayName)}
                                            </Avatar>
                                            <div className="flex-1">
                                                <div className="font-medium text-gray-900 dark:text-white">
                                                    {displayName}
                                                </div>
                                                {displayEmail && displayEmail !== displayName && (
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                                        {displayEmail}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <Button
                                    variant="plain"
                                    onClick={() => setIsOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="solid"
                                    onClick={handleSave}
                                    loading={saving}
                                >
                                    Save Members
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </Dialog>
        </>
    )
}

export default EntityMembersManager

