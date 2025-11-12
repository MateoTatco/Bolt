import {
    NAV_ITEM_TYPE_TITLE,
    NAV_ITEM_TYPE_ITEM,
    NAV_ITEM_TYPE_COLLAPSE,
} from '@/constants/navigation.constant'

const navigationConfig = [
    {
        key: 'home',
        path: '/home',
        title: 'CRM',
        translateKey: 'nav.home',
        icon: 'home',
        type: NAV_ITEM_TYPE_ITEM,
        authority: [],
        subMenu: [],
    },
    {
        key: 'masterTracker',
        path: '/projects',
        title: 'Master Tracker',
        translateKey: 'nav.masterTracker',
        icon: 'masterTracker',
        type: NAV_ITEM_TYPE_ITEM,
        authority: [],
        subMenu: [],
    },
    {
        key: 'projectProfitability',
        path: '/project-profitability',
        title: 'Project Profitability',
        translateKey: 'nav.projectProfitability',
        icon: 'projectProfitability',
        type: NAV_ITEM_TYPE_ITEM,
        authority: [],
        subMenu: [],
    },
    {
        key: 'advancedFeatures',
        path: '/advanced-features',
        title: 'Advanced Features Dashboard',
        translateKey: 'nav.advancedFeatures',
        icon: 'advancedFeatures',
        type: NAV_ITEM_TYPE_ITEM,
        authority: [],
        subMenu: [],
    },
]

export default navigationConfig
