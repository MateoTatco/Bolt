import { useState } from 'react'
import { Button, Card } from '@/components/ui'
import { useSessionUser } from '@/store/authStore'
import AgreementSettingsPanel from './components/AgreementSettingsPanel'
import PdfViewerModal from './components/PdfViewerModal'

// Authorized emails that can upload/delete PDFs
const ADMIN_EMAILS = [
    'admin-01@tatco.construction',
    'brett@tatco.construction'
]

const PlansTab = () => {
    const user = useSessionUser((state) => state.user)
    const [showSettingsPanel, setShowSettingsPanel] = useState(false)
    const [showPdfModal, setShowPdfModal] = useState(false)
    const [activeFilter, setActiveFilter] = useState('profit')

    const isAdmin = ADMIN_EMAILS.some(email => email.toLowerCase() === user?.email?.toLowerCase())

    return (
        <>
            <div className="space-y-6">
                {/* Header with buttons */}
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Plans</h2>
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="plain" 
                            size="sm"
                            onClick={() => setShowSettingsPanel(true)}
                            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                        >
                            View plan settings
                        </Button>
                        <Button 
                            variant="solid" 
                            size="sm"
                        >
                            Create
                        </Button>
                    </div>
                </div>

                {/* Filter Tabs - Only Profit */}
                <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
                    <button
                        onClick={() => setActiveFilter('profit')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                            activeFilter === 'profit'
                                ? 'text-gray-900 dark:text-white border-b-2 border-primary'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        Profit
                    </button>
                </div>

                {/* Content Area */}
                <div className="space-y-4">
                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Draft</div>
                    
                    <Card className="p-6">
                        <div className="text-center py-12">
                            <div className="text-gray-400 dark:text-gray-500 text-lg">No plans created yet</div>
                            <div className="text-gray-400 dark:text-gray-500 text-sm mt-2">Create your first profit plan</div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Agreement Settings Side Panel */}
            <AgreementSettingsPanel
                isOpen={showSettingsPanel}
                onClose={() => setShowSettingsPanel(false)}
                onViewAgreement={() => {
                    setShowSettingsPanel(false)
                    setShowPdfModal(true)
                }}
            />

            {/* PDF Viewer Modal */}
            <PdfViewerModal
                isOpen={showPdfModal}
                onClose={() => setShowPdfModal(false)}
                isAdmin={isAdmin}
            />
        </>
    )
}

export default PlansTab

