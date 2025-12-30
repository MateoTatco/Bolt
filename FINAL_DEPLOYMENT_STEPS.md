# Final Deployment Steps - Manual Authentication Required

## ✅ What's Already Done

1. ✅ **Cloud Run Service**: Fully deployed and working
   - URL: `https://libreoffice-converter-4rbf2cqvba-uc.a.run.app`
   - Status: Active

2. ✅ **Firebase Function Code**: Built and ready
   - Location: `functions/src/docxToPdfConverterLibreOffice.ts`
   - Build: Successful (no errors)

3. ✅ **Configuration**: Service URL ready to be set

## 🔐 Final Step: Firebase Authentication & Deployment

Firebase CLI requires browser-based authentication which must be done manually. Here's the exact command sequence:

### Option 1: Interactive Script (Recommended)

```bash
cd /Users/manshink/Desktop/Tatco/Bolt
./complete-firebase-deployment.sh
```

This script will:
1. Open browser for Firebase authentication
2. Configure the service URL
3. Deploy the function

### Option 2: Manual Commands

```bash
cd /Users/manshink/Desktop/Tatco/Bolt

# 1. Authenticate (opens browser)
npx firebase-tools login

# 2. Configure service URL
cd functions
npx firebase-tools functions:config:set libreoffice.service_url="https://libreoffice-converter-4rbf2cqvba-uc.a.run.app"

# 3. Deploy
npx firebase-tools deploy --only functions:convertDocxToPdf
```

## 📋 What Happens During Authentication

1. Running `firebase login` opens your default browser
2. You'll be asked to sign in with your Google account
3. Grant permissions to Firebase CLI
4. Authentication completes automatically

## ✅ After Deployment

Once deployed, your Firebase Function will be available at:
- **Function Name**: `convertDocxToPdf`
- **Region**: us-central1 (default)
- **Callable from**: Client code using Firebase Functions SDK

## 🧪 Testing

After deployment, you can test the function from your client code:

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const convertDocxToPdf = httpsCallable(functions, 'convertDocxToPdf');

const result = await convertDocxToPdf({
  docxUrl: 'https://firebasestorage.googleapis.com/.../document.docx',
  outputFileName: 'converted.pdf'
});
```

## 📝 Summary

- **Cloud Run**: ✅ Deployed and working
- **Firebase Function**: ⏳ Needs authentication (2 minutes)
- **Total Time**: ~2 minutes to complete

The hard part (Cloud Run deployment) is done! Just need the browser authentication step.

