# Power BI Investigation Queries

## Critical Finding
Power BI Model View shows `ProjectProfitabilityArchive` table, but we're using `dbo.v_ProjectProfitability`. 
We need to verify which table/view Power BI actually uses.

## Query 1: Check if ProjectProfitabilityArchive table exists
```sql
-- Check if this table exists and what it contains
SELECT TOP 10 *
FROM dbo.ProjectProfitabilityArchive
ORDER BY ArchiveDate DESC
```

results: 

ProjectName
ProjectRevisedContractAmount
ProjectNumber
EstCostAtCompletion
JobCostToDate
PercentCompleteBasedOnCost
RemainingCost
ProjectedProfit
ProjectedProfitPercentage
ContractStartDate
ContractEndDate
TotalInvoiced
ContractStatus
ProjectStage
BalanceLeftOnContract
PercentCompleteBasedOnRevenue
CustomerRetainage
VendorRetainage
ArchiveDate
RedTeamImport
ProjectManager
ProfitCenterYear
ProcoreId
EstimatedProjectProfit
IsActive
Brakes Plus - N. Penn - OKC
1800000.00
131600002
2026-01-16T00:00:00.0000000
Not Awarded
2025-11-21T08:24:18.9730000
0
Cindy Smith-Frawner
2026
0
Yellow Earth Learning Center - Stroud, OK
0.00
135730001
2026-09-01T00:00:00.0000000
Not Awarded
2025-11-21T08:24:18.9730000
0
Simon Cox
2026
0
Dutch Bros - Oviedo
1385769.41
219300008
1240837.71
484641.30
0.39
756196.41
144931.70
10.46
2026-01-29T00:00:00.0000000
Approved
Course of Construction
912802.45
2961.90
2025-11-21T08:24:18.9730000
0
Trey Roberts
2026
140921.76
1
Dutch Bros Coffee - Oviedo
0.00
235740001
2026-01-13T00:00:00.0000000
Bidding
2025-11-21T08:24:18.9730000
0
2026
0
Hulsey Dental Office - OKC
1300000.00
135750001
2026-03-30T00:00:00.0000000
Not Awarded
2025-11-21T08:24:18.9730000
0
Simon Cox
2026
0
Chipotle 5001 Interior - Sachse, TX - Additional Edging & Mulch
628.29
330200002
320.69
320.69
1.00
0.00
307.60
48.96
2025-06-16T00:00:00.0000000
2025-06-27T00:00:00.0000000
Approved
Warranty
0.00
2025-11-21T08:24:18.9730000
0
Joe Lassiter
2025
0
Chicken Salad Chick Quail Springs - Add on's
14475.78
130100003
14475.78
14475.78
1.00
0.00
0.00
0.00
2025-07-31T00:00:00.0000000
Approved
Post-Construction
530.78
0.00
2025-11-21T08:24:18.9730000
0
Simon Cox
2025
1
Chicken Salad Chick - Del City
650000.00
130100004
2025-12-13T00:00:00.0000000
Not Awarded
2025-11-21T08:24:18.9730000
0
Simon Cox
2026
0
Bosch Auto Service - Moore, OK
2065434.00
10033
2041355.98
353039.44
0.17
1688316.54
24078.02
1.17
2025-08-12T00:00:00.0000000
2026-03-30T00:00:00.0000000
Approved
Course of Construction
1537599.02
38500.00
2025-11-21T08:24:18.9730000
0
Cindy Smith-Frawner
2026
54697.00
1
El Reno Remodel - El Reno, OK
0.00
135790001
2025-10-14T00:00:00.0000000
Not Awarded
2025-11-21T08:24:18.9730000
0
Simon Cox
2025
0

## Query 2: Compare row counts between views (FIXED)
```sql
-- Compare row counts - RowCount is reserved, use TotalRows instead
SELECT 
    'v_ProjectProfitability' as Source,
    COUNT(*) as TotalRows,
    SUM(ProjectRevisedContractAmount) as TotalContractValue,
    SUM(ProjectedProfit) as TotalProjectedProfit,
    SUM(JobCostToDate) as TotalJobToDateCost
FROM dbo.v_ProjectProfitability
UNION ALL
SELECT 
    'ProjectProfitabilityArchive' as Source,
    COUNT(*) as TotalRows,
    SUM(ProjectRevisedContractAmount) as TotalContractValue,
    SUM(ProjectedProfit) as TotalProjectedProfit,
    SUM(JobCostToDate) as TotalJobToDateCost
FROM dbo.ProjectProfitabilityArchive
```

