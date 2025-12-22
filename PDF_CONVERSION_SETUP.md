# PDF Conversion Setup

## Required Packages

The PDF conversion feature requires the following packages to be installed:

```bash
npm install jspdf html2canvas
```

These are peer dependencies of `html2pdf.js` which is already installed.

## How It Works

1. **Document Generation**: When a plan or award is saved/finalized:
   - DOCX document is generated from template
   - DOCX is uploaded to Firebase Storage
   - DOCX is converted to PDF using `mammoth` (DOCX→HTML) + `html2pdf.js` (HTML→PDF)
   - PDF is uploaded to Firebase Storage
   - Both DOCX and PDF URLs are stored in Firestore

2. **Document Viewing**:
   - PDF URL is used for viewing (preview in iframe)
   - DOCX URL is stored for reference/download if needed
   - If PDF conversion fails, falls back to HTML preview

3. **Storage Structure**:
   - Plan documents: `profitSharing/plans/{planId}/plan-{planId}-{timestamp}.pdf`
   - Award documents: `profitSharing/awards/{stakeholderId}/{awardId}/award-{stakeholderId}-{awardId}-{timestamp}.pdf`

## Firestore Fields

### Plan Document Fields:
- `planDocumentUrl` - PDF URL (preferred for viewing)
- `planDocumentPdfUrl` - PDF URL (explicit)
- `planDocumentDocxUrl` - Original DOCX URL
- `planDocumentStoragePath` - PDF storage path
- `planDocumentPdfPath` - PDF storage path (explicit)
- `planDocumentDocxPath` - DOCX storage path

### Award Document Fields:
- `documentUrl` - PDF URL (preferred for viewing)
- `documentPdfUrl` - PDF URL (explicit)
- `documentDocxUrl` - Original DOCX URL
- `documentStoragePath` - PDF storage path
- `documentPdfPath` - PDF storage path (explicit)
- `documentDocxPath` - DOCX storage path
- `documentFileName` - PDF filename

## Installation

Run the following command to install required dependencies:

```bash
npm install jspdf html2canvas
```

After installation, PDF conversion will work automatically when documents are generated.

