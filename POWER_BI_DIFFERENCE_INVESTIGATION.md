# Power BI Difference Investigation

## Current Status

### Our Results (Most Recent Archive Records)
- **Projects**: 563
- **Total Contract Value**: $273,851,223
- **Projected Profit** (calculated): $161,759,635
- **Job To Date Cost**: $49,061,951

### Power BI Results
- **Total Contract Value**: $264,602,613
- **Total Projected Profit**: $158,945,357
- **Job To Date Cost**: $45,316,650

### Differences
- **Total Contract Value**: $9,248,610 difference (we're higher)
- **Projected Profit**: $2,814,278 difference (we're higher)
- **Job To Date Cost**: $3,745,301 difference (we're higher)

## Investigation Queries

### Query 1: Check if Power BI filters by IsActive
```sql
-- Compare totals with and without Active filter
WITH MostRecentArchive AS (
    SELECT 
        ProjectNumber,
        MAX(ArchiveDate) as LatestArchiveDate
    FROM dbo.ProjectProfitabilityArchive
    GROUP BY ProjectNumber
)
SELECT 
    'All Projects' as FilterType,
    COUNT(*) as TotalProjects,
    SUM(ppa.ProjectRevisedContractAmount) as TotalContractValue,
    SUM(ppa.ProjectRevisedContractAmount) - SUM(ppa.EstCostAtCompletion) as CalculatedProjectedProfit,
    SUM(ppa.JobCostToDate) as TotalJobToDateCost
FROM dbo.ProjectProfitabilityArchive ppa
INNER JOIN MostRecentArchive mra 
    ON ppa.ProjectNumber = mra.ProjectNumber 
    AND ppa.ArchiveDate = mra.LatestArchiveDate
UNION ALL
SELECT 
    'Active Only' as FilterType,
    COUNT(*) as TotalProjects,
    SUM(ppa.ProjectRevisedContractAmount) as TotalContractValue,
    SUM(ppa.ProjectRevisedContractAmount) - SUM(ppa.EstCostAtCompletion) as CalculatedProjectedProfit,
    SUM(ppa.JobCostToDate) as TotalJobToDateCost
FROM dbo.ProjectProfitabilityArchive ppa
INNER JOIN MostRecentArchive mra 
    ON ppa.ProjectNumber = mra.ProjectNumber 
    AND ppa.ArchiveDate = mra.LatestArchiveDate
WHERE ppa.IsActive = 1
```
results: 
FilterType
TotalProjects
TotalContractValue
CalculatedProjectedProfit
TotalJobToDateCost
All Projects
563
273851222.58
161759634.68
49061951.15
Active Only
167
87660820.89
43259502.31
29010881.10

### Query 2: Check if Power BI filters by ContractStatus
```sql
-- Check totals by ContractStatus
WITH MostRecentArchive AS (
    SELECT 
        ProjectNumber,
        MAX(ArchiveDate) as LatestArchiveDate
    FROM dbo.ProjectProfitabilityArchive
    GROUP BY ProjectNumber
)
SELECT 
    ppa.ContractStatus,
    COUNT(*) as ProjectCount,
    SUM(ppa.ProjectRevisedContractAmount) as TotalContractValue,
    SUM(ppa.ProjectRevisedContractAmount) - SUM(ppa.EstCostAtCompletion) as CalculatedProjectedProfit,
    SUM(ppa.JobCostToDate) as TotalJobToDateCost
FROM dbo.ProjectProfitabilityArchive ppa
INNER JOIN MostRecentArchive mra 
    ON ppa.ProjectNumber = mra.ProjectNumber 
    AND ppa.ArchiveDate = mra.LatestArchiveDate
GROUP BY ppa.ContractStatus
ORDER BY TotalContractValue DESC
```
results: 
ContractStatus
ProjectCount
TotalContractValue
CalculatedProjectedProfit
TotalJobToDateCost
481
204216435.57
154021904.52
785317.65
Approved
72
60902785.44
6663577.83
42506312.91
Complete
3
4279993.63
-4471.11
4234711.34
Out For Signature
2
2996530.87
449746.03
1193916.28
Draft
5
1455477.07
628877.41
341692.97

### Query 3: Check if Power BI filters by ProjectStage
```sql
-- Check totals by ProjectStage
WITH MostRecentArchive AS (
    SELECT 
        ProjectNumber,
        MAX(ArchiveDate) as LatestArchiveDate
    FROM dbo.ProjectProfitabilityArchive
    GROUP BY ProjectNumber
)
SELECT 
    ppa.ProjectStage,
    COUNT(*) as ProjectCount,
    SUM(ppa.ProjectRevisedContractAmount) as TotalContractValue,
    SUM(ppa.ProjectRevisedContractAmount) - SUM(ppa.EstCostAtCompletion) as CalculatedProjectedProfit,
    SUM(ppa.JobCostToDate) as TotalJobToDateCost
FROM dbo.ProjectProfitabilityArchive ppa
INNER JOIN MostRecentArchive mra 
    ON ppa.ProjectNumber = mra.ProjectNumber 
    AND ppa.ArchiveDate = mra.LatestArchiveDate
GROUP BY ppa.ProjectStage
ORDER BY TotalContractValue DESC
```
results: 
ProjectStage
ProjectCount
TotalContractValue
CalculatedProjectedProfit
TotalJobToDateCost
Not Awarded
139
118471013.25
117258220.76
4572.77
Closed
194
51077642.77
5807118.73
Course of Construction
38
37794211.34
8651904.85
20596725.61
Bidding
20
17989076.13
Post-Construction
24
17238717.92
1388020.37
15689845.26
Warranty
30
11749303.82
1127306.22
10510854.04
Pre-Construction
10
11462820.09
3470699.54
498738.32
34
5383865.23
5060299.79
321934.44
Complete
8
2243805.89
802446.96
1439280.71
Proposal
3
237883.24
25487.49
Request
27
202882.90
179053.84
Draft
34
0.00
0.00
0.00
In Progress
2
0.00
0.00


### Query 4: Check if Power BI excludes NULL values
```sql
-- Check totals excluding NULL values
WITH MostRecentArchive AS (
    SELECT 
        ProjectNumber,
        MAX(ArchiveDate) as LatestArchiveDate
    FROM dbo.ProjectProfitabilityArchive
    GROUP BY ProjectNumber
)
SELECT 
    'All Projects' as FilterType,
    COUNT(*) as TotalProjects,
    SUM(ppa.ProjectRevisedContractAmount) as TotalContractValue,
    SUM(ppa.ProjectRevisedContractAmount) - SUM(ppa.EstCostAtCompletion) as CalculatedProjectedProfit,
    SUM(ppa.JobCostToDate) as TotalJobToDateCost
FROM dbo.ProjectProfitabilityArchive ppa
INNER JOIN MostRecentArchive mra 
    ON ppa.ProjectNumber = mra.ProjectNumber 
    AND ppa.ArchiveDate = mra.LatestArchiveDate
UNION ALL
SELECT 
    'No NULLs' as FilterType,
    COUNT(*) as TotalProjects,
    SUM(ppa.ProjectRevisedContractAmount) as TotalContractValue,
    SUM(ppa.ProjectRevisedContractAmount) - SUM(ppa.EstCostAtCompletion) as CalculatedProjectedProfit,
    SUM(ppa.JobCostToDate) as TotalJobToDateCost
FROM dbo.ProjectProfitabilityArchive ppa
INNER JOIN MostRecentArchive mra 
    ON ppa.ProjectNumber = mra.ProjectNumber 
    AND ppa.ArchiveDate = mra.LatestArchiveDate
WHERE ppa.ProjectRevisedContractAmount IS NOT NULL
  AND ppa.EstCostAtCompletion IS NOT NULL
  AND ppa.JobCostToDate IS NOT NULL
```
results: 
FilterType
TotalProjects
TotalContractValue
CalculatedProjectedProfit
TotalJobToDateCost
All Projects
563
273851222.58
161759634.68
49061951.15
No NULLs
121
76312468.80
9727629.75
49061951.15

### Query 5: Check Active + Approved combination
```sql
-- Check Active + Approved combination
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
    SUM(ppa.ProjectRevisedContractAmount) - SUM(ppa.EstCostAtCompletion) as CalculatedProjectedProfit,
    SUM(ppa.JobCostToDate) as TotalJobToDateCost
FROM dbo.ProjectProfitabilityArchive ppa
INNER JOIN MostRecentArchive mra 
    ON ppa.ProjectNumber = mra.ProjectNumber 
    AND ppa.ArchiveDate = mra.LatestArchiveDate
WHERE ppa.IsActive = 1 
  AND ppa.ContractStatus = 'Approved'
```
results: 
TotalProjects
TotalContractValue
CalculatedProjectedProfit
TotalJobToDateCost
37
41355800.42
2336563.91
27342860.25

### Query 6: Check for projects with zero or negative contract values
```sql
-- Check if Power BI excludes zero/negative contract values
WITH MostRecentArchive AS (
    SELECT 
        ProjectNumber,
        MAX(ArchiveDate) as LatestArchiveDate
    FROM dbo.ProjectProfitabilityArchive
    GROUP BY ProjectNumber
)
SELECT 
    'All Projects' as FilterType,
    COUNT(*) as TotalProjects,
    SUM(ppa.ProjectRevisedContractAmount) as TotalContractValue,
    SUM(ppa.ProjectRevisedContractAmount) - SUM(ppa.EstCostAtCompletion) as CalculatedProjectedProfit,
    SUM(ppa.JobCostToDate) as TotalJobToDateCost
FROM dbo.ProjectProfitabilityArchive ppa
INNER JOIN MostRecentArchive mra 
    ON ppa.ProjectNumber = mra.ProjectNumber 
    AND ppa.ArchiveDate = mra.LatestArchiveDate
UNION ALL
SELECT 
    'Contract Value > 0' as FilterType,
    COUNT(*) as TotalProjects,
    SUM(ppa.ProjectRevisedContractAmount) as TotalContractValue,
    SUM(ppa.ProjectRevisedContractAmount) - SUM(ppa.EstCostAtCompletion) as CalculatedProjectedProfit,
    SUM(ppa.JobCostToDate) as TotalJobToDateCost
FROM dbo.ProjectProfitabilityArchive ppa
INNER JOIN MostRecentArchive mra 
    ON ppa.ProjectNumber = mra.ProjectNumber 
    AND ppa.ArchiveDate = mra.LatestArchiveDate
WHERE ppa.ProjectRevisedContractAmount > 0
```
results: 
FilterType
TotalProjects
TotalContractValue
CalculatedProjectedProfit
TotalJobToDateCost
All Projects
563
273851222.58
161759634.68
49061951.15
Contract Value > 0
395
273851222.58
165594922.34
48196551.81

### Query 7: Check RedTeamImport filter
```sql
-- Check if Power BI filters by RedTeamImport
WITH MostRecentArchive AS (
    SELECT 
        ProjectNumber,
        MAX(ArchiveDate) as LatestArchiveDate
    FROM dbo.ProjectProfitabilityArchive
    GROUP BY ProjectNumber
)
SELECT 
    ppa.RedTeamImport,
    COUNT(*) as ProjectCount,
    SUM(ppa.ProjectRevisedContractAmount) as TotalContractValue,
    SUM(ppa.ProjectRevisedContractAmount) - SUM(ppa.EstCostAtCompletion) as CalculatedProjectedProfit,
    SUM(ppa.JobCostToDate) as TotalJobToDateCost
FROM dbo.ProjectProfitabilityArchive ppa
INNER JOIN MostRecentArchive mra 
    ON ppa.ProjectNumber = mra.ProjectNumber 
    AND ppa.ArchiveDate = mra.LatestArchiveDate
GROUP BY ppa.RedTeamImport
ORDER BY TotalContractValue DESC
```
results: 
RedTeamImport
ProjectCount
TotalContractValue
CalculatedProjectedProfit
TotalJobToDateCost
0
303
222332813.67
155747974.62
49061951.15
1
260
51518408.91
6011660.06
0.00

### Query 8: Find projects that might be excluded
```sql
-- Find projects with unusual characteristics that might be filtered
WITH MostRecentArchive AS (
    SELECT 
        ProjectNumber,
        MAX(ArchiveDate) as LatestArchiveDate
    FROM dbo.ProjectProfitabilityArchive
    GROUP BY ProjectNumber
)
SELECT 
    ppa.ProjectNumber,
    ppa.ProjectName,
    ppa.ProjectRevisedContractAmount,
    ppa.ContractStatus,
    ppa.ProjectStage,
    ppa.IsActive,
    ppa.RedTeamImport,
    ppa.ProjectRevisedContractAmount - ppa.EstCostAtCompletion as CalculatedProjectedProfit,
    ppa.JobCostToDate
FROM dbo.ProjectProfitabilityArchive ppa
INNER JOIN MostRecentArchive mra 
    ON ppa.ProjectNumber = mra.ProjectNumber 
    AND ppa.ArchiveDate = mra.LatestArchiveDate
WHERE ppa.ProjectRevisedContractAmount IS NULL
   OR ppa.ProjectRevisedContractAmount <= 0
   OR ppa.ContractStatus = 'Not Awarded'
   OR ppa.ProjectStage = 'Bidding'
ORDER BY ppa.ProjectRevisedContractAmount DESC
```
results: 
ProjectNumber
ProjectName
ProjectRevisedContractAmount
ContractStatus
ProjectStage
IsActive
RedTeamImport
CalculatedProjectedProfit
JobCostToDate
10041
Legacy Shops - Norman, OK (Buildings A,B,C,D)
5000000.00
Bidding
1
0
20041
Dutch Bros - Melbourne, FL
1439343.72
Bidding
1
0
235880002
Heartland Dental - Weeki Wachee
1323000.00
Bidding
1
0
219300014
Dutch Bros - Port Orange
1300000.00
Bidding
1
0
219300017
GA0104 - Dutch Bros (Buford, GA)
1250000.00
Bidding
1
0
219300016
Dutch Bros (Smyrna, GA)
1250000.00
Bidding
1
0
235740002
Chipotle - Lithia
1235723.14
Bidding
1
0
236030001
Dutch Bros - Leesburg, FL
1000000.00
Bidding
1
0
135220014
7 Brew - Lawton - OK
878122.26
Bidding
1
0
135970002
Love's - Hinton
800000.00
Bidding
1
0
35220010
7 Brew - Spring Hill
650000.00
Bidding
1
0
20042
SWIG
600000.00
Bidding
1
0
126700008
Wingstop AC191 - Peoria
450000.00
Bidding
1
0
20038
Scenthound
412887.01
Bidding
1
0
135940002
Stanton Optical - Wichita Falls, TX
400000.00
Bidding
1
0
136000001
Dutch Bros - Knoxville
0.00
Bidding
1
0
335340002
The Sicilian Butcher - Add-On
0.00
Warranty
1
0
-10029.60
0.00
91090
Peak Civil LLC
0.00
Course of Construction
1
0
-10000.00
2957.40
111300002
OKC Vet - Additional Items
0.00
Course of Construction
1
0
-200.00
200.00
123200007
Wingstop - Sand Springs, OK
0.00
Not Awarded
0
0
228300001
Life Church - Wellington, FL
0.00
Not Awarded
1
0
219300015
Dutch Bros - Riverview
0.00
Not Awarded
1
0
10032
Ardmore Dental Group
0.00
Not Awarded
0
0
135890001
Churches Chicken + Asian Cuisine - OKC, OK
0.00
Not Awarded
1
0
135910001
Fierce 45 Rose Creek -
0.00
Not Awarded
0
0
231300003
Dollar Tree - St. Cloud
0.00
Approved
Course of Construction
1
0
-1588040.71
320675.97
2900001
dummy project
0.00
Closed
0
1
0.00
2410039
Starbucks Moore Interior Sign Add
0.00
Closed
0
1
-1255.78
1150002
Loud City - Door Repair 032124
0.00
Closed
0
1
-477.03
1720029
2546 N Moore Ave
0.00
Closed
0
1
0.00
1930010
Dutch Bros - Andover Direct Charges
0.00
Closed
0
1
-5395.23
2620004
Harrison's Team Warranty 2023
0.00
Closed
0
1
-953.28
2620005
Simon's Team Warranty 2023
0.00
Closed
0
1
-8488.57
2620006
Joe's Team Warranty 2023
0.00
Closed
0
1
-6016.05
1720028
Lagree - S. Prospect Ave
0.00
Closed
0
1
-2846.18
2620001
Harrison's Team 2023
0.00
Closed
0
1
-3297.26
2620002
Joe's Team 2023
0.00
Closed
0
1
-23502.32
1290013
Starbucks - N May Siding Repair
0.00
Closed
0
1
-2022.70
2560001
2800 S Telephone Rd - Site Assessment
0.00
Closed
0
1
-600.00
2420001
3101 NE 63rd - Office/Lobby Renovation
0.00
Closed
0
1
-18950.59
2230001
Ruby Vet Clinic - Remodel
0.00
Closed
0
1
0.00
1360011
Weatherford â€“ Structural Repairs
0.00
Closed
0
1
-124.20
1360009
4800 S Elm - Wall Infill
0.00
Closed
0
1
-2274.38
1360010
2400 N 9th - Wall Infill
0.00
Closed
0
1
-2461.89
1570007
Starbucks - 178th & May HVAC
0.00
Closed
0
1
-935.00
1600011
Casey's #4259 8002 NE 36th St
0.00
Closed
0
1
0.00
1360005
7100 W Hefner - Rail Repair
0.00
Closed
0
1
-650.00
1150001
Loud City â€“ Front Door
0.00
Closed
0
1
-847.41
1440003
Cajun 1 - A/C Issue
0.00
Closed
0
1
-1495.85
1440004
Cajun 2 - Backdoor and Patch
0.00
Closed
0
1

(there is an option here to load more results.)

## Next Steps

1. Run Query 1 to see if Active filter makes a difference
2. Run Query 2 to see ContractStatus distribution
3. Run Query 3 to see ProjectStage distribution
4. Run Query 4 to see if NULL exclusion helps
5. Run Query 5 to check Active + Approved combination
6. Run Query 6 to check if zero/negative values are excluded
7. Run Query 7 to check RedTeamImport filter
8. Run Query 8 to identify projects that might be filtered out

Compare each query result with Power BI values to find the matching combination.