results: (Run this query)



## Query 3: Check ProjectProfitabilityArchive structure
```sql
-- See what columns exist in the archive table
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'dbo' 
  AND TABLE_NAME = 'ProjectProfitabilityArchive'
ORDER BY ORDINAL_POSITION
```
results: 
COLUMN_NAME
DATA_TYPE
IS_NULLABLE
ProjectName
nvarchar
YES
ProjectRevisedContractAmount
decimal
YES
ProjectNumber
int
YES
EstCostAtCompletion
decimal
YES
JobCostToDate
decimal
YES
PercentCompleteBasedOnCost
decimal
YES
RemainingCost
decimal
YES
ProjectedProfit
decimal
YES
ProjectedProfitPercentage
decimal
YES
ContractStartDate
datetime
YES
ContractEndDate
datetime
YES
TotalInvoiced
decimal
YES
ContractStatus
nvarchar
YES
ProjectStage
nvarchar
YES
BalanceLeftOnContract
decimal
YES
PercentCompleteBasedOnRevenue
decimal
YES
CustomerRetainage
decimal
YES
VendorRetainage
decimal
YES
ArchiveDate
datetime
YES
RedTeamImport
tinyint
YES
ProjectManager
nvarchar
YES
ProfitCenterYear
int
YES
ProcoreId
bigint
YES
EstimatedProjectProfit
decimal
YES
IsActive
tinyint
NO

## Query 4: Check Archive table - how many records per project?
```sql
-- Check if Archive table has multiple records per project (archive snapshots)
SELECT 
    ProjectNumber,
    ProjectName,
    COUNT(*) as RecordCount,
    MIN(ArchiveDate) as FirstArchiveDate,
    MAX(ArchiveDate) as LatestArchiveDate
FROM dbo.ProjectProfitabilityArchive
GROUP BY ProjectNumber, ProjectName
HAVING COUNT(*) > 1
ORDER BY RecordCount DESC
```

results: (Run this to see if projects have multiple archive records)



## Query 5: Get totals from Archive table - MOST RECENT records only
```sql
-- Power BI likely filters to most recent ArchiveDate per project
-- This query gets the latest record for each project
WITH MostRecentArchive AS (
    SELECT 
        ProjectNumber,
        MAX(ArchiveDate) as LatestArchiveDate
    FROM dbo.ProjectProfitabilityArchive
    GROUP BY ProjectNumber
)
SELECT 
    COUNT(*) as TotalProjects,
    SUM(ppa.ProjectRevisedContractAmount) as TotalContractValue,
    SUM(ppa.ProjectedProfit) as TotalProjectedProfit,
    SUM(ppa.JobCostToDate) as TotalJobToDateCost
FROM dbo.ProjectProfitabilityArchive ppa
INNER JOIN MostRecentArchive mra 
    ON ppa.ProjectNumber = mra.ProjectNumber 
    AND ppa.ArchiveDate = mra.LatestArchiveDate
```
results: (Run this - this should match Power BI if it filters by "Is Most Recent?")

## Query 6: Calculate Projected Profit from Archive - MOST RECENT (Total Contract Value - Est Cost At Completion)
```sql
-- Check if Power BI calculates Projected Profit differently
-- Using most recent archive records only
WITH MostRecentArchive AS (
    SELECT 
        ProjectNumber,
        MAX(ArchiveDate) as LatestArchiveDate
    FROM dbo.ProjectProfitabilityArchive
    GROUP BY ProjectNumber
)
SELECT 
    COUNT(*) as TotalProjects,
    SUM(ppa.ProjectRevisedContractAmount) as TotalContractValue,
    SUM(ppa.EstCostAtCompletion) as TotalEstCostAtCompletion,
    SUM(ppa.ProjectRevisedContractAmount) - SUM(ppa.EstCostAtCompletion) as CalculatedProjectedProfit,
    SUM(ppa.ProjectedProfit) as StoredProjectedProfit,
    SUM(ppa.JobCostToDate) as TotalJobToDateCost
FROM dbo.ProjectProfitabilityArchive ppa
INNER JOIN MostRecentArchive mra 
    ON ppa.ProjectNumber = mra.ProjectNumber 
    AND ppa.ArchiveDate = mra.LatestArchiveDate
```
results: (Run this to compare calculated vs stored Projected Profit)


