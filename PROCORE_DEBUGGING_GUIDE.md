# Procore API Debugging Guide

## New Approach Based on Formula Reference Chart

Since the Procore Developer Portal doesn't show scope/permission settings, the issue is likely **user account permissions in Procore itself**, not OAuth app permissions.

## What We've Updated

### 1. Prime Contracts - Extended View
- ✅ Now using `view=extended` to get more fields
- ✅ Added detailed logging to see all available fields
- ✅ Logging full Prime Contract structure for debugging

### 2. Invoices Endpoint
- ✅ Changed from `/owner_invoices` to `/invoices` (per Formula Reference Chart)
- ✅ Using `/rest/v1.0/invoices` with `project_id` as query parameter
- ✅ Added detailed logging to see invoice structure

### 3. Enhanced Logging
- ✅ Logging full JSON structure of Prime Contracts
- ✅ Logging all available fields in each response
- ✅ Better error messages to identify permission issues

## What to Check in Procore

### Step 1: Verify Your User Permissions

1. **Log into Procore**: https://us02.procore.com
2. **Go to Company Settings** → **Users** → Find your user
3. **Check your role**: You need **Admin** or **Financial Admin** permissions
4. **Go to Project Settings** → **Permissions** → Check your project-level permissions
5. **Ensure you have access to**:
   - ✅ Prime Contracts tool
   - ✅ Invoicing tool
   - ✅ Budget Views / Project Status (if available)

### Step 2: Enable Required Tools

1. **Go to Project Settings** → **Tool Settings**
2. **Enable**:
   - ✅ Prime Contracts
   - ✅ Invoicing
   - ✅ Budget (if available)
   - ✅ Project Status (if available)

### Step 3: Check if Data Exists

1. **Navigate to the project** in Procore UI
2. **Go to Prime Contracts** → Verify you can see contract data
3. **Go to Invoicing** → Verify you can see invoices
4. **If you can see it in UI but API returns 403**, it's a permissions issue

## Testing After Deployment

### 1. Clear Tokens and Re-authorize
```bash
# In your app, click "🗑️ Clear Tokens"
# Then click "Connect to Procore" again
```

### 2. Check the Logs

After re-authorizing and fetching data, check the logs:

```bash
firebase functions:log --only procoreGetAllProjectsProfitability --lines 200
```

### 3. Look For These Log Messages

**Success indicators:**
- ✅ `[project_id] Found X prime contract(s)`
- ✅ `[project_id] Full Prime Contract structure: {...}`
- ✅ `[project_id] Prime Contract available fields: [...]`
- ✅ `[project_id] Invoice structure: {...}`

**Permission issues:**
- ❌ `403 Forbidden (no access)` - Your user account doesn't have permission
- ❌ `404 Not Found` - Endpoint doesn't exist or tool not enabled

### 4. What the Logs Will Show

The logs will now show:
1. **Full Prime Contract JSON** - So we can see exactly what fields are available
2. **All available fields** - So we can map them correctly
3. **Invoice structure** - So we can find customer retainage
4. **Error details** - To identify permission vs. endpoint issues

## Next Steps Based on Logs

### If Prime Contracts Returns 403:
1. **Check your user role** in Procore (needs Admin/Financial Admin)
2. **Check project permissions** (needs Prime Contracts access)
3. **Verify Prime Contracts tool is enabled** in the project

### If Prime Contracts Returns Data:
1. **Check the logged structure** - We'll see what fields are actually available
2. **Update field mapping** based on actual field names
3. **Test other endpoints** (Budget Views, Invoices, etc.)

### If Invoices Returns 403:
1. **Check Invoicing tool is enabled** in the project
2. **Check your user has Invoicing permissions**
3. **Try getting invoices from Prime Contract** (if nested)

## Formula Reference Chart Mapping

Based on your chart, we're now fetching:

| Field | Source | Status |
|-------|--------|--------|
| Total Contract Value | `/prime_contract` → `ProjectRevisedContractAmount` | ✅ Trying with extended view |
| Total Invoiced | `/prime_contract` → `OwnerInvoiceAmount` | ✅ Trying with extended view |
| Balance Left on Contract | `RevisedContractAmount - OwnerInvoiceAmount` | ✅ Calculated |
| Contract Start Date | `/prime_contract` → `Start Date` | ✅ Trying with extended view |
| Contract End Date | `/prime_contract` → `End Date` | ✅ Trying with extended view |
| Customer Retainage | `/invoices` → `Total Retainage` | ✅ Trying `/invoices` endpoint |
| Vendor Retainage | `/requisitions` → Sum of retainage | ✅ Already implemented |
| Est Cost Of Completion | `/budget_views` → Sum | ⚠️ Still 403 (needs permissions) |
| Job To Date Cost | `/budget_views` → Sum | ⚠️ Still 403 (needs permissions) |

## Key Insight

**The data exists** (you can see it in Procore UI), so the issue is:
- ❌ Not OAuth app permissions (Developer Portal doesn't have scope settings)
- ✅ **User account permissions in Procore** (you need Admin/Financial Admin role)
- ✅ **Tool enablement** (Prime Contracts, Invoicing must be enabled in project)

After deployment, the detailed logs will show us exactly what fields are available and what permissions are missing.

