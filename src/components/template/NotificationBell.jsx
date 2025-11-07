import { useEffect, useState } from 'react'
import { PiBellDuotone } from 'react-icons/pi'
import withHeaderItem from '@/utils/hoc/withHeaderItem'
import Dropdown from '@/components/ui/Dropdown'
import NotificationCenter from '@/components/shared/NotificationCenter'
import { useNotificationStore } from '@/store/notificationStore'
import { getAuth } from 'firebase/auth'
import classNames from '@/utils/classNames'

const _NotificationBell = ({ className }) => {
    const { unreadCount, loadUnreadCount, subscribe, unsubscribe: unsubscribeStore } = useNotificationStore()
    const [isOpen, setIsOpen] = useState(false)

    // Load unread count and subscribe on mount
    useEffect(() => {
        const auth = getAuth()
        if (auth.currentUser) {
            loadUnreadCount()
            const unsubscribe = subscribe()
            return () => {
                if (unsubscribe && typeof unsubscribe === 'function') {
                    unsubscribe()
                }
                unsubscribeStore()
            }
        }
    }, []) // Empty deps - only run on mount/unmount

    return (
        <Dropdown
            className="flex"
            toggleClassName="flex items-center"
            renderTitle={
                <div className="cursor-pointer flex items-center relative">
                    <PiBellDuotone className={classNames(
                        "text-2xl transition-colors",
                        unreadCount > 0 
                            ? "text-gray-900 dark:text-gray-100" 
                            : "text-gray-700 dark:text-gray-300"
                    )} />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-semibold text-white bg-red-500 rounded-full animate-pulse ring-2 ring-red-200 dark:ring-red-800">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </div>
            }
            placement="bottom-end"
            onOpen={() => setIsOpen(true)}
            onClose={() => setIsOpen(false)}
        >
            <div className="p-0">
                <NotificationCenter />
            </div>
        </Dropdown>
    )
}

const NotificationBell = withHeaderItem(_NotificationBell)

export default NotificationBell

