# Procore Integration - Clean Restart Guide

## Step 1: Clear All Existing Tokens

Open your browser console on the Project Profitability page and run:

```javascript
// Import the service (if not already available)
import { ProcoreService } from './services/ProcoreService.js'

// Clear tokens
await ProcoreService.clearTokens()
```

Or manually delete from Firestore:
1. Go to Firebase Console → Firestore Database
2. Find the `procoreTokens` collection
3. Delete all documents

## Step 2: Verify Redirect URI Configuration

**CRITICAL**: The redirect URI must match EXACTLY in three places:

1. **Procore Developer Portal** (OAuth Credentials):
   - Go to: https://developers.procore.com/
   - Your "Bolt" app → "OAuth Credentials"
   - **Redirect URI must be exactly**: `http://localhost:5173`
   - No trailing slash, no path, include the port

2. **Firebase Functions** (`functions/src/index.ts`):
   - Line 27: `redirectUri: process.env.PROCORE_REDIRECT_URI || 'http://localhost:5173'`
   - Must be exactly: `http://localhost:5173`

3. **Authorization URL** (generated in `procoreGetAuthUrl`):
   - Uses the same `PROCORE_CONFIG.redirectUri`
   - Should match exactly

## Step 3: Verify App Installation

1. Go to Procore Sandbox: https://sandbox.procore.com/4278454/company/app_management
2. Verify "Bolt" app is installed
3. If not installed, use App Version Key: `80134927-1030-4e2d-9a63-d3d9854d05f8`

## Step 4: Fresh OAuth Flow

1. **Clear browser cache** or use incognito window
2. Go to: `http://localhost:5173/project-profitability`
3. Open browser console (F12)
4. Click "Connect to Procore"
5. Complete authorization
6. Watch console for detailed logs

## Step 5: Check Logs

If errors persist, check Firebase Functions logs:

```bash
firebase functions:log --only procoreExchangeToken --lines 50
```

Look for:
- The exact `redirect_uri` being used
- Any `invalid_grant` errors
- Token expiration times

## Common Issues

### "invalid_grant" Error
- **Cause**: Redirect URI mismatch
- **Fix**: Verify all three places have exactly `http://localhost:5173`

### "Token already used" Error
- **Cause**: Authorization code was used twice (React StrictMode)
- **Fix**: The new code prevents this - just try again

### "Token expired immediately"
- **Cause**: Token was invalid from the start
- **Fix**: Clear tokens and try fresh OAuth flow

## Debugging

The new code includes:
- ✅ Protection against duplicate code exchanges
- ✅ Detailed logging of redirect URIs
- ✅ Token expiration tracking
- ✅ Clear tokens function for reset

## Next Steps

If this still doesn't work, we may need to:
1. Check if the app needs different OAuth scopes
2. Verify the Client ID/Secret are correct for Sandbox
3. Contact Procore support about OAuth configuration

