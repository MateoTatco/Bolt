-- ============================================================================
-- AZURE SQL QUERIES: Investigate Project 135250003 (Burger King)
-- ============================================================================
-- Purpose: Find project 135250003 (previously 135250002) in Azure SQL Database
-- Table: dbo.ProjectProfitabilityArchive
-- 
-- Data Flow: Procore → Azure SQL Database → Bolt (Project Profitability Page)
-- 
-- Bolt filters to the MOST RECENT ArchiveDate per project, so if the project
-- exists but isn't on the most recent archive date, it won't show in Bolt.
-- ============================================================================

-- ============================================================================
-- QUERY 1: Check if project 135250003 exists (NEW NUMBER)
-- ============================================================================
-- This checks if the project with the new number exists in Azure
SELECT 
    ProjectName,
    ProjectNumber,
    ProjectManager,
    ArchiveDate,
    CAST(ArchiveDate AS DATE) as ArchiveDateOnly,
    ProjectRevisedContractAmount,
    IsActive as Active,
    ContractStatus,
    ProjectStage,
    ProcoreId,
    RedTeamImport,
    EstCostAtCompletion,
    ProjectedProfit,
    ContractStartDate,
    ContractEndDate
FROM dbo.ProjectProfitabilityArchive
WHERE ProjectNumber = '135250003'
ORDER BY ArchiveDate DESC;

-- ============================================================================
-- QUERY 2: Check if project 135250002 still exists (OLD NUMBER)
-- ============================================================================
-- This checks if the old project number still exists (duplicate)
SELECT 
    ProjectName,
    ProjectNumber,
    ProjectManager,
    ArchiveDate,
    CAST(ArchiveDate AS DATE) as ArchiveDateOnly,
    ProjectRevisedContractAmount,
    IsActive as Active,
    ContractStatus,
    ProjectStage,
    ProcoreId,
    RedTeamImport,
    EstCostAtCompletion,
    ProjectedProfit,
    ContractStartDate,
    ContractEndDate
FROM dbo.ProjectProfitabilityArchive
WHERE ProjectNumber = '135250002'
ORDER BY ArchiveDate DESC;

-- ============================================================================
-- QUERY 3: Find by Project Name (Burger King)
-- ============================================================================
-- Search for Burger King projects to find the correct one
SELECT 
    ProjectName,
    ProjectNumber,
    ProjectManager,
    ArchiveDate,
    CAST(ArchiveDate AS DATE) as ArchiveDateOnly,
    ProjectRevisedContractAmount,
    IsActive as Active,
    ContractStatus,
    ProjectStage,
    ProcoreId,
    RedTeamImport,
    EstCostAtCompletion,
    ProjectedProfit,
    ContractStartDate,
    ContractEndDate
FROM dbo.ProjectProfitabilityArchive
WHERE ProjectName LIKE '%Burger King%' 
   OR ProjectName LIKE '%burger king%'
   OR ProjectName LIKE '%BK%'
ORDER BY ArchiveDate DESC, ProjectNumber;

-- ============================================================================
-- QUERY 4: Check what the MOST RECENT ArchiveDate is
-- ============================================================================
-- Bolt only shows projects from the most recent archive date
-- If project 135250003 exists but isn't on this date, it won't show in Bolt
SELECT 
    MAX(CAST(ArchiveDate AS DATE)) as MostRecentArchiveDate,
    COUNT(DISTINCT ProjectNumber) as ProjectCountOnMostRecentDate
FROM dbo.ProjectProfitabilityArchive;

-- ============================================================================
-- QUERY 5: Check if 135250003 is on the MOST RECENT archive date
-- ============================================================================
-- This matches Bolt's query logic - only shows projects from most recent date
WITH MostRecentArchiveDate AS (
    SELECT MAX(CAST(ArchiveDate AS DATE)) as LatestArchiveDateOnly
    FROM dbo.ProjectProfitabilityArchive
),
MostRecentArchive AS (
    SELECT 
        ppa.ProjectNumber,
        MAX(ppa.ArchiveDate) as LatestArchiveDate
    FROM dbo.ProjectProfitabilityArchive ppa
    CROSS JOIN MostRecentArchiveDate mrad
    WHERE CAST(ppa.ArchiveDate AS DATE) = mrad.LatestArchiveDateOnly
    GROUP BY ppa.ProjectNumber
)
SELECT 
    ppa.ProjectName,
    ppa.ProjectNumber,
    ppa.ProjectManager,
    ppa.ArchiveDate,
    CAST(ppa.ArchiveDate AS DATE) as ArchiveDateOnly,
    ppa.ProjectRevisedContractAmount,
    ppa.IsActive as Active,
    ppa.ContractStatus,
    ppa.ProjectStage,
    ppa.ProcoreId,
    ppa.RedTeamImport,
    ppa.EstCostAtCompletion,
    ppa.ProjectedProfit,
    ppa.ContractStartDate,
    ppa.ContractEndDate
FROM dbo.ProjectProfitabilityArchive ppa
INNER JOIN MostRecentArchive mra 
    ON ppa.ProjectNumber = mra.ProjectNumber 
    AND ppa.ArchiveDate = mra.LatestArchiveDate
