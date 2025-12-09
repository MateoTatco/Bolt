import { useState, useEffect } from 'react'
import { Drawer, Input, Button, Tabs, Notification, toast } from '@/components/ui'
import { db } from '@/configs/firebase.config'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

const AGREEMENT_SETTINGS_DOC = 'profitSharing/agreementSettings'

const AgreementSettingsPanel = ({ isOpen, onClose, onViewAgreement }) => {
    const [administratorName, setAdministratorName] = useState('Brett Tatum')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    // Load settings from Firestore when panel opens
    useEffect(() => {
        if (isOpen) {
            loadSettings()
        }
    }, [isOpen])

    const loadSettings = async () => {
        setLoading(true)
        try {
            const settingsRef = doc(db, AGREEMENT_SETTINGS_DOC)
            const settingsSnap = await getDoc(settingsRef)
            
            if (settingsSnap.exists()) {
                const data = settingsSnap.data()
                setAdministratorName(data.administratorName || 'Brett Tatum')
            }
        } catch (error) {
            console.error('Error loading agreement settings:', error)
            toast.push(
                <Notification type="danger" duration={2000}>
                    Failed to load agreement settings
                </Notification>
            )
        } finally {
            setLoading(false)
        }
    }

    const handleFinalize = async () => {
        setSaving(true)
        try {
            const settingsRef = doc(db, AGREEMENT_SETTINGS_DOC)
            await setDoc(settingsRef, {
                administratorName,
                updatedAt: serverTimestamp()
            }, { merge: true })
            
            toast.push(
                <Notification type="success" duration={2000}>
                    Agreement settings saved successfully
                </Notification>
            )
            onClose()
        } catch (error) {
            console.error('Error saving agreement settings:', error)
            toast.push(
                <Notification type="danger" duration={2000}>
                    Failed to save agreement settings
                </Notification>
            )
        } finally {
            setSaving(false)
        }
    }

    const footer = (
        <div className="flex items-center justify-between w-full">
            <Button
                variant="plain"
                onClick={onViewAgreement}
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
                View Agreement
            </Button>
            <Button
                variant="solid"
                onClick={handleFinalize}
                loading={saving}
                disabled={saving || loading}
            >
                Finalize Agreement
            </Button>
        </div>
    )

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            onRequestClose={onClose}
            placement="right"
            width={600}
            title="Agreement Settings"
            footer={footer}
        >
            <div className="space-y-6">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Set administration, pool type and sizes for your all plans.
                </p>

                {/* Tabs - Only Profit */}
                <Tabs value="profit">
                    <Tabs.TabList>
                        <Tabs.TabNav value="profit">Profit</Tabs.TabNav>
                    </Tabs.TabList>
                </Tabs>

                {/* Administration Section */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Administration</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Administrator
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Name of the contact person for the plan, or committee if designated by the board.
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Name of administrator (or committee)
                            </label>
                            <Input
                                value={administratorName}
                                onChange={(e) => setAdministratorName(e.target.value)}
                                placeholder="Enter administrator name"
                                disabled={loading}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </Drawer>
    )
}

export default AgreementSettingsPanel

