/**
 * LibreOffice Headless DOCX to PDF Converter Server
 * 
 * This server runs in Cloud Run and converts DOCX to PDF using LibreOffice
 * 
 * Deploy to Cloud Run:
 * gcloud run deploy libreoffice-converter \
 *   --source . \
 *   --platform managed \
 *   --region us-central1 \
 *   --allow-unauthenticated \
 *   --memory 2Gi \
 *   --timeout 60
 */

const http = require('http')
const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')
const { promisify } = require('util')

const execAsync = promisify(exec)

const PORT = process.env.PORT || 8080

const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
        res.writeHead(200)
        res.end()
        return
    }

    if (req.method !== 'POST' || req.url !== '/convert') {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Not found' }))
        return
    }

    try {
        // Create temp directory
        const tempDir = `/tmp/conversion-${Date.now()}`
        fs.mkdirSync(tempDir, { recursive: true })

        const inputFile = path.join(tempDir, 'input.docx')
        const outputFile = path.join(tempDir, 'output.pdf')

        // Write DOCX to temp file
        const chunks = []
        req.on('data', chunk => chunks.push(chunk))
        req.on('end', async () => {
            try {
                const buffer = Buffer.concat(chunks)
                console.log(`Received ${buffer.length} bytes, writing to ${inputFile}`)
                
                // Validate input
                if (buffer.length < 100) {
                    throw new Error(`Input file is too small (${buffer.length} bytes), likely corrupted`)
                }
                
                // Check DOCX header (should start with PK for ZIP format)
                const header = buffer.slice(0, 2).toString('ascii')
                console.log(`Input file header: ${header}, size: ${buffer.length} bytes`)
                if (header !== 'PK') {
                    const errorText = buffer.slice(0, 200).toString('utf-8')
                    console.error(`Invalid DOCX header: ${header}. First 200 chars: ${errorText}`)
                    throw new Error(`Input file does not appear to be a valid DOCX (header: ${header})`)
                }
                
                fs.writeFileSync(inputFile, buffer)
                
                // Verify file was written
                const inputStats = fs.statSync(inputFile)
                console.log(`Input file written, size: ${inputStats.size} bytes`)

                // Convert using LibreOffice headless
                // --headless: Run without GUI
                // --convert-to pdf: Convert to PDF
                // --outdir: Output directory
                // Use export filter options to prevent blank pages
                // Note: LibreOffice may still add blank pages if the template has page break settings
                // The template itself should be checked for unnecessary page breaks
                const command = `libreoffice --headless --convert-to pdf:"writer_pdf_Export:{\\"ExportFormFields\\":false}" --outdir "${tempDir}" "${inputFile}" 2>&1`

                console.log(`Executing: ${command}`)
                const { stdout, stderr } = await execAsync(command, { timeout: 50000 })
                console.log(`LibreOffice stdout: ${stdout}`)
                if (stderr) {
                    console.log(`LibreOffice stderr: ${stderr}`)
                }

                // LibreOffice creates output.pdf in the output directory
                // But it might also create it with the input filename
                const possibleOutputFiles = [
                    outputFile, // output.pdf
                    path.join(tempDir, 'input.pdf'), // input.pdf (same name as input)
                    path.join(tempDir, path.basename(inputFile, '.docx') + '.pdf') // input filename with .pdf
                ]

                let pdfFile = null
                for (const file of possibleOutputFiles) {
                    if (fs.existsSync(file)) {
                        pdfFile = file
                        console.log(`Found PDF at: ${pdfFile}`)
                        break
                    }
                }

                if (!pdfFile) {
                    // List all files in temp directory for debugging
                    const files = fs.readdirSync(tempDir)
                    console.error(`PDF not found. Files in temp dir: ${files.join(', ')}`)
                    throw new Error(`PDF conversion failed - output file not found. Files in directory: ${files.join(', ')}`)
                }

                // Read PDF and send response
                const pdfBuffer = fs.readFileSync(pdfFile)
                
                res.writeHead(200, {
                    'Content-Type': 'application/pdf',
                    'Content-Length': pdfBuffer.length,
                })
                res.end(pdfBuffer)

                // Cleanup
                setTimeout(() => {
                    fs.rmSync(tempDir, { recursive: true, force: true })
                }, 5000)
            } catch (error) {
                console.error('Conversion error:', error)
                res.writeHead(500, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: error.message }))
                
                // Cleanup on error
                if (fs.existsSync(tempDir)) {
                    fs.rmSync(tempDir, { recursive: true, force: true })
                }
            }
        })
    } catch (error) {
        console.error('Server error:', error)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: error.message }))
    }
})

server.listen(PORT, () => {
    console.log(`LibreOffice converter server running on port ${PORT}`)
})

