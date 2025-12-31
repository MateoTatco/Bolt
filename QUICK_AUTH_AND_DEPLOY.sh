#!/bin/bash

# Quick Authentication and Deployment Script
# This script will guide you through authentication and then deploy

set -e

export PATH="$HOME/google-cloud-sdk/bin:$PATH"

echo "🔐 Step 1: Checking authentication..."

# Check if already authenticated
if gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "✅ Already authenticated!"
    ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1)
    echo "   Account: $ACCOUNT"
else
    echo "❌ Not authenticated. Starting authentication..."
    echo ""
    echo "📋 This will open a browser window for you to sign in."
    echo "   Please complete the sign-in process in your browser."
    echo ""
    read -p "Press Enter to start authentication (or Ctrl+C to cancel)..."
    
    gcloud auth login
    
    if [ $? -eq 0 ]; then
        echo "✅ Authentication successful!"
    else
        echo "❌ Authentication failed. Please try again."
        exit 1
    fi
fi

echo ""
echo "🚀 Step 2: Setting project..."
gcloud config set project tatco-crm

echo ""
echo "🔧 Step 3: Enabling required APIs..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com --quiet

echo ""
echo "📦 Step 4: Deploying LibreOffice converter to Cloud Run..."
echo "   This will take 5-10 minutes (building Docker image)..."
cd cloud-run-libreoffice

gcloud run deploy libreoffice-converter \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --timeout 60 \
  --max-instances 10

# Get the service URL
SERVICE_URL=$(gcloud run services describe libreoffice-converter --region us-central1 --format="value(status.url)")

echo ""
echo "✅ Cloud Run service deployed!"
echo "   Service URL: $SERVICE_URL"

echo ""
echo "📝 Step 5: Configuring Firebase Functions..."
cd ../functions

firebase functions:config:set libreoffice.service_url="$SERVICE_URL"

echo ""
echo "🔨 Step 6: Building Firebase Functions..."
npm run build

echo ""
echo "🚀 Step 7: Deploying Firebase Function..."
firebase deploy --only functions:convertDocxToPdf

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Summary:"
echo "   - Cloud Run service: $SERVICE_URL"
echo "   - Firebase Function: convertDocxToPdf"
echo ""
echo "🧪 The PDF converter is now ready to use!"


