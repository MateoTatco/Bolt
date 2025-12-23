import { useState, useEffect } from 'react'
import { Dialog, Button, Input } from '@/components/ui'

const SignatureInput = ({ isOpen, onClose, onSign, signerName = '' }) => {
    const [signature, setSignature] = useState(signerName || '')
    
    // Reset signature when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setSignature(signerName || '')
        } else {
            setSignature('')
        }
    }, [isOpen, signerName])

    const handleSign = () => {
        if (!signature.trim()) {
            return
        }
        onSign({
            name: signature.trim(),
            signedAt: new Date().toISOString()
        })
        setSignature('')
        onClose()
    }

    const handleClose = () => {
        setSignature('')
        onClose()
    }

    return (
        <Dialog
            isOpen={isOpen}
            onClose={handleClose}
            width={600}
        >
            <div className="p-6">
                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        Sign Document
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Enter your name to sign this document. Your signature will be embedded in the PDF.
                    </p>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Your Name
                    </label>
                    <Input
                        value={signature}
                        onChange={(e) => setSignature(e.target.value)}
                        placeholder="Enter your full name"
                    />
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3">
                    <Button
                        variant="plain"
                        onClick={handleClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="solid"
                        onClick={handleSign}
                        disabled={!signature.trim()}
                    >
                        Sign Document
                    </Button>
                </div>
            </div>
        </Dialog>
    )
}

export default SignatureInput

