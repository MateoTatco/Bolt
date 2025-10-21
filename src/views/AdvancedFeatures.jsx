import React from 'react'
import { Card } from '@/components/ui'
import AdvancedFeatures from '@/components/AdvancedFeatures'

const AdvancedFeaturesDashboard = () => {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Advanced Features Dashboard</h1>
            </div>
            
            <Card className="p-6">
                <AdvancedFeatures />
            </Card>
        </div>
    )
}

export default AdvancedFeaturesDashboard