## Query 7: Check all tables/views that might be used
```sql
-- Find all tables and views that might contain project profitability data
SELECT 
    TABLE_SCHEMA,
    TABLE_NAME,
    TABLE_TYPE
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%Profit%' 
   OR TABLE_NAME LIKE '%Project%'
ORDER BY TABLE_TYPE, TABLE_NAME
```

results: TABLE_SCHEMA
TABLE_NAME
TABLE_TYPE
bolt
LeadsProjectMarkets
BASE TABLE
dbo
ProfitCenters
BASE TABLE
bolt
ProjectAuditLog
BASE TABLE
dbo
ProjectBudgets
BASE TABLE
bolt
ProjectMarkets
BASE TABLE
bolt
ProjectProbabilities
BASE TABLE
dbo
ProjectProfitabilityArchive
BASE TABLE
dbo
ProjectRoles
BASE TABLE
dbo
Projects
BASE TABLE
bolt
ProjectStatuses
BASE TABLE
bolt
ProjectStyles
BASE TABLE
dbo
RedTeamMasterProjectNumbers
BASE TABLE
dbo
RedTeamProjectData
BASE TABLE
dbo
VendorProjects
BASE TABLE
bolt
ProjectManagers
VIEW
bolt
ProjectSupers
VIEW
bolt
v_ClientProjects
VIEW
bolt
v_ProjectAuditLog
VIEW
dbo
v_ProjectProfitability
VIEW
bolt
v_Projects
VIEW

## Query 8: Compare ALL Archive records vs MOST RECENT only
```sql
-- Compare totals: All archive records vs Most recent only
SELECT 
    'All Archive Records' as FilterType,
    COUNT(*) as TotalProjects,
    SUM(ProjectRevisedContractAmount) as TotalContractValue,
    SUM(ProjectedProfit) as TotalProjectedProfit,
    SUM(JobCostToDate) as TotalJobToDateCost
FROM dbo.ProjectProfitabilityArchive
UNION ALL
SELECT 
    'Most Recent Only' as FilterType,
    COUNT(*) as TotalProjects,
    SUM(ppa.ProjectRevisedContractAmount) as TotalContractValue,
    SUM(ppa.ProjectedProfit) as TotalProjectedProfit,
    SUM(ppa.JobCostToDate) as TotalJobToDateCost
FROM dbo.ProjectProfitabilityArchive ppa
INNER JOIN (
    SELECT ProjectNumber, MAX(ArchiveDate) as LatestArchiveDate
    FROM dbo.ProjectProfitabilityArchive
    GROUP BY ProjectNumber
) mra ON ppa.ProjectNumber = mra.ProjectNumber 
    AND ppa.ArchiveDate = mra.LatestArchiveDate
```
results: (Run this to see the difference)

## Query 9: Check ArchiveDate distribution
```sql
-- See when the archive records were created
SELECT 
    CAST(ArchiveDate AS DATE) as ArchiveDateOnly,
    COUNT(*) as RecordCount,
    COUNT(DISTINCT ProjectNumber) as UniqueProjects
FROM dbo.ProjectProfitabilityArchive
GROUP BY CAST(ArchiveDate AS DATE)
ORDER BY ArchiveDateOnly DESC
```
results: (Run this to see archive snapshot dates)

## Next Steps
1. ✅ Query 1: Confirmed ProjectProfitabilityArchive exists
2. Run Query 2 (FIXED) to compare totals between v_ProjectProfitability and Archive
3. Run Query 4 to see if projects have multiple archive records
4. Run Query 5 to get totals from most recent archive records (likely what Power BI uses)
5. Run Query 6 to check if Power BI calculates Projected Profit differently
6. Run Query 8 to compare all vs most recent archive records
7. Compare Query 5 results with Power BI values ($264.6M, $158.9M, $45.3M)

