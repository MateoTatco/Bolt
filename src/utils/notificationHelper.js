import React from 'react'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { NOTIFICATION_TYPES, ENTITY_TYPES } from '@/constants/notification.constant'
import { getAuth } from 'firebase/auth'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { db } from '@/configs/firebase.config'
import { collection, getDocs, getDoc, doc } from 'firebase/firestore'
import { USER_ROLES, MODULES, hasModuleAccess } from '@/constants/roles.constant'

/**
 * Check if a user should receive notifications for a specific entity type based on their role
 * Non-Tatco roles should not receive notifications for CRM entities (lead, client) or projects
 * @param {string} userId - User ID to check role for
 * @param {string} entityType - Entity type (lead, client, project)
 * @returns {Promise<boolean>} True if user should receive notifications for this entity type
 */
export async function shouldReceiveNotificationForEntity(userId, entityType) {
    if (!userId || !entityType) {
        return true // Default to enabled if missing params
    }

    try {
        const userResult = await FirebaseDbService.users.getById(userId)
        if (userResult.success && userResult.data) {
            const userRole = userResult.data.role
            if (!userRole) {
                return true // No role set, allow notifications (backward compatibility)
            }

            const roles = Array.isArray(userRole) ? userRole : [userRole]
            
            // Admin and Tatco roles can receive all notifications
            const hasTatcoRole = roles.some(r => 
                r === USER_ROLES.TATCO_USER || 
                r === USER_ROLES.TATCO_USER_WITH_PROFIT_SHARING
            )
            const hasAdminRole = roles.some(r => r === USER_ROLES.ADMIN)
            
            if (hasTatcoRole || hasAdminRole) {
                return true // Tatco users and admins get all notifications
            }

            // For non-Tatco roles, block notifications for CRM and project-related entities
            // Only allow profit sharing notifications
            if (entityType === 'lead' || entityType === 'client') {
                // These are CRM entities - block for non-Tatco roles
                return false
            }
            
            if (entityType === 'project') {
                // Projects are part of Master Tracker/Project Profitability - block for non-Tatco roles
                return false
            }

            // Allow other entity types (like profit sharing)
            return true
        }
        // Default to enabled if no user found
        return true
    } catch (error) {
        console.error('Error checking notification entity access:', error)
        // Default to enabled on error
        return true
    }
}

/**
 * Check if a notification type is enabled for a user
 * @param {string} userId - User ID to check preferences for
 * @param {string} notificationType - Notification type to check
 * @returns {Promise<boolean>} True if notification is enabled, false otherwise
 */
export async function isNotificationEnabled(userId, notificationType) {
    if (!userId || !notificationType) {
        return true // Default to enabled if missing params
    }

    try {
        const userResult = await FirebaseDbService.users.getById(userId)
        if (userResult.success && userResult.data) {
            const preferences = userResult.data.notificationPreferences
            // If preferences exist, check the specific type
            // If not set, default to true (enabled)
            if (preferences && typeof preferences[notificationType] !== 'undefined') {
                return preferences[notificationType] === true
            }
        }
        // Default to enabled if no preferences found
        return true
    } catch (error) {
        console.error('Error checking notification preferences:', error)
        // Default to enabled on error
        return true
    }
}

/**
 * Helper function to create a notification
 * @param {Object} params - Notification parameters
 * @param {string} params.userId - User ID to notify
 * @param {string} params.type - Notification type (from NOTIFICATION_TYPES)
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {string} params.entityType - Entity type (lead, client, project)
 * @param {string} params.entityId - Entity ID
 * @param {string} params.relatedUserId - User ID who triggered the notification (optional)
 * @param {Object} params.metadata - Additional metadata (optional)
 * @returns {Promise<Object>} Result object with success flag
 */
