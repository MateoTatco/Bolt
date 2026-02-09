import { lazy } from 'react'
import authRoute from './authRoute'
import othersRoute from './othersRoute'

// Public routes accessible without authentication
export const publicRoutes = [
    ...authRoute,
    {
        key: 'privacyPolicy',
        path: `/privacy-policy`,
        component: lazy(() => import('@/views/others/PrivacyPolicy')),
        authority: [],
    },
    {
        key: 'termsAndConditions',
        path: `/terms-and-conditions`,
        component: lazy(() => import('@/views/others/TermsAndConditions')),
        authority: [],
    },
]

export const protectedRoutes = [
    {
        key: 'home',
        path: '/home',
        component: lazy(() => import('@/views/Home')),
        authority: [],
    },
    {
        key: 'crm',
        path: '/crm',
        component: lazy(() => import('@/views/CRM')),
        authority: [],
    },
    {
        key: 'leadDetail',
        path: '/leads/:leadId',
        component: lazy(() => import('@/views/LeadDetail')),
        authority: [],
    },
    {
        key: 'clientDetail',
        path: '/clients/:clientId',
        component: lazy(() => import('@/views/ClientDetail')),
        authority: [],
    },
    {
        key: 'projects',
        path: '/projects',
        component: lazy(() => import('@/views/ProjectsList')),
        authority: [],
    },
    {
        key: 'projectDetail',
        path: '/projects/:projectId',
        component: lazy(() => import('@/views/ProjectDetail')),
        authority: [],
    },
    {
        key: 'profile',
        path: '/profile',
        component: lazy(() => import('@/views/Profile')),
        authority: [],
    },
    {
        key: 'projectProfitability',
        path: '/project-profitability',
        component: lazy(() => import('@/views/ProjectProfitability')),
        authority: [],
    },
    {
        key: 'profitSharing',
        path: '/profit-sharing',
        component: lazy(() => import('@/views/ProfitSharing')),
        authority: [],
    },
    {
        key: 'warrantyTracker',
        path: '/warranty-tracker',
        component: lazy(() => import('@/views/WarrantyTracker')),
        authority: [],
    },
    {
        key: 'warrantyDetail',
        path: '/warranty-tracker/:warrantyId',
        component: lazy(() => import('@/views/WarrantyTracker/WarrantyDetail')),
        authority: [],
    },
    {
        key: 'crewTracker',
        path: '/crew-tracker',
        component: lazy(() => import('@/views/CrewTracker')),
        authority: [],
    },
    {
        key: 'crewEmployeeDetail',
        path: '/crew-tracker/employees/:employeeId',
        component: lazy(() => import('@/views/CrewTracker/EmployeeDetail')),
        authority: [],
    },
    {
        key: 'crewJobDetail',
        path: '/crew-tracker/jobs/:jobId',
        component: lazy(() => import('@/views/CrewTracker/JobDetail')),
        authority: [],
    },
    {
        key: 'createProfitPlan',
        path: '/profit-sharing/create-plan',
        component: lazy(() => import('@/views/ProfitSharing/CreateProfitPlan')),
        authority: [],
    },
    {
        key: 'stakeholderDetail',
        path: '/profit-sharing/stakeholders/:stakeholderId',
        component: lazy(() => import('@/views/ProfitSharing/StakeholderDetail')),
        authority: [],
    },
    {
        key: 'advancedFeatures',
        path: '/advanced-features',
        component: lazy(() => import('@/views/AdvancedFeatures')),
        authority: [],
    },
    ...othersRoute,
]
