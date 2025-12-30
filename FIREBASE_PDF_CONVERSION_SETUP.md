# Firebase PDF Conversion Setup Guide

## Overview
This guide explains how to set up server-side DOCX to PDF conversion using Firebase Cloud Functions and CloudConvert API. This will provide **production-quality PDFs** that preserve all Word formatting, numbering, fonts, and layout.

## Why Server-Side?
- ✅ **Perfect formatting preservation** - Uses LibreOffice engine (same as Word)
- ✅ **No text clipping** - Direct conversion, not canvas-based
- ✅ **Preserves numbering** - Word auto-numbering works correctly
- ✅ **Preserves fonts** - Including script/cursive fonts for signatures
- ✅ **Professional quality** - Suitable for legal documents

## Setup Steps

### Step 1: Get CloudConvert API Key

1. Go to https://cloudconvert.com
2. Sign up for a free account (25 free conversions/day) or paid plan
3. Go to Dashboard → API Keys
4. Create a new API key
5. Copy the API key (starts with something like `eyJ...`)

### Step 2: Set Firebase Functions Config

In your terminal, run:

```bash
cd functions
firebase functions:config:set cloudconvert.api_key="YOUR_API_KEY_HERE"
```

Replace `YOUR_API_KEY_HERE` with your actual CloudConvert API key.

### Step 3: Deploy the Function

```bash
cd functions
npm install  # Make sure axios is installed (it should be)
npm run build
firebase deploy --only functions:convertDocxToPdf
```

### Step 4: Update Client-Side Code

The client-side code needs to call this Cloud Function instead of doing client-side conversion.

## Cost Considerations

- **CloudConvert Free Tier**: 25 conversions/day
- **CloudConvert Paid**: Starting at $9/month for 1,000 conversions
- **Alternative**: You can use LibreOffice in a Cloud Run service (free but more complex setup)

## Testing

Once deployed, test the function:

```javascript
// In your browser console or code
const functions = getFunctions()
const convertDocxToPdf = httpsCallable(functions, 'convertDocxToPdf')

const result = await convertDocxToPdf({
  docxUrl: 'https://firebasestorage.googleapis.com/.../document.docx'
})

// result.data.pdfBase64 contains the PDF as base64
// Convert to blob and use
```

## Next Steps

After setup, we'll update the `DocumentGenerationService.js` to:
1. Generate DOCX (already working)
2. Upload DOCX to Firebase Storage
3. Call Cloud Function to convert to PDF
4. Upload PDF to Firebase Storage
5. Return both DOCX and PDF URLs

This will give you perfect PDFs every time! 🎉

