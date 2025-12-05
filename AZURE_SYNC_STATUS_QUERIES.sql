-- ============================================================================
-- AZURE SYNC STATUS QUERIES: Check Procore → Azure Sync Status
-- ============================================================================
-- Purpose: Determine when the last sync occurred and check sync frequency
-- 
-- IMPORTANT: Bolt does NOT control the Procore → Azure sync.
-- The sync is handled by an external process (Azure Data Factory, 
-- Logic Apps, Procore export, or another integration service).
-- 
-- These queries help you understand the sync pattern and timing.
-- ============================================================================

-- ============================================================================
-- QUERY 1: Find the Most Recent Archive Date (Last Sync Date)
-- ============================================================================
-- This shows when the last sync from Procore to Azure occurred
-- The ArchiveDate represents when data was archived/synced to Azure
SELECT 
    MAX(CAST(ArchiveDate AS DATE)) as MostRecentSyncDate,
    MAX(ArchiveDate) as MostRecentSyncDateTime,
    COUNT(DISTINCT ProjectNumber) as ProjectCountOnMostRecentDate,
    COUNT(*) as TotalRecordsOnMostRecentDate
FROM dbo.ProjectProfitabilityArchive;

-- ============================================================================
-- QUERY 2: Check All Archive Dates and Their Frequency
-- ============================================================================
-- Shows all sync dates and how many projects were synced on each date
-- This helps identify sync frequency (daily, multiple times per day, etc.)
SELECT 
    CAST(ArchiveDate AS DATE) as SyncDate,
    COUNT(DISTINCT ProjectNumber) as UniqueProjects,
    COUNT(*) as TotalRecords,
    MIN(ArchiveDate) as FirstSyncTime,
    MAX(ArchiveDate) as LastSyncTime
FROM dbo.ProjectProfitabilityArchive
GROUP BY CAST(ArchiveDate AS DATE)
ORDER BY SyncDate DESC;

-- ============================================================================
-- QUERY 3: Check Recent Sync History (Last 30 Days)
-- ============================================================================
-- Shows sync activity over the last 30 days
-- Helps identify if syncs are running regularly
SELECT 
    CAST(ArchiveDate AS DATE) as SyncDate,
    COUNT(DISTINCT ProjectNumber) as UniqueProjects,
    COUNT(*) as TotalRecords,
    MIN(ArchiveDate) as FirstSyncTime,
    MAX(ArchiveDate) as LastSyncTime,
    DATEDIFF(DAY, CAST(ArchiveDate AS DATE), GETDATE()) as DaysAgo
FROM dbo.ProjectProfitabilityArchive
WHERE CAST(ArchiveDate AS DATE) >= DATEADD(DAY, -30, GETDATE())
GROUP BY CAST(ArchiveDate AS DATE)
ORDER BY SyncDate DESC;

-- ============================================================================
-- QUERY 4: Check if Project 135250003 Should Have Synced
-- ============================================================================
-- Checks if the project number change happened before the last sync
-- If the change was made AFTER the last sync, it won't be in Azure yet
SELECT 
    'Last Sync Date' as Info,
    MAX(CAST(ArchiveDate AS DATE)) as Value,
    'This is when Azure last received data from Procore' as Description
FROM dbo.ProjectProfitabilityArchive

UNION ALL

SELECT 
    'Project 135250003 Exists' as Info,
    CASE 
        WHEN EXISTS (SELECT 1 FROM dbo.ProjectProfitabilityArchive WHERE ProjectNumber = '135250003')
        THEN 1
        ELSE 0
    END as Value,
    '1 = Exists in Azure, 0 = Not synced yet' as Description

UNION ALL

SELECT 
    'Project 135250002 Still Exists' as Info,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM dbo.ProjectProfitabilityArchive 
            WHERE ProjectNumber = '135250002' 
            AND CAST(ArchiveDate AS DATE) = (SELECT MAX(CAST(ArchiveDate AS DATE)) FROM dbo.ProjectProfitabilityArchive)
        )
        THEN 1
        ELSE 0
    END as Value,
    '1 = Old number still on most recent date, 0 = Removed or not on latest date' as Description;

-- ============================================================================
-- QUERY 5: Check Sync Frequency Pattern
-- ============================================================================
-- Analyzes the sync pattern to determine frequency
-- Shows gaps between syncs and average time between syncs
WITH SyncDates AS (
    SELECT DISTINCT CAST(ArchiveDate AS DATE) as SyncDate
    FROM dbo.ProjectProfitabilityArchive
),
SyncGaps AS (
    SELECT 
        SyncDate,
        LAG(SyncDate) OVER (ORDER BY SyncDate DESC) as PreviousSyncDate,
        DATEDIFF(DAY, LAG(SyncDate) OVER (ORDER BY SyncDate DESC), SyncDate) as DaysBetweenSyncs
    FROM SyncDates
)
SELECT 
    'Sync Frequency Analysis' as AnalysisType,
    MIN(DaysBetweenSyncs) as MinDaysBetweenSyncs,
    MAX(DaysBetweenSyncs) as MaxDaysBetweenSyncs,
    AVG(DaysBetweenSyncs) as AvgDaysBetweenSyncs,
    COUNT(*) as TotalSyncs,
    MIN(SyncDate) as FirstSyncDate,
    MAX(SyncDate) as LastSyncDate
