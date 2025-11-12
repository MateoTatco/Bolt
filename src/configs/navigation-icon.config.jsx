import {
    PiHouseLineDuotone,
    PiArrowsInDuotone,
    PiBookOpenUserDuotone,
    PiBookBookmarkDuotone,
    PiAcornDuotone,
    PiBagSimpleDuotone,
    PiGearDuotone,
    PiClipboardTextDuotone,
    PiCurrencyDollarDuotone,
} from 'react-icons/pi'

const navigationIcon = {
    home: <PiHouseLineDuotone />,
    masterTracker: <PiClipboardTextDuotone />,
    projectProfitability: <PiCurrencyDollarDuotone />,
    singleMenu: <PiAcornDuotone />,
    collapseMenu: <PiArrowsInDuotone />,
    groupSingleMenu: <PiBookOpenUserDuotone />,
    groupCollapseMenu: <PiBookBookmarkDuotone />,
    groupMenu: <PiBagSimpleDuotone />,
    advancedFeatures: <PiGearDuotone />,
}

export default navigationIcon
