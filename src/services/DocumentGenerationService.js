import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import ImageModule from 'docxtemplater-image-module-free'
import { storage } from '@/configs/firebase.config'
import { ref as storageRef, getBytes, uploadBytes, getDownloadURL } from 'firebase/storage'
import { convertDocxToPdf } from '@/utils/pdfConverter'

/**
 * Document Generation Service
 * Handles generation of Word documents from templates with placeholder replacement
 */

// Template paths in Firebase Storage
const TEMPLATE_PATHS = {
    PLAN: 'profitSharing/templates/Profit Sharing Plan Template.docx',
    AWARD: 'profitSharing/templates/Profit Award Agreement Template.docx'
}

/**
 * Load a template from Firebase Storage
 * @param {string} templateType - 'PLAN' or 'AWARD'
 * @returns {Promise<ArrayBuffer>} Template file as ArrayBuffer
 */
const loadTemplate = async (templateType) => {
    try {
        const templatePath = TEMPLATE_PATHS[templateType]
        if (!templatePath) {
            throw new Error(`Unknown template type: ${templateType}`)
        }

        const templateRef = storageRef(storage, templatePath)
        const templateBytes = await getBytes(templateRef)
        
        // Note: Signature placeholder removed - using timestamps instead
        
        return templateBytes
    } catch (error) {
        console.error(`[DocumentGeneration] Error loading template ${templateType}:`, error)
        throw new Error(`Failed to load template: ${error.message}`)
    }
}

/**
 * Generate a document from a template with data replacement
 * @param {string} templateType - 'PLAN' or 'AWARD'
 * @param {Object} data - Data object with keys matching template placeholders (e.g., {COMPANY NAME}, {START DATE})
 * @returns {Promise<Blob>} Generated document as Blob
 */
export const generateDocument = async (templateType, data) => {
    try {
        // Load template
        const templateBytes = await loadTemplate(templateType)
        
        // Create PizZip instance from template
        const zip = new PizZip(templateBytes)
        
        // Note: Signature placeholder removed - using timestamps instead
        
        // Create Docxtemplater instance (no image module needed - signatures removed)
        const modules = []
        
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            modules: modules.length > 0 ? modules : undefined
        })

        // Replace placeholders in the document
        // Convert data keys to match template format (e.g., {COMPANY NAME} -> COMPANY NAME)
        const templateData = {}
        Object.keys(data).forEach(key => {
            // Handle both {KEY} and KEY formats
            const cleanKey = key.replace(/[{}]/g, '').trim()
            templateData[cleanKey] = data[key] || ''
        })

        try {
            // Render the document with data (new API - render with data directly)
            doc.render(templateData)
        } catch (error) {
            // Handle rendering errors (e.g., missing placeholders)
            console.error('[DocumentGeneration] Document rendering error:', error)
            if (error.properties && error.properties.errors instanceof Array) {
                const errorMessages = error.properties.errors
                    .map((e) => e.properties.explanation)
                    .join(', ')
                throw new Error(`Document rendering failed: ${errorMessages}`)
            }
            throw error
        }

        // Generate the document as a blob
        const blob = doc.getZip().generate({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            compression: 'DEFLATE',
        })

        return blob
    } catch (error) {
        console.error('Error generating document:', error)
        throw error
    }
}

/**
 * Upload generated document to Firebase Storage
 * @param {Blob} documentBlob - Generated document blob
 * @param {string} storagePath - Path in Firebase Storage (e.g., 'profitSharing/plans/{planId}/document.docx')
 * @returns {Promise<{url: string, path: string}>} Document URL and storage path
 */
export const uploadGeneratedDocument = async (documentBlob, storagePath) => {
    try {
        const documentRef = storageRef(storage, storagePath)
        
        // Convert blob to Uint8Array for upload
        const arrayBuffer = await documentBlob.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        
        await uploadBytes(documentRef, uint8Array)
        const downloadURL = await getDownloadURL(documentRef)
        
        return {
            url: downloadURL,
            path: storagePath
        }
    } catch (error) {
        console.error('Error uploading document:', error)
        throw new Error(`Failed to upload document: ${error.message}`)
    }
}

/**
 * Generate and upload a plan document
 * @param {Object} planData - Plan data object
 * @param {Object} companyData - Company data object
 * @param {string} planId - Plan ID for storage path
 * @returns {Promise<{url: string, path: string}>} Document URL and storage path
 */
