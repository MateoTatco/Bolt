import { useState, useEffect } from 'react'
import { Dialog, Button, Upload, Notification, toast } from '@/components/ui'
import { HiOutlineTrash } from 'react-icons/hi'
import { db, storage } from '@/configs/firebase.config'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import React from 'react'

const AwardDocumentModal = ({ isOpen, onClose, award, stakeholderId, onDocumentUpdated }) => {
    const [pdfFile, setPdfFile] = useState(null)
    const [pdfUrl, setPdfUrl] = useState(null)
    const [pdfStoragePath, setPdfStoragePath] = useState(null)
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [deleting, setDeleting] = useState(false)

    // Load PDF from award when modal opens
    useEffect(() => {
        if (isOpen && award) {
            loadPdf()
        }
    }, [isOpen, award])

    const loadPdf = async () => {
        if (!award || !stakeholderId) return
        
        setLoading(true)
        try {
            if (award.documentUrl) {
                setPdfUrl(award.documentUrl)
                setPdfStoragePath(award.documentStoragePath)
                setPdfFile({ name: award.documentFileName || 'award-document.pdf' })
            } else {
                setPdfUrl(null)
                setPdfStoragePath(null)
                setPdfFile(null)
            }
        } catch (error) {
            console.error('Error loading PDF:', error)
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
                React.createElement(
                    Notification,
                    { type: "danger", duration: 2000 },
                    "Please upload a PDF file"
                )
            )
            return
        }

        setUploading(true)
        try {
            await ensureSignedIn()
            
            const fileName = `award-${stakeholderId}-${award.id}-${Date.now()}.pdf`
            const path = `profitSharing/awards/${stakeholderId}/${award.id}/${fileName}`
            const sRef = storageRef(storage, path)
            
            await uploadBytes(sRef, file)
            const downloadURL = await getDownloadURL(sRef)
            
            // Update award in stakeholder document
            const stakeholderRef = doc(db, 'stakeholders', stakeholderId)
            const stakeholderSnap = await getDoc(stakeholderRef)
            
            if (stakeholderSnap.exists()) {
                const data = stakeholderSnap.data()
                const profitAwards = data.profitAwards || []
                const updatedAwards = profitAwards.map(a => 
                    a.id === award.id 
                        ? { 
                            ...a, 
                            documentUrl: downloadURL,
                            documentStoragePath: path,
                            documentFileName: file.name
                        }
                        : a
                )
                
                await updateDoc(stakeholderRef, {
                    profitAwards: updatedAwards,
                    updatedAt: serverTimestamp(),
                })
                
                setPdfFile(file)
                setPdfUrl(downloadURL)
                setPdfStoragePath(path)
                
                toast.push(
                    React.createElement(
                        Notification,
                        { type: "success", duration: 2000 },
                        "PDF uploaded successfully"
                    )
                )
                
                if (onDocumentUpdated) {
                    onDocumentUpdated()
                }
            }
        } catch (error) {
            console.error('Error uploading PDF:', error)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "danger", duration: 2000 },
                    "Failed to upload PDF"
                )
            )
        } finally {
            setUploading(false)
        }
    }

    const handleDelete = async () => {
        if (!pdfStoragePath || !stakeholderId || !award) return
        
        setDeleting(true)
        try {
            // Delete from Storage
            const sRef = storageRef(storage, pdfStoragePath)
            await deleteObject(sRef)
            
            // Remove from award in stakeholder document
            const stakeholderRef = doc(db, 'stakeholders', stakeholderId)
            const stakeholderSnap = await getDoc(stakeholderRef)
            
            if (stakeholderSnap.exists()) {
                const data = stakeholderSnap.data()
                const profitAwards = data.profitAwards || []
                const updatedAwards = profitAwards.map(a => 
                    a.id === award.id 
                        ? { 
                            ...a, 
                            documentUrl: null,
                            documentStoragePath: null,
                            documentFileName: null
                        }
                        : a
                )
                
                await updateDoc(stakeholderRef, {
                    profitAwards: updatedAwards,
                    updatedAt: serverTimestamp(),
                })
                
                setPdfFile(null)
                setPdfUrl(null)
                setPdfStoragePath(null)
                
                toast.push(
                    React.createElement(
                        Notification,
                        { type: "success", duration: 2000 },
                        "PDF deleted successfully"
                    )
                )
                
                if (onDocumentUpdated) {
                    onDocumentUpdated()
                }
            }
        } catch (error) {
            console.error('Error deleting PDF:', error)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "danger", duration: 2000 },
                    "Failed to delete PDF"
                )
            )
        } finally {
            setDeleting(false)
        }
    }

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            width={900}
        >
            <div className="p-6">
                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">View Agreement</h2>
                </div>

                {/* Upload Section (Admin Only) */}
                <div className="mb-6">
                    {!pdfUrl ? (
                        <Upload
                            draggable
                            fileList={[]}
                            onChange={handleFileUpload}
                            accept=".pdf"
                            uploadLimit={1}
                        >
                            <div className="text-center">
                                <p className="font-semibold text-gray-900 dark:text-white mb-1">
                                    Drop or select file to upload
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Only PDF files are allowed
                                </p>
                            </div>
                        </Upload>
                    ) : (
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded flex items-center justify-center">
                                    <span className="text-red-600 dark:text-red-400 font-semibold">PDF</span>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{pdfFile?.name || 'award-document.pdf'}</p>
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
                            title="Award Document"
                        />
                    </div>
                ) : (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                        <p className="text-gray-400 dark:text-gray-500">No document uploaded yet. Upload a PDF to view the agreement.</p>
                    </div>
                )}

                {/* Footer */}
                <div className="flex justify-end mt-6">
                    <Button
                        variant="solid"
                        onClick={onClose}
                    >
                        Close
                    </Button>
                </div>
            </div>
        </Dialog>
    )
}

export default AwardDocumentModal

