import { useState, useEffect } from 'react'
import { Dialog, Button, Notification, toast } from '@/components/ui'
import { HiOutlineDownload, HiOutlineEye } from 'react-icons/hi'
import { generateDocumentPreview } from '@/services/DocumentGenerationService'
import React from 'react'

const DocumentPreviewModal = ({ isOpen, onClose, templateType, templateData, documentName, existingDocumentUrl, autoGenerate = false }) => {
    const [previewData, setPreviewData] = useState(null)
    const [generating, setGenerating] = useState(false)
    const [error, setError] = useState(null)

    // Auto-generate preview when modal opens if autoGenerate is true
    useEffect(() => {
        if (isOpen && autoGenerate && templateData && !previewData && !generating) {
            handleGeneratePreview()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, autoGenerate])

    // Load existing document if provided
    useEffect(() => {
        if (isOpen && existingDocumentUrl && !previewData) {
            // If we have an existing document URL, we can show it directly
            // For now, we'll still need to generate preview from template
            // But we can indicate that a document already exists
        }
    }, [isOpen, existingDocumentUrl])

    const handleGeneratePreview = async () => {
        if (!templateData) {
            toast.push(
                React.createElement(
                    Notification,
                    { type: "warning", duration: 2000, title: "Warning" },
                    "Please fill in the required fields first"
                )
            )
            return
        }

        setGenerating(true)
        setError(null)
        try {
            // generateDocumentPreview expects the data structure: { planData, companyData } for PLAN or { awardData, planData, stakeholderData, companyData } for AWARD
            // Returns { docxUrl, htmlContent }
            const result = await generateDocumentPreview(templateType, templateData)
            setPreviewData(result)
        } catch (err) {
            console.error('Error generating preview:', err)
            setError(err.message || 'Failed to generate document preview')
            toast.push(
                React.createElement(
                    Notification,
                    { type: "danger", duration: 2000, title: "Error" },
                    `Failed to generate preview: ${err.message || 'Unknown error'}`
                )
            )
        } finally {
            setGenerating(false)
        }
    }

    const handleDownload = () => {
        if (previewData?.docxUrl) {
            const link = document.createElement('a')
            link.href = previewData.docxUrl
            link.download = `${documentName || 'document'}.docx`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        }
    }

    const handleClose = () => {
        // Clean up blob URL
        if (previewData?.docxUrl) {
            URL.revokeObjectURL(previewData.docxUrl)
        }
        setPreviewData(null)
        setError(null)
        setGenerating(false)
        onClose()
    }

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (previewData?.docxUrl) {
                URL.revokeObjectURL(previewData.docxUrl)
            }
        }
    }, [previewData?.docxUrl])

    return (
        <Dialog
            isOpen={isOpen}
            onClose={handleClose}
            width={1000}
        >
            <div className="p-6">
                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        Document Preview
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Preview the generated document before finalizing
                    </p>
                </div>

                {!previewData && !generating && !error && (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                        <HiOutlineEye className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            Click "Generate Preview" to see how the document will look
                        </p>
                        <Button
                            variant="solid"
                            icon={<HiOutlineEye />}
                            onClick={handleGeneratePreview}
                        >
                            Generate Preview
                        </Button>
                    </div>
                )}

                {generating && (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-gray-600 dark:text-gray-400">Generating document preview...</p>
                    </div>
                )}

                {error && (
                    <div className="border border-red-200 dark:border-red-800 rounded-lg p-6 bg-red-50 dark:bg-red-900/20">
                        <p className="text-red-600 dark:text-red-400 font-medium mb-2">Error generating preview</p>
                        <p className="text-sm text-red-500 dark:text-red-500">{error}</p>
                        <Button
                            variant="solid"
                            className="mt-4"
                            onClick={handleGeneratePreview}
                        >
                            Try Again
                        </Button>
                    </div>
                )}

                {previewData && (
                    <div className="space-y-4">
                        {previewData.htmlContent ? (
                            <>
                                {/* HTML Preview */}
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                    <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Document Preview
                                        </p>
                                    </div>
                                    <div 
                                        className="p-6 bg-white dark:bg-gray-900 overflow-y-auto"
                                        style={{ 
                                            fontFamily: 'Times New Roman, serif',
                                            fontSize: '12pt',
                                            lineHeight: '1.5',
                                            maxHeight: 'calc(100vh - 300px)',
                                            minHeight: '400px'
                                        }}
                                        dangerouslySetInnerHTML={{ __html: previewData.htmlContent }}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Preview rendered from Word document. Download the .docx file for the original formatting.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Fallback if HTML conversion failed */}
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                    <p className="text-sm text-blue-800 dark:text-blue-300">
                                        <strong>Note:</strong> Word documents (.docx) cannot be previewed directly in the browser. 
                                        Please download the document to view it in Microsoft Word or another compatible application.
                                    </p>
                                </div>

                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
                                    <div className="mb-4">
                                        <HiOutlineDownload className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500" />
                                    </div>
                                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                                        Document generated successfully
                                    </p>
                                    <Button
                                        variant="solid"
                                        icon={<HiOutlineDownload />}
                                        onClick={handleDownload}
                                    >
                                        Download Document
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="flex justify-end gap-3 mt-6">
                    {previewData && (
                        <Button
                            variant="plain"
                            icon={<HiOutlineDownload />}
                            onClick={handleDownload}
                        >
                            Download .docx
                        </Button>
                    )}
                    <Button
                        variant="solid"
                        onClick={handleClose}
                    >
                        Close
                    </Button>
                </div>
            </div>
        </Dialog>
    )
}

export default DocumentPreviewModal

