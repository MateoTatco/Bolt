# Azure SQL Database Approach - Project Profitability

## Overview
Instead of fetching data from Procore API (which has rate limits and missing fields), we can query the Azure SQL database that Power BI uses. This database already has the correct calculations.

## Database Information
- **Database**: `tatco (tatco/tatco)`
- **Key View**: `dbo.v_ProjectProfitability` - This likely contains all the profitability data we need

## Benefits
1. ✅ **No Rate Limiting** - Direct database queries don't have API rate limits
2. ✅ **Correct Values** - Database already has the correct calculations (matches Power BI)
3. ✅ **Faster** - Single query instead of multiple API calls
4. ✅ **More Reliable** - No API errors or missing fields

## What We Need

### 1. View Structure
First, let's see what columns are in `dbo.v_ProjectProfitability`:
```sql
SELECT TOP 1 * FROM dbo.v_ProjectProfitability
```

Or to see column names:
```sql
SELECT COLUMN_NAME, DATA_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'v_ProjectProfitability'
```

### 2. Connection Information
We'll need:
- **Server Name**: (e.g., `tatco.database.windows.net`)
- **Database Name**: `tatco`
- **Authentication**: SQL Authentication or Azure AD
- **Username/Password** or **Connection String**

### 3. Required Columns
Based on what we're trying to match, we need:
- Project Number (130100006)
- Project Name
- Customer Retainage
- Vendor Retainage
- Total Invoiced
- Total Contract Value
- Est. Cost at Completion
- Remaining Cost
- And other profitability fields

## Implementation Plan

### Step 1: Query the View
Run this query in Azure Query Editor to see the structure:
```sql
SELECT TOP 10 * 
FROM dbo.v_ProjectProfitability
WHERE ProjectNumber = '130100006'  -- Chicken Salad Chick - Norman
```

### Step 2: Set Up Database Connection
We'll need to:
1. Store connection credentials securely (Firebase Functions environment variables)
2. Install SQL client library (`mssql` or `tedious` for Node.js)
3. Create a new Firebase Function to query the database

### Step 3: Replace Procore API Calls
Instead of multiple Procore API calls, we'll:
- Query `dbo.v_ProjectProfitability` once
- Get all the data we need in a single query
- Return it in the same format as the Procore function

## Next Steps

1. **Run the query** to see the view structure
2. **Share the results** so I can see what columns are available
3. **Get connection details** (we'll store them securely)
4. **Implement the database query function**

