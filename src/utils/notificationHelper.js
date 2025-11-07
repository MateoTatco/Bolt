import React from 'react'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { NOTIFICATION_TYPES, ENTITY_TYPES } from '@/constants/notification.constant'
import { getAuth } from 'firebase/auth'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'

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

    // Check user preferences before creating notification
    const isEnabled = await isNotificationEnabled(userId, type)
    if (!isEnabled) {
        console.log('Notification skipped due to user preferences:', { userId, type, title })
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
        } else {
            console.log('Notification created successfully:', { userId, type, title })
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
                metadata: {
                    entityName,
                    changes,
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
 * This is a placeholder - in the future, this could check entity assignments,
 * watchers, or team members
 */
export function getUsersToNotify(entityType, entityId) {
    // For now, return empty array - this should be implemented based on
    // entity assignments, watchers, or team members
    // TODO: Implement based on entity-specific logic
    return []
}

