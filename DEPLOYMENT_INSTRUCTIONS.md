# PDF Converter Deployment - Next Steps

## ✅ What's Been Done

1. ✅ Google Cloud SDK installed
2. ✅ LibreOffice Cloud Run service code created
3. ✅ Firebase Function code created and built
4. ✅ Deployment script created (`deploy-pdf-converter.sh`)
5. ✅ Project configured: `tatco-crm`

## 🔐 Step 1: Authenticate with Google Cloud

You need to authenticate before deploying. Run this command:

```bash
export PATH="$HOME/google-cloud-sdk/bin:$PATH"
gcloud auth login
```

This will open a browser window. Sign in with your Google account that has access to the `tatco-crm` project.

## 🚀 Step 2: Run the Deployment Script

After authentication, run the deployment script:

```bash
cd /Users/manshink/Desktop/Tatco/Bolt
./deploy-pdf-converter.sh
```

This script will:
1. Deploy LibreOffice converter to Cloud Run (takes 5-10 minutes)
2. Configure Firebase Functions with the service URL
3. Deploy the Firebase Function

## 📋 Manual Steps (if script fails)

If you prefer to run commands manually:

### 1. Enable APIs
```bash
export PATH="$HOME/google-cloud-sdk/bin:$PATH"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
```

### 2. Deploy Cloud Run Service
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

### 3. Get Service URL and Configure Firebase
```bash
# Get the URL
SERVICE_URL=$(gcloud run services describe libreoffice-converter --region us-central1 --format="value(status.url)")

# Configure Firebase Functions
cd ../functions
firebase functions:config:set libreoffice.service_url="$SERVICE_URL"
```

### 4. Deploy Firebase Function
```bash
cd functions
npm run build
firebase deploy --only functions:convertDocxToPdf
```

## 🧪 Testing

After deployment, the function will be available at:
- Function name: `convertDocxToPdf`
- Call it from your client code using Firebase Functions SDK

## 📝 Notes

- **Free Tier**: 2 million requests/month FREE
- **First Request**: May take 10-20 seconds (cold start)
- **Subsequent Requests**: 2-5 seconds
- **Cost After Free Tier**: ~$0.000024 per request

## 🔧 Troubleshooting

### If authentication fails:
```bash
gcloud auth login
gcloud config set project tatco-crm
```

### If Cloud Run deployment fails:
- Make sure billing is enabled (free tier still requires billing account)
- Check that Cloud Run API is enabled

### If Firebase Function deployment fails:
- Make sure you're logged into Firebase: `firebase login`
- Check that the service URL is correctly set in config

## 📚 Files Created

- `cloud-run-libreoffice/` - LibreOffice Docker service
- `functions/src/docxToPdfConverterLibreOffice.ts` - Firebase Function
- `deploy-pdf-converter.sh` - Deployment script
- `FREE_PDF_CONVERSION_SETUP.md` - Detailed setup guide

