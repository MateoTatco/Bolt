#!/bin/bash

# PDF Converter Deployment Script
# This script deploys the LibreOffice PDF converter to Cloud Run and Firebase Functions

set -e  # Exit on error

echo "🚀 Starting PDF Converter Deployment..."

# Add gcloud to PATH
export PATH="$HOME/google-cloud-sdk/bin:$PATH"

# Check if authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Not authenticated. Please run: gcloud auth login"
    echo "   Then run this script again."
    exit 1
fi

# Set project
PROJECT_ID="tatco-crm"
echo "📋 Setting project to: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com --quiet

# Step 1: Deploy LibreOffice service to Cloud Run
echo ""
echo "📦 Step 1: Deploying LibreOffice converter to Cloud Run..."
echo "   This will take 5-10 minutes (building Docker image)..."
cd cloud-run-libreoffice

gcloud run deploy libreoffice-converter \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --timeout 60 \
  --max-instances 10 \
  --quiet

# Get the service URL
SERVICE_URL=$(gcloud run services describe libreoffice-converter --region us-central1 --format="value(status.url)")

echo ""
echo "✅ Cloud Run service deployed!"
echo "   Service URL: $SERVICE_URL"

# Step 2: Configure Firebase Functions
echo ""
echo "📝 Step 2: Configuring Firebase Functions..."
cd ../functions

firebase functions:config:set libreoffice.service_url="$SERVICE_URL"

# Step 3: Build and deploy Firebase Function
echo ""
echo "🔨 Step 3: Building Firebase Functions..."
npm run build

echo ""
echo "🚀 Step 4: Deploying Firebase Function..."
firebase deploy --only functions:convertDocxToPdf

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Summary:"
echo "   - Cloud Run service: $SERVICE_URL"
echo "   - Firebase Function: convertDocxToPdf"
echo ""
echo "🧪 To test, update your client code to call the Cloud Function."
echo "   See: src/services/DocumentGenerationService.js"

