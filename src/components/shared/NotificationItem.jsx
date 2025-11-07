import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { 
    HiOutlineUserAdd, 
    HiOutlineCheckCircle, 
    HiOutlinePencil, 
    HiOutlineClock, 
    HiOutlineExclamationCircle,
    HiOutlinePlusCircle,
    HiOutlineRefresh,
    HiOutlineTrash,
    HiOutlinePaperClip,
    HiOutlineBell,
    HiOutlineX
} from 'react-icons/hi'
import { NOTIFICATION_TYPES, NOTIFICATION_COLORS } from '@/constants/notification.constant'
import { useNotificationStore } from '@/store/notificationStore'
import classNames from '@/utils/classNames'

const ICON_MAP = {
    [NOTIFICATION_TYPES.TASK_ASSIGNED]: HiOutlineUserAdd,
    [NOTIFICATION_TYPES.TASK_COMPLETED]: HiOutlineCheckCircle,
    [NOTIFICATION_TYPES.TASK_UPDATED]: HiOutlinePencil,
    [NOTIFICATION_TYPES.TASK_DUE_SOON]: HiOutlineClock,
    [NOTIFICATION_TYPES.TASK_OVERDUE]: HiOutlineExclamationCircle,
    [NOTIFICATION_TYPES.ENTITY_CREATED]: HiOutlinePlusCircle,
    [NOTIFICATION_TYPES.ENTITY_UPDATED]: HiOutlinePencil,
    [NOTIFICATION_TYPES.ENTITY_STATUS_CHANGED]: HiOutlineRefresh,
    [NOTIFICATION_TYPES.ENTITY_DELETED]: HiOutlineTrash,
    [NOTIFICATION_TYPES.ATTACHMENT_ADDED]: HiOutlinePaperClip,
    [NOTIFICATION_TYPES.ATTACHMENT_DELETED]: HiOutlineTrash,
    [NOTIFICATION_TYPES.ACTIVITY_ADDED]: HiOutlineClock,
    [NOTIFICATION_TYPES.SYSTEM]: HiOutlineBell,
}

const COLOR_CLASSES = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400',
    gray: 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
    red: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400',
    indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400',
}

const NotificationItem = ({ notification }) => {
    const navigate = useNavigate()
    const { markAsRead, deleteNotification } = useNotificationStore()

    const Icon = useMemo(() => {
        return ICON_MAP[notification.type] || HiOutlineBell
    }, [notification.type])

    const colorClass = useMemo(() => {
        const color = NOTIFICATION_COLORS[notification.type] || 'gray'
        return COLOR_CLASSES[color] || COLOR_CLASSES.gray
    }, [notification.type])

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return ''
        try {
            let date
            if (timestamp?.toDate) {
                date = timestamp.toDate()
            } else if (timestamp?.seconds) {
                date = new Date(timestamp.seconds * 1000)
            } else if (typeof timestamp === 'string') {
                date = new Date(timestamp)
            } else {
                date = new Date(timestamp)
            }

            if (isNaN(date.getTime())) return ''

            const now = new Date()
            const diffMs = now - date
            const diffMins = Math.floor(diffMs / 60000)
            const diffHours = Math.floor(diffMs / 3600000)
            const diffDays = Math.floor(diffMs / 86400000)

            if (diffMins < 1) return 'Just now'
            if (diffMins < 60) return `${diffMins}m ago`
            if (diffHours < 24) return `${diffHours}h ago`
            if (diffDays < 7) return `${diffDays}d ago`
            
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        } catch (error) {
            return ''
        }
    }

    const handleClick = () => {
        // Mark as read when clicked
        if (!notification.read) {
            markAsRead(notification.id)
        }

        // Navigate to related entity if available
        if (notification.entityType && notification.entityId) {
            let path = ''
            if (notification.entityType === 'lead') {
                path = `/leads/${notification.entityId}`
            } else if (notification.entityType === 'client') {
                path = `/clients/${notification.entityId}`
            } else if (notification.entityType === 'project') {
                path = `/projects/${notification.entityId}`
            }

            if (path) {
                navigate(path)
            }
        }
    }

    const handleMarkAsRead = (e) => {
        e.stopPropagation()
        if (!notification.read) {
            markAsRead(notification.id)
        }
    }

    const handleDelete = (e) => {
        e.stopPropagation()
        deleteNotification(notification.id)
    }

    return (
        <div
            className={classNames(
                'flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors',
                notification.read
                    ? 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    : 'bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20 border-l-2 border-blue-500'
            )}
            onClick={handleClick}
        >
            <div className={classNames('flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center', colorClass)}>
                <Icon className="text-lg" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <h4 className={classNames(
                            'text-sm font-semibold mb-1',
                            notification.read ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-white'
                        )}>
                            {notification.title}
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                            {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            {formatTimestamp(notification.createdAt)}
                        </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        {!notification.read && (
                            <button
                                onClick={handleMarkAsRead}
                                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                title="Mark as read"
                            >
                                <HiOutlineCheckCircle className="text-sm text-gray-500 dark:text-gray-400" />
                            </button>
                        )}
                        <button
                            onClick={handleDelete}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            title="Delete"
                        >
                            <HiOutlineX className="text-sm text-gray-500 dark:text-gray-400" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default NotificationItem

