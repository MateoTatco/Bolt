import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import ImageModule from 'docxtemplater-image-module-free'
import { storage } from '@/configs/firebase.config'
import { ref as storageRef, getBytes, uploadBytes, getDownloadURL, listAll } from 'firebase/storage'
import { getFunctions, httpsCallable } from 'firebase/functions'

/**
 * Document Generation Service
 * Handles generation of Word documents from templates with placeholder replacement
 */

// Template paths in Firebase Storage
const TEMPLATE_PATHS = {
    PLAN: 'profitSharing/templates/Profit Sharing Plan Template.docx',
    AWARD: 'profitSharing/templates/Profit Award Agreement Template.docx'
}

// Alternative template file names to try (case variations, common naming patterns)
const ALTERNATIVE_TEMPLATE_NAMES = {
    PLAN: [
        'profitSharing/templates/Profit Sharing Plan Template.docx',
        'profitSharing/templates/profit sharing plan template.docx',
        'profitSharing/templates/Profit-Sharing-Plan-Template.docx',
        'profitSharing/templates/ProfitSharingPlanTemplate.docx',
        'profitSharing/templates/Plan Template.docx',
        'profitSharing/templates/plan-template.docx'
    ],
    AWARD: [
        'profitSharing/templates/Profit Award Agreement Template.docx',
        'profitSharing/templates/profit award agreement template.docx',
        'profitSharing/templates/Profit-Award-Agreement-Template.docx',
        'profitSharing/templates/ProfitAwardAgreementTemplate.docx',
        'profitSharing/templates/Award Agreement Template.docx',
        'profitSharing/templates/award-agreement-template.docx',
        'profitSharing/templates/Award Template.docx',
        'profitSharing/templates/award-template.docx'
    ]
}

// Initialize Firebase Functions
const functions = getFunctions()
const convertDocxToPdfFunction = httpsCallable(functions, 'convertDocxToPdf')

/**
 * Load a template from Firebase Storage
 * Tries the primary path first, then alternative paths if the primary fails
 * @param {string} templateType - 'PLAN' or 'AWARD'
 * @returns {Promise<ArrayBuffer>} Template file as ArrayBuffer
 */
const loadTemplate = async (templateType) => {
    if (!TEMPLATE_PATHS[templateType]) {
        throw new Error(`Unknown template type: ${templateType}. Expected 'PLAN' or 'AWARD'.`)
    }

    // Get all paths to try (primary + alternatives)
    const pathsToTry = ALTERNATIVE_TEMPLATE_NAMES[templateType] || [TEMPLATE_PATHS[templateType]]
    const errors = []

    // Try each path until one succeeds
    for (const templatePath of pathsToTry) {
        try {
            console.log(`[DocumentGeneration] Attempting to load template from: ${templatePath}`)
            const templateRef = storageRef(storage, templatePath)
            const templateBytes = await getBytes(templateRef)
            
            if (!templateBytes || templateBytes.byteLength === 0) {
                throw new Error(`Template file is empty: ${templatePath}`)
            }
            
            console.log(`[DocumentGeneration] Template loaded successfully from: ${templatePath}, size: ${templateBytes.byteLength} bytes`)
            return templateBytes
        } catch (error) {
            // Store error but continue trying other paths
            errors.push({ path: templatePath, error: error.message })
            console.warn(`[DocumentGeneration] Failed to load from ${templatePath}:`, error.message)
            continue
        }
    }

    // If all paths failed, try to list existing files in the templates directory to help diagnose
    let existingFiles = []
    try {
        const templatesDirRef = storageRef(storage, 'profitSharing/templates/')
        const listResult = await listAll(templatesDirRef)
        existingFiles = listResult.items.map(item => item.name)
    } catch (listError) {
        console.warn('[DocumentGeneration] Could not list files in templates directory:', listError)
    }

    // Build error message
    const primaryPath = TEMPLATE_PATHS[templateType]
    const expectedFileName = templateType === 'PLAN' ? 'Profit Sharing Plan Template.docx' : 'Profit Award Agreement Template.docx'
    
    let errorMessage = `The ${templateType} template file is missing from Firebase Storage.\n\n`
    errorMessage += `Expected file: ${expectedFileName}\n`
    errorMessage += `Expected path: ${primaryPath}\n\n`
    
    if (existingFiles.length > 0) {
        errorMessage += `Found ${existingFiles.length} file(s) in templates directory:\n`
        existingFiles.forEach(file => {
            errorMessage += `  - ${file}\n`
        })
        errorMessage += `\n`
    } else {
        errorMessage += `No files found in the templates directory (profitSharing/templates/).\n\n`
    }
    
    errorMessage += `To fix this:\n`
    errorMessage += `1. Go to Firebase Console → Storage\n`
    errorMessage += `2. Navigate to: profitSharing/templates/\n`
    errorMessage += `3. Upload the file: ${expectedFileName}\n`
    errorMessage += `4. Ensure the file name matches exactly (case-sensitive)`

    console.error(`[DocumentGeneration] All template paths failed for ${templateType}:`, errors)
    if (existingFiles.length > 0) {
        console.error(`[DocumentGeneration] Existing files in templates directory:`, existingFiles)
    }
    
    // Create a user-friendly error object
    const templateError = new Error(errorMessage)
    templateError.isTemplateMissing = true
    templateError.templateType = templateType
    templateError.expectedFileName = expectedFileName
    templateError.expectedPath = primaryPath
    templateError.existingFiles = existingFiles
    throw templateError
}

