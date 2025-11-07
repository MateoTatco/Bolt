import React from 'react'
import { create } from 'zustand'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { getAuth } from 'firebase/auth'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { NOTIFICATION_TYPES } from '@/constants/notification.constant'

export const useNotificationStore = create((set, get) => ({
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null,
    firestoreUnsubscribe: null,

    // Load notifications for current user
    loadNotifications: async (options = {}) => {
        const auth = getAuth()
        const currentUser = auth.currentUser
        if (!currentUser) {
            set({ notifications: [], error: 'User not authenticated' })
            return { success: false, hasMore: false }
        }

        const isInitialLoad = !options.startAfter
        if (isInitialLoad) {
            set({ loading: true, error: null })
        }

        try {
            const result = await FirebaseDbService.notifications.getUserNotifications(
                currentUser.uid,
                options
            )
            if (result.success) {
                if (isInitialLoad) {
                    set({ notifications: result.data, loading: false })
                } else {
                    // Append to existing notifications
                    set((state) => ({
                        notifications: [...state.notifications, ...result.data],
                        loading: false
                    }))
                }
                return {
                    success: true,
                    hasMore: result.hasMore || false,
                    lastDoc: result.lastDoc || null
                }
            } else {
                set({ error: result.error, loading: false })
                return { success: false, hasMore: false }
            }
        } catch (error) {
            set({ error: error.message, loading: false })
            return { success: false, hasMore: false }
        }
    },

    // Load unread count
    loadUnreadCount: async () => {
        const auth = getAuth()
        const currentUser = auth.currentUser
        if (!currentUser) {
            set({ unreadCount: 0 })
            return
        }

        try {
            const result = await FirebaseDbService.notifications.getUnreadCount(currentUser.uid)
            if (result.success) {
                set({ unreadCount: result.count })
            } else {
                set({ unreadCount: 0 })
            }
        } catch (error) {
            console.error('Error loading unread count:', error)
            set({ unreadCount: 0 })
        }
    },

    // Subscribe to real-time notifications
    subscribe: () => {
        const auth = getAuth()
        const currentUser = auth.currentUser
        if (!currentUser) {
            return () => {} // Return empty function if no user
        }

        // Unsubscribe from previous listener if exists
        const currentUnsubscribe = get().firestoreUnsubscribe
        if (currentUnsubscribe && typeof currentUnsubscribe === 'function') {
            currentUnsubscribe()
        }

        try {
            let previousNotificationIds = new Set()
            
            const unsubscribeFn = FirebaseDbService.notifications.subscribe(
                currentUser.uid,
                (notifications) => {
                    // Get current notification IDs
                    const currentNotificationIds = new Set(notifications.map(n => n.id))
                    
                    // Find new notifications (not in previous set)
                    const newNotifications = notifications.filter(
                        n => !previousNotificationIds.has(n.id) && !n.read
                    )
                    
                    // Show toast for new important notifications
                    newNotifications.forEach(notification => {
                        // Only show toast for certain notification types
                        const showToastTypes = [
                            NOTIFICATION_TYPES.TASK_ASSIGNED,
                            NOTIFICATION_TYPES.TASK_DUE_SOON,
                            NOTIFICATION_TYPES.TASK_OVERDUE,
                            NOTIFICATION_TYPES.ENTITY_STATUS_CHANGED
                        ]
                        
                        if (showToastTypes.includes(notification.type)) {
                            const notificationType = 
                                notification.type === NOTIFICATION_TYPES.TASK_ASSIGNED ? 'info' :
                                notification.type === NOTIFICATION_TYPES.TASK_OVERDUE ? 'danger' :
                                notification.type === NOTIFICATION_TYPES.TASK_DUE_SOON ? 'warning' :
                                'info'
                            
                            toast.push(
                                React.createElement(
                                    Notification,
                                    {
                                        type: notificationType,
                                        duration: 4000,
                                        title: notification.title
                                    },
                                    notification.message
                                )
                            )
                        }
                    })
                    
                    // Update previous notification IDs
                    previousNotificationIds = currentNotificationIds
                    
                    set({ notifications })
                    // Update unread count
                    const unreadCount = notifications.filter(n => !n.read).length
                    set({ unreadCount })
                },
                { limit: 50 }
            )

            set({ firestoreUnsubscribe: unsubscribeFn })
            return unsubscribeFn
        } catch (error) {
            console.error('Error subscribing to notifications:', error)
            return () => {} // Return empty function on error
        }
    },

    // Unsubscribe from notifications
    unsubscribe: () => {
        const firestoreUnsubscribe = get().firestoreUnsubscribe
        if (firestoreUnsubscribe && typeof firestoreUnsubscribe === 'function') {
            firestoreUnsubscribe()
            set({ firestoreUnsubscribe: null })
        }
    },

    // Mark notification as read
    markAsRead: async (notificationId) => {
        try {
            const result = await FirebaseDbService.notifications.markAsRead(notificationId)
            if (result.success) {
                set((state) => ({
                    notifications: state.notifications.map(n =>
                        n.id === notificationId ? { ...n, read: true } : n
                    ),
                    unreadCount: Math.max(0, state.unreadCount - 1)
                }))
            }
            return result
        } catch (error) {
            console.error('Error marking notification as read:', error)
            return { success: false, error: error.message }
        }
    },

    // Mark all notifications as read
    markAllAsRead: async () => {
        const auth = getAuth()
        const currentUser = auth.currentUser
        if (!currentUser) {
            return { success: false, error: 'User not authenticated' }
        }

        try {
            const result = await FirebaseDbService.notifications.markAllAsRead(currentUser.uid)
            if (result.success) {
                set((state) => ({
                    notifications: state.notifications.map(n => ({ ...n, read: true })),
                    unreadCount: 0
                }))
            }
            return result
        } catch (error) {
            console.error('Error marking all as read:', error)
            return { success: false, error: error.message }
        }
    },

    // Delete notification
    deleteNotification: async (notificationId) => {
        try {
            const result = await FirebaseDbService.notifications.delete(notificationId)
            if (result.success) {
                set((state) => {
                    const notification = state.notifications.find(n => n.id === notificationId)
                    const wasUnread = notification && !notification.read
                    return {
                        notifications: state.notifications.filter(n => n.id !== notificationId),
                        unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
                    }
                })
            }
            return result
        } catch (error) {
            console.error('Error deleting notification:', error)
            return { success: false, error: error.message }
        }
    },

    // Delete all notifications
    deleteAll: async () => {
        const auth = getAuth()
        const currentUser = auth.currentUser
        if (!currentUser) {
            return { success: false, error: 'User not authenticated' }
        }

        try {
            const result = await FirebaseDbService.notifications.deleteAll(currentUser.uid)
            if (result.success) {
                set({ notifications: [], unreadCount: 0 })
            }
            return result
        } catch (error) {
            console.error('Error deleting all notifications:', error)
            return { success: false, error: error.message }
        }
    },

    // Reset store
    reset: () => {
        const firestoreUnsubscribe = get().firestoreUnsubscribe
        if (firestoreUnsubscribe && typeof firestoreUnsubscribe === 'function') {
            firestoreUnsubscribe()
        }
        set({
            notifications: [],
            unreadCount: 0,
            loading: false,
            error: null,
            firestoreUnsubscribe: null
        })
    }
}))

