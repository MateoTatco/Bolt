import { useState, useEffect } from 'react'
import { Drawer, Select, Input, Button } from '@/components/ui'

const CreateMilestonePanel = ({ isOpen, onClose, onAddMilestone, initialData }) => {
    const [milestoneType, setMilestoneType] = useState(initialData?.type || null) // 'financial' or 'custom'
    const [keyMetric, setKeyMetric] = useState(initialData?.keyMetric || null)
    const [trackAs, setTrackAs] = useState(initialData?.trackAs || null)
    const [customMilestoneType, setCustomMilestoneType] = useState(initialData?.customMilestoneType || null) // 'binary' or 'value'
    const [customTrackAs, setCustomTrackAs] = useState(initialData?.customTrackAs || null)
    const [whatToAchieve, setWhatToAchieve] = useState(initialData?.whatToAchieve || '')

    const milestoneTypeOptions = [
        { value: 'financial', label: 'Financial' },
        { value: 'custom', label: 'Custom' }
    ]

    const keyMetricOptions = [
        { value: 'Gross Revenue', label: 'Gross Revenue' },
        { value: 'Gross Profit', label: 'Gross Profit' },
        { value: 'Net Profit', label: 'Net Profit' },
        { value: 'EBITDA', label: 'EBITDA' },
        { value: 'EBIT', label: 'EBIT' },
        { value: 'Price Per Share', label: 'Price Per Share' }
    ]

    const getAllTrackAsOptions = () => [
        { value: 'Percent (Minimum Growth)', label: 'Percent (Minimum Growth)' },
        { value: 'Percent (Minimum Margin)', label: 'Percent (Minimum Margin)' },
        { value: 'Dollars (Minimum Amount)', label: 'Dollars (Minimum Amount)' }
    ]

    const getTrackAsOptions = () => {
        // If Gross Revenue is selected, exclude "Percent (Minimum Growth)"
        if (keyMetric === 'Gross Revenue') {
            return getAllTrackAsOptions().filter(opt => opt.value !== 'Percent (Minimum Growth)')
        }
        return getAllTrackAsOptions()
    }

    const customMilestoneTypeOptions = [
        { value: 'binary', label: 'Binary-based' },
        { value: 'value', label: 'Value-based' }
    ]

    const customTrackAsOptions = [
        { value: 'Percent', label: 'Percent' },
        { value: 'Dollars', label: 'Dollars' },
        { value: 'Number', label: 'Number' }
    ]

    // Reset state when panel opens/closes or initialData changes
    useEffect(() => {
        if (isOpen) {
            setMilestoneType(initialData?.type || null)
            setKeyMetric(initialData?.keyMetric || null)
            setTrackAs(initialData?.trackAs || null)
            setCustomMilestoneType(initialData?.customMilestoneType || null)
            setCustomTrackAs(initialData?.customTrackAs || null)
            setWhatToAchieve(initialData?.whatToAchieve || '')
        }
    }, [isOpen, initialData])

    const handleAdd = () => {
        let milestoneData = {
            type: milestoneType
        }

        if (milestoneType === 'financial') {
            if (!keyMetric || !trackAs) return
            milestoneData.keyMetric = keyMetric
            milestoneData.trackAs = trackAs
            milestoneData.name = keyMetric
        } else if (milestoneType === 'custom') {
            if (!customMilestoneType || !whatToAchieve) return
            milestoneData.customMilestoneType = customMilestoneType
            milestoneData.whatToAchieve = whatToAchieve
            milestoneData.name = whatToAchieve
            
            if (customMilestoneType === 'value') {
                if (!customTrackAs) return
                milestoneData.customTrackAs = customTrackAs
            }
        }

        onAddMilestone(milestoneData)
    }

    const canAdd = () => {
        if (!milestoneType) return false
        if (milestoneType === 'financial') {
            return keyMetric && trackAs
        } else if (milestoneType === 'custom') {
            if (!customMilestoneType || !whatToAchieve) return false
            if (customMilestoneType === 'value') {
                return customTrackAs !== null
            }
            return true
        }
        return false
    }

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            onRequestClose={onClose}
            placement="right"
            width={600}
            title="Create Milestone"
        >
            <div className="flex flex-col h-full">
                <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                {/* Milestone Type */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        What Type of milestone is this?
                    </label>
                    <Select
                        options={milestoneTypeOptions}
                        value={milestoneTypeOptions.find(opt => opt.value === milestoneType) || null}
                        onChange={(opt) => setMilestoneType(opt?.value || null)}
                        placeholder="Select..."
                    />
                </div>

                {/* Financial Milestone Options */}
                {milestoneType === 'financial' && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Key Metrics
                            </label>
                            <Select
                                options={keyMetricOptions}
                                value={keyMetricOptions.find(opt => opt.value === keyMetric) || null}
                                onChange={(opt) => setKeyMetric(opt?.value || null)}
                                placeholder="Select..."
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Track As
                            </label>
                            <Select
                                options={getTrackAsOptions()}
                                value={getTrackAsOptions().find(opt => opt.value === trackAs) || null}
                                onChange={(opt) => setTrackAs(opt?.value || null)}
                                placeholder="Select..."
                            />
                        </div>
                    </div>
                )}

                {/* Custom Milestone Options */}
                {milestoneType === 'custom' && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                What type of custom milestone is this?
                            </label>
                            <Select
                                options={customMilestoneTypeOptions}
                                value={customMilestoneTypeOptions.find(opt => opt.value === customMilestoneType) || null}
                                onChange={(opt) => setCustomMilestoneType(opt?.value || null)}
                                placeholder="Select..."
                            />
                        </div>

                        {customMilestoneType === 'value' && (
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Track as
                                </label>
                                <Select
                                    options={customTrackAsOptions}
                                    value={customTrackAsOptions.find(opt => opt.value === customTrackAs) || null}
                                    onChange={(opt) => setCustomTrackAs(opt?.value || null)}
                                    placeholder="Select..."
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                What do we want to achieve?
                            </label>
                            <Input
                                value={whatToAchieve}
                                onChange={(e) => setWhatToAchieve(e.target.value)}
                                placeholder={customMilestoneType === 'value' ? 'eg. Number of satisfied customers' : 'eg. complete safety certifications'}
                            />
                        </div>
                    </div>
                )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 dark:border-gray-700 p-6 flex items-center justify-end gap-3">
                    <Button
                        variant="plain"
                        onClick={onClose}
                        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="solid"
                        onClick={handleAdd}
                        disabled={!canAdd()}
                    >
                        Add
                    </Button>
                </div>
            </div>
        </Drawer>
    )
}

export default CreateMilestonePanel

