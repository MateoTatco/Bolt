import { lazy } from 'react'
import { ADMIN, USER } from '@/constants/roles.constant'

const othersRoute = [
    {
        key: 'accessDenied',
        path: `/access-denied`,
        component: lazy(() => import('@/views/others/AccessDenied')),
        authority: [ADMIN, USER],
        meta: {
            pageBackgroundType: 'plain',
            pageContainerType: 'contained',
        },
    },
    // Note: privacy-policy and terms-and-conditions are accessible via publicRoutes
    // for unauthenticated users. Authenticated users can access them through publicRoutes
    // (PublicRoute allows authenticated users to access these pages)
]

export default othersRoute
