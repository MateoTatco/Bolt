-- ============================================================================
-- MANUAL UPDATE: Change Project Number 135250002 → 135250003
-- ============================================================================
-- WARNING: Only use this if you need immediate results and understand the risks
-- 
-- RECOMMENDATION: Wait for natural sync (should happen around 4:18 PM today)
-- 
-- This manual update will:
-- 1. Update the most recent records (2025-12-05) from 135250002 to 135250003
-- 2. Keep historical records unchanged (for audit trail)
-- 
-- RISKS:
-- - Next sync (around 4:18 PM) may overwrite this change
-- - If Procore still has 135250002, sync will bring it back
-- - Manual changes may cause data inconsistencies
-- ============================================================================

-- ============================================================================
-- STEP 1: BACKUP - Create backup of records before updating
-- ============================================================================
-- Run this first to create a backup table
SELECT * 
INTO dbo.ProjectProfitabilityArchive_Backup_135250002_20251205
FROM dbo.ProjectProfitabilityArchive
WHERE ProjectNumber = '135250002'
AND CAST(ArchiveDate AS DATE) = '2025-12-05';

-- Verify backup was created
SELECT COUNT(*) as BackupRecordCount
FROM dbo.ProjectProfitabilityArchive_Backup_135250002_20251205;

-- ============================================================================
-- STEP 2: VERIFY - Check what will be updated
-- ============================================================================
-- Review the records that will be changed BEFORE running the update
SELECT 
    ProjectName,
    ProjectNumber,
    ArchiveDate,
    ProjectRevisedContractAmount,
    IsActive,
    ContractStatus,
    ProjectStage
FROM dbo.ProjectProfitabilityArchive
WHERE ProjectNumber = '135250002'
AND CAST(ArchiveDate AS DATE) = '2025-12-05'
ORDER BY ArchiveDate;

-- ============================================================================
-- STEP 3: UPDATE - Change project number on most recent date only
-- ============================================================================
-- This updates ONLY the most recent sync date (2025-12-05)
-- Historical records remain unchanged for audit purposes
UPDATE dbo.ProjectProfitabilityArchive
SET ProjectNumber = '135250003'
WHERE ProjectNumber = '135250002'
AND CAST(ArchiveDate AS DATE) = '2025-12-05';

-- ============================================================================
-- STEP 4: VERIFY - Check the update was successful
-- ============================================================================
-- Verify 135250003 now exists on most recent date
SELECT 
    ProjectName,
    ProjectNumber,
    ArchiveDate,
    ProjectRevisedContractAmount,
    IsActive,
    ContractStatus,
    ProjectStage
FROM dbo.ProjectProfitabilityArchive
WHERE ProjectNumber = '135250003'
AND CAST(ArchiveDate AS DATE) = '2025-12-05'
ORDER BY ArchiveDate;

-- Verify 135250002 no longer exists on most recent date
SELECT 
    COUNT(*) as RemainingOldRecords
FROM dbo.ProjectProfitabilityArchive
WHERE ProjectNumber = '135250002'
AND CAST(ArchiveDate AS DATE) = '2025-12-05';
-- Should return 0

-- ============================================================================
-- STEP 5: ROLLBACK (if needed)
-- ============================================================================
-- If something goes wrong, restore from backup:
/*
DELETE FROM dbo.ProjectProfitabilityArchive
WHERE ProjectNumber = '135250003'
AND CAST(ArchiveDate AS DATE) = '2025-12-05';

INSERT INTO dbo.ProjectProfitabilityArchive
SELECT * FROM dbo.ProjectProfitabilityArchive_Backup_135250002_20251205;
*/

-- ============================================================================
-- IMPORTANT NOTES
-- ============================================================================
-- 
-- 1. This only updates the MOST RECENT sync date (2025-12-05)
--    - Historical records with 135250002 remain unchanged
--    - This is intentional for audit trail
-- 
-- 2. Next sync (around 4:18 PM) may:
--    - Overwrite this change if Procore still has 135250002
--    - OR bring in 135250003 if Procore has been updated
-- 
-- 3. After running this:
--    - Check Bolt's Project Profitability page
--    - The project should appear with number 135250003
--    - Monitor the next sync to ensure it doesn't revert
-- 
-- 4. If the next sync reverts the change:
--    - The issue is in Procore (number not actually changed)
--    - OR the sync process is pulling old data
--    - You'll need to fix it in Procore first
-- 
-- ============================================================================

