import HorizontalMenuContent from './HorizontalMenuContent'
import { useRouteKeyStore } from '@/store/routeKeyStore'
import { useSessionUser } from '@/store/authStore'
import appConfig from '@/configs/app.config'
import { getNavigationConfig } from '@/configs/navigation.config'

const HorizontalNav = ({
    translationSetup = appConfig.activeNavTranslation,
}) => {
    const currentRouteKey = useRouteKeyStore((state) => state.currentRouteKey)

    const user = useSessionUser((state) => state.user)
    const userAuthority = user?.authority || []
    const userEmail = user?.email || ''
    
    // Filter navigation based on user email
    const filteredNavigationConfig = getNavigationConfig(userEmail)

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
