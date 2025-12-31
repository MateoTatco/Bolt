#!/bin/bash

# Complete Firebase Deployment Script
# This will authenticate and deploy the Firebase Function

set -e

cd /Users/manshink/Desktop/Tatco/Bolt

echo "🔐 Step 1: Authenticating with Firebase..."
echo "   This will open a browser window for authentication."
echo ""
npx firebase-tools login

echo ""
echo "✅ Authentication successful!"
echo ""

echo "📝 Step 2: Configuring Firebase Functions..."
cd functions
npx firebase-tools functions:config:set libreoffice.service_url="https://libreoffice-converter-4rbf2cqvba-uc.a.run.app"

echo ""
echo "✅ Configuration complete!"
echo ""

echo "🚀 Step 3: Deploying Firebase Function..."
npx firebase-tools deploy --only functions:convertDocxToPdf

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Summary:"
echo "   - Cloud Run service: https://libreoffice-converter-4rbf2cqvba-uc.a.run.app"
echo "   - Firebase Function: convertDocxToPdf"
echo ""
echo "🎉 PDF converter is now fully deployed and ready to use!"


