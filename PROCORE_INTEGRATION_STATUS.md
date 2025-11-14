# Procore Integration Status

## ✅ Working Features

### 1. Authentication & Authorization
- ✅ OAuth 2.0 Authorization Code Grant flow
- ✅ Token exchange and storage in Firestore
- ✅ Automatic token refresh
- ✅ Connection testing

### 2. Project Data
- ✅ **Total Contract Value**: Successfully fetched from `total_value` field in project details
  - Endpoint: `/rest/v1.0/projects/{project_id}`
  - Field: `projectDetail.total_value`
  - Example: $31,502,663 across 50 projects

- ✅ **Projected Profit**: Successfully extracted from custom field
  - Custom Field ID: `custom_field_598134325649528`
  - Data Type: `decimal`
  - Location: `projectDetail.custom_fields.custom_field_598134325649528.value`
  - Example: $1,587,991 across 50 projects

- ✅ **Project Basic Info**: Name, number, status, dates, etc.
  - From project list endpoint: `/rest/v1.0/companies/{company_id}/projects`
  - From project detail endpoint: `/rest/v1.0/projects/{project_id}`

### 3. Calculated Fields
- ✅ **Percent Projected Profit**: Calculated as `(projectedProfit / totalValue) * 100`
- ✅ **Project Status**: Derived from `active` field and `status_name`

## ❌ Not Available / Requires Additional Setup

### 1. Project Status Snapshots
- ❌ **Budget Views Endpoint**: Returns 403 Forbidden
  - Endpoint: `/rest/v2.0/companies/{company_id}/projects/{project_id}/project_status_snapshots/budget_views`
  - Error: 403 (Permissions issue or feature not enabled)

- ❌ **Project Status Snapshots**: Returns 404 Not Found
  - Endpoint: `/rest/v2.0/companies/{company_id}/projects/{project_id}/project_status_snapshots`
  - Error: 404 (Endpoint not available or wrong structure)

**Impact**: Cannot access:
- Job To Date Cost
- Cost at Completion
- Percent Complete (Revenue/Cost)
- Other financial metrics from snapshots

### 2. Prime Contracts
- ⚠️ **Status**: Not yet tested (endpoint exists but may require permissions)
  - Endpoint: `/rest/v2.0/companies/{company_id}/projects/{project_id}/prime_contracts`
  - Potential data: Contract amounts, retainage, invoiced amounts

## 📊 Current Data Summary

### Available Fields (per project):
```javascript
{
  id: string,
  projectName: string,
  projectNumber: string,
  projectManager: string,
  projectSystem: "Procore",
  projectStatus: "Active" | "Inactive",
  totalContractValue: number,        // ✅ From total_value
  currentProjectedProfit: number,    // ✅ From custom field
  percentProjectedProfit: number,    // ✅ Calculated
  contractStartDate: string | null,
  contractEndDate: string | null,
  isActive: boolean,
  // Fields below are set to 0 (not available):
  estCostAtCompletion: 0,
  initialEstimatedProfit: 0,
  estimatedDifference: 0,
  balanceLeftOnContract: 0,
  percentCompleteRevenue: 0,
  percentCompleteCost: 0,
  customerRetainage: 0,
  remainingCost: 0,
  vendorRetainage: 0,
  totalInvoiced: 0,
}
```

## 🔧 To Enable Additional Financial Data

### Option 1: Enable Project Status Snapshots in Procore
1. Log into Procore (production or sandbox)
2. Navigate to: **Project Settings** → **Financials** → **Project Status**
3. Ensure "Project Status" feature is enabled
4. Create at least one Project Status snapshot
5. Verify OAuth app has required scopes/permissions

### Option 2: Request Additional API Permissions
1. Check Procore Developer Portal: https://developers.procore.com/
2. Verify OAuth app scopes include:
   - `read:project-status`
   - `read:budget`
   - `read:financials`
3. Re-authorize the application after adding scopes

### Option 3: Use Alternative Endpoints
- **Prime Contracts**: May provide contract amounts and invoiced data
- **Commitments**: May provide cost tracking
- **Invoices**: May provide invoiced amounts

## 📝 Next Steps

1. **Test Prime Contracts Endpoint**: Click "🧪 Test Prime Contracts" button to see if it provides additional data
2. **Check Procore UI**: Verify if Project Status feature is enabled in your Procore account
3. **Contact Procore Support**: If Project Status is enabled in UI but API returns 403/404, may need API access enabled
4. **Consider Custom Fields**: Additional financial metrics could be stored in custom fields (like Projected Profit)

## 🎯 Current Integration Status

**Status**: ✅ **Partially Working**

- **Working**: Total Contract Value, Projected Profit, Basic Project Info
- **Not Available**: Job To Date Cost, Cost at Completion, Percent Complete (requires Project Status Snapshots)
- **Performance**: Fetching 50 projects with individual detail calls (50+ API calls per load)

## 💡 Recommendations

1. **For Production**: Consider caching project details to reduce API calls
2. **For Missing Data**: 
   - Use mock data as fallback for fields not available via API
   - Or display "N/A" for unavailable metrics
   - Or calculate estimates from available data
3. **For Performance**: 
   - Implement pagination for projects
   - Cache project details in Firestore
   - Batch API calls where possible

