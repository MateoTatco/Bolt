# Procore API Permissions Guide

## Problem
You're seeing 403 Forbidden errors when trying to access:
- Prime Contracts
- Budget Views / Project Status Snapshots
- Other financial endpoints

But the data **exists** in Procore (as shown in your Financial Insights app screenshot).

## Solution: Check OAuth App Permissions

The issue is that your OAuth app doesn't have the necessary permissions/scopes to access financial data.

### Step 1: Check Procore Developer Portal

1. Go to: https://developers.procore.com/
2. Log in with your Procore account
3. Navigate to **My Apps** → Find your app (Client ID: `cnOtyAY1YcKSCGdzQp88vB5ETGOknRvao3VT7cY2HoM`)
4. Check the **Scopes** or **Permissions** section

### Step 2: Required Permissions/Scopes

Your OAuth app needs access to:
- ✅ **Projects** (already working - you can fetch projects)
- ❌ **Prime Contracts** (403 error - needs permission)
- ❌ **Project Status / Budget Views** (403 error - needs permission)
- ❌ **Financials** (may need permission)
- ❌ **Requisitions** (404 error - may need permission)

### Step 3: Enable Permissions

In the Procore Developer Portal:
1. Look for a **Scopes** or **API Permissions** section
2. Enable:
   - `read:prime-contracts`
   - `read:project-status`
   - `read:budget`
   - `read:financials`
   - `read:requisitions`
3. **Save** the changes

### Step 4: Check User Permissions in Procore

Even if the OAuth app has permissions, your **user account** needs:
- **Admin** level access to Prime Contracts tool
- Access to Project Status / Budget Views
- Financial permissions

To check:
1. Log into Procore: https://us02.procore.com
2. Go to the project: `598134326177405` (Chicken Salad Chick - Norman)
3. Check **Project Settings** → **Permissions** → Your user role
4. Ensure you have **Admin** or **Financial Admin** permissions

### Step 5: Re-authorize the Application

After updating permissions:
1. **Clear your tokens** (click "🗑️ Clear Tokens" button in the app)
2. **Re-authorize** by clicking "Connect to Procore"
3. The new authorization will include the updated permissions

## Alternative: Check if Tools are Enabled

The Financial Insights app you showed uses Procore's internal tools. Make sure:
1. **Prime Contracts** tool is enabled in the project
2. **Project Status** feature is enabled
3. **Budget Views** are configured

## What We've Fixed

✅ **Requisitions endpoint**: Changed from `/rest/v2.0/.../requisitions` to `/rest/v1.0/requisitions` with `project_id` as query parameter

✅ **Project Roles endpoint**: Changed from `/rest/v2.0/.../project_roles` to `/rest/v1.0/project_roles` with `project_id` as query parameter

✅ **Added OAuth scopes**: Updated authorization URL to request financial scopes (though Procore may configure these in Developer Portal)

## Next Steps

1. **Check Procore Developer Portal** for your OAuth app permissions
2. **Verify your user has Admin access** to Prime Contracts in Procore
3. **Clear tokens and re-authorize** after making changes
4. **Check the logs** to see if Requisitions and Project Roles now work (they should with the fixed endpoints)

## Testing

After re-authorizing, check the logs:
```bash
firebase functions:log --only procoreGetAllProjectsProfitability --lines 100 | grep -E "Requisitions|Project Roles|Prime Contracts|Success|403|404"
```

You should see:
- ✅ Requisitions: Success (with the fixed endpoint)
- ✅ Project Roles: Success (with the fixed endpoint)
- ❌ Prime Contracts: Still 403 (needs permissions)
- ❌ Budget Views: Still 403 (needs permissions)

