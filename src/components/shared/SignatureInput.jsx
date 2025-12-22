import { useState, useEffect } from 'react'
import { Dialog, Button, Input } from '@/components/ui'

const SignatureInput = ({ isOpen, onClose, onSign, signerName = '' }) => {
    const [signature, setSignature] = useState(signerName || '')
    const [fontFamily, setFontFamily] = useState('Dancing Script') // Elegant cursive font
    const [fontSize, setFontSize] = useState(36) // Reduced from 48 to match document text size
    
    // Reset signature when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setSignature(signerName || '')
        } else {
            setSignature('')
        }
    }, [isOpen, signerName])
    
    // Debug: Log font changes
    useEffect(() => {
        console.log('[SignatureInput] Font family changed:', fontFamily)
    }, [fontFamily])
    
    useEffect(() => {
        console.log('[SignatureInput] Font size changed:', fontSize)
    }, [fontSize])
    
    // Debug: Log when signature preview should update
    useEffect(() => {
        if (signature) {
            console.log('[SignatureInput] Signature preview update:', { signature, fontFamily, fontSize })
        }
    }, [signature, fontFamily, fontSize])

    const handleSign = () => {
        if (!signature.trim()) {
            return
        }
        onSign({
            name: signature.trim(),
            fontFamily,
            fontSize,
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
                        className="mb-4"
                    />
                </div>

                {/* Signature Preview */}
                {signature && (
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Signature Preview
                        </label>
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 bg-white dark:bg-gray-800">
                            <div
                                key={`preview-${fontFamily}-${fontSize}-${signature}`} // Force re-render when font or signature changes
                                style={{
                                    fontFamily: `"${fontFamily}", cursive`,
                                    fontSize: `${fontSize}px`,
                                    color: '#1f2937',
                                    textAlign: 'center',
                                    lineHeight: '1.2',
                                    minHeight: '60px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                {signature}
                            </div>
                        </div>
                    </div>
                )}

                {/* Font Options */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Signature Style
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                Font Family
                            </label>
                            <select
                                value={fontFamily}
                                onChange={(e) => {
                                    const newFont = e.target.value
                                    console.log('[SignatureInput] Font select changed:', { oldFont: fontFamily, newFont })
                                    setFontFamily(newFont)
                                }}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            >
                                <option value="Dancing Script">Dancing Script (Elegant)</option>
                                <option value="Great Vibes">Great Vibes (Formal)</option>
                                <option value="Allura">Allura (Classic)</option>
                                <option value="Brush Script MT">Brush Script MT (Traditional)</option>
                                <option value="Lucida Handwriting">Lucida Handwriting (Cursive)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                Font Size
                            </label>
                            <input
                                type="range"
                                min="28"
                                max="48"
                                value={fontSize}
                                onChange={(e) => setFontSize(parseInt(e.target.value))}
                                className="w-full"
                            />
                            <div className="text-xs text-gray-500 text-center mt-1">{fontSize}px</div>
                        </div>
                    </div>
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