/**
 * Generate a document from a template with data replacement
 * @param {string} templateType - 'PLAN' or 'AWARD'
 * @param {Object} data - Data object with keys matching template placeholders (e.g., {COMPANY NAME}, {START DATE})
 * @returns {Promise<Blob>} Generated document as Blob
 */
export const generateDocument = async (templateType, data) => {
    try {
        console.log('[DocumentGeneration] Loading template:', templateType)
        // Load template
        const templateBytes = await loadTemplate(templateType)
        console.log('[DocumentGeneration] Template loaded, size:', templateBytes.byteLength, 'bytes')
        
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
        
        console.log('[DocumentGeneration] Template data to render:', templateData)

        try {
            // Render the document with data (new API - render with data directly)
            doc.render(templateData)
            console.log('[DocumentGeneration] Document rendered successfully')
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

        // Post-process document XML to apply script font to signature names
        // This applies cursive formatting to "Brett Tatum" and employee names
        try {
            const zip = doc.getZip()
            const documentXml = zip.files['word/document.xml'].asText()
            
            let modifiedXml = documentXml
            
            // Apply script font to "Brett Tatum" in plan documents
            if (templateType === 'PLAN') {
                // Find "Brett Tatum" text and wrap with script font formatting
                // Pattern: Look for runs containing "Brett Tatum" and add script font properties
                modifiedXml = modifiedXml.replace(
                    /(<w:r[^>]*>)(<w:t[^>]*>)(Brett Tatum)(<\/w:t>)(<\/w:r>)/g,
                    (match, runOpen, textOpen, name, textClose, runClose) => {
                        // Check if already has script font in the run
                        const runContent = documentXml.substring(documentXml.indexOf(match) - 500, documentXml.indexOf(match) + match.length + 500)
                        if (runContent.includes('Brush Script')) return match
                        // Wrap with script font formatting
                        return `${runOpen}<w:rPr><w:rFonts w:ascii="Brush Script MT" w:hAnsi="Brush Script MT" w:cs="Brush Script MT"/><w:i/></w:rPr>${textOpen}${name}${textClose}${runClose}`
                    }
                )
            }
            
            // Apply script font to employee names in award documents (signature line)
            if (templateType === 'AWARD' && templateData['EMPLOYEE NAME']) {
                const employeeName = templateData['EMPLOYEE NAME']
                // Escape special regex characters
                const escapedName = employeeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                // Find employee name in signature context and apply script font
                modifiedXml = modifiedXml.replace(
                    new RegExp(`(<w:r[^>]*>)(<w:t[^>]*>)(${escapedName})(<\/w:t>)(<\/w:r>)`, 'g'),
                    (match, runOpen, textOpen, name, textClose, runClose) => {
                        // Check context to see if this is a signature (look for nearby signature-related text)
                        const matchIndex = documentXml.indexOf(match)
                        const context = documentXml.substring(Math.max(0, matchIndex - 500), Math.min(documentXml.length, matchIndex + match.length + 500))
                        // If it's near signature-related text, apply script font
                        if (context.includes('EMPLOYEE NAME') || context.includes('Signature') || context.includes('By:') || context.includes('Employee Name')) {
                            // Check if already formatted
                            if (context.includes('Brush Script')) return match
                            return `${runOpen}<w:rPr><w:rFonts w:ascii="Brush Script MT" w:hAnsi="Brush Script MT" w:cs="Brush Script MT"/><w:i/></w:rPr>${textOpen}${name}${textClose}${runClose}`
                        }
                        return match
                    }
                )
            }
            
            // Update the document XML
            zip.file('word/document.xml', modifiedXml)
            console.log('[DocumentGeneration] Applied script font formatting to signature names')
        } catch (postProcessError) {
            console.warn('[DocumentGeneration] Post-processing XML failed, continuing without script font formatting:', postProcessError)
            // Continue without post-processing - template should handle formatting
        }

        // Generate the document as a blob
        const blob = doc.getZip().generate({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            compression: 'DEFLATE',
        })
        
        console.log('[DocumentGeneration] Generated blob size:', blob.size, 'bytes')

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
        console.log('[DocumentGeneration] Template data for plan:', templateData)
        
        // Generate DOCX document
        const docxBlob = await generateDocument('PLAN', templateData)
        console.log('[DocumentGeneration] Generated DOCX blob size:', docxBlob.size, 'bytes')
        
        if (docxBlob.size < 1000) {
            console.warn('[DocumentGeneration] DOCX blob is suspiciously small, might be empty or corrupted')
        }
        
        // Upload DOCX to storage
        const docxFileName = `plan-${planId}-${Date.now()}.docx`
        const docxStoragePath = `profitSharing/plans/${planId}/${docxFileName}`
        const docxResult = await uploadGeneratedDocument(docxBlob, docxStoragePath)
        console.log('[DocumentGeneration] DOCX uploaded successfully:', docxResult.url)
        
        // Convert DOCX to PDF using Firebase Function
        let pdfResult = null
        try {
            console.log('[DocumentGeneration] Converting DOCX to PDF using Firebase Function...')
            const pdfFileName = `plan-${planId}-${Date.now()}.pdf`
            
            // Call Firebase Function to convert DOCX to PDF
            const conversionResult = await convertDocxToPdfFunction({
                docxUrl: docxResult.url,
                outputFileName: pdfFileName
            })
            
            if (conversionResult.data && conversionResult.data.pdfUrl) {
                // PDF was generated and uploaded by the function
                pdfResult = {
                    url: conversionResult.data.pdfUrl,
                    path: conversionResult.data.pdfPath || `profitSharing/plans/${planId}/${pdfFileName}`
                }
                console.log('[DocumentGeneration] PDF conversion successful:', pdfResult.url)
            } else {
                throw new Error('PDF conversion returned no URL')
            }
        } catch (pdfError) {
            console.error('[DocumentGeneration] Could not generate PDF version:', pdfError)
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
        
        // Convert DOCX to PDF using Firebase Function
        let pdfResult = null
        try {
            console.log('[DocumentGeneration] Converting DOCX to PDF using Firebase Function...')
            const pdfFileName = `award-${stakeholderId}-${awardId}-${Date.now()}.pdf`
            
            // Call Firebase Function to convert DOCX to PDF
            const conversionResult = await convertDocxToPdfFunction({
                docxUrl: docxResult.url,
                outputFileName: pdfFileName
            })
            
            if (conversionResult.data && conversionResult.data.pdfUrl) {
                // PDF was generated and uploaded by the function
                pdfResult = {
                    url: conversionResult.data.pdfUrl,
                    path: conversionResult.data.pdfPath || `profitSharing/awards/${stakeholderId}/${awardId}/${pdfFileName}`
                }
                console.log('[DocumentGeneration] PDF conversion successful:', pdfResult.url)
            } else {
                throw new Error('PDF conversion returned no URL')
            }
        } catch (pdfError) {
            console.error('[DocumentGeneration] Could not generate PDF version:', pdfError)
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
        
        // Convert DOCX to PDF using Firebase Function
        let pdfResult = null
        try {
            console.log('[DocumentGeneration] Converting signed DOCX to PDF using Firebase Function...')
            const pdfFileName = `award-signed-${stakeholderId}-${awardId}-${Date.now()}.pdf`
            
            // Call Firebase Function to convert DOCX to PDF
            const conversionResult = await convertDocxToPdfFunction({
                docxUrl: docxResult.url,
                outputFileName: pdfFileName
            })
            
            if (conversionResult.data && conversionResult.data.pdfUrl) {
                // PDF was generated and uploaded by the function
                pdfResult = {
                    url: conversionResult.data.pdfUrl,
                    path: conversionResult.data.pdfPath || `profitSharing/awards/${stakeholderId}/${awardId}/${pdfFileName}`
                }
                console.log('[DocumentGeneration] PDF conversion successful:', pdfResult.url)
            } else {
                throw new Error('PDF conversion returned no URL')
            }
        } catch (pdfError) {
            console.error('[DocumentGeneration] Could not generate PDF version:', pdfError)
            console.error('[DocumentGeneration] PDF conversion error details:', {
                message: pdfError.message,
                code: pdfError.code,
                details: pdfError.details
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

    // Format "Brett Tatum" signature with cursive font
    const signatureName = 'Brett Tatum'
    const formattedSignature = formatSignatureName(signatureName)

    return {
        'COMPANY NAME': companyData?.name || '',
        'START DATE': formatDate(planData?.startDate),
        // Add signature name with cursive formatting (for plan template)
        'SIGNATURE NAME': formattedSignature,
    }
}

/**
 * Format signature name with script font styling using Word XML
 * Uses docxtemplater's ability to handle XML by post-processing the document
 * Note: This requires the template to use a specific format, or we post-process the XML
 * @param {string} name - Name to format
 * @returns {string} Name (will be formatted via post-processing if needed)
 */
const formatSignatureName = (name) => {
    if (!name) return ''
    // Return name as-is - the template placeholders should be formatted in Word
    // with script font (Brush Script MT, italic) for proper cursive appearance
    // Alternative: Post-process the generated XML to apply script font formatting
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

    // Format employee name signature with cursive font
    const formattedEmployeeName = formatSignatureName(employeeName)

    return {
        'COMPANY NAME': companyData?.name || '',
        'EMPLOYEE NAME': formattedEmployeeName, // Apply cursive formatting to employee name signature
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

