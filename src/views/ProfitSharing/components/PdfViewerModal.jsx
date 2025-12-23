import { useState, useEffect } from 'react'
import { Dialog, Button, Upload, Notification, toast } from '@/components/ui'
import { HiOutlineTrash, HiOutlineDownload } from 'react-icons/hi'
import { db, storage } from '@/configs/firebase.config'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import { convertDocxUrlToHtml } from '@/utils/pdfConverter'

const AGREEMENT_SETTINGS_DOC = 'profitSharing/agreementSettings'

const PdfViewerModal = ({ isOpen, onClose, isAdmin, planDocumentUrl = null }) => {
    const [pdfFile, setPdfFile] = useState(null)
    const [pdfUrl, setPdfUrl] = useState(null)
    const [pdfStoragePath, setPdfStoragePath] = useState(null)
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [convertedPdfBlob, setConvertedPdfBlob] = useState(null)
    const [htmlContent, setHtmlContent] = useState(null)

    // Load PDF from Firestore when modal opens
    useEffect(() => {
        if (isOpen) {
            loadPdf()
        }
    }, [isOpen, planDocumentUrl])

    const loadPdf = async () => {
        setLoading(true)
        try {
            // If planDocumentUrl is provided, use it (for generated plan documents)
            if (planDocumentUrl) {
                // Check if it's a DOCX file - if so, we need to convert or use PDF version
                const isDocx = planDocumentUrl.includes('.docx') || planDocumentUrl.toLowerCase().includes('docx')
                
                if (isDocx) {
                    // Try to convert DOCX to PDF for viewing
                    try {
                        const { convertDocxUrlToPdf } = await import('@/utils/pdfConverter')
                        const pdfBlob = await convertDocxUrlToPdf(planDocumentUrl)
                        const pdfUrl = URL.createObjectURL(pdfBlob)
                        setPdfUrl(pdfUrl)
                        setConvertedPdfBlob(pdfUrl) // Store for cleanup
                        setPdfStoragePath(null)
                    } catch (convertError) {
                        console.warn('Could not convert DOCX to PDF, using HTML preview:', convertError)
                        // Fall back to HTML preview (no download)
                        const { convertDocxUrlToHtml } = await import('@/utils/pdfConverter')
                        try {
                            const htmlContent = await convertDocxUrlToHtml(planDocumentUrl)
                            // Store HTML for preview - we'll show it instead of PDF
                            setPdfUrl(null) // Clear PDF URL
                            setHtmlContent(htmlContent)
                        } catch (htmlError) {
                            console.warn('Could not convert DOCX to HTML either:', htmlError)
                            // Last resort: show message
                            setPdfUrl(null)
                        }
                    }
                } else {
                    // It's already a PDF - fetch it as blob to prevent auto-download
                    try {
                        // Remove any download parameters from Firebase Storage URL
                        const cleanUrl = planDocumentUrl.split('?')[0] + '?alt=media'
                        const response = await fetch(cleanUrl, {
                            method: 'GET',
                            headers: {
                                'Accept': 'application/pdf'
                            }
                        })
                        
                        if (!response.ok) {
                            throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`)
                        }
                        
                        const pdfBlob = await response.blob()
                        
                        // Ensure the blob has the correct MIME type
                        const typedBlob = pdfBlob.type === 'application/pdf' 
                            ? pdfBlob 
                            : new Blob([pdfBlob], { type: 'application/pdf' })
                        
                        const pdfBlobUrl = URL.createObjectURL(typedBlob)
                        setPdfUrl(pdfBlobUrl)
                        setConvertedPdfBlob(pdfBlobUrl) // Store for cleanup
                    } catch (fetchError) {
                        console.warn('[PdfViewerModal] Could not fetch PDF as blob:', fetchError)
                        // Fallback to direct URL
                        setPdfUrl(planDocumentUrl)
                    }
                }
                setPdfStoragePath(null) // We don't have storage path for generated documents
                setLoading(false)
                return
            }

            // Otherwise, try to load from agreement settings (legacy/manual upload)
            const settingsRef = doc(db, AGREEMENT_SETTINGS_DOC)
            const settingsSnap = await getDoc(settingsRef)
            
            if (settingsSnap.exists()) {
                const data = settingsSnap.data()
                if (data.pdfUrl) {
                    setPdfUrl(data.pdfUrl)
                    setPdfStoragePath(data.pdfStoragePath)
                }
            }
        } catch (error) {
            console.error('Error loading PDF:', error)
            toast.push(
                <Notification type="danger" duration={2000}>
                    Failed to load document
                </Notification>
            )
        } finally {
            setLoading(false)
        }
    }

    const ensureSignedIn = async () => {
        const authInstance = getAuth()
        if (authInstance.currentUser) return authInstance.currentUser
        try {
            const enableAnon = import.meta.env.VITE_ENABLE_ANON_SIGNIN === 'true' || import.meta.env.DEV
            if (!enableAnon) return authInstance.currentUser
            await signInAnonymously(authInstance)
            return authInstance.currentUser
        } catch (e) {
            // If sign-in is in-flight, wait for it
            await new Promise((resolve) => {
                const unsub = onAuthStateChanged(authInstance, () => { unsub(); resolve() })
            })
            return authInstance.currentUser
        }
    }

    const handleFileUpload = async (files) => {
        if (!files || files.length === 0) return
        
        const file = files[0]
        if (file.type !== 'application/pdf') {
            toast.push(
                <Notification type="danger" duration={2000}>
                    Please upload a PDF file
                </Notification>
            )
            return
        }

        setUploading(true)
        try {
            // Ensure user is authenticated before uploading
            await ensureSignedIn()
            
            // Upload to Firebase Storage
            const fileName = `agreement-${Date.now()}.pdf`
            const path = `profitSharing/agreement/${fileName}`
            const sRef = storageRef(storage, path)
            
            await uploadBytes(sRef, file)
            const downloadURL = await getDownloadURL(sRef)
            
            // Save to Firestore
            const settingsRef = doc(db, AGREEMENT_SETTINGS_DOC)
            await setDoc(settingsRef, {
                pdfUrl: downloadURL,
                pdfStoragePath: path,
                pdfFileName: file.name,
                pdfUpdatedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }, { merge: true })
            
            setPdfFile(file)
            setPdfUrl(downloadURL)
            setPdfStoragePath(path)
            
            toast.push(
                <Notification type="success" duration={2000}>
                    PDF uploaded successfully
                </Notification>
            )
        } catch (error) {
            console.error('Error uploading PDF:', error)
            toast.push(
                <Notification type="danger" duration={2000}>
                    Failed to upload PDF
                </Notification>
            )
        } finally {
            setUploading(false)
        }
    }

    const handleDelete = async () => {
        if (!pdfStoragePath) return
        
        setDeleting(true)
        try {
            // Delete from Storage
            const sRef = storageRef(storage, pdfStoragePath)
            await deleteObject(sRef)
            
            // Remove from Firestore
            const settingsRef = doc(db, AGREEMENT_SETTINGS_DOC)
            await setDoc(settingsRef, {
                pdfUrl: null,
                pdfStoragePath: null,
                pdfFileName: null,
                pdfUpdatedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }, { merge: true })
            
            setPdfFile(null)
            setPdfUrl(null)
            setPdfStoragePath(null)
            
            toast.push(
                <Notification type="success" duration={2000}>
                    PDF deleted successfully
                </Notification>
            )
        } catch (error) {
            console.error('Error deleting PDF:', error)
            toast.push(
                <Notification type="danger" duration={2000}>
                    Failed to delete PDF
                </Notification>
            )
        } finally {
            setDeleting(false)
        }
    }

    const handleClose = () => {
        // Cleanup blob URL if we created one
        if (convertedPdfBlob) {
            URL.revokeObjectURL(convertedPdfBlob)
            setConvertedPdfBlob(null)
        }
        onClose()
    }

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (convertedPdfBlob) {
                URL.revokeObjectURL(convertedPdfBlob)
            }
        }
    }, [convertedPdfBlob])

    return (
        <Dialog
            isOpen={isOpen}
            onClose={handleClose}
            width={1200}
            style={{ 
                content: { 
                    maxHeight: '95vh',
                    height: '95vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }
            }}
        >
            <div className="p-6 flex flex-col" style={{ maxHeight: 'calc(95vh - 120px)', height: 'calc(95vh - 120px)', overflow: 'hidden' }}>
                {/* Header */}
                <div className="mb-6 flex-shrink-0">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">View Agreement</h2>
                </div>

                {/* Upload Section (Admin Only) */}
                {isAdmin && (
                    <div className="mb-6 flex-shrink-0">
                        {!pdfUrl ? (
                            <Upload
                                accept=".pdf"
                                onChange={handleFileUpload}
                                showList={false}
                                disabled={uploading || loading}
                            >
                                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                                    {uploading ? (
                                        <p className="text-gray-600 dark:text-gray-400">Uploading PDF...</p>
                                    ) : (
                                        <>
                                            <p className="text-gray-600 dark:text-gray-400 mb-2">Upload PDF Agreement</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-500">Click or drag PDF file here</p>
                                        </>
                                    )}
                                </div>
                            </Upload>
                        ) : (
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded flex items-center justify-center">
                                        <span className="text-red-600 dark:text-red-400 font-semibold">PDF</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{pdfFile?.name || 'agreement.pdf'}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">PDF Document</p>
                                    </div>
                                </div>
                                <Button
                                    variant="plain"
                                    size="sm"
                                    icon={<HiOutlineTrash />}
                                    onClick={handleDelete}
                                    loading={deleting}
                                    disabled={deleting}
                                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                >
                                    Delete
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* Document Viewer */}
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                {loading ? (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-gray-400 dark:text-gray-500">Loading document...</p>
                    </div>
                ) : htmlContent ? (
                    // Show HTML preview for DOCX files (when PDF conversion not available)
                    <div className="space-y-4 flex flex-col flex-1 min-h-0">
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col flex-1 min-h-0">
                            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Document Preview
                                </p>
                            </div>
                            <div 
                                className="bg-white dark:bg-gray-900 overflow-auto flex-1 min-h-0"
                                dangerouslySetInnerHTML={{ __html: htmlContent }}
                            />
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg flex-shrink-0">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Preview rendered from Word document. Install jspdf and html2canvas for PDF download.
                            </p>
                            {planDocumentUrl && (
                                <Button
                                    variant="plain"
                                    size="sm"
                                    icon={<HiOutlineDownload />}
                                    onClick={() => {
                                        const link = document.createElement('a')
                                        link.href = planDocumentUrl
                                        link.download = 'plan-document.docx'
                                        link.target = '_blank'
                                        document.body.appendChild(link)
                                        link.click()
                                        document.body.removeChild(link)
                                    }}
                                >
                                    Download .docx
                                </Button>
                            )}
                        </div>
                    </div>
                ) : pdfUrl ? (
                    // Show PDF in iframe (preview only, no auto-download)
                    <div className="space-y-4 flex flex-col flex-1 min-h-0">
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex-1 min-h-0">
                            <iframe
                                src={pdfUrl}
                                className="w-full h-full"
                                style={{ minHeight: '400px' }}
                                title="PDF Agreement"
                            />
                        </div>
                        <div className="flex items-center justify-end p-3 bg-gray-50 dark:bg-gray-800 rounded-lg flex-shrink-0">
                            <Button
                                variant="plain"
                                size="sm"
                                icon={<HiOutlineDownload />}
                                onClick={() => {
                                    const link = document.createElement('a')
                                    link.href = pdfUrl
                                    link.download = 'plan-document.pdf'
                                    link.target = '_blank'
                                    document.body.appendChild(link)
                                    link.click()
                                    document.body.removeChild(link)
                                }}
                            >
                                Download PDF
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                        <p className="text-gray-400 dark:text-gray-500">
                            {planDocumentUrl 
                                ? 'Document is loading...' 
                                : (isAdmin 
                                    ? 'No plan document available. Finalize a profit plan to generate a document.' 
                                    : 'No agreement document available.')}
                        </p>
                    </div>
                )}
                </div>

                {/* Footer */}
                <div className="flex justify-end mt-6 flex-shrink-0">
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

export default PdfViewerModal

