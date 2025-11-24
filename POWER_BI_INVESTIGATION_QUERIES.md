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

results: Source
TotalRows
TotalContractValue
TotalProjectedProfit
TotalJobToDateCost
v_ProjectProfitability
292
214856785.41
9004489.61
46511425.22
ProjectProfitabilityArchive
399263
158478197627.05
12500510130.05
30429663147.42



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

results: 

ProjectNumber
ProjectName
RecordCount
FirstArchiveDate
LatestArchiveDate
2620014
Tyler's Team Warranty 2024
1239
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
2620013
Trey's Team Warranty 2024
1239
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
2620007
Sarah's Team Warranty 2024
1239
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
2670008
Wingstop - Lawton
1239
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
2600002
The Hub at Colony Pointe
1239
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
1570015
O'Reilly Auto Parts - Fellsmere
1239
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
2200003
Dutch Bros - Tulsa
1239
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
1930015
Dutch Bros - Gainesville
1239
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
3040001
KFC - Bartlesville (Exterior Repair)
1239
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
2620016
PM Overhead
1239
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
1570027
Detention Pond - Sachse, TX
1239
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
2620009
Joe's Team Warranty 2024
1239
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
2620012
Cindy's Team Warranty 2024
1239
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
1260011
Starbucks - Western Ave.
1239
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
1570026
Starbucks - Sachse, TX
1239
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
2620010
Heath's Team Warranty 2024
1239
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
3000001
Cheba Hut - 23rd St
1239
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
2980001
UrgentVet - Moore
1238
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
2680001
Livewell Animal Hospital
1238
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
2410036
Starbucks Broadway Interior
1238
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
1130003
OKC Vet Collective
1206
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
2410033
Starbucks 50th St & May Interior
1185
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
1570025
Walgreens - Royse City, TX
1173
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
3070001
Wendy's Cushing OK
1172
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
1570028
Chipotle Interior - Fort Worth, TX
1162
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
1570029
Chipotle - Fort Worth, TX
1162
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
2620008
Sam's Team Warranty 2024
1161
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
3010002
Chicken Salad Chick - Quail Springs
1161
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
2620015
Simon's Team Warranty 2024
1161
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
2410038
Starbucks Interior US 69 & 26th Ave, Miami OK
1147
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
2530004
Take 5 Oil Change - St. Augustine
1142
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
3060001
Arby's Skiatook OK
1142
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
2620011
Marc's Team Warranty
1129
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
2720001
Superintendent Overhead - OK
1129
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
1930017
Dutch Bros - Davenport - Four Corners (FL0401)
1129
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
1570017
O'Reilly Auto Parts - Belle Glade
1129
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
1790015
Salad and Go - #1611
1129
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
2790001
Dutch Bros - Jacksonville Argyle (FL1403)
1129
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
2440001
Dutch Bros - Stillwater
1128
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
1900001
Meisner Garage
1128
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
1780002
Price Edwards - 738 Culbertson Ave
1128
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
1720017
Lakeshore - Ste 103
1128
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
1440001
Cajun Corner 3
1128
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
1160001
Schimmels Barn Apartment
1128
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
1720013
Lagree - 245 W Wilshire
1128
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
2900001
dummy project
1128
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
1570021
Starbucks Guthrie RTU (I-35 & Waterloo)
1128
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
2410037
SBX Guthrie RTU I-35 & Waterloo
1128
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
1870001
Glen Williams
1128
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000
1570008
O'Reilly Auto Parts Harrah, OK
1128
2024-08-02T11:58:18.7230000
2025-11-21T08:24:18.9730000

(There is an option to load even more, but i guess is fine with this ammount)



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
results: 

TotalProjects
TotalContractValue
TotalProjectedProfit
TotalJobToDateCost
563
273851222.58
15739289.80
49061951.15

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
results: 
TotalProjects
TotalContractValue
TotalEstCostAtCompletion
CalculatedProjectedProfit
StoredProjectedProfit
TotalJobToDateCost
563
273851222.58
112091587.90
161759634.68
15739289.80
49061951.15


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
results: 

FilterType
TotalProjects
TotalContractValue
TotalProjectedProfit
TotalJobToDateCost
All Archive Records
399263
158478197627.05
12500510130.05
30429663147.42
Most Recent Only
563
273851222.58
15739289.80
49061951.15

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
results: 

ArchiveDateOnly
RecordCount
UniqueProjects
2025-11-21
486
486
2025-11-20
972
486
2025-11-19
972
486
2025-11-18
972
486
2025-11-17
972
486
2025-11-16
972
486
2025-11-15
972
486
2025-11-14
972
486
2025-11-13
972
486
2025-11-12
485
485
2025-11-11
970
485
2025-11-10
970
485
2025-11-09
970
485
2025-11-08
970
485
2025-11-07
1455
485
2025-11-06
969
485
2025-11-05
484
484
2025-11-04
967
484
2025-11-03
966
483
2025-11-02
966
483
2025-11-01
966
483
2025-10-31
1449
483
2025-10-30
965
483
2025-10-29
964
482
2025-10-28
481
481
2025-10-27
961
481
2025-10-26
960
480
2025-10-25
960
480
2025-10-24
1440
480
2025-10-23
959
480
2025-10-22
479
479
2025-10-21
958
479
2025-10-20
955
478
2025-10-19
954
477
2025-10-18
477
477
2025-10-17
1431
477
2025-10-16
477
477
2025-10-15
954
477
2025-10-14
950
477
2025-10-13
946
473
2025-10-12
946
473
2025-10-11
473
473
2025-10-10
1419
473
2025-10-09
945
473
2025-10-08
472
472
2025-10-07
943
472
2025-10-06
942
471
2025-10-05
942
471
2025-10-04
942
471
2025-10-03
1413
471

(there is an option to load even more data here, but i guess this is enough)

## Next Steps
1. ✅ Query 1: Confirmed ProjectProfitabilityArchive exists
2. Run Query 2 (FIXED) to compare totals between v_ProjectProfitability and Archive
3. Run Query 4 to see if projects have multiple archive records
4. Run Query 5 to get totals from most recent archive records (likely what Power BI uses)
5. Run Query 6 to check if Power BI calculates Projected Profit differently
6. Run Query 8 to compare all vs most recent archive records
7. Compare Query 5 results with Power BI values ($264.6M, $158.9M, $45.3M)

