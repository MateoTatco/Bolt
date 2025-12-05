# Project 135250003 Investigation Guide

## Problem Summary
- **Original Project Number**: 135250002 (Burger King project)
- **New Project Number**: 135250003 (changed to avoid duplicate)
- **Issue**: Project not appearing in Bolt's Project Profitability page after number change

## Data Flow: Procore → Azure → Bolt

```
Procore (Project Management Tool)
    ↓
    [Sync Process - Automatic/Manual]
    ↓
Azure SQL Database (dbo.ProjectProfitabilityArchive)
    ↓
    [Cloud Function: azureSqlGetAllProjectsProfitability]
    ↓
Bolt (Project Profitability Page)
```

### Key Points:
1. **Procore** is the source of truth - projects are created/managed there
2. **Azure SQL Database** receives data from Procore via a sync process (timing varies)
3. **Bolt** queries Azure SQL Database to display project profitability data
4. **Bolt filters** to only show projects from the **most recent ArchiveDate**

## Why Projects Might Not Show in Bolt

### 1. **Not on Most Recent Archive Date** (Most Common)
- Bolt only shows projects from the **most recent ArchiveDate** in the database
- If project 135250003 exists but isn't on the latest archive date, it won't appear
- **Solution**: Wait for next Azure sync, or check if sync is running

### 2. **Filtered Out by Contract Amount**
- Bolt filters out projects where `ProjectRevisedContractAmount <= 0`
- If the project has $0 or NULL contract amount, it won't show
- **Solution**: Check Query 7 in the SQL file

### 3. **Azure Sync Not Complete**
- Procore → Azure sync may not have run since project number was changed
- The sync process may take time (hours/days depending on schedule)
- **Solution**: Check when last sync occurred, wait for next sync

### 4. **Project Number Not Updated in Procore**
- If the project number wasn't actually changed in Procore, Azure won't have the new number
- **Solution**: Verify in Procore that project number is actually 135250003

## How to Investigate

### Option 1: Use Azure Portal (Recommended)
1. Open Azure Portal → SQL databases → Your database
2. Click "Query editor" or use SQL Server Management Studio
3. Run queries from `AZURE_PROJECT_INVESTIGATION_QUERIES.sql`
4. Start with **Query 1** (check if 135250003 exists)

### Option 2: Use Bolt's Built-in Investigation Tool
Bolt has a function `investigateProjectInAzure` that you can call from the browser console:

```javascript
// In browser console on Bolt
const ProcoreService = (await import('./services/ProcoreService.js')).ProcoreService;
const result = await ProcoreService.investigateProjectInAzure('135250003');
console.log(result);
```

This will show:
- If project exists on most recent archive date
- All historical records for the project number
- Whether it's being filtered out

## Step-by-Step Investigation

### Step 1: Check if Project Exists
Run **Query 1** from the SQL file:
- If results found → Project exists in Azure
- If no results → Project hasn't synced to Azure yet

### Step 2: Check Most Recent Archive Date
Run **Query 4** from the SQL file:
- Note the date shown
- This is the date Bolt uses to filter projects

### Step 3: Check if Project is on Most Recent Date
Run **Query 5** from the SQL file:
- If 135250003 appears → Should show in Bolt (check Step 4)
- If 135250003 doesn't appear → Project exists but not on most recent date

### Step 4: Check if Project is Filtered Out
Run **Query 7** from the SQL file:
- Check the `BoltVisibilityStatus` column
- If shows "✅ Will Show in Bolt" → Should appear (may need to refresh Bolt)
- If shows "❌ Filtered Out" → Project is excluded by filters

### Step 5: Check Old Project Number
Run **Query 2** from the SQL file:
- Check if 135250002 still exists
- If it does, you may have duplicate records

## Expected Results

### If Project Should Show in Bolt:
- ✅ Exists in Azure (Query 1 returns results)
- ✅ On most recent archive date (Query 5 returns results)
- ✅ Contract amount > 0 (Query 7 shows "Will Show in Bolt")

### If Project Won't Show in Bolt:
- ❌ Not in Azure yet → Wait for Procore sync
- ❌ Not on most recent date → Wait for next Azure archive run
- ❌ Contract amount = 0 or NULL → Update contract amount in Procore
- ❌ Old number (135250002) still exists → May need to delete old records

## Next Steps After Investigation

1. **If project exists but not on most recent date:**
   - Wait for next Azure archive/sync process
   - Check with team when Azure sync runs (daily/weekly?)

2. **If project doesn't exist in Azure:**
   - Verify project number was changed in Procore
   - Check Procore sync status/logs
   - May need to trigger manual sync

3. **If project is filtered out:**
   - Update contract amount in Procore if it's $0
   - Check if project is marked as inactive

4. **If old project number still exists:**
   - May need to delete old records (135250002) from Azure
   - Or wait for sync to update/remove old records

## Questions to Ask Your Team

1. **When does Procore sync to Azure?** (Daily? Weekly? Manual?)
2. **How long does it take for changes in Procore to appear in Azure?**
3. **When was the project number changed in Procore?**
4. **Is there a way to trigger a manual sync from Procore to Azure?**

## Files Created

- `AZURE_PROJECT_INVESTIGATION_QUERIES.sql` - SQL queries to run in Azure Portal
- This guide - Step-by-step investigation process

