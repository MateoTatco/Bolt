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
    {
        key: 'privacyPolicy',
        path: `/privacy-policy`,
        component: lazy(() => import('@/views/others/PrivacyPolicy')),
        authority: [ADMIN, USER],
        meta: {
            pageBackgroundType: 'plain',
            pageContainerType: 'contained',
        },
    },
    {
        key: 'termsAndConditions',
        path: `/terms-and-conditions`,
        component: lazy(() => import('@/views/others/TermsAndConditions')),
        authority: [ADMIN, USER],
        meta: {
            pageBackgroundType: 'plain',
            pageContainerType: 'contained',
        },
    },
]

export default othersRoute
