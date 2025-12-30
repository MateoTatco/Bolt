# FREE PDF Conversion Setup (LibreOffice)

## Overview
This uses **LibreOffice headless** running in **Google Cloud Run** - **100% FREE** (2 million requests/month free tier).

## Why LibreOffice?
- ✅ **Completely FREE** - No API costs
- ✅ **Perfect formatting** - Same engine Word uses for PDF export
- ✅ **Preserves everything** - Numbering, fonts, alignment, spacing
- ✅ **No text clipping** - Direct conversion
- ✅ **Unlimited** - Free tier is very generous

## Setup Steps

### Step 1: Install Google Cloud SDK (if not already installed)

```bash
# macOS
brew install google-cloud-sdk

# Or download from: https://cloud.google.com/sdk/docs/install
```

### Step 2: Authenticate with Google Cloud

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

Replace `YOUR_PROJECT_ID` with your Firebase project ID.

### Step 3: Deploy LibreOffice Service to Cloud Run

```bash
cd cloud-run-libreoffice
gcloud run deploy libreoffice-converter \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --timeout 60 \
  --max-instances 10
```

This will:
- Build the Docker image with LibreOffice
- Deploy to Cloud Run
- Give you a URL like: `https://libreoffice-converter-xxxxx.run.app`

**First deployment takes ~5-10 minutes** (building Docker image)

### Step 4: Set the Service URL in Firebase Functions

```bash
cd functions
firebase functions:config:set libreoffice.service_url="https://libreoffice-converter-xxxxx.run.app"
```

### Step 5: Update Firebase Functions Code

The function is already created in `functions/src/docxToPdfConverterLibreOffice.ts`

Export it in `functions/src/index.ts`:
```typescript
export { convertDocxToPdfLibreOffice as convertDocxToPdf } from './docxToPdfConverterLibreOffice'
```

### Step 6: Deploy Firebase Function

```bash
cd functions
npm run build
firebase deploy --only functions:convertDocxToPdf
```

## Cost

- **Cloud Run Free Tier**: 
  - 2 million requests/month FREE
  - 360,000 GB-seconds compute FREE
  - 1 GB egress/month FREE
- **After free tier**: Very cheap (~$0.000024 per request)

## Testing

Once deployed, test:

```javascript
const functions = getFunctions()
const convertDocxToPdf = httpsCallable(functions, 'convertDocxToPdf')

const result = await convertDocxToPdf({
  docxUrl: 'https://firebasestorage.googleapis.com/.../document.docx'
})
```

## Troubleshooting

### If deployment fails:
- Make sure you have billing enabled (free tier still requires billing account)
- Check Cloud Run API is enabled: `gcloud services enable run.googleapis.com`

### If conversion is slow:
- First request may take 10-20 seconds (cold start)
- Subsequent requests are faster (2-5 seconds)
- You can set `--min-instances 1` to keep it warm (costs more)

## Next Steps

After setup, we'll update the client code to use this Cloud Function instead of client-side conversion.

This gives you **perfect PDFs for FREE**! 🎉

