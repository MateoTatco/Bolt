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
        // Convert DOCX to HTML using mammoth with enhanced style mapping to preserve formatting
        const mammoth = await import('mammoth')
        const arrayBuffer = await docxBlob.arrayBuffer()
        
        // Configure mammoth with enhanced style mapping to preserve formatting
        // Mammoth will preserve inline styles and some formatting automatically
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
                    // Preserve numbered lists - Mammoth should handle these automatically
                    "p[style-name='List Number'] => ol > li:fresh",
                    "p[style-name='List Bullet'] => ul > li:fresh",
                    // Preserve any numbered paragraph styles
                    "p[style-name^='List'] => ol > li:fresh",
                ],
                includeDefaultStyleMap: true,
                // Preserve inline styles (alignment, spacing, etc.)
                preserveInlineStyles: true,
                convertImage: mammoth.images.imgElement(function(image) {
                    return image.read("base64").then(function(imageBuffer) {
                        return {
                            src: "data:" + image.contentType + ";base64," + imageBuffer
                        }
                    })
                })
            }
        )
        
        // Post-process HTML to enhance formatting preservation
        let processedHtml = result.value
        
        // Mammoth preserves inline styles automatically, but we'll enhance the HTML
        // to ensure numbering and alignment are properly preserved
        try {
            // Create a temporary DOM to process the HTML (only if DOM is available)
            if (typeof document !== 'undefined') {
                const tempDiv = document.createElement('div')
                tempDiv.innerHTML = processedHtml
                
                // Process paragraphs to detect and preserve numbering patterns
                const paragraphs = tempDiv.querySelectorAll('p')
                let sectionCounter = 0
                
                // Track numbering context - detect if we're in a numbered section
                let inNumberedSection = false
                let lastNumber = 0
                
                paragraphs.forEach((p, index) => {
                    const text = p.textContent.trim()
                    const htmlContent = p.innerHTML
                    
                    // Fix numbering: Detect if paragraph starts with a number pattern
                    // Word auto-numbering often results in all paragraphs showing "1."
                    const numberPattern = /^(\d+)\.\s*(.+)$/
                    const match = text.match(numberPattern)
                    
                    if (match) {
                        const numberPart = match[1]
                        const contentPart = match[2]
                        const currentNumber = parseInt(numberPart, 10)
                        
                        // Check if this looks like a section heading (has content, reasonable number)
                        const isSectionHeading = currentNumber >= 1 && currentNumber <= 50 && contentPart.length > 3
                        
                        if (isSectionHeading) {
                            // If we see "1." again after seeing other sections, it's a new section
                            if (currentNumber === 1) {
                                if (inNumberedSection && lastNumber > 0) {
                                    // This is a new section starting with "1." - increment
                                    sectionCounter++
                                } else {
                                    // First section
                                    sectionCounter = 1
                                    inNumberedSection = true
                                }
                            } else {
                                // Use the number from the text if it's different from 1
                                sectionCounter = currentNumber
                                inNumberedSection = true
                            }
                            
                            lastNumber = sectionCounter
                            
                            // Replace the number with the correct sequential number
                            // Preserve any HTML formatting in the content
                            const contentHtml = htmlContent.replace(/^\d+\.\s*/, '')
                            p.innerHTML = `<strong>${sectionCounter}.</strong> ${contentHtml}`
                            p.setAttribute('data-numbered', 'true')
                            p.setAttribute('data-section', sectionCounter.toString())
                        }
                    } else {
                        // Reset numbering context if we hit a non-numbered paragraph
                        // (but only if it's a significant break, like a heading or empty line)
                        if (text.length === 0 || text.match(/^[A-Z]/)) {
                            // Might be a break, but don't reset yet
                        }
                    }
                    
                    // Detect and mark signature names for script font styling
                    const signatureKeywords = ['ISSUED BY', 'ACCEPTED BY', 'EMPLOYEE NAME', 'Brett Tantum', 'Brett Tatum']
                    const isSignature = signatureKeywords.some(keyword => 
                        text.includes(keyword) || p.innerHTML.includes(keyword)
                    )
                    
                    if (isSignature) {
                        p.setAttribute('data-signature', 'true')
                        p.classList.add('signature-name')
                        // Apply script font directly
                        p.style.fontFamily = "'Brush Script MT', 'Lucida Handwriting', 'Comic Sans MS', cursive, serif"
                        p.style.fontStyle = 'italic'
                        p.style.fontSize = '14pt'
                    }
                    
                    // Also check for employee name patterns
                    if (text.includes('Brett') || text.includes('Tantum') || text.includes('Tatum')) {
                        // Check if it's in a signature context (not just any mention)
                        const parentText = p.parentElement?.textContent || ''
                        if (parentText.includes('EMPLOYEE NAME') || parentText.includes('ISSUED BY') || parentText.includes('ACCEPTED BY')) {
                            p.setAttribute('data-signature', 'true')
                            p.classList.add('signature-name')
                            p.style.fontFamily = "'Brush Script MT', 'Lucida Handwriting', 'Comic Sans MS', cursive, serif"
                            p.style.fontStyle = 'italic'
                            p.style.fontSize = '14pt'
                        }
                    }
                    
                    // Ensure any inline styles from Mammoth are preserved
                    const inlineStyle = p.getAttribute('style') || ''
                    if (inlineStyle && inlineStyle.includes('text-align')) {
                        // Alignment is already in style, ensure it's applied
                        p.style.cssText = inlineStyle + (p.style.cssText ? '; ' + p.style.cssText : '')
                    }
                })
                
                processedHtml = tempDiv.innerHTML
            }
        } catch (error) {
            // If DOM processing fails, use original HTML (Mammoth output is usually good enough)
            console.warn('Could not post-process HTML for enhanced formatting:', error)
            // processedHtml remains as result.value
        }
        
        // Wrap the HTML with enhanced styling to preserve document appearance
        // Match Word's default formatting: Times New Roman, 12pt, single spacing
        const styledHtml = `
            <div style="
                font-family: 'Times New Roman', 'Georgia', serif;
                font-size: 12pt;
                line-height: 1.0;
                color: #000;
                width: 6.5in;
                margin: 0 auto;
                padding: 0;
                box-sizing: border-box;
            ">
                <style>
                    * {
                        box-sizing: border-box;
                    }
                    body { 
                        margin: 0; 
                        padding: 0; 
                        font-family: 'Times New Roman', 'Georgia', serif;
                        font-size: 12pt;
                        line-height: 1.0;
                    }
                    h1, h2, h3, h4, h5, h6 { 
                        font-weight: bold; 
                        margin-top: 12pt; 
                        margin-bottom: 6pt;
                        page-break-after: avoid;
                        page-break-inside: avoid;
                    }
                    h1 { 
                        font-size: 18pt; 
                        line-height: 1.0;
                    }
                    h2 { 
                        font-size: 16pt; 
                        line-height: 1.0;
                    }
                    h3 { 
                        font-size: 14pt; 
                        line-height: 1.0;
                    }
                    p { 
                        margin: 0;
                        margin-bottom: 0;
                        padding: 0;
                        line-height: 1.0;
                        text-align: left;
                        page-break-inside: avoid;
                        orphans: 3;
                        widows: 3;
                    }
                    /* Preserve text alignment - Mammoth may add style attributes */
                    p[style*="text-align: center"],
                    p[align="center"],
                    .center {
                        text-align: center !important;
                    }
                    p[style*="text-align: right"],
                    p[align="right"],
                    .right {
                        text-align: right !important;
                    }
                    p[style*="text-align: justify"],
                    p[align="justify"],
                    .justify {
                        text-align: justify !important;
                    }
                    /* Preserve line spacing */
                    p[style*="line-height"] {
                        /* Use inline style if present */
                    }
                    strong { 
                        font-weight: bold; 
                    }
                    em { 
                        font-style: italic; 
                    }
                    /* Enhanced list styling to preserve numbering */
                    ul, ol { 
                        margin: 6pt 0;
                        padding-left: 36pt;
                        page-break-inside: avoid;
                    }
                    ol {
                        list-style-type: decimal;
                        counter-reset: item;
                    }
                    ol > li {
                        display: list-item;
                        list-style-position: outside;
                        margin: 0;
                        padding-left: 0;
                        page-break-inside: avoid;
                    }
                    ul > li {
                        display: list-item;
                        list-style-position: outside;
                        margin: 0;
                        padding-left: 0;
                        page-break-inside: avoid;
                    }
                    /* Preserve numbered paragraphs (Word auto-numbering) */
                    p[data-numbered="true"] {
                        /* Numbering is already in the text content, just ensure proper spacing */
                        margin-left: 0;
                        text-indent: 0;
                    }
                    /* Ensure numbered sections maintain their numbers */
                    p[data-numbered="true"]::before {
                        content: none; /* Don't add extra numbering - it's already in content */
                    }
                    /* Preserve any inline styles from Word (alignment, spacing, etc.) */
                    p[style], h1[style], h2[style], h3[style], h4[style], h5[style], h6[style] {
                        /* Inline styles take precedence */
                    }
                    /* Signature names in script/cursive font - applied via JavaScript post-processing */
                    .signature-name,
                    [data-signature="true"] {
                        font-family: 'Brush Script MT', 'Lucida Handwriting', 'Comic Sans MS', cursive, serif !important;
                        font-style: italic;
                        font-size: 14pt;
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
                    div {
                        page-break-inside: avoid;
                    }
                    /* Prevent clipping at page boundaries */
                    p, h1, h2, h3, h4, h5, h6, li {
                        margin-bottom: 3pt;
                    }
                </style>
                ${processedHtml}
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
 * Uses html2pdf.js for better formatting preservation (alternative to html2canvas + jsPDF)
 * Falls back to html2canvas + jsPDF if html2pdf.js fails
 * @param {Blob} docxBlob - DOCX file as Blob
 * @param {boolean} useHtml2Pdf - Whether to use html2pdf.js (better formatting) or html2canvas (fallback)
 * @returns {Promise<Blob>} PDF file as Blob
 */
export const convertDocxToPdf = async (docxBlob, useHtml2Pdf = true) => {
    try {
        // Step 1: Convert DOCX to HTML using mammoth
        const htmlContent = await convertDocxToHtml(docxBlob)
        
        // Note: html2pdf.js removed due to compatibility issues
        // Server-side conversion recommended for production quality

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

        // Wait for images to load - increased timeout for signature images
        const images = tempDiv.querySelectorAll('img')
        if (images.length > 0) {
            await Promise.all(
                Array.from(images).map(img => {
                    if (img.complete) return Promise.resolve()
                    return new Promise((resolve, reject) => {
                        img.onload = resolve
                        img.onerror = resolve // Don't fail if image fails to load
                        // Timeout after 3 seconds
                        setTimeout(resolve, 3000)
                    })
                })
            )
        } else {
            // No images, just wait a bit for layout
            await new Promise(resolve => setTimeout(resolve, 200))
        }

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
        // Increased buffer (15mm) to prevent text clipping at page ends
        // This ensures we have extra space and content naturally flows to next page
        // The buffer prevents cutting off text at the bottom of pages
        const contentHeight = pdfHeight - (2 * margin) - 15 // 213.6mm (reduced from 223.6mm to add more buffer)
        
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
                
                // Enhanced page break detection to prevent clipping
                // If this is not the last page, try to find a better break point
                if (page < totalPages - 1 && sliceHeight < remainingHeight) {
                    // Look ahead up to 120 pixels (increased from 80) to find a better break point
                    const lookAhead = Math.min(120, remainingHeight - sliceHeight)
                    let bestBreakPoint = sliceHeight
                    let maxWhiteSpace = 0
                    
                    // Get canvas context with willReadFrequently for better performance
                    const canvasCtx = canvas.getContext('2d', { willReadFrequently: true })
                    
                    // Sample more points to find areas with more white space (paragraph breaks)
                    // Check every 3 pixels (more frequent) for better accuracy
                    for (let offset = 0; offset <= lookAhead; offset += 3) {
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
                            
                            // Check a larger vertical range (5 pixels instead of 3) to detect paragraph breaks
                            for (let dy = -2; dy <= 2; dy++) {
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
                            // Require at least 18 white space pixels (out of ~35 total samples) to consider it a good break
                            // This is more lenient to find better break points
                            if (whiteSpaceCount > maxWhiteSpace && whiteSpaceCount >= 18) {
                                maxWhiteSpace = whiteSpaceCount
                                bestBreakPoint = sliceHeight + offset
                            }
                        }
                    }
                    
                    // Use the best break point if we found one with sufficient white space
                    // Also ensure we don't break too close to the end (at least 20px from end)
                    if (maxWhiteSpace >= 18 && bestBreakPoint <= remainingHeight - 20) {
                        sliceHeight = bestBreakPoint
                    }
                }
                
                // Additional safety: Ensure we don't clip content by reducing slice height slightly
                // This adds a small buffer at the bottom of each page (except the last)
                if (page < totalPages - 1 && sliceHeight > 20) {
                    sliceHeight = sliceHeight - 10 // Reduce by 10px to add buffer
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

