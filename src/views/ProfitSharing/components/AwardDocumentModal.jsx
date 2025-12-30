import { useState, useEffect } from 'react'
import { Dialog, Button, Upload, Notification, toast, Tag } from '@/components/ui'
import { HiOutlineTrash, HiOutlineDownload, HiOutlinePencil, HiOutlineCheckCircle } from 'react-icons/hi'
import { db, storage } from '@/configs/firebase.config'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import { convertDocxUrlToHtml } from '@/utils/pdfConverter'
import { useSessionUser } from '@/store/authStore'
import SignatureInput from '@/components/shared/SignatureInput'
import { generateAwardDocumentWithSignature } from '@/services/DocumentGenerationService'
// FirebaseDbService imported dynamically to avoid initialization issues
import React from 'react'

const AwardDocumentModal = ({ isOpen, onClose, award, stakeholderId, onDocumentUpdated, isAdmin = false }) => {
    const currentUser = useSessionUser()
    const [pdfFile, setPdfFile] = useState(null)
    const [pdfUrl, setPdfUrl] = useState(null)
    const [pdfBlob, setPdfBlob] = useState(null) // Store the PDF blob for download
    const [pdfStoragePath, setPdfStoragePath] = useState(null)
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [convertingToHtml, setConvertingToHtml] = useState(false)
    const [htmlContent, setHtmlContent] = useState(null)
    const [showSignatureModal, setShowSignatureModal] = useState(false)
    const [signing, setSigning] = useState(false)

    // Load PDF from award when modal opens or award document changes
    useEffect(() => {
        if (isOpen && award) {
            loadPdf()
        }
    }, [isOpen, award?.id, award?.signedDocumentPdfUrl, award?.signedDocumentDocxUrl, award?.signedDocumentUrl, award?.documentPdfUrl, award?.documentUrl])

    // Close signature modal when main modal closes to prevent React-Modal warnings
    useEffect(() => {
        if (!isOpen) {
            setShowSignatureModal(false)
        }
    }, [isOpen])

    const loadPdf = async () => {
        if (!award || !stakeholderId) return
        
        setLoading(true)
        setHtmlContent(null)
        try {
            // Prefer signed document PDF URL if available, otherwise use regular document URL
            // If signed PDF is missing but signed DOCX exists, we'll convert it
            let pdfUrlToUse = award.signedDocumentPdfUrl || award.signedDocumentDocxUrl || award.signedDocumentUrl || award.documentPdfUrl || award.documentUrl
            let shouldConvertDocx = false
            
            // If we have a signed DOCX but no signed PDF, convert the DOCX
            if ((award.signedDocumentDocxUrl || award.signedDocumentUrl) && !award.signedDocumentPdfUrl) {
                pdfUrlToUse = award.signedDocumentDocxUrl || award.signedDocumentUrl
                shouldConvertDocx = true
            }
            
            
            if (pdfUrlToUse) {
                setPdfStoragePath(award.documentStoragePath || award.documentPdfPath)
                setPdfFile({ name: award.documentFileName || 'award-document.pdf' })
                
                // Check if it's a DOCX file - if so, convert to PDF for viewing
                const isDocx = shouldConvertDocx || pdfUrlToUse.includes('.docx') || pdfUrlToUse.toLowerCase().includes('docx')
                if (isDocx) {
                    setConvertingToHtml(true)
                    try {
                        // Try to convert DOCX to PDF for viewing
                        const { convertDocxUrlToPdf } = await import('@/utils/pdfConverter')
                        const convertedPdfBlob = await convertDocxUrlToPdf(pdfUrlToUse)
                        const pdfViewUrl = URL.createObjectURL(convertedPdfBlob)
                        setPdfUrl(pdfViewUrl)
                        setPdfBlob(convertedPdfBlob) // Store blob for download
                        setHtmlContent(null) // Clear HTML if PDF conversion succeeds
                    } catch (convertError) {
                        console.warn('[AwardDocumentModal] Could not convert DOCX to PDF, using HTML preview:', convertError)
                        // Fall back to HTML preview (no download)
                        try {
                            const html = await convertDocxUrlToHtml(pdfUrlToUse)
                            setHtmlContent(html)
                            setPdfUrl(null) // Don't set PDF URL - we'll show HTML preview
                        } catch (htmlError) {
                            console.warn('[AwardDocumentModal] Could not convert DOCX to HTML either:', htmlError)
                            setPdfUrl(pdfUrlToUse) // Last resort: show download option
                        }
                    } finally {
                        setConvertingToHtml(false)
                    }
                } else {
                    // It's already a PDF - fetch it as blob to prevent auto-download
                    try {
                        // Remove any download parameters from Firebase Storage URL
                        const cleanUrl = pdfUrlToUse.split('?')[0] + '?alt=media'
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
                        
                        // Validate PDF - if it's too small, it's likely corrupted
                        if (pdfBlob.size < 5000) {
                            console.warn(`[AwardDocumentModal] PDF is too small (${pdfBlob.size} bytes), likely corrupted. Checking for DOCX fallback...`)
                            
                            // If we have a signed DOCX, use that instead
                            const signedDocxUrl = award.signedDocumentDocxUrl || award.signedDocumentUrl
                            if (signedDocxUrl) {
                                const { convertDocxUrlToPdf } = await import('@/utils/pdfConverter')
                                const convertedPdfBlob = await convertDocxUrlToPdf(signedDocxUrl)
                                const pdfViewUrl = URL.createObjectURL(convertedPdfBlob)
                                setPdfUrl(pdfViewUrl)
                                setPdfBlob(convertedPdfBlob)
                                setHtmlContent(null)
                                return
                            }
                            
                            throw new Error(`PDF is too small (${pdfBlob.size} bytes), likely corrupted`)
                        }
                        
                        // Validate PDF header
                        const pdfHeaderBlob = pdfBlob.slice(0, 4)
                        const pdfHeaderArrayBuffer = await pdfHeaderBlob.arrayBuffer()
                        const pdfHeader = new TextDecoder().decode(pdfHeaderArrayBuffer)
                        
                        if (!pdfHeader.startsWith('%PDF')) {
                            console.warn(`[AwardDocumentModal] Invalid PDF header: ${pdfHeader}, likely corrupted. Checking for DOCX fallback...`)
                            
                            // If we have a signed DOCX, use that instead
                            const signedDocxUrl = award.signedDocumentDocxUrl || award.signedDocumentUrl
                            if (signedDocxUrl) {
                                const { convertDocxUrlToPdf } = await import('@/utils/pdfConverter')
                                const convertedPdfBlob = await convertDocxUrlToPdf(signedDocxUrl)
                                const pdfViewUrl = URL.createObjectURL(convertedPdfBlob)
                                setPdfUrl(pdfViewUrl)
                                setPdfBlob(convertedPdfBlob)
                                setHtmlContent(null)
                                return
                            }
                            
                            throw new Error(`Invalid PDF header: ${pdfHeader}`)
                        }
                        
                        // Ensure the blob has the correct MIME type
                        // Firebase Storage might return application/octet-stream, so we force it to application/pdf
                        const typedBlob = pdfBlob.type === 'application/pdf' 
                            ? pdfBlob 
                            : new Blob([pdfBlob], { type: 'application/pdf' })
                        
                        const pdfBlobUrl = URL.createObjectURL(typedBlob)
                        setPdfUrl(pdfBlobUrl)
                        setPdfBlob(typedBlob) // Store blob for download
                    } catch (fetchError) {
                        console.warn('[AwardDocumentModal] Could not fetch PDF as blob:', fetchError)
                        
                        // Final fallback: try to use signed DOCX if available
                        const signedDocxUrl = award.signedDocumentDocxUrl || award.signedDocumentUrl
                        if (signedDocxUrl) {
                            try {
                                const { convertDocxUrlToPdf } = await import('@/utils/pdfConverter')
                                const convertedPdfBlob = await convertDocxUrlToPdf(signedDocxUrl)
                                const pdfViewUrl = URL.createObjectURL(convertedPdfBlob)
                                setPdfUrl(pdfViewUrl)
                                setPdfBlob(convertedPdfBlob)
                                setHtmlContent(null)
                            } catch (convertError) {
                                console.error('[AwardDocumentModal] Could not convert DOCX fallback:', convertError)
                                setPdfUrl(pdfUrlToUse) // Last resort
                            }
                        } else {
                            setPdfUrl(pdfUrlToUse) // Last resort
                        }
                    }
                }
            } else {
                setPdfUrl(null)
                setPdfStoragePath(null)
                setPdfFile(null)
            }
        } catch (error) {
            console.error('[AwardDocumentModal] Error loading document:', error)
        } finally {
            setLoading(false)
        }
    }

    // Cleanup blob URL on unmount
    useEffect(() => {
        return () => {
            if (pdfUrl && pdfUrl.startsWith('blob:')) {
                URL.revokeObjectURL(pdfUrl)
            }
        }
    }, [pdfUrl])
    
    // Reset PDF blob when modal closes
    useEffect(() => {
        if (!isOpen) {
            setPdfBlob(null)
        }
    }, [isOpen])

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

    // Helper function to remove undefined values from object (recursive for nested objects)
    const removeUndefined = (obj) => {
        if (obj === null || obj === undefined) return null
        if (Array.isArray(obj)) {
            return obj.map(item => removeUndefined(item))
        }
        if (typeof obj !== 'object') return obj
        
        const cleaned = {}
        Object.keys(obj).forEach(key => {
            if (obj[key] !== undefined) {
                if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                    const cleanedNested = removeUndefined(obj[key])
                    if (Object.keys(cleanedNested).length > 0) {
                        cleaned[key] = cleanedNested
                    }
                } else {
                    cleaned[key] = removeUndefined(obj[key])
                }
            }
        })
        return cleaned
    }

    // Handle document signing
    const handleSignDocument = async (signatureData) => {
        if (!award || !stakeholderId || !currentUser) return
        
        setSigning(true)
        try {
            
            // Import FirebaseDbService once at the beginning to avoid initialization issues
            const { FirebaseDbService } = await import('@/services/FirebaseDbService')
            
            // Use signature text directly (not image) for better PDF compatibility
            const signatureText = signatureData.name || ''
            
            // Get plan and company data for document regeneration
            let planData = null
            let companyData = null
            if (award.planId) {
                const planRef = doc(db, 'profitSharingPlans', award.planId)
                const planSnap = await getDoc(planRef)
                if (planSnap.exists()) {
                    planData = { id: planSnap.id, ...planSnap.data() }
                    
                    if (planData.companyId) {
                        const companyResult = await FirebaseDbService.companies.getById(planData.companyId)
                        if (companyResult.success) {
                            companyData = companyResult.data
                        }
                    }
                }
            }
            
            // Get stakeholder data
            const stakeholderResult = await FirebaseDbService.stakeholders.getById(stakeholderId)
            if (!stakeholderResult.success) {
                throw new Error('Failed to load stakeholder data')
            }
            const stakeholderData = stakeholderResult.data
            
            // Regenerate document with signature text embedded (not image)
            const signedDocumentResult = await generateAwardDocumentWithSignature(
                award,
                planData,
                stakeholderData,
                companyData,
                stakeholderId,
                award.id,
                signatureText // Pass text instead of image
            )
            
            // Update award with signature metadata and signed document
            const stakeholderRef = doc(db, 'stakeholders', stakeholderId)
            const currentData = await FirebaseDbService.stakeholders.getById(stakeholderId)
            const existingAwards = currentData.data.profitAwards || []
            
            // Build the updated award object, ensuring no undefined values
            const updatedAward = {
                ...award,
                signatureUrl: null, // No longer storing signature image
                signatureStoragePath: null, // No longer storing signature image
                // Use DOCX URL explicitly for signed document (not the fallback URL)
                signedDocumentUrl: signedDocumentResult?.docxUrl || signedDocumentResult?.pdfUrl || signedDocumentResult?.url || null,
                signedDocumentPdfUrl: signedDocumentResult?.pdfUrl || null,
                signedDocumentDocxUrl: signedDocumentResult?.docxUrl || null,
                signedDocumentStoragePath: signedDocumentResult?.pdfPath || signedDocumentResult?.path || null,
                signatureMetadata: {
                    signedAt: new Date().toISOString(),
                    signedBy: currentUser.id || currentUser.uid || null,
                    signedByEmail: currentUser.email || null,
                    signedByName: signatureData.name || null
                }
            }
            
            // Clean the updated award to remove any undefined values
            const cleanedAward = removeUndefined(updatedAward)
            
            const updatedAwards = existingAwards.map(a => 
                a.id === award.id ? cleanedAward : a
            )
            
            // Clean all awards before saving
            const cleanedAwards = updatedAwards.map(a => removeUndefined(a))
            
            await updateDoc(stakeholderRef, {
                profitAwards: cleanedAwards,
                updatedAt: serverTimestamp(),
            })
            
            // Directly load the signed document - try PDF first, fallback to HTML preview
            const signedDocxUrl = signedDocumentResult?.docxUrl
            const signedPdfUrl = signedDocumentResult?.pdfUrl
            
            if (signedPdfUrl) {
                // Use PDF if available
                try {
                    const cleanUrl = signedPdfUrl.split('?')[0] + '?alt=media'
                    const response = await fetch(cleanUrl, {
                        method: 'GET',
                        headers: { 'Accept': 'application/pdf' }
                    })
                    const pdfBlob = await response.blob()
                    const pdfBlobUrl = URL.createObjectURL(new Blob([pdfBlob], { type: 'application/pdf' }))
                    setPdfUrl(pdfBlobUrl)
                    setPdfBlob(pdfBlob)
                    setHtmlContent(null)
                } catch (pdfError) {
                    console.warn('[AwardDocumentModal] Could not load signed PDF, trying DOCX:', pdfError)
                    // Fall through to DOCX conversion
                }
            }
            
            if (!pdfUrl && signedDocxUrl) {
                // Convert DOCX to PDF for viewing
                try {
                    const { convertDocxUrlToPdf } = await import('@/utils/pdfConverter')
                    const convertedPdfBlob = await convertDocxUrlToPdf(signedDocxUrl)
                    const pdfViewUrl = URL.createObjectURL(convertedPdfBlob)
                    setPdfUrl(pdfViewUrl)
                    setPdfBlob(convertedPdfBlob)
                    setHtmlContent(null)
                } catch (convertError) {
                    console.warn('[AwardDocumentModal] Could not convert signed DOCX to PDF, using HTML preview:', convertError)
                    // Fall back to HTML preview
                    try {
                        const html = await convertDocxUrlToHtml(signedDocxUrl)
                        setHtmlContent(html)
                        setPdfUrl(null)
                    } catch (htmlError) {
                        console.error('[AwardDocumentModal] Could not convert signed DOCX to HTML either:', htmlError)
                        setPdfUrl(signedDocxUrl) // Last resort
                    }
                }
            }
            
            if (!pdfUrl && !htmlContent && !signedDocxUrl) {
                console.warn('[AwardDocumentModal] No signed document URL available, falling back to loadPdf')
                // Fallback: try to reload from award prop
                if (onDocumentUpdated) {
                    await onDocumentUpdated()
                }
                await new Promise(resolve => setTimeout(resolve, 100))
                await loadPdf()
            }
            
            // Update the award prop by calling onDocumentUpdated (for parent component state)
            if (onDocumentUpdated) {
                await onDocumentUpdated()
            }
            
            // Notify admins
            const { createNotification } = await import('@/utils/notificationHelper')
            const { NOTIFICATION_TYPES } = await import('@/constants/notification.constant')
            // FirebaseDbService already imported at the beginning of handleSignDocument
            
            try {
                // Get all admins (super admins + profit sharing admins)
                const allUsersResult = await FirebaseDbService.users.getAll()
                const allUsers = allUsersResult.success ? allUsersResult.data : []
                
                // Get profit sharing access records to find admins
                const accessResult = await FirebaseDbService.profitSharingAccess.getAll()
                const accessRecords = accessResult.success ? accessResult.data : []
                
                // Find admin user IDs
                const adminUserIds = new Set()
                allUsers.forEach(u => {
                    const email = u.email?.toLowerCase()
                    if (email === 'admin-01@tatco.construction' || email === 'brett@tatco.construction') {
                        adminUserIds.add(u.id)
                    }
                })
                accessRecords.forEach(access => {
                    if (access.role === 'admin') {
                        adminUserIds.add(access.userId)
                    }
                })
                
                // Notify all admins
                await Promise.all(
                    Array.from(adminUserIds).map(adminId =>
                        createNotification({
                            userId: adminId,
                            type: NOTIFICATION_TYPES.PROFIT_SHARING_ADMIN,
                            title: 'Document Signed',
                            message: `${signatureData.name} has signed the award document for ${stakeholderData.name || 'a stakeholder'}.`,
                            entityType: 'profit_sharing',
                            entityId: award.id,
                            relatedUserId: currentUser.id || currentUser.uid,
                            metadata: {
                                stakeholderId: stakeholderId,
                                action: 'document_signed',
                                signerName: signatureData.name
                            }
                        })
                    )
                )
            } catch (notifError) {
                console.warn('[AwardDocumentModal] Failed to send notifications:', notifError)
                // Don't fail the entire signing process if notifications fail
            }
            
            toast.push(
                React.createElement(
                    Notification,
                    { type: "success", duration: 3000 },
                    "Document signed successfully!"
                )
            )
            
            // Call onDocumentUpdated callback
            if (onDocumentUpdated) {
                await onDocumentUpdated()
            }
        } catch (error) {
            console.error('[AwardDocumentModal] Error signing document:', error)
            toast.push(
                React.createElement(
                    Notification,
                    { type: "danger", duration: 3000 },
                    `Failed to sign document: ${error.message}`
                )
            )
        } finally {
            setSigning(false)
        }
    }

    // Early return if award is null (shouldn't happen when isOpen is true, but safety check)
    if (!award && isOpen) {
        return (
            <Dialog
                isOpen={isOpen}
                onClose={onClose}
                width={1200}
            >
                <div className="p-6">
                    <p className="text-gray-600 dark:text-gray-400">No award data available.</p>
                    <Button variant="solid" onClick={onClose} className="mt-4">
                        Close
                    </Button>
                </div>
            </Dialog>
        )
    }

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
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
                <div className="mb-6 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">View Agreement</h2>
                        {/* Signature Status */}
                        {award?.signatureMetadata && (
                            <Tag className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                <HiOutlineCheckCircle className="mr-1" />
                                Signed by {award.signatureMetadata.signedByName || 'User'}
                            </Tag>
                        )}
                    </div>
                </div>

                {/* Upload Section (Admin Only) */}
                {isAdmin && (
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
                )}

                {/* Document Viewer */}
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                {loading || convertingToHtml ? (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-gray-400 dark:text-gray-500">
                            {convertingToHtml ? 'Converting document for viewing...' : 'Loading document...'}
                        </p>
                    </div>
                ) : htmlContent ? (
                    // Show HTML preview for DOCX files
                    <div className="space-y-4 flex flex-col flex-1 min-h-0">
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col flex-1 min-h-0">
                            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Document Preview
                                </p>
                            </div>
                            <div 
                                className="bg-white dark:bg-gray-900 overflow-y-auto overflow-x-hidden flex-1 min-h-0"
                                style={{ maxHeight: '100%' }}
                                dangerouslySetInnerHTML={{ __html: htmlContent }}
                            />
                        </div>
                    </div>
                ) : pdfUrl && !pdfUrl.includes('.docx') ? (
                    // Show PDF in embed/iframe (only for actual PDF files)
                    <div className="space-y-4 flex flex-col flex-1 min-h-0">
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex-1 min-h-0">
                            {pdfUrl.startsWith('blob:') ? (
                                // Use embed for blob URLs to prevent download
                                <embed
                                    src={`${pdfUrl}#toolbar=0`}
                                    type="application/pdf"
                                    className="w-full h-full"
                                    style={{ minHeight: '400px', border: 'none' }}
                                    title="Award Document"
                                />
                            ) : (
                                // Use iframe for regular URLs
                                <iframe
                                    src={`${pdfUrl}#toolbar=0`}
                                    type="application/pdf"
                                    className="w-full h-full"
                                    style={{ minHeight: '400px', border: 'none' }}
                                    title="Award Document"
                                />
                            )}
                        </div>
                    </div>
                ) : pdfUrl ? (
                    // Fallback: DOCX file that couldn't be converted
                    <div className="space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <p className="text-sm text-blue-800 dark:text-blue-300">
                                <strong>Note:</strong> This is a Word document (.docx). Click download to view it.
                            </p>
                        </div>
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
                            <p className="text-gray-600 dark:text-gray-400 mb-4">
                                Document available for download
                            </p>
                            <Button
                                variant="solid"
                                icon={<HiOutlineDownload />}
                                onClick={() => {
                                    const link = document.createElement('a')
                                    link.href = pdfUrl
                                    link.download = pdfFile?.name || 'award-document.docx'
                                    link.target = '_blank'
                                    document.body.appendChild(link)
                                    link.click()
                                    document.body.removeChild(link)
                                }}
                            >
                                Download Document
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                        <p className="text-gray-400 dark:text-gray-500">No document available yet. {isAdmin ? 'Upload a PDF or finalize the award to generate a document.' : 'Document will be available once the award is finalized.'}</p>
                    </div>
                )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 mt-auto">
                    {/* Sign Document Button - Only show for finalized awards without signature */}
                    {award && award?.status === 'Finalized' && 
                     !award?.signatureMetadata && 
                     !award?.signedDocumentPdfUrl && 
                     !award?.signedDocumentDocxUrl && 
                     !award?.signedDocumentUrl && 
                     pdfUrl && (
                        <Button
                            variant="solid"
                            icon={<HiOutlinePencil />}
                            onClick={() => {
                                if (!showSignatureModal) {
                                    setShowSignatureModal(true)
                                }
                            }}
                            loading={signing}
                            disabled={signing || showSignatureModal}
                        >
                            Sign Document
                        </Button>
                    )}
                    {/* Download Button */}
                    {award && (pdfUrl || award.documentPdfUrl || award.documentUrl || award.documentDocxUrl) && (
                        <Button
                            variant="plain"
                            icon={<HiOutlineDownload />}
                            onClick={() => {
                                // Prefer signed document URL if available
                                if (award.signedDocumentPdfUrl || award.signedDocumentUrl) {
                                    const downloadUrl = award.signedDocumentPdfUrl || award.signedDocumentUrl
                                    const link = document.createElement('a')
                                    link.href = downloadUrl
                                    link.download = (award.documentFileName || 'award-document').replace('.docx', '.pdf') || 'award-document.pdf'
                                    link.target = '_blank'
                                    document.body.appendChild(link)
                                    link.click()
                                    document.body.removeChild(link)
                                } else if (award.documentPdfUrl || award.documentUrl) {
                                    // Use PDF URL
                                    const downloadUrl = award.documentPdfUrl || award.documentUrl
                                    const link = document.createElement('a')
                                    link.href = downloadUrl
                                    link.download = (award.documentFileName || 'award-document').replace('.docx', '.pdf') || 'award-document.pdf'
                                    link.target = '_blank'
                                    document.body.appendChild(link)
                                    link.click()
                                    document.body.removeChild(link)
                                } else if (award.documentDocxUrl) {
                                    // Fallback to DOCX
                                    const link = document.createElement('a')
                                    link.href = award.documentDocxUrl
                                    link.download = (award.documentFileName || 'award-document').replace('.pdf', '.docx') || 'award-document.docx'
                                    link.target = '_blank'
                                    document.body.appendChild(link)
                                    link.click()
                                    document.body.removeChild(link)
                                } else if (pdfUrl) {
                                    // Use preview PDF URL
                                    const link = document.createElement('a')
                                    link.href = pdfUrl
                                    link.download = (award.documentFileName || 'award-document').replace('.docx', '.pdf') || 'award-document.pdf'
                                    link.target = '_blank'
                                    document.body.appendChild(link)
                                    link.click()
                                    document.body.removeChild(link)
                                }
                            }}
                        >
                            {award.documentPdfUrl || award.documentUrl || pdfUrl ? 'Download PDF' : 'Download .docx'}
                        </Button>
                    )}
                    <Button
                        variant="solid"
                        onClick={onClose}
                    >
                        Close
                    </Button>
                </div>
            </div>

            {/* Signature Input Modal */}
            <SignatureInput
                isOpen={showSignatureModal}
                onClose={() => setShowSignatureModal(false)}
                onSign={handleSignDocument}
                signerName={currentUser?.name || currentUser?.email || ''}
            />
        </Dialog>
    )
}

export default AwardDocumentModal