export async function createNotification({
    userId,
    type,
    title,
    message,
    entityType = null,
    entityId = null,
    relatedUserId = null,
    metadata = {}
}) {
    if (!userId || !type || !title || !message) {
        console.error('Missing required notification parameters', { userId, type, title, message })
        return { success: false, error: 'Missing required parameters' }
    }

    // Check if user should receive notifications for this entity type based on role
    if (entityType) {
        const shouldReceive = await shouldReceiveNotificationForEntity(userId, entityType)
        if (!shouldReceive) {
            return { success: true, skipped: true, reason: 'User role does not have access to this entity type' }
        }
    }

    // Check user preferences before creating notification
    const isEnabled = await isNotificationEnabled(userId, type)
    if (!isEnabled) {
        return { success: true, skipped: true, reason: 'User preference disabled' }
    }

    try {
        const result = await FirebaseDbService.notifications.create({
            userId,
            type,
            title,
            message,
            entityType,
            entityId,
            relatedUserId,
            metadata
        })

        if (!result.success) {
            console.error('Failed to create notification:', result.error, { userId, type, title })
        }

        return result
    } catch (error) {
        console.error('Error creating notification:', error, { userId, type, title })
        return { success: false, error: error.message }
    }
}

/**
 * Create notification for task assignment
 */
export async function notifyTaskAssigned({
    assigneeId,
    taskName,
    entityType,
    entityId,
    assignedBy,
    metadata = {},
    showToast = true
}) {
    const result = await createNotification({
        userId: assigneeId,
        type: NOTIFICATION_TYPES.TASK_ASSIGNED,
        title: 'New Task Assigned',
        message: `You have been assigned to task "${taskName}"`,
        entityType,
        entityId,
        relatedUserId: assignedBy,
        metadata: {
            taskName,
            ...metadata
        }
    })

    // Show toast notification if enabled and notification was created successfully
    if (showToast && result.success && assigneeId === getCurrentUserId()) {
        toast.push(
            React.createElement(
                Notification,
                { type: "info", duration: 4000, title: "New Task Assigned" },
                `You have been assigned to task "${taskName}"`
            )
        )
    }

    return result
}

/**
 * Create notification for task completion
 */
export async function notifyTaskCompleted({
    userId,
    taskName,
    entityType,
    entityId,
    completedBy,
    metadata = {},
    showToast = true
}) {
    const result = await createNotification({
        userId,
        type: NOTIFICATION_TYPES.TASK_COMPLETED,
        title: 'Task Completed',
        message: `Task "${taskName}" has been completed`,
        entityType,
        entityId,
        relatedUserId: completedBy,
        metadata: {
            taskName,
            ...metadata
        }
    })

    // Show toast notification if enabled and notification was created successfully
    if (showToast && result.success && userId === getCurrentUserId()) {
        toast.push(
            React.createElement(
                Notification,
                { type: "success", duration: 3000, title: "Task Completed" },
                `Task "${taskName}" has been completed`
            )
        )
    }

    return result
}

/**
 * Create notification for task update
 */
export async function notifyTaskUpdated({
    assigneeId,
    taskName,
    entityType,
    entityId,
    updatedBy,
    metadata = {},
    showToast = true
}) {
    if (!assigneeId) return { success: false, error: 'Assignee ID required' }
    
    const result = await createNotification({
        userId: assigneeId,
        type: NOTIFICATION_TYPES.TASK_UPDATED,
        title: 'Task Updated',
        message: `Task "${taskName}" has been updated`,
        entityType,
        entityId,
        relatedUserId: updatedBy,
        metadata: {
            taskName,
            ...metadata
        }
    })

    // Show toast notification if enabled and notification was created successfully
    if (showToast && result.success && assigneeId === getCurrentUserId()) {
        toast.push(
            React.createElement(
                Notification,
                { type: "info", duration: 3000, title: "Task Updated" },
                `Task "${taskName}" has been updated`
            )
        )
    }

    return result
}

/**
 * Create notification for entity update
 */
