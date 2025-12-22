/**
 * PDF Conversion Utility
 * Converts DOCX documents to PDF format for download and preview
 */

/**
 * Convert DOCX blob to HTML for preview
 * @param {Blob} docxBlob - DOCX file as Blob
 * @returns {Promise<string>} HTML content string
 */
export const convertDocxToHtml = async (docxBlob) => {
    try {
        // Convert DOCX to HTML using mammoth with style mapping to preserve formatting
        const mammoth = await import('mammoth')
        const arrayBuffer = await docxBlob.arrayBuffer()
        
        // Configure mammoth to preserve styles and formatting
        const result = await mammoth.convertToHtml(
            { arrayBuffer },
            {
                styleMap: [
                    "p[style-name='Heading 1'] => h1:fresh",
                    "p[style-name='Heading 2'] => h2:fresh",
                    "p[style-name='Heading 3'] => h3:fresh",
                    "p[style-name='Title'] => h1.title:fresh",
                    "r[style-name='Strong'] => strong",
                    "r[style-name='Emphasis'] => em",
                ],
                includeDefaultStyleMap: true,
                convertImage: mammoth.images.imgElement(function(image) {
                    return image.read("base64").then(function(imageBuffer) {
                        return {
                            src: "data:" + image.contentType + ";base64," + imageBuffer
                        }
                    })
                })
            }
        )
        
        // Wrap the HTML with proper styling to preserve document appearance
        // Note: We'll add margins in PDF generation, not in HTML padding
        const styledHtml = `
            <div style="
                font-family: 'Times New Roman', 'Georgia', serif;
                font-size: 12pt;
                line-height: 1.6;
                color: #000;
                width: 6.5in;
                margin: 0 auto;
                padding: 0;
                box-sizing: border-box;
            ">
                <style>
                    body { margin: 0; padding: 0; }
                    h1, h2, h3, h4, h5, h6 { 
                        font-weight: bold; 
                        margin-top: 12pt; 
                        margin-bottom: 6pt;
                    }
                    h1 { font-size: 18pt; }
                    h2 { font-size: 16pt; }
                    h3 { font-size: 14pt; }
                    p { 
                        margin: 6pt 0;
                        margin-bottom: 12pt;
                        text-align: justify;
                        page-break-inside: avoid;
                        orphans: 3;
                        widows: 3;
                    }
                    strong { font-weight: bold; }
                    em { font-style: italic; }
                    ul, ol { 
                        margin: 6pt 0;
                        padding-left: 24pt;
                        page-break-inside: avoid;
                    }
                    li { 
                        margin: 3pt 0;
                        page-break-inside: avoid;
                    }
                    table {
                        border-collapse: collapse;
                        width: 100%;
                        margin: 12pt 0;
                        page-break-inside: avoid;
                        page-break-before: auto;
                        page-break-after: auto;
                    }
                    table tr {
                        page-break-inside: avoid;
                    }
                    table thead {
                        display: table-header-group;
                    }
                    table tfoot {
                        display: table-footer-group;
                    }
                    table td, table th {
                        border: 1px solid #000;
                        padding: 6pt;
                        page-break-inside: avoid;
                    }
                    table th {
                        background-color: #f0f0f0;
                        font-weight: bold;
                    }
                    h1, h2, h3, h4, h5, h6 {
                        page-break-after: avoid;
                        page-break-inside: avoid;
                    }
                    div {
                        page-break-inside: avoid;
                    }
                </style>
                ${result.value}
            </div>
        `
        
        return styledHtml
    } catch (error) {
        console.error('Error converting DOCX to HTML:', error)
        throw new Error(`Failed to convert document to HTML: ${error.message}`)
    }
}

/**
 * Convert DOCX URL to HTML for preview
 * @param {string} docxUrl - URL of the DOCX file
 * @returns {Promise<string>} HTML content string
 */
export const convertDocxUrlToHtml = async (docxUrl) => {
    try {
        // Fetch the DOCX file
        const response = await fetch(docxUrl)
        const docxBlob = await response.blob()
        
        // Convert to HTML
        return await convertDocxToHtml(docxBlob)
    } catch (error) {
        console.error('Error converting DOCX URL to HTML:', error)
        throw new Error(`Failed to convert document URL to HTML: ${error.message}`)
    }
}

/**
 * Check if PDF conversion dependencies are available
 * @returns {Promise<boolean>} True if jspdf and html2canvas are available
 */
