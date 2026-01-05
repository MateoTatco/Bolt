import HorizontalMenuContent from './HorizontalMenuContent'
import { useRouteKeyStore } from '@/store/routeKeyStore'
import { useSessionUser } from '@/store/authStore'
import appConfig from '@/configs/app.config'
import { getNavigationConfig } from '@/configs/navigation.config'
import { useProfitSharingAccessContext } from '@/context/ProfitSharingAccessContext'

const HorizontalNav = ({
    translationSetup = appConfig.activeNavTranslation,
}) => {
    const currentRouteKey = useRouteKeyStore((state) => state.currentRouteKey)

    const user = useSessionUser((state) => state.user)
    const userAuthority = user?.authority || []
    const userEmail = user?.email || ''
    const userRole = user?.role || null
    const { hasAccess: hasProfitSharingAccess } = useProfitSharingAccessContext()
    
    // Filter navigation based on user email, role, and profit sharing access
    // Ensure we always get a valid array
    const filteredNavigationConfig = getNavigationConfig(userEmail, hasProfitSharingAccess, userRole) || []

    return (
        <HorizontalMenuContent
            navigationTree={filteredNavigationConfig}
            routeKey={currentRouteKey}
            userAuthority={userAuthority}
            translationSetup={translationSetup}
        />
    )
}

export default HorizontalNav
