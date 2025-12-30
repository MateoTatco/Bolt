/**
 * DOCX to PDF Converter using LibreOffice (FREE)
 * 
 * This uses LibreOffice headless to convert DOCX to PDF
 * Runs in Cloud Run for free (2M requests/month free tier)
 * 
 * Alternative: Can also be called from Cloud Functions if you set up a Cloud Run service
 */

import * as functions from 'firebase-functions/v1'
import * as admin from 'firebase-admin'
import axios, { AxiosResponse } from 'axios'

/**
 * Convert DOCX to PDF using LibreOffice via Cloud Run
 * 
 * First, you need to deploy a Cloud Run service with LibreOffice
 * See: cloud-run-libreoffice/ directory for Docker setup
 */
export const convertDocxToPdfLibreOffice = functions.https.onCall(async (data, context) => {
    try {
        const { docxUrl, storagePath, outputFileName } = data

        if (!docxUrl && !storagePath) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Either docxUrl or storagePath must be provided'
            )
        }

        // Get the DOCX file
        let docxBuffer: Buffer

        if (storagePath) {
            console.log('[convertDocxToPdf] Downloading from storage path:', storagePath)
            const bucket = admin.storage().bucket()
            const file = bucket.file(storagePath)
            const [buffer] = await file.download()
            docxBuffer = buffer
            console.log('[convertDocxToPdf] Downloaded from storage, size:', docxBuffer.length, 'bytes')
        } else if (docxUrl) {
            console.log('[convertDocxToPdf] Downloading from URL:', docxUrl)
            const response: AxiosResponse<ArrayBuffer> = await axios.get(docxUrl, { responseType: 'arraybuffer' })
            docxBuffer = Buffer.from(response.data)
            console.log('[convertDocxToPdf] Downloaded from URL, size:', docxBuffer.length, 'bytes')
            
            // Validate DOCX header (should start with PK for ZIP format)
            const docxHeader = docxBuffer.slice(0, 2).toString('ascii')
            if (docxHeader !== 'PK') {
                console.error('[convertDocxToPdf] Invalid DOCX header:', docxHeader)
                throw new Error('Downloaded file does not appear to be a valid DOCX file (missing ZIP header)')
            }
            console.log('[convertDocxToPdf] DOCX header validated:', docxHeader)
        } else {
            throw new functions.https.HttpsError('invalid-argument', 'No valid input provided')
        }

        // Get Cloud Run service URL from config
        // Try to get from functions config, fallback to environment variable, then hardcoded
        let cloudRunUrl: string = 'https://libreoffice-converter-758117357297.us-central1.run.app' // Default fallback
        try {
            const config: any = (functions as any).config()
            if (config?.libreoffice?.service_url) {
                cloudRunUrl = config.libreoffice.service_url
                console.log('[convertDocxToPdf] Using config URL:', cloudRunUrl)
            } else {
                console.log('[convertDocxToPdf] Config not found, using default URL')
            }
        } catch (e) {
            console.warn('[convertDocxToPdf] Config read error, using default URL:', e)
        }
        
        // Check environment variable as override
        if (process.env.LIBREOFFICE_SERVICE_URL) {
            cloudRunUrl = process.env.LIBREOFFICE_SERVICE_URL
            console.log('[convertDocxToPdf] Using env var URL:', cloudRunUrl)
        }
        
        console.log('[convertDocxToPdf] Final Cloud Run URL:', cloudRunUrl)

        // Always use Cloud Run service (URL is guaranteed to be set)
        try {
            // Call Cloud Run service
            const pdfResult = await convertWithCloudRun(docxBuffer, cloudRunUrl)
            
            // Upload PDF to Firebase Storage
            const bucket = admin.storage().bucket()
            const pdfFileName = outputFileName || `converted-${Date.now()}.pdf`
            const pdfStoragePath = `profitSharing/converted_pdfs/${pdfFileName}`
            const fileRef = bucket.file(pdfStoragePath)
            
            // Convert base64 back to buffer
            const pdfBuffer = Buffer.from(pdfResult.pdfBase64, 'base64')
            
            // Upload to Firebase Storage
            await fileRef.save(pdfBuffer, {
                metadata: {
                    contentType: 'application/pdf',
                },
            })
            
            // Get download URL using Firebase Admin SDK
            // Try signed URL first, fallback to public URL if permissions fail
            let downloadUrl: string
            try {
                const [signedUrl] = await fileRef.getSignedUrl({
                    action: 'read',
                    expires: '03-09-2491', // Long expiry date
                })
                downloadUrl = signedUrl
            } catch (signedUrlError: any) {
                // If signed URL fails due to permissions, make it public
                console.warn('[convertDocxToPdf] Signed URL failed, making file public:', signedUrlError.message)
                try {
                    await fileRef.makePublic()
                    downloadUrl = `https://storage.googleapis.com/${bucket.name}/${pdfStoragePath}`
                } catch (publicError) {
                    // If that also fails, throw error
                    console.error('[convertDocxToPdf] Could not make file public:', publicError)
                    throw new Error('Could not generate download URL for PDF')
                }
            }
            
            return {
                pdfUrl: downloadUrl,
                pdfPath: pdfStoragePath,
                pdfSize: pdfResult.pdfSize,
            }
        } catch (cloudRunError: any) {
            console.error('[convertDocxToPdf] Cloud Run conversion error:', cloudRunError)
            throw new functions.https.HttpsError(
                'internal',
                `PDF conversion failed: ${cloudRunError.message || 'Unknown error'}`
            )
        }
    } catch (error: any) {
        console.error('Error converting DOCX to PDF:', error)
        if (error instanceof functions.https.HttpsError) {
            throw error
        }
        throw new functions.https.HttpsError('internal', error.message || 'PDF conversion failed')
    }
})

/**
 * Convert using Cloud Run service with LibreOffice
 * This is the recommended FREE approach
 */
async function convertWithCloudRun(docxBuffer: Buffer, serviceUrl: string) {
    try {
        console.log(`[convertWithCloudRun] Sending ${docxBuffer.length} bytes to ${serviceUrl}/convert`)
        
        // Send DOCX to Cloud Run service
        const response = await axios.post(
            `${serviceUrl}/convert`,
            docxBuffer,
            {
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                },
                responseType: 'arraybuffer',
                timeout: 60000, // 60 second timeout
            }
        )

        if (!response.data || response.data.byteLength === 0) {
            throw new Error('Cloud Run service returned empty response')
        }

        const pdfBuffer = Buffer.from(response.data)
        
        // Validate PDF header
        const pdfHeader = pdfBuffer.slice(0, 4).toString('ascii')
        if (!pdfHeader.startsWith('%PDF')) {
            throw new Error(`Invalid PDF header: ${pdfHeader}. Response might be an error message.`)
        }

        console.log(`[convertWithCloudRun] Successfully converted to PDF (${pdfBuffer.length} bytes)`)

        return {
            pdfBase64: pdfBuffer.toString('base64'),
            pdfSize: pdfBuffer.length,
        }
    } catch (error: any) {
        console.error('[convertWithCloudRun] Error:', error.message)
        if (error.response) {
            // Try to parse error response
            const errorText = Buffer.from(error.response.data || '').toString('utf-8')
            console.error('[convertWithCloudRun] Error response:', errorText)
            throw new Error(`Cloud Run conversion failed: ${errorText || error.message}`)
        }
        throw error
    }
}


