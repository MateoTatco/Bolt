import { Card } from '@/components/ui'

const StakeholdersTab = () => {
    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-3">
                <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Stakeholders</h2>
            </div>
            
            <Card className="p-6">
                <div className="text-center py-12">
                    <div className="text-gray-400 dark:text-gray-500 text-lg">No stakeholders added yet</div>
                    <div className="text-gray-400 dark:text-gray-500 text-sm mt-2">Add stakeholders to manage their awards and incentives</div>
                </div>
            </Card>
        </div>
    )
}

export default StakeholdersTab

