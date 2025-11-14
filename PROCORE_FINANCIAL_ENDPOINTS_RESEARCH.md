# Procore Financial Endpoints Research Guide

## Overview
The basic `/rest/v1.0/companies/{company_id}/projects` endpoint only returns basic project information (id, name, status, address) but **does NOT include financial data**.

## Potential Financial Endpoints Found

### 1. Prime Contracts Endpoint
**Endpoint:** `/rest/v2.0/companies/{company_id}/projects/{project_id}/prime_contracts`

**What it provides:**
- List all prime contracts for a project
- Contains `total_amount` field (found in spec)
- May contain contract value information

**How to use:**
- First, get all projects (already working)
- For each project, call this endpoint to get prime contracts
- Sum up `total_amount` from all contracts = Total Contract Value

**Limitations:**
- Requires one API call per project
- May need to handle multiple contracts per project
- Need to check if this endpoint works in sandbox

### 2. Budget View / Project Status Snapshots
**Endpoints:**
- `/rest/v2.0/companies/{company_id}/projects/{project_id}/project_status_snapshots/budget_views`
- `/rest/v2.0/companies/{company_id}/projects/{project_id}/budget_view/{budget_view_id}/project_status_snapshots`

**What it provides:**
- Budget views for projects
- Project status snapshots with financial data
- May contain profitability metrics

**How to use:**
- Get available budget views for a project
- Get the latest project status snapshot
- Extract financial data from snapshot

**Limitations:**
- More complex - requires multiple steps
- May need specific budget view IDs
- Need to understand snapshot structure

### 3. Budget Line Items
**Endpoint:** `/rest/v2.0/companies/{company_id}/projects/{project_id}/budget_line_items/{id}`

**What it provides:**
- Detailed budget line items
- Cost breakdowns

**Limitations:**
- Very detailed, may be too granular
- Requires line item IDs

## Recommended Research Approach

### Step 1: Test Prime Contracts Endpoint
This seems like the most straightforward option for getting contract values.

**Test in Browser/Postman:**
```
GET https://sandbox.procore.com/rest/v2.0/companies/4278454/projects/306371/prime_contracts
Headers:
  Authorization: Bearer {your_access_token}
  Procore-Company-Id: 4278454
```

**What to check:**
- Does it return data?
- What fields are in the response?
- Is there a `total_amount` or `contract_amount` field?
- How many contracts per project?

### Step 2: Test Project Status Snapshots
If prime contracts don't have all the data we need, try project status snapshots.

**Test:**
```
GET https://sandbox.procore.com/rest/v2.0/companies/4278454/projects/306371/project_status_snapshots/budget_views
Headers:
  Authorization: Bearer {your_access_token}
  Procore-Company-Id: 4278454
```

**What to check:**
- What budget views are available?
- Can we get the latest snapshot?
- What financial fields are in snapshots?

### Step 3: Check Procore Developer Documentation
1. Go to: https://developers.procore.com/
2. Search for:
   - "Project Status Snapshots"
   - "Prime Contracts"
   - "Budget Views"
   - "Profitability"
3. Look for examples and field descriptions

### Step 4: Check Your Procore Sandbox UI
1. Log into Procore Sandbox
2. Open a project
3. Navigate to:
   - **Financials** → **Prime Contracts** (check what data is shown)
   - **Financials** → **Budget** (check what metrics are available)
   - **Project Status** (check if profitability data is shown)
4. Compare what you see in UI with what the API might return

## What Financial Data We Need

Based on your Project Profitability page, we need:
- ✅ **Total Contract Value** - Sum of all prime contracts
- ❓ **Projected Profit** - May be in project status snapshots
- ❓ **Cost at Completion** - May be in budget or project status
- ❓ **Job To Date Cost** - May be in project status
- ❓ **Percent Complete** - May be in project status

## Next Steps

1. **Test Prime Contracts endpoint** with one of your sandbox projects
2. **Share the response structure** so we can map the fields
3. **If Prime Contracts works**, we'll integrate it into the Firebase function
4. **If not**, we'll try Project Status Snapshots

## How to Test Endpoints

### Option A: Using Browser Console
```javascript
// In browser console on your app
const token = 'YOUR_ACCESS_TOKEN'; // Get from Firestore or console
const projectId = '306371'; // One of your project IDs

fetch(`https://sandbox.procore.com/rest/v2.0/companies/4278454/projects/${projectId}/prime_contracts`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Procore-Company-Id': '4278454'
  }
})
.then(r => r.json())
.then(data => console.log('Prime Contracts:', JSON.stringify(data, null, 2)));
```

### Option B: Using Postman/Insomnia
1. Create new GET request
2. URL: `https://sandbox.procore.com/rest/v2.0/companies/4278454/projects/306371/prime_contracts`
3. Headers:
   - `Authorization: Bearer {token}`
   - `Procore-Company-Id: 4278454`
4. Send request and examine response

### Option C: Add Temporary Logging to Firebase Function
We can add a test endpoint that calls these APIs and logs the response structure.

## Questions to Answer

1. ✅ Does Prime Contracts endpoint work in sandbox?
2. ✅ What fields does it return?
3. ✅ Can we get contract amounts?
4. ❓ Where is projected profit stored?
5. ❓ Where is cost at completion stored?
6. ❓ Do we need multiple API calls per project?