const checkPdfDependencies = async () => {
    try {
        // Try to import jspdf and html2canvas
        await Promise.all([
            import('jspdf'),
            import('html2canvas')
        ])
        return true
    } catch (error) {
        return false
    }
}

/**
 * Convert DOCX blob to PDF blob using HTML as intermediate format
 * Uses jspdf and html2canvas directly for better reliability
 * @param {Blob} docxBlob - DOCX file as Blob
 * @returns {Promise<Blob>} PDF file as Blob
 */
export const convertDocxToPdf = async (docxBlob) => {
    try {
        // Step 1: Convert DOCX to HTML using mammoth
        const htmlContent = await convertDocxToHtml(docxBlob)

        // Step 2: Import jspdf and html2canvas directly
        const jsPDFModule = await import('jspdf')
        const html2canvasModule = await import('html2canvas')
        const jsPDF = jsPDFModule.default
        const html2canvas = html2canvasModule.default

        // Create a temporary div with the HTML content
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = htmlContent
        // Set up the container - content is 6.5in wide (Letter 8.5in - 2*1in margins)
        tempDiv.style.width = '6.5in' // Content width (without margins)
        tempDiv.style.minHeight = 'auto'
        tempDiv.style.position = 'absolute'
        tempDiv.style.left = '-9999px'
        tempDiv.style.top = '0'
        tempDiv.style.backgroundColor = '#fff'
        tempDiv.style.boxSizing = 'border-box'
        document.body.appendChild(tempDiv)

        // Wait for images to load
        await new Promise(resolve => setTimeout(resolve, 100))

        // Convert HTML to canvas
        const canvas = await html2canvas(tempDiv, {
            scale: 2,
            useCORS: true,
            logging: false,
            letterRendering: true,
            width: tempDiv.scrollWidth,
            height: tempDiv.scrollHeight
        })

        // Calculate PDF dimensions (Letter: 8.5in x 11in = 215.9mm x 279.4mm)
        // With 1 inch (25.4mm) margins on all sides
        const pdfWidth = 215.9 // mm (8.5 inches)
        const pdfHeight = 279.4 // mm (11 inches)
        const margin = 25.4 // mm (1 inch)
        const contentWidth = pdfWidth - (2 * margin) // 165.1mm (6.5 inches)
        // Add a small buffer (5mm) to content height to prevent cutting in middle of content
        // This ensures we have extra space and content naturally flows to next page
        const contentHeight = pdfHeight - (2 * margin) - 5 // 223.6mm (9 inches minus buffer)
        
        // Calculate full image dimensions maintaining aspect ratio
        // Canvas is 6.5in wide, so we scale it to fit contentWidth
        const imgWidth = contentWidth // Content width matches canvas width
        const fullImgHeight = (canvas.height * contentWidth) / canvas.width

        // Create PDF with Letter size
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [pdfWidth, pdfHeight] // Letter size
        })

        // Convert full canvas to image data
        const fullImgData = canvas.toDataURL('image/jpeg', 0.98)
        
        // Handle multi-page PDF by slicing into page-sized chunks
        if (fullImgHeight <= contentHeight) {
            // If content fits on one page, add it with margins on all sides
            pdf.addImage(fullImgData, 'JPEG', margin, margin, imgWidth, fullImgHeight)
        } else {
            // For multi-page content, slice the canvas into page-sized chunks
            // Each chunk will fit within the content area with margins
            const totalPages = Math.ceil(fullImgHeight / contentHeight)
            
            for (let page = 0; page < totalPages; page++) {
                if (page > 0) {
                    pdf.addPage()
                }
                
                // Calculate the source rectangle for this page slice
                // Convert contentHeight to canvas pixels
                const contentHeightInPixels = contentHeight * (canvas.width / contentWidth)
                let sourceY = page * contentHeightInPixels
                const remainingHeight = canvas.height - sourceY
                
                // Calculate slice height - no overlapping buffers to prevent duplication
                let sliceHeight = Math.min(contentHeightInPixels, remainingHeight)
                
                // Ensure we don't exceed canvas bounds
                if (sourceY + sliceHeight > canvas.height) {
                    sliceHeight = canvas.height - sourceY
                }
                
                // If this is not the last page and we're close to the end of a content block,
                // try to adjust the slice to end at a better break point
                // We'll look for areas with more white space (potential paragraph breaks)
                if (page < totalPages - 1 && sliceHeight < remainingHeight) {
                    // Look ahead up to 80 pixels to find a better break point
                    const lookAhead = Math.min(80, remainingHeight - sliceHeight)
                    let bestBreakPoint = sliceHeight
                    let maxWhiteSpace = 0
                    
                    // Get canvas context with willReadFrequently for better performance
                    const canvasCtx = canvas.getContext('2d', { willReadFrequently: true })
                    
                    // Sample more points to find areas with more white space
                    // Check every 5 pixels for better accuracy
                    for (let offset = 0; offset <= lookAhead; offset += 5) {
                        const testY = sourceY + sliceHeight + offset
                        if (testY < canvas.height) {
                            // Sample more horizontal points across the width to check for white space
                            const samplePoints = [
                                canvas.width * 0.05, 
                                canvas.width * 0.15, 
                                canvas.width * 0.3,
                                canvas.width * 0.5, 
                                canvas.width * 0.7,
                                canvas.width * 0.85,
                                canvas.width * 0.95
                            ]
                            let whiteSpaceCount = 0
                            
                            // Check a small vertical range (3 pixels) to detect paragraph breaks
                            for (let dy = -1; dy <= 1; dy++) {
                                const checkY = Math.max(0, Math.min(canvas.height - 1, testY + dy))
                                for (const x of samplePoints) {
                                    const checkX = Math.max(0, Math.min(canvas.width - 1, x))
                                    try {
                                        const imageData = canvasCtx.getImageData(checkX, checkY, 1, 1).data
                                        // Check if pixel is white (RGB all > 240)
                                        if (imageData[0] > 240 && imageData[1] > 240 && imageData[2] > 240) {
                                            whiteSpaceCount++
                                        }
                                    } catch (e) {
                                        // Ignore out of bounds errors
                                    }
                                }
                            }
                            
                            // If we found significantly more white space, this might be a better break point
                            // Require at least 15 white space pixels (out of ~21 total samples) to consider it a good break
                            if (whiteSpaceCount > maxWhiteSpace && whiteSpaceCount >= 21) {
                                maxWhiteSpace = whiteSpaceCount
                                bestBreakPoint = sliceHeight + offset
                            }
                        }
                    }
                    
                    // Use the best break point if we found one with sufficient white space
                    if (maxWhiteSpace >= 21 && bestBreakPoint <= remainingHeight) {
                        sliceHeight = bestBreakPoint
                    }
                }
                
                // Create a temporary canvas for this page slice
                const pageCanvas = document.createElement('canvas')
                pageCanvas.width = canvas.width
                pageCanvas.height = sliceHeight
                const pageCtx = pageCanvas.getContext('2d')
                
                // Draw only the slice of the original canvas that belongs to this page
                pageCtx.drawImage(
                    canvas,
                    0, sourceY, canvas.width, sliceHeight,  // Source rectangle
                    0, 0, canvas.width, sliceHeight         // Destination rectangle
                )
                
                // Convert this page slice to image data
                const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.98)
                const pageImgHeight = (sliceHeight * contentWidth) / canvas.width
                
                // Add this page slice to PDF with margins on all sides
                // Every page gets margin at top and bottom
                pdf.addImage(pageImgData, 'JPEG', margin, margin, imgWidth, pageImgHeight)
                
                // Clean up temporary canvas
                pageCanvas.width = 0
                pageCanvas.height = 0
            }
        }

        // Clean up
        document.body.removeChild(tempDiv)

        // Return PDF as blob
        const pdfBlob = pdf.output('blob')
        return pdfBlob
    } catch (error) {
        console.error('Error converting DOCX to PDF:', error)
        throw new Error(`Failed to convert document to PDF: ${error.message}`)
    }
}

/**
 * Convert DOCX URL to PDF blob
 * @param {string} docxUrl - URL of the DOCX file
 * @returns {Promise<Blob>} PDF file as Blob
 */
export const convertDocxUrlToPdf = async (docxUrl) => {
    try {
        // Fetch the DOCX file
        const response = await fetch(docxUrl)
        const docxBlob = await response.blob()
        
        // Convert to PDF
        return await convertDocxToPdf(docxBlob)
    } catch (error) {
        console.error('Error converting DOCX URL to PDF:', error)
        throw new Error(`Failed to convert document URL to PDF: ${error.message}`)
    }
}