CROSS JOIN MostRecentArchiveDate mrad
WHERE ppa.ProjectNumber IN ('135250002', '135250003')
    AND CAST(ppa.ArchiveDate AS DATE) = mrad.LatestArchiveDateOnly
ORDER BY ppa.ProjectNumber;

-- ============================================================================
-- QUERY 6: Check ALL archive dates for both project numbers
-- ============================================================================
-- See the full history of both project numbers across all archive dates
SELECT 
    ProjectName,
    ProjectNumber,
    ProjectManager,
    ArchiveDate,
    CAST(ArchiveDate AS DATE) as ArchiveDateOnly,
    ProjectRevisedContractAmount,
    IsActive as Active,
    ContractStatus,
    ProjectStage,
    ProcoreId,
    RedTeamImport,
    EstCostAtCompletion,
    ProjectedProfit,
    ContractStartDate,
    ContractEndDate,
    CASE 
        WHEN CAST(ArchiveDate AS DATE) = (SELECT MAX(CAST(ArchiveDate AS DATE)) FROM dbo.ProjectProfitabilityArchive)
        THEN 'YES - Most Recent'
        ELSE 'NO - Older Date'
    END as IsOnMostRecentDate
FROM dbo.ProjectProfitabilityArchive
WHERE ProjectNumber IN ('135250002', '135250003')
ORDER BY ProjectNumber, ArchiveDate DESC;

-- ============================================================================
-- QUERY 7: Check if project is being filtered out by Bolt's filters
-- ============================================================================
-- Bolt uses filter: ProjectRevisedContractAmount > 0
-- This checks if the project would be excluded by that filter
WITH MostRecentArchiveDate AS (
    SELECT MAX(CAST(ArchiveDate AS DATE)) as LatestArchiveDateOnly
    FROM dbo.ProjectProfitabilityArchive
),
MostRecentArchive AS (
    SELECT 
        ppa.ProjectNumber,
        MAX(ppa.ArchiveDate) as LatestArchiveDate
    FROM dbo.ProjectProfitabilityArchive ppa
    CROSS JOIN MostRecentArchiveDate mrad
    WHERE CAST(ppa.ArchiveDate AS DATE) = mrad.LatestArchiveDateOnly
    GROUP BY ppa.ProjectNumber
)
SELECT 
    ppa.ProjectName,
    ppa.ProjectNumber,
    ppa.ProjectRevisedContractAmount,
    ppa.ProjectedProfit,
    ppa.IsActive as Active,
    ppa.RedTeamImport,
    CASE 
        WHEN ppa.ProjectRevisedContractAmount > 0 THEN '✅ Will Show in Bolt'
        WHEN ppa.ProjectRevisedContractAmount = 0 THEN '❌ Filtered Out (Amount = 0)'
        WHEN ppa.ProjectRevisedContractAmount IS NULL THEN '❌ Filtered Out (Amount is NULL)'
        ELSE '❌ Filtered Out (Amount < 0)'
    END as BoltVisibilityStatus
FROM dbo.ProjectProfitabilityArchive ppa
INNER JOIN MostRecentArchive mra 
    ON ppa.ProjectNumber = mra.ProjectNumber 
    AND ppa.ArchiveDate = mra.LatestArchiveDate
CROSS JOIN MostRecentArchiveDate mrad
WHERE ppa.ProjectNumber IN ('135250002', '135250003')
    AND CAST(ppa.ArchiveDate AS DATE) = mrad.LatestArchiveDateOnly;

-- ============================================================================
-- QUERY 8: Find projects by ProcoreId (if you have the Procore ID)
-- ============================================================================
-- If you know the Procore Project ID, you can search by it
-- Replace 'YOUR_PROCORE_ID' with the actual Procore Project ID
/*
SELECT 
    ProjectName,
    ProjectNumber,
    ProjectManager,
    ArchiveDate,
    CAST(ArchiveDate AS DATE) as ArchiveDateOnly,
    ProjectRevisedContractAmount,
    IsActive as Active,
    ContractStatus,
    ProjectStage,
    ProcoreId,
    RedTeamImport,
    EstCostAtCompletion,
    ProjectedProfit,
    ContractStartDate,
    ContractEndDate
FROM dbo.ProjectProfitabilityArchive
WHERE ProcoreId = 'YOUR_PROCORE_ID'
ORDER BY ArchiveDate DESC;
*/

-- ============================================================================
-- SUMMARY: What to Check
-- ============================================================================
-- 1. Run Query 1: Check if 135250003 exists
-- 2. Run Query 2: Check if 135250002 still exists (duplicate)
-- 3. Run Query 4: Check what the most recent archive date is
-- 4. Run Query 5: Check if 135250003 is on the most recent date (this is what Bolt shows)
-- 5. Run Query 7: Check if project is being filtered out by Bolt's filters
--
-- Common Reasons Project Might Not Show in Bolt:
-- 1. Project exists but NOT on the most recent ArchiveDate
-- 2. ProjectRevisedContractAmount = 0 or NULL (filtered out)
-- 3. Procore hasn't synced the new project number to Azure yet
-- 4. Azure sync hasn't run since the project number was changed
-- ============================================================================