export const generatePlanDocument = async (planData, companyData, planId) => {
    try {
        // Map plan and company data to template placeholders
        const templateData = mapPlanDataToTemplate(planData, companyData)
        
        // Generate DOCX document
        const docxBlob = await generateDocument('PLAN', templateData)
        
        // Upload DOCX to storage
        const docxFileName = `plan-${planId}-${Date.now()}.docx`
        const docxStoragePath = `profitSharing/plans/${planId}/${docxFileName}`
        const docxResult = await uploadGeneratedDocument(docxBlob, docxStoragePath)
        
        // Convert DOCX to PDF
        let pdfResult = null
        try {
            const pdfBlob = await convertDocxToPdf(docxBlob)
            const pdfFileName = `plan-${planId}-${Date.now()}.pdf`
            const pdfStoragePath = `profitSharing/plans/${planId}/${pdfFileName}`
            pdfResult = await uploadGeneratedDocument(pdfBlob, pdfStoragePath)
        } catch (pdfError) {
            console.warn('Could not generate PDF version:', pdfError)
            // Continue without PDF - DOCX is still available
        }
        
        // Return both DOCX and PDF URLs (PDF preferred for viewing)
        return {
            url: pdfResult?.url || docxResult.url, // Prefer PDF for viewing
            path: pdfResult?.path || docxResult.path,
            docxUrl: docxResult.url,
            docxPath: docxResult.path,
            pdfUrl: pdfResult?.url || null,
            pdfPath: pdfResult?.path || null
        }
    } catch (error) {
        console.error('Error generating plan document:', error)
        throw error
    }
}

/**
 * Generate and upload an award document
 * @param {Object} awardData - Award data object
 * @param {Object} planData - Plan data object
 * @param {Object} stakeholderData - Stakeholder data object
 * @param {Object} companyData - Company data object
 * @param {string} stakeholderId - Stakeholder ID
 * @param {string} awardId - Award ID for storage path
 * @returns {Promise<{url: string, path: string}>} Document URL and storage path
 */
export const generateAwardDocument = async (awardData, planData, stakeholderData, companyData, stakeholderId, awardId) => {
    try {
        // Map award, plan, stakeholder, and company data to template placeholders
        const templateData = mapAwardDataToTemplate(awardData, planData, stakeholderData, companyData)
        
        // Generate document
        const documentBlob = await generateDocument('AWARD', templateData)
        
        // Upload to storage
        const fileName = `award-${stakeholderId}-${awardId}-${Date.now()}.docx`
        const storagePath = `profitSharing/awards/${stakeholderId}/${awardId}/${fileName}`
        
        const docxResult = await uploadGeneratedDocument(documentBlob, storagePath)
        
        // Convert DOCX to PDF
        let pdfResult = null
        try {
            const pdfBlob = await convertDocxToPdf(documentBlob)
            const pdfFileName = `award-${stakeholderId}-${awardId}-${Date.now()}.pdf`
            const pdfStoragePath = `profitSharing/awards/${stakeholderId}/${awardId}/${pdfFileName}`
            pdfResult = await uploadGeneratedDocument(pdfBlob, pdfStoragePath)
        } catch (pdfError) {
            console.warn('Could not generate PDF version:', pdfError)
        }
        
        // Return both DOCX and PDF URLs
        return {
            url: pdfResult?.url || docxResult.url,
            path: pdfResult?.path || docxResult.path,
            docxUrl: docxResult.url,
            docxPath: docxResult.path,
            pdfUrl: pdfResult?.url || null,
            pdfPath: pdfResult?.path || null
        }
    } catch (error) {
        console.error('Error generating award document:', error)
        throw error
    }
}

/**
 * Generate and upload an award document with signature embedded
 * @param {Object} awardData - Award data object
 * @param {Object} planData - Plan data object
 * @param {Object} stakeholderData - Stakeholder data object
 * @param {Object} companyData - Company data object
 * @param {string} stakeholderId - Stakeholder ID
 * @param {string} awardId - Award ID for storage path
 * @param {string} signatureImageDataUrl - Signature image as data URL (base64)
 * @returns {Promise<{url: string, path: string, pdfUrl: string, pdfPath: string, docxUrl: string, docxPath: string}>} Document URLs and storage paths
 */
