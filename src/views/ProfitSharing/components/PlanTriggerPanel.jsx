import { useState, useEffect } from 'react'
import { Drawer, Select, Input, Button, Switcher } from '@/components/ui'
import { HiOutlineCurrencyDollar } from 'react-icons/hi'

const formatCurrencyInput = (value) => {
    // Remove all non-numeric characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, '')
    if (!numericValue) return ''
    const num = parseFloat(numericValue)
    if (isNaN(num)) return ''
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const PlanTriggerPanel = ({ isOpen, onClose, onSetTrigger, initialData, title = 'Plan Trigger', buttonText = 'Set Plan Trigger' }) => {
    const [typeOfTrigger, setTypeOfTrigger] = useState(initialData?.type || null)
    const [trackAs, setTrackAs] = useState(initialData?.trackAs || 'dollars')
    const [differentTargetsPerPeriod, setDifferentTargetsPerPeriod] = useState(initialData?.differentTargetsPerPeriod || false)
    const [dollarAmount, setDollarAmount] = useState(initialData?.amount ? formatCurrencyInput(String(initialData.amount)) : '')

    // Reset state when panel opens/closes or initialData changes
    useEffect(() => {
        if (isOpen) {
            setTypeOfTrigger(initialData?.type || null)
            setTrackAs(initialData?.trackAs || 'dollars')
            setDifferentTargetsPerPeriod(initialData?.differentTargetsPerPeriod || false)
            setDollarAmount(initialData?.amount ? formatCurrencyInput(String(initialData.amount)) : '')
        }
    }, [isOpen, initialData])

    const triggerTypeOptions = [
        { value: 'Gross Revenue', label: 'Gross Revenue' },
        { value: 'Gross Profit', label: 'Gross Profit' },
        { value: 'Net Profit', label: 'Net Profit' },
        { value: 'EBITDA', label: 'EBITDA' },
        { value: 'EBIT', label: 'EBIT' }
    ]

    const trackAsOptions = [
        { value: 'dollars', label: 'Dollars' }
    ]

    const handleDollarAmountChange = (e) => {
        const formatted = formatCurrencyInput(e.target.value)
        setDollarAmount(formatted)
    }

    const handleSetTrigger = () => {
        if (!typeOfTrigger || !dollarAmount) {
            return
        }

        const amount = parseFloat(dollarAmount.replace(/,/g, ''))
        onSetTrigger({
            type: typeOfTrigger,
            trackAs,
            differentTargetsPerPeriod,
            amount
        })
    }

    const canSetTrigger = typeOfTrigger && dollarAmount

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            onRequestClose={onClose}
            placement="right"
            width={600}
            title={title}
        >
            <div className="flex flex-col h-full">
                <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                {/* Type of trigger and Track as dropdowns */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Type of trigger
                        </label>
                        <Select
                            options={triggerTypeOptions}
                            value={triggerTypeOptions.find(opt => opt.value === typeOfTrigger) || null}
                            onChange={(opt) => setTypeOfTrigger(opt?.value || null)}
                            placeholder="Select..."
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Track as
                        </label>
                        <Select
                            options={trackAsOptions}
                            value={trackAsOptions.find(opt => opt.value === trackAs) || null}
                            onChange={(opt) => setTrackAs(opt?.value || 'dollars')}
                            placeholder="Select..."
                        />
                    </div>
                </div>

                {/* Toggle */}
                <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Trigger
                    </label>
                    <div className="flex items-center gap-3">
                        <Switcher
                            checked={differentTargetsPerPeriod}
                            onChange={(checked) => setDifferentTargetsPerPeriod(checked)}
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                            I want to set different targets for each period.
                        </span>
                    </div>
                </div>

                {/* Dollar amount field */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Dollar amount
                    </label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">
                            <HiOutlineCurrencyDollar className="w-5 h-5" />
                        </span>
                        <Input
                            value={dollarAmount}
                            onChange={handleDollarAmountChange}
                            placeholder="0"
                            className="pl-10"
                        />
                    </div>
                </div>
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
                        onClick={handleSetTrigger}
                        disabled={!canSetTrigger}
                    >
                        {buttonText}
                    </Button>
                </div>
            </div>
        </Drawer>
    )
}

export default PlanTriggerPanel

