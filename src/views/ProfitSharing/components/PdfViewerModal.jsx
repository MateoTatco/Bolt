import { useState, useEffect } from 'react'
import { Dialog, Button, Upload, Notification, toast } from '@/components/ui'
import { HiOutlineTrash } from 'react-icons/hi'
import { db, storage } from '@/configs/firebase.config'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'

const AGREEMENT_SETTINGS_DOC = 'profitSharing/agreementSettings'

const PdfViewerModal = ({ isOpen, onClose, isAdmin }) => {
    const [pdfFile, setPdfFile] = useState(null)
    const [pdfUrl, setPdfUrl] = useState(null)
    const [pdfStoragePath, setPdfStoragePath] = useState(null)
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [deleting, setDeleting] = useState(false)

    // Load PDF from Firestore when modal opens
    useEffect(() => {
        if (isOpen) {
            loadPdf()
        }
    }, [isOpen])

    const loadPdf = async () => {
        setLoading(true)
        try {
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
                    Failed to load PDF
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
        onClose()
    }

    return (
        <Dialog
            isOpen={isOpen}
            onClose={handleClose}
            width={900}
        >
            <div className="p-6">
                {/* Header */}
                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">View Agreement</h2>
                </div>

                {/* Upload Section (Admin Only) */}
                {isAdmin && (
                    <div className="mb-6">
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

                {/* PDF Viewer */}
                {loading ? (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                        <p className="text-gray-400 dark:text-gray-500">Loading PDF...</p>
                    </div>
                ) : pdfUrl ? (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <iframe
                            src={pdfUrl}
                            className="w-full h-[600px]"
                            title="PDF Agreement"
                        />
                    </div>
                ) : (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                        <p className="text-gray-400 dark:text-gray-500">
                            {isAdmin ? 'No PDF uploaded yet. Upload a PDF to view the agreement.' : 'No agreement PDF available.'}
                        </p>
                    </div>
                )}

                {/* Footer */}
                <div className="flex justify-end mt-6">
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

