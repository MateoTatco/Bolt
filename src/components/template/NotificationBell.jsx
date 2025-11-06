import { PiBellDuotone } from 'react-icons/pi'
import withHeaderItem from '@/utils/hoc/withHeaderItem'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'

const _NotificationBell = ({ className }) => {
    const handleClick = () => {
        toast.push(
            <Notification type="info" duration={3000} title="Coming Soon">
                Notifications feature will be available soon!
            </Notification>
        )
    }

    return (
        <button
            onClick={handleClick}
            className={`cursor-pointer flex items-center justify-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${className || ''}`}
            aria-label="Notifications"
        >
            <PiBellDuotone className="text-2xl text-gray-700 dark:text-gray-300" />
        </button>
    )
}

const NotificationBell = withHeaderItem(_NotificationBell)

export default NotificationBell

