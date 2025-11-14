# Procore API Integration Setup Guide

This guide will help you set up the Procore API integration for the Project Profitability page.

## Prerequisites

1. Procore Developer Account with OAuth credentials
2. Firebase project with Functions enabled
3. Node.js 20+ installed

## Step 1: Install Dependencies

Navigate to the `functions` directory and install the new dependency:

```bash
cd functions
npm install
```

This will install `axios` which is needed for making API calls to Procore.

## Step 2: Configure Environment Variables

### For Local Development

Create a `.env` file in the `functions` directory (optional for local dev, defaults are set):

```env
PROCORE_BASE_URL=https://sandbox.procore.com
PROCORE_API_BASE_URL=https://sandbox.procore.com
PROCORE_CLIENT_ID=cnOtyAY1YcKSCGdzQp88vB5ETGOknRvao3VT7cY2HoM
PROCORE_CLIENT_SECRET=-HR68NdpKiELjbKOgz7sTAOFNXc1voHV2fq8Zosy55E
PROCORE_REDIRECT_URI=http://localhost
PROCORE_COMPANY_ID=4278454
```

**Note:** The credentials are currently hardcoded in `functions/src/index.ts` with defaults. For production, you should use Firebase Functions environment variables.

### For Production (Firebase Functions)

Set environment variables using Firebase CLI:

```bash
firebase functions:config:set \
  procore.base_url="https://api.procore.com" \
  procore.api_base_url="https://api.procore.com" \
  procore.client_id="YOUR_PRODUCTION_CLIENT_ID" \
  procore.client_secret="YOUR_PRODUCTION_CLIENT_SECRET" \
  procore.redirect_uri="https://your-domain.com" \
  procore.company_id="YOUR_COMPANY_ID"
```

Then update `functions/src/index.ts` to read from config:

```typescript
const PROCORE_CONFIG = {
    baseUrl: functions.config().procore?.base_url || 'https://sandbox.procore.com',
    apiBaseUrl: functions.config().procore?.api_base_url || 'https://sandbox.procore.com',
    clientId: functions.config().procore?.client_id || 'cnOtyAY1YcKSCGdzQp88vB5ETGOknRvao3VT7cY2HoM',
    clientSecret: functions.config().procore?.client_secret || '-HR68NdpKiELjbKOgz7sTAOFNXc1voHV2fq8Zosy55E',
    redirectUri: functions.config().procore?.redirect_uri || 'http://localhost',
    companyId: functions.config().procore?.company_id || '4278454',
};
```

## Step 3: Build and Deploy Firebase Functions

```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

## Step 4: Configure Procore OAuth Redirect URI

1. Go to [Procore Developer Portal](https://developers.procore.com/)
2. Navigate to your app's OAuth Credentials
3. Ensure the Redirect URI matches what you set in the environment variables:
   - For local dev: `http://localhost/project-profitability` (or `http://localhost` if your app handles root redirects)
   - For production: Your production domain + `/project-profitability`
   
   **Important:** The Redirect URI in Procore must match EXACTLY what's in your code, including the path.

## Step 5: Test the Integration

1. **IMPORTANT: Log into Procore Sandbox First**
   - Open a new browser tab
   - Go to: `https://login-sandbox.procore.com`
   - Log in with your Procore Sandbox credentials
   - Keep this tab open (you need to be logged in before starting OAuth)

2. Start your development server:
   ```bash
   npm run dev
   ```

3. Navigate to the Project Profitability page

4. Click "Connect to Procore" button

5. You should now see the authorization page (not the login page) since you're already logged in

6. Click "Authorize" or "Allow" to grant access

7. You'll be redirected back to your app with the authorization code

8. The page should now load real data from Procore

**Note:** If you see the login page instead of the authorization page, it means:
- You're not logged into Procore Sandbox, OR
- Your session expired - log in again in a separate tab

## API Endpoints Used

The integration uses the following Procore API endpoints:

- **OAuth Token Exchange**: `POST /oauth/token`
- **Get Projects**: `GET /vapid/projects`
- **Get Project Details**: `GET /vapid/projects/{project_id}`
- **Get Project Budget** (if available): `GET /vapid/projects/{project_id}/budget_view`

## Data Mapping

The Procore API response is mapped to our internal format. The mapping happens in `functions/src/index.ts` in the `procoreGetAllProjectsProfitability` function.

**Note:** The actual field names from Procore API may differ. You may need to adjust the mapping based on the actual Procore API response structure. Check the Procore API documentation for the exact field names.

## Troubleshooting

### "No valid Procore access token" Error

- Make sure you've authorized the application by clicking "Connect to Procore"
- Check that the OAuth flow completed successfully
- Verify the token is stored in Firestore collection `procoreTokens`

### "Failed to fetch projects" Error

- Check Firebase Functions logs: `firebase functions:log`
- Verify the Procore API endpoints are correct
- Ensure the Company ID is correct
- Check that your Procore app has the necessary permissions/scopes

### Data Not Showing

- The integration falls back to mock data if Procore data is unavailable
- Check the browser console for errors
- Verify the data mapping matches your Procore API response structure
- Check Firebase Functions logs for API errors

### OAuth Popup Issues

- Ensure popup blockers are disabled
- Check that the redirect URI matches exactly in Procore settings
- Verify the Client ID and Client Secret are correct

## Security Notes

- **Never commit** Client Secret to version control
- Use Firebase Functions environment variables for production credentials
- Tokens are stored securely in Firestore with user-specific documents
- Access tokens are automatically refreshed when they expire

## Next Steps

1. Test with real Procore data
2. Adjust data mapping based on actual API responses
3. Add error handling for specific Procore API errors
4. Implement pagination if you have many projects
5. Add caching to reduce API calls

## Support

For Procore API documentation, visit: https://developers.procore.com/

For Firebase Functions documentation, visit: https://firebase.google.com/docs/functions