FROM SyncGaps
WHERE DaysBetweenSyncs IS NOT NULL;

-- ============================================================================
-- QUERY 6: Check When Project 135250002 Last Appeared
-- ============================================================================
-- Shows the last time the old project number (135250002) was synced
-- If this is the most recent sync date, the new number hasn't synced yet
SELECT 
    ProjectNumber,
    ProjectName,
    MAX(CAST(ArchiveDate AS DATE)) as LastSyncDate,
    MAX(ArchiveDate) as LastSyncDateTime,
    COUNT(*) as TotalRecords
FROM dbo.ProjectProfitabilityArchive
WHERE ProjectNumber = '135250002'
GROUP BY ProjectNumber, ProjectName;

-- ============================================================================
-- QUERY 7: Compare Sync Dates for Both Project Numbers
-- ============================================================================
-- Shows when each project number last appeared in Azure
-- Helps determine if the change has synced
SELECT 
    ProjectNumber,
    MAX(CAST(ArchiveDate AS DATE)) as LastSyncDate,
    MAX(ArchiveDate) as LastSyncDateTime,
    COUNT(*) as TotalRecords,
    CASE 
        WHEN MAX(CAST(ArchiveDate AS DATE)) = (SELECT MAX(CAST(ArchiveDate AS DATE)) FROM dbo.ProjectProfitabilityArchive)
        THEN '✅ On Most Recent Sync'
        ELSE '❌ Not on Most Recent Sync'
    END as SyncStatus
FROM dbo.ProjectProfitabilityArchive
WHERE ProjectNumber IN ('135250002', '135250003')
GROUP BY ProjectNumber
ORDER BY ProjectNumber;

-- ============================================================================
-- QUERY 8: Check for Multiple Syncs Per Day
-- ============================================================================
-- Shows if there are multiple syncs per day (indicates frequent syncing)
SELECT 
    CAST(ArchiveDate AS DATE) as SyncDate,
    COUNT(DISTINCT CAST(ArchiveDate AS TIME)) as SyncsPerDay,
    STRING_AGG(
        CAST(CAST(ArchiveDate AS TIME) AS VARCHAR(8)), 
        ', '
    ) WITHIN GROUP (ORDER BY ArchiveDate) as SyncTimes
FROM dbo.ProjectProfitabilityArchive
WHERE CAST(ArchiveDate AS DATE) >= DATEADD(DAY, -7, GETDATE())
GROUP BY CAST(ArchiveDate AS DATE)
HAVING COUNT(DISTINCT CAST(ArchiveDate AS TIME)) > 1
ORDER BY SyncDate DESC;

-- ============================================================================
-- INTERPRETATION GUIDE
-- ============================================================================
-- 
-- 1. QUERY 1: Most Recent Sync Date
--    - Shows when Azure last received data from Procore
--    - If this is old (e.g., > 1 day), sync may not be running
-- 
-- 2. QUERY 2: All Archive Dates
--    - Shows sync frequency pattern
--    - Daily syncs = 1 row per day
--    - Multiple per day = Multiple rows per day
-- 
-- 3. QUERY 3: Recent History
--    - Check if syncs are happening regularly
--    - Gaps indicate sync issues
-- 
-- 4. QUERY 4: Project Status
--    - Quick check if 135250003 exists
--    - Shows if old number still on most recent date
-- 
-- 5. QUERY 5: Sync Frequency
--    - Determines sync schedule (daily, weekly, etc.)
--    - Shows average time between syncs
-- 
-- 6. QUERY 6: Old Project Last Sync
--    - When was 135250002 last seen?
--    - If this matches most recent date, new number hasn't synced
-- 
-- 7. QUERY 7: Comparison
--    - Direct comparison of both project numbers
--    - Shows which one is on the most recent sync
-- 
-- 8. QUERY 8: Multiple Syncs Per Day
--    - Shows if sync runs multiple times per day
--    - Indicates more frequent syncing
-- 
-- ============================================================================
-- NEXT STEPS
-- ============================================================================
-- 
-- If project 135250003 doesn't exist:
-- 1. Check Query 1: When was the last sync?
-- 2. Check Query 6: When was 135250002 last synced?
-- 3. If last sync was BEFORE the project number change → Wait for next sync
-- 4. If last sync was AFTER the change → Check Procore to verify number was changed
-- 
-- To find the sync process:
-- 1. Check Azure Portal → Data Factory (if using Azure Data Factory)
-- 2. Check Azure Portal → Logic Apps (if using Logic Apps)
-- 3. Check Procore → Integrations/Connections (if Procore has built-in export)
-- 4. Check with your IT/DevOps team about the sync process
-- 
-- ============================================================================

