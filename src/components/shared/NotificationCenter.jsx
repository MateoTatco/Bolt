import { useState, useEffect, useMemo } from 'react'
import { useNotificationStore } from '@/store/notificationStore'
import { NOTIFICATION_TYPES } from '@/constants/notification.constant'
import NotificationItem from './NotificationItem'
import { Button } from '@/components/ui'
import { HiOutlineCheck, HiOutlineTrash, HiOutlineBell } from 'react-icons/hi'
import classNames from '@/utils/classNames'

const NotificationCenter = ({ onClose }) => {
    const {
        notifications,
        unreadCount,
        loading,
        markAllAsRead,
        deleteAll,
        loadNotifications,
        subscribe,
        unsubscribe: unsubscribeStore
    } = useNotificationStore()

    const [filter, setFilter] = useState('all') // 'all', 'unread', 'tasks', 'entities', 'attachments'
    const [hasMore, setHasMore] = useState(false)
    const [lastDoc, setLastDoc] = useState(null)
    const [loadingMore, setLoadingMore] = useState(false)

    // Load initial notifications and subscribe to real-time updates
    useEffect(() => {
        const loadInitial = async () => {
            const result = await loadNotifications({ limit: 20 })
            if (result?.hasMore) {
                setHasMore(true)
                setLastDoc(result.lastDoc)
            }
        }
        loadInitial()
        const unsubscribe = subscribe()
        return () => {
            if (unsubscribe && typeof unsubscribe === 'function') {
                unsubscribe()
            }
            unsubscribeStore()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // Only run on mount/unmount

    // Handle load more
    const handleLoadMore = async () => {
        if (loadingMore || !hasMore) return
        
        setLoadingMore(true)
        try {
            const result = await loadNotifications({ 
                limit: 20, 
                startAfter: lastDoc 
            })
            if (result?.hasMore) {
                setHasMore(true)
                setLastDoc(result.lastDoc)
            } else {
                setHasMore(false)
            }
        } catch (error) {
            console.error('Error loading more notifications:', error)
        } finally {
            setLoadingMore(false)
        }
    }

    // Filter notifications
    const filteredNotifications = useMemo(() => {
        let filtered = [...notifications]

        // Filter by read status
        if (filter === 'unread') {
            filtered = filtered.filter(n => !n.read)
        }

        // Filter by type
        if (filter === 'tasks') {
            filtered = filtered.filter(n =>
                n.type === NOTIFICATION_TYPES.TASK_ASSIGNED ||
                n.type === NOTIFICATION_TYPES.TASK_COMPLETED ||
                n.type === NOTIFICATION_TYPES.TASK_UPDATED ||
                n.type === NOTIFICATION_TYPES.TASK_DUE_SOON ||
                n.type === NOTIFICATION_TYPES.TASK_OVERDUE
            )
        } else if (filter === 'entities') {
            filtered = filtered.filter(n =>
                n.type === NOTIFICATION_TYPES.ENTITY_CREATED ||
                n.type === NOTIFICATION_TYPES.ENTITY_UPDATED ||
                n.type === NOTIFICATION_TYPES.ENTITY_STATUS_CHANGED ||
                n.type === NOTIFICATION_TYPES.ENTITY_DELETED
            )
        } else if (filter === 'attachments') {
            filtered = filtered.filter(n =>
                n.type === NOTIFICATION_TYPES.ATTACHMENT_ADDED ||
                n.type === NOTIFICATION_TYPES.ATTACHMENT_DELETED
            )
        }

        return filtered
    }, [notifications, filter])

    const handleMarkAllAsRead = async () => {
        await markAllAsRead()
    }

    const handleDeleteAll = async () => {
        if (window.confirm('Are you sure you want to delete all notifications?')) {
            await deleteAll()
        }
    }

    const filterOptions = [
        { value: 'all', label: 'All' },
        { value: 'unread', label: 'Unread' },
        { value: 'tasks', label: 'Tasks' },
        { value: 'entities', label: 'Entities' },
        { value: 'attachments', label: 'Attachments' },
    ]

    return (
        <div className="w-96 max-h-[600px] flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Notifications
                    </h3>
                    {unreadCount > 0 && (
                        <span className="px-2 py-0.5 text-xs font-semibold bg-blue-500 text-white rounded-full">
                            {unreadCount}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                        <Button
                            size="sm"
                            variant="plain"
                            icon={<HiOutlineCheck />}
                            onClick={handleMarkAllAsRead}
                            title="Mark all as read"
                        />
                    )}
                    {notifications.length > 0 && (
                        <Button
                            size="sm"
                            variant="plain"
                            icon={<HiOutlineTrash />}
                            onClick={handleDeleteAll}
                            title="Delete all"
                        />
                    )}
                </div>
            </div>

            {/* Filters */}
            {notifications.length > 0 && (
                <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                    {filterOptions.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => setFilter(option.value)}
                            className={classNames(
                                'px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors',
                                filter === option.value
                                    ? 'bg-primary text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto p-2">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4">
                        <div className="text-gray-400 dark:text-gray-500 mb-2">
                            <HiOutlineBell className="text-4xl" />
                        </div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                            {notifications.length === 0 ? 'No notifications' : 'No notifications match your filter'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                            {notifications.length === 0 
                                ? 'You\'re all caught up!' 
                                : 'Try selecting a different filter'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-2">
                            {filteredNotifications.map((notification) => (
                                <NotificationItem key={notification.id} notification={notification} />
                            ))}
                        </div>
                        {hasMore && filter === 'all' && (
                            <div className="flex justify-center pt-4 pb-2">
                                <Button
                                    size="sm"
                                    variant="twoTone"
                                    onClick={handleLoadMore}
                                    loading={loadingMore}
                                >
                                    Load More
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

export default NotificationCenter