export async function notifyEntityUpdated({
    userIds,
    entityType,
    entityId,
    entityName,
    updatedBy,
    changes = {},
    metadata = {}
}) {
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return { success: false, error: 'User IDs required' }
    }

    // Helper to remove undefined values from object
    const removeUndefined = (obj) => {
        const cleaned = {}
        Object.keys(obj).forEach(key => {
            if (obj[key] !== undefined) {
                if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                    const cleanedNested = removeUndefined(obj[key])
                    if (Object.keys(cleanedNested).length > 0) {
                        cleaned[key] = cleanedNested
                    }
                } else {
                    cleaned[key] = obj[key]
                }
            }
        })
        return cleaned
    }

    const notifications = await Promise.all(
        userIds.map(userId =>
            createNotification({
                userId,
                type: NOTIFICATION_TYPES.ENTITY_UPDATED,
                title: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} Updated`,
                message: `${entityName} has been updated`,
                entityType,
                entityId,
                relatedUserId: updatedBy,
                metadata: removeUndefined({
                    entityName,
                    changes,
                    ...metadata
                })
            })
        )
    )

    return {
        success: notifications.every(n => n.success),
        notifications
    }
}

/**
 * Create notification for status change
 */
export async function notifyStatusChanged({
    userIds,
    entityType,
    entityId,
    entityName,
    oldStatus,
    newStatus,
    changedBy,
    metadata = {}
}) {
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return { success: false, error: 'User IDs required' }
    }

    const notifications = await Promise.all(
        userIds.map(userId =>
            createNotification({
                userId,
                type: NOTIFICATION_TYPES.ENTITY_STATUS_CHANGED,
                title: 'Status Changed',
                message: `${entityName} status changed from ${oldStatus} to ${newStatus}`,
                entityType,
                entityId,
                relatedUserId: changedBy,
                metadata: {
                    entityName,
                    oldStatus,
                    newStatus,
                    ...metadata
                }
            })
        )
    )

    return {
        success: notifications.every(n => n.success),
        notifications
    }
}

/**
 * Create notification for attachment added
 */
export async function notifyAttachmentAdded({
    userIds,
    entityType,
    entityId,
    entityName,
    fileName,
    uploadedBy,
    metadata = {}
}) {
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return { success: false, error: 'User IDs required' }
    }

    const notifications = await Promise.all(
        userIds.map(userId =>
            createNotification({
                userId,
                type: NOTIFICATION_TYPES.ATTACHMENT_ADDED,
                title: 'New Attachment',
                message: `New file "${fileName}" added to ${entityName}`,
                entityType,
                entityId,
                relatedUserId: uploadedBy,
                metadata: {
                    entityName,
                    fileName,
                    ...metadata
                }
            })
        )
    )

    return {
        success: notifications.every(n => n.success),
        notifications
    }
}

/**
 * Get current user ID from auth
 */
export function getCurrentUserId() {
    try {
        const auth = getAuth()
        return auth.currentUser?.uid || null
    } catch (error) {
        console.error('Error getting current user ID:', error)
        return null
    }
}

/**
 * Get users to notify for an entity
 * Fetches members from entity-level members array and all sections
 * @param {string} entityType - Entity type (lead, client, project)
 * @param {string} entityId - Entity ID
 * @returns {Promise<string[]>} Array of user IDs to notify
 */
const getCollectionName = (entityType) => {
    if (entityType === 'warranty') return 'warranties'
    return `${entityType}s`
}

export async function getUsersToNotify(entityType, entityId) {
    if (!entityType || !entityId) {
        return []
    }

    try {
        const memberIds = new Set()
        const collectionName = getCollectionName(entityType)
        
        // First, check for entity-level members (stored directly on the entity document)
        const entityDoc = await getDoc(doc(db, collectionName, entityId))
        if (entityDoc.exists()) {
            const entityData = entityDoc.data()

            // Generic members array (used by projects/leads/clients/etc.)
            if (entityData.members && Array.isArray(entityData.members)) {
                entityData.members.forEach(memberId => {
                    if (memberId) {
                        memberIds.add(memberId)
                    }
                })
            }

            // Warranty-specific membership: assignedTo, cc, createdBy
            if (entityType === 'warranty') {
                if (Array.isArray(entityData.assignedTo)) {
                    entityData.assignedTo.forEach(memberId => {
                        if (memberId) {
                            memberIds.add(memberId)
                        }
                    })
                }

                if (Array.isArray(entityData.cc)) {
                    entityData.cc.forEach(memberId => {
                        if (memberId) {
                            memberIds.add(memberId)
                        }
                    })
                }

                if (entityData.createdBy) {
                    memberIds.add(entityData.createdBy)
                }
            }
        }
        
        // Also get members from all sections (for backward compatibility)
        const sectionsRef = collection(db, collectionName, entityId, 'sections')
        const sectionsSnapshot = await getDocs(sectionsRef)
        
        sectionsSnapshot.forEach(doc => {
            const sectionData = doc.data()
            if (sectionData.members && Array.isArray(sectionData.members)) {
                sectionData.members.forEach(memberId => {
                    if (memberId) {
                        memberIds.add(memberId)
                    }
                })
            }
        })
        
        return Array.from(memberIds)
    } catch (error) {
        console.error('Error getting users to notify:', error)
        return []
    }
}

/**
 * Create notification for entity creation
 */
export async function notifyEntityCreated({
    userIds,
    entityType,
    entityId,
    entityName,
    createdBy,
    metadata = {}
}) {
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return { success: false, error: 'User IDs required' }
    }

    const notifications = await Promise.all(
        userIds.map(userId =>
            createNotification({
                userId,
                type: NOTIFICATION_TYPES.ENTITY_CREATED,
                title: `New ${entityType.charAt(0).toUpperCase() + entityType.slice(1)} Created`,
                message: `${entityName} has been created`,
                entityType,
                entityId,
                relatedUserId: createdBy,
                metadata: {
                    entityName,
                    ...metadata
                }
            })
        )
    )

    return {
        success: notifications.every(n => n.success),
        notifications
    }
}

/**
 * Create notification for entity deletion
 */
export async function notifyEntityDeleted({
    userIds,
    entityType,
    entityId,
    entityName,
    deletedBy,
    metadata = {}
}) {
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return { success: false, error: 'User IDs required' }
    }

    const notifications = await Promise.all(
        userIds.map(userId =>
            createNotification({
                userId,
                type: NOTIFICATION_TYPES.ENTITY_DELETED,
                title: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} Deleted`,
                message: `${entityName} has been deleted`,
                entityType,
                entityId,
                relatedUserId: deletedBy,
                metadata: {
                    entityName,
                    ...metadata
                }
            })
        )
    )

    return {
        success: notifications.every(n => n.success),
        notifications
    }
}