export const generateAwardDocumentWithSignature = async (awardData, planData, stakeholderData, companyData, stakeholderId, awardId, signatureText) => {
    try {
        // Map award, plan, stakeholder, and company data to template placeholders
        // Note: Signature functionality removed - using timestamps instead
        const templateData = mapAwardDataToTemplate(awardData, planData, stakeholderData, companyData)
        
        // Generate document (signature placeholder removed)
        const documentBlob = await generateDocument('AWARD', templateData)
        
        // Upload signed document to storage
        const fileName = `award-signed-${stakeholderId}-${awardId}-${Date.now()}.docx`
        const storagePath = `profitSharing/awards/${stakeholderId}/${awardId}/${fileName}`
        
        const docxResult = await uploadGeneratedDocument(documentBlob, storagePath)
        
        // Convert DOCX to PDF with signature
        let pdfResult = null
        try {
            const pdfBlob = await convertDocxToPdf(documentBlob)
            
            // Validate PDF size - should be at least 5KB for a valid PDF
            if (pdfBlob.size < 5000) {
                console.error(`[DocumentGeneration] PDF blob is too small (${pdfBlob.size} bytes), conversion likely failed`)
                throw new Error(`PDF blob is too small (${pdfBlob.size} bytes), conversion likely failed`)
            }
            
            // Validate PDF header (should start with %PDF)
            const pdfArrayBuffer = await pdfBlob.slice(0, 4).arrayBuffer()
            const pdfHeader = new TextDecoder().decode(pdfArrayBuffer)
            if (!pdfHeader.startsWith('%PDF')) {
                console.error(`[DocumentGeneration] PDF header invalid: ${pdfHeader}, conversion likely failed`)
                throw new Error(`Invalid PDF header: ${pdfHeader}`)
            }
            
            const pdfFileName = `award-signed-${stakeholderId}-${awardId}-${Date.now()}.pdf`
            const pdfStoragePath = `profitSharing/awards/${stakeholderId}/${awardId}/${pdfFileName}`
            pdfResult = await uploadGeneratedDocument(pdfBlob, pdfStoragePath)
        } catch (pdfError) {
            console.error('[DocumentGeneration] Could not generate PDF version:', pdfError)
            console.error('[DocumentGeneration] PDF conversion error details:', {
                message: pdfError.message,
                stack: pdfError.stack
            })
            // Don't throw - we'll use DOCX URL as fallback and convert on-the-fly when viewing
        }
        
        // Return both DOCX and PDF URLs
        // Only include PDF URL if it was successfully generated (not too small)
        const result = {
            url: pdfResult?.url || docxResult.url,
            path: pdfResult?.path || docxResult.path,
            docxUrl: docxResult.url,
            docxPath: docxResult.path,
            pdfUrl: pdfResult?.url || null, // Will be null if PDF conversion failed
            pdfPath: pdfResult?.path || null
        }
        return result
    } catch (error) {
        console.error('[DocumentGeneration] Error generating signed award document:', error)
        throw error
    }
}

/**
 * Generate document preview (for viewing before finalizing)
 * Returns both DOCX blob URL and HTML content for preview
 * @param {string} templateType - 'PLAN' or 'AWARD'
 * @param {Object} data - For PLAN: { planData, companyData }, For AWARD: { awardData, planData, stakeholderData, companyData }
 * @returns {Promise<{docxUrl: string, htmlContent: string}>} Object with DOCX blob URL and HTML content
 */
export const generateDocumentPreview = async (templateType, data) => {
    try {
        let templateData
        
        if (templateType === 'PLAN') {
            templateData = mapPlanDataToTemplate(data.planData, data.companyData)
        } else if (templateType === 'AWARD') {
            templateData = mapAwardDataToTemplate(data.awardData, data.planData, data.stakeholderData, data.companyData)
        } else {
            throw new Error(`Unknown template type: ${templateType}`)
        }
        
        const documentBlob = await generateDocument(templateType, templateData)
        const docxUrl = URL.createObjectURL(documentBlob)
        
        // Convert DOCX to HTML for preview using mammoth
        let htmlContent = null
        try {
            const mammoth = await import('mammoth')
            const arrayBuffer = await documentBlob.arrayBuffer()
            const result = await mammoth.convertToHtml({ arrayBuffer })
            htmlContent = result.value
        } catch (mammothError) {
            console.warn('Could not convert DOCX to HTML for preview:', mammothError)
            // If mammoth fails, we'll just show the download option
        }
        
        return {
            docxUrl,
            htmlContent
        }
    } catch (error) {
        console.error('Error generating document preview:', error)
        throw error
    }
}

