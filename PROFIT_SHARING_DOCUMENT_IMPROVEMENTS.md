# Profit Sharing Document System - Improvements

## Completed Fixes ✅

1. ✅ Fixed React-Modal duplicate instance warning - Changed conditional rendering to always render modal
2. ✅ Fixed deprecated docxtemplater `.setData()` method - Updated to use `render(data)` directly
3. ✅ Auto-generate preview when modal opens - Added `autoGenerate` prop
4. ✅ Fixed duplicate Download buttons - Removed duplicate button from content area
5. ✅ Fixed Agreement Settings "View Agreement" - Now shows latest finalized plan document
6. ✅ Added "View Document" buttons to Plans and Awards tables
7. ✅ Implemented PDF conversion - DOCX files are automatically converted to PDF for browser viewing
8. ✅ Enhanced document viewing - Award documents now display as PDFs in browser

## Remaining Tasks

### 1. Agreement Settings "View Agreement" - Show Generated Plan Documents
**Current Issue**: The "View Agreement" button in Agreement Settings shows an empty modal because it's looking for a manually uploaded PDF in `profitSharing/agreementSettings`, but it should show the latest finalized plan document.

**Solution**: 
- Modify `PdfViewerModal` to accept a `planDocumentUrl` prop
- Update `PlansTab` to pass the latest finalized plan's `planDocumentUrl` to the modal
- If no plan document exists, show a message indicating no plan has been finalized yet

### 2. Show Already Generated Documents
**Current Issue**: Users can only preview documents before finalizing. Once a plan/award is finalized, there's no way to view the generated document.

**Solution**:
- Add "View Document" buttons/links in:
  - Plans tab: Show document icon next to finalized plans
  - Stakeholder Detail: Show document icon next to finalized awards
- Create a component to display existing documents (PDF or HTML preview)
- Load document from `planDocumentUrl` or `documentUrl` fields in Firestore

### 3. Convert Documents to PDF Format
**Current Issue**: Documents are generated as .docx files, but users want to view them as PDFs in the browser.

**Solution Options**:

**Option A: Client-Side Conversion (Recommended)**
- Use `docx-pdf` or `libreoffice-convert` (requires server-side)
- Or use `pdfkit` to generate PDFs directly from data
- Convert DOCX to PDF using `mammoth` (DOCX→HTML) + `html2pdf` (HTML→PDF)

**Option B: Server-Side Conversion**
- Create a Firebase Cloud Function to convert DOCX to PDF
- Store both DOCX and PDF versions in Firebase Storage
- Update document generation to create both formats

**Option C: Use PDF Generation Library**
- Replace docxtemplater with a PDF generation library like `pdfkit` or `jspdf`
- Create PDF templates instead of Word templates
- Generate PDFs directly

**Recommended Approach**: Option A with `html2pdf.js` or similar library for client-side conversion.

### 4. Digital Signature Functionality
**Current Issue**: Stakeholders need to digitally sign their award documents.

**Solution Plan**:

**Phase 1: Basic Signature Capture**
1. Add a signature canvas component (using `react-signature-canvas` or similar)
2. Allow stakeholders to draw their signature
3. Save signature as image (base64 or blob)
4. Store signature in Firestore with award document

**Phase 2: Document Integration**
1. Convert signature image to a format that can be embedded in Word/PDF
2. Add signature field to document templates
3. Generate document with signature embedded
4. Store signed document version separately from unsigned version

**Phase 3: Signature Workflow**
1. Stakeholder receives notification about award
2. Stakeholder views award document
3. Stakeholder signs document using signature canvas
4. System generates signed version of document
5. Store signed document and signature metadata
6. Notify admin that document has been signed

**Technical Considerations**:
- Signature storage: Store as base64 image in Firestore or as file in Storage
- Document embedding: Use docxtemplater image module or convert to PDF and use PDF library
- Legal compliance: Ensure signature meets legal requirements for your jurisdiction
- Audit trail: Track when signature was added, by whom, and IP address

## Implementation Priority

1. **High Priority**:
   - Fix Agreement Settings to show generated plan documents
   - Show already generated documents in Plans and Awards

2. **Medium Priority**:
   - Convert documents to PDF format for better browser viewing

3. **Low Priority** (Future Enhancement):
   - Digital signature functionality

## Next Steps

1. Update `PdfViewerModal` to accept and display plan document URLs
2. Add document viewing functionality to Plans and Awards tables
3. Research and implement PDF conversion solution
4. Plan and design digital signature UI/UX