/**
 * Create notification for attachment deletion
 */
export async function notifyAttachmentDeleted({
    userIds,
    entityType,
    entityId,
    entityName,
    fileName,
    deletedBy,
    metadata = {}
}) {
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return { success: false, error: 'User IDs required' }
    }

    const notifications = await Promise.all(
        userIds.map(userId =>
            createNotification({
                userId,
                type: NOTIFICATION_TYPES.ATTACHMENT_DELETED,
                title: 'Attachment Deleted',
                message: `File "${fileName}" has been deleted from ${entityName}`,
                entityType,
                entityId,
                relatedUserId: deletedBy,
                metadata: {
                    entityName,
                    fileName,
                    ...metadata
                }
            })
        )
    )

    return {
        success: notifications.every(n => n.success),
        notifications
    }
}

/**
 * Create notification for activity added
 */
export async function notifyActivityAdded({
    userIds,
    entityType,
    entityId,
    entityName,
    activityMessage,
    activityType,
    createdBy,
    metadata = {}
}) {
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return { success: false, error: 'User IDs required' }
    }

    const notifications = await Promise.all(
        userIds.map(userId =>
            createNotification({
                userId,
                type: NOTIFICATION_TYPES.ACTIVITY_ADDED,
                title: 'New Activity',
                message: activityMessage || `New activity on ${entityName}`,
                entityType,
                entityId,
                relatedUserId: createdBy,
                metadata: {
                    entityName,
                    activityMessage,
                    activityType,
                    ...metadata
                }
            })
        )
    )

    return {
        success: notifications.every(n => n.success),
        notifications
    }
}

/**
 * Create notification for warranty creation
 */
