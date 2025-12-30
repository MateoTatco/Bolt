/**
 * DOCX to PDF Converter Cloud Function
 * Converts DOCX files to PDF using CloudConvert API (recommended) or LibreOffice
 * 
 * This function receives a DOCX file URL or Firebase Storage path and returns a PDF
 */

import * as functions from 'firebase-functions/v1'
import * as admin from 'firebase-admin'
import axios, { AxiosResponse } from 'axios'

/**
 * Convert DOCX to PDF Cloud Function
 * Uses CloudConvert API for high-quality conversion
 * 
 * Usage: Call this function with { docxUrl: 'https://...' } or { storagePath: 'path/to/file.docx' }
 * Returns: { pdfBase64: '...', pdfSize: 12345 }
 */
export const convertDocxToPdf = functions.https.onCall(async (data, context) => {
    try {
        const { docxUrl, storagePath } = data

        if (!docxUrl && !storagePath) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Either docxUrl or storagePath must be provided'
            )
        }

        // Get the DOCX file
        let docxBuffer: Buffer

        if (storagePath) {
            // Download from Firebase Storage
            const bucket = admin.storage().bucket()
            const file = bucket.file(storagePath)
            const [buffer] = await file.download()
            docxBuffer = buffer
        } else if (docxUrl) {
            // Download from URL
            const response: AxiosResponse<ArrayBuffer> = await axios.get(docxUrl, { responseType: 'arraybuffer' })
            docxBuffer = Buffer.from(response.data)
        } else {
            throw new functions.https.HttpsError('invalid-argument', 'No valid input provided')
        }

        // Use CloudConvert API (recommended for production quality)
        // Get API key from Firebase Functions config
        let cloudConvertApiKey: string | undefined
        try {
            const config: any = (functions as any).config()
            cloudConvertApiKey = config?.cloudconvert?.api_key
        } catch (e) {
            // Config not available, use env var
        }
        cloudConvertApiKey = cloudConvertApiKey || process.env.CLOUDCONVERT_API_KEY

        if (!cloudConvertApiKey) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'CloudConvert API key not configured. Please set it in Firebase Functions config.'
            )
        }

        return await convertWithCloudConvert(docxBuffer, cloudConvertApiKey)
    } catch (error: any) {
        console.error('Error converting DOCX to PDF:', error)
        if (error instanceof functions.https.HttpsError) {
            throw error
        }
        throw new functions.https.HttpsError('internal', error.message || 'PDF conversion failed')
    }
})

/**
 * Convert using CloudConvert API (recommended for production quality)
 * Preserves Word formatting, numbering, fonts, and layout perfectly
 */
async function convertWithCloudConvert(docxBuffer: Buffer, apiKey: string) {
    // CloudConvert v2 API - Create a job with upload, convert, and export tasks
    
    // Step 1: Create conversion job with inline file upload
    const jobResponse: AxiosResponse<any> = await axios.post(
        'https://api.cloudconvert.com/v2/jobs',
        {
            tasks: {
                'import-base64': {
                    operation: 'import/base64',
                    file: docxBuffer.toString('base64'),
                    filename: 'document.docx',
                },
                'convert-docx': {
                    operation: 'convert',
                    input: 'import-base64',
                    output_format: 'pdf',
                    engine: 'libreoffice', // Use LibreOffice for best quality
                },
                'export-url': {
                    operation: 'export/url',
                    input: 'convert-docx',
                },
            },
        },
        {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        }
    )

    const jobId = jobResponse.data.id
    console.log(`CloudConvert job created: ${jobId}`)

    // Step 2: Wait for conversion (poll status)
    let jobStatus: any
    let attempts = 0
    const maxAttempts = 60 // 60 seconds max

    while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second

        const statusResponse: AxiosResponse<any> = await axios.get(
            `https://api.cloudconvert.com/v2/jobs/${jobId}`,
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                },
            }
        )

        jobStatus = statusResponse.data
        console.log(`Job status: ${jobStatus.status}`)

        if (jobStatus.status === 'finished') {
            break
        }

        if (jobStatus.status === 'error') {
            const errorMsg = jobStatus.message || 'CloudConvert conversion failed'
            console.error('CloudConvert error:', errorMsg)
            throw new Error(errorMsg)
        }

        attempts++
    }

    if (jobStatus.status !== 'finished') {
        throw new Error('Conversion timeout after 60 seconds')
    }

    // Step 3: Get the export URL and download PDF
    const exportTask = jobStatus.data.tasks.find((t: any) => t.operation === 'export/url')
    const exportUrl = exportTask?.result?.files?.[0]?.url

    if (!exportUrl) {
        throw new Error('No export URL found in conversion result')
    }

    console.log('Downloading PDF from:', exportUrl)
    const pdfResponse: AxiosResponse<ArrayBuffer> = await axios.get(exportUrl, { responseType: 'arraybuffer' })
    const pdfBuffer = Buffer.from(pdfResponse.data)

    console.log(`PDF conversion successful. Size: ${pdfBuffer.length} bytes`)

    // Return base64 encoded PDF
    return {
        pdfBase64: pdfBuffer.toString('base64'),
        pdfSize: pdfBuffer.length,
    }
}

