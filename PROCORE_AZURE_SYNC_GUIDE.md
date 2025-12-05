# Procore → Azure Sync Status Guide

## Understanding the Sync Process

### Important: Bolt Does NOT Control the Sync

**Bolt only READS from Azure SQL Database** - it does not write to it or control the sync process.

The sync from **Procore → Azure SQL Database** is handled by an **external process** that is NOT part of the Bolt codebase. This could be:

1. **Azure Data Factory** - Scheduled data pipeline
2. **Azure Logic Apps** - Workflow automation
3. **Procore Export/Integration** - Built-in Procore feature
4. **Third-party Integration Tool** - Like Zapier, MuleSoft, etc.
5. **Custom Script/Service** - Separate application/service

## How to Check Sync Status

### Step 1: Run Sync Status Queries

Use the queries in `AZURE_SYNC_STATUS_QUERIES.sql` to check:

1. **Query 1**: When was the last sync? (Most Recent Archive Date)
2. **Query 2**: What's the sync frequency pattern?
3. **Query 4**: Does project 135250003 exist in Azure?
4. **Query 7**: Compare both project numbers' sync dates

### Step 2: Interpret Results

#### If Last Sync Date is Recent (Today/Yesterday):
- ✅ Sync is running
- ⚠️ If 135250003 doesn't exist, the change may not have been made in Procore yet, OR
- ⚠️ The sync process may not have picked up the change yet

#### If Last Sync Date is Old (> 2 days):
- ❌ Sync may not be running
- ❌ Need to check the sync process/service
- ❌ May need to restart/trigger the sync manually

#### If 135250002 Still on Most Recent Date:
- The old project number is still in Azure
- The new number (135250003) hasn't synced yet
- Either:
  - Sync hasn't run since the change was made in Procore
  - OR the change wasn't actually made in Procore

## Finding the Sync Process

### Option 1: Check Azure Portal

1. **Azure Data Factory**:
   - Go to Azure Portal → Data Factories
   - Look for pipelines that reference Procore or your database
   - Check pipeline run history

2. **Azure Logic Apps**:
   - Go to Azure Portal → Logic Apps
   - Look for workflows that reference Procore
   - Check run history

3. **Azure SQL Database**:
   - Check for external data sources or linked servers
   - Look for scheduled jobs (SQL Agent jobs)

### Option 2: Check Procore

1. **Procore Integrations**:
   - Log into Procore
   - Go to Company Settings → Integrations
   - Look for Azure, SQL, or database connections
   - Check integration logs/status

2. **Procore API/Export**:
   - Check if there's a scheduled export feature
   - Look for data export or reporting features

### Option 3: Check with Your Team

Ask your IT/DevOps team:
- "What process syncs Procore data to Azure SQL Database?"
- "When does it run?" (Schedule)
- "How can we check if it's running?"
- "Can we trigger a manual sync?"

## For Project 135250003 Specifically

### Current Situation:
- ✅ Project number changed in Procore to 135250003
- ❌ Project 135250003 does NOT exist in Azure (Query 1 returned 0 results)
- ⚠️ Project 135250002 still exists on most recent sync date (2025-12-05)

### What This Means:
1. **The sync hasn't run since the project number was changed**
   - OR
2. **The sync ran but didn't pick up the change** (less likely)

### What to Do:

1. **Verify in Procore**:
   - Double-check that project number is actually 135250003 in Procore
   - Check when the change was made
   - Verify the project is active and not deleted

2. **Check Sync Schedule**:
   - Run Query 1 from `AZURE_SYNC_STATUS_QUERIES.sql` to see last sync date
   - Run Query 2 to see sync frequency
   - Determine when the next sync should occur

3. **Wait for Next Sync**:
   - If sync runs daily, wait until tomorrow
   - If sync runs multiple times per day, wait a few hours
   - If sync runs weekly, wait until next scheduled run

4. **Trigger Manual Sync** (if possible):
   - If you find the sync process, trigger it manually
   - This may require access to Azure Data Factory, Logic Apps, or Procore integrations

5. **Monitor**:
   - After next sync, run Query 1 again to check if 135250003 appears
   - Use Query 7 to compare both project numbers

## Expected Timeline

Based on your query results:
- **Most Recent Sync**: 2025-12-05 (from Query 5 results)
- **Current Date**: Likely 2025-12-05 or later
- **Project Number Changed**: Unknown (need to verify)

### If sync runs daily:
- Next sync should be within 24 hours
- Check again tomorrow

### If sync runs multiple times per day:
- Next sync could be within hours
- Check again in a few hours

### If sync runs weekly:
- Next sync could be days away
- May need to trigger manually

## Troubleshooting

### If Sync Isn't Running:

1. **Check Azure Data Factory/Logic Apps**:
   - Look for failed pipeline runs
   - Check error logs
   - Verify credentials/connections

2. **Check Procore**:
   - Verify API access is still valid
   - Check if any integrations are disabled
   - Look for error notifications

3. **Contact Support**:
   - If you can't find the sync process, contact your IT team
   - They should know what service handles the sync

### If Sync Runs But Project Still Missing:

1. **Verify Procore Change**:
   - Confirm project number is actually 135250003 in Procore
   - Check if project is active
   - Verify project hasn't been deleted/archived

2. **Check Sync Filters**:
   - The sync process may filter certain projects
   - Check if there are filters excluding this project

3. **Check Sync Logs**:
   - Look for errors in sync logs
   - Check if this specific project failed to sync

## Files Created

- `AZURE_SYNC_STATUS_QUERIES.sql` - Queries to check sync status and frequency
- This guide - How to interpret results and find the sync process

## Quick Reference

**To check if 135250003 exists:**
```sql
SELECT COUNT(*) FROM dbo.ProjectProfitabilityArchive 
WHERE ProjectNumber = '135250003';
```

**To check last sync date:**
```sql
SELECT MAX(CAST(ArchiveDate AS DATE)) as LastSyncDate 
FROM dbo.ProjectProfitabilityArchive;
```

**To check if old number still on most recent date:**
```sql
SELECT * FROM dbo.ProjectProfitabilityArchive 
WHERE ProjectNumber = '135250002' 
AND CAST(ArchiveDate AS DATE) = (
    SELECT MAX(CAST(ArchiveDate AS DATE)) 
    FROM dbo.ProjectProfitabilityArchive
);
```