export async function notifyWarrantyCreated({
    warrantyId,
    warrantyName,
    createdBy,
    userIds = []
}) {
    // If userIds not provided, get them from the warranty
    if (userIds.length === 0) {
        userIds = await getUsersToNotify('warranty', warrantyId)
    }

    if (userIds.length === 0) {
        return { success: true, skipped: true, reason: 'No users to notify' }
    }

    const notifications = await Promise.all(
        userIds.map(userId =>
            createNotification({
                userId,
                type: NOTIFICATION_TYPES.WARRANTY_CREATED,
                title: 'New Warranty Created',
                message: `Warranty "${warrantyName}" has been created`,
                entityType: 'warranty',
                entityId: warrantyId,
                relatedUserId: createdBy,
                metadata: {
                    warrantyName
                }
            })
        )
    )

    return {
        success: notifications.every(n => n.success),
        notifications
    }
}

/**
 * Create notification for warranty update
 */
export async function notifyWarrantyUpdated({
    warrantyId,
    warrantyName,
    updatedBy,
    userIds = []
}) {
    // If userIds not provided, get them from the warranty
    if (userIds.length === 0) {
        userIds = await getUsersToNotify('warranty', warrantyId)
    }

    if (userIds.length === 0) {
        return { success: true, skipped: true, reason: 'No users to notify' }
    }

    const notifications = await Promise.all(
        userIds.map(userId =>
            createNotification({
                userId,
                type: NOTIFICATION_TYPES.WARRANTY_UPDATED,
                title: 'Warranty Updated',
                message: `Warranty "${warrantyName}" has been updated`,
                entityType: 'warranty',
                entityId: warrantyId,
                relatedUserId: updatedBy,
                metadata: {
                    warrantyName
                }
            })
        )
    )

    return {
        success: notifications.every(n => n.success),
        notifications
    }
}

/**
 * Create notification for warranty status change
 */
export async function notifyWarrantyStatusChanged({
    warrantyId,
    warrantyName,
    oldStatus,
    newStatus,
    changedBy,
    userIds = []
}) {
    // If userIds not provided, get them from the warranty
    if (userIds.length === 0) {
        userIds = await getUsersToNotify('warranty', warrantyId)
    }

    if (userIds.length === 0) {
        return { success: true, skipped: true, reason: 'No users to notify' }
    }

    const statusLabels = {
        'open': 'Open',
        'completed': 'Completed'
    }

    const notifications = await Promise.all(
        userIds.map(userId =>
            createNotification({
                userId,
                type: NOTIFICATION_TYPES.WARRANTY_STATUS_CHANGED,
                title: 'Warranty Status Changed',
                message: `Warranty "${warrantyName}" status changed from ${statusLabels[oldStatus] || oldStatus} to ${statusLabels[newStatus] || newStatus}`,
                entityType: 'warranty',
                entityId: warrantyId,
                relatedUserId: changedBy,
                metadata: {
                    warrantyName,
                    oldStatus,
                    newStatus
                }
            })
        )
    )

    return {
        success: notifications.every(n => n.success),
        notifications
    }
}

/**
 * Create notification for warranty attachment
 */
export async function notifyWarrantyAttachment({
    warrantyId,
    warrantyName,
    fileName,
    uploadedBy,
    userIds = []
}) {
    // If userIds not provided, get them from the warranty
    if (userIds.length === 0) {
        userIds = await getUsersToNotify('warranty', warrantyId)
    }

    if (userIds.length === 0) {
        return { success: true, skipped: true, reason: 'No users to notify' }
    }

    const notifications = await Promise.all(
        userIds.map(userId =>
            createNotification({
                userId,
                type: NOTIFICATION_TYPES.WARRANTY_ATTACHMENT,
                title: 'Warranty Attachment Added',
                message: `New file "${fileName}" added to warranty "${warrantyName}"`,
                entityType: 'warranty',
                entityId: warrantyId,
                relatedUserId: uploadedBy,
                metadata: {
                    warrantyName,
                    fileName
                }
            })
        )
    )

    return {
        success: notifications.every(n => n.success),
        notifications
    }
}