/**
 * Map plan data to template placeholders
 * Based on actual template placeholders: {COMPANY NAME}, {START DATE}
 */
const mapPlanDataToTemplate = (planData, companyData) => {
    const formatDate = (date) => {
        if (!date) return ''
        const d = date instanceof Date ? date : new Date(date)
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    }

    return {
        'COMPANY NAME': companyData?.name || '',
        'START DATE': formatDate(planData?.startDate),
    }
}

/**
 * Format signature name with script font styling
 * Note: For proper script font in Word documents, the template should be modified
 * to apply script font formatting to the {ISSUED BY} and {ACCEPTED BY} placeholders.
 * This function currently returns the name as-is, but can be extended to use Word XML formatting.
 * @param {string} name - Name to format
 * @returns {string} Formatted name (currently returns as-is, template should handle font styling)
 */
const formatSignatureName = (name) => {
    if (!name) return ''
    // TODO: Apply script font using Word XML formatting if docxtemplater supports it
    // For now, the template should be modified in Word to apply script font to these placeholders
    return name
}

/**
 * Map award data to template placeholders
 * Based on actual template placeholders from Profit Award Agreement Template
 */
const mapAwardDataToTemplate = (awardData, planData, stakeholderData, companyData) => {
    const formatDate = (date) => {
        if (!date) return ''
        const d = date instanceof Date ? date : new Date(date)
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    }

    const formatCurrency = (value) => {
        if (!value && value !== 0) return '$0'
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value)
    }

    const formatSchedule = (schedule) => {
        if (!schedule) return ''
        const scheduleMap = {
            'quarterly': 'Quarterly',
            'bi-annually': 'Bi-Annually',
            'annually': 'Annually'
        }
        return scheduleMap[schedule] || schedule
    }

    const formatPaymentTerms = (terms) => {
        if (!terms) return ''
        const termsMap = {
            'within-30-days': 'Within 30 days',
            'within-60-days': 'Within 60 days',
            'installment-payments': 'Installment payments'
        }
        return termsMap[terms] || terms
    }

    // Get employee name from stakeholder
    const employeeName = stakeholderData?.name || 
                         `${stakeholderData?.firstName || ''} ${stakeholderData?.lastName || ''}`.trim() ||
                         'Employee'

    // Format payment dates from plan
    const paymentDates = Array.isArray(planData?.paymentScheduleDates) 
        ? planData.paymentScheduleDates.map(d => formatDate(d)).join(', ')
        : ''

    return {
        'COMPANY NAME': companyData?.name || '',
        'EMPLOYEE NAME': employeeName,
        'AWARD DATE': formatDate(awardData?.awardDate),
        'START DATE': formatDate(awardData?.awardStartDate),
        'END DATE': formatDate(awardData?.awardEndDate),
        'NUMBER OF PROFIT SHARES ISSUED': awardData?.sharesIssued?.toLocaleString() || '0',
        'PROFIT PLAN NAME': planData?.name || 'Profit Plan',
        'SCHEDULE': formatSchedule(planData?.schedule),
        'PAYMENT DATES': paymentDates,
        'PAYMENT TERMS': formatPaymentTerms(planData?.paymentTerms),
        'PROFIT DEFINITION': planData?.profitDescription || '',
        'TRIGGER AMOUNT': formatCurrency(planData?.triggerAmount || planData?.milestoneAmount || 0),
        'TOTAL PROFIT SHARES': planData?.totalShares?.toLocaleString() || '0',
        // Timestamp information (replaces signature)
        // Apply script font to signature names using Word XML formatting
        'ISSUED BY': formatSignatureName(awardData?.issuedBy || ''),
        'ISSUED AT': awardData?.issuedAt ? formatDate(awardData.issuedAt) : '',
        'ACCEPTED BY': formatSignatureName(awardData?.acceptedBy || ''),
        'ACCEPTED AT': awardData?.acceptedAt ? formatDate(awardData.acceptedAt) : '',
    }
}

