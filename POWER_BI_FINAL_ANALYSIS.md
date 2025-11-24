# Power BI Final Analysis

## Key Findings

### Query Results Summary

| Query | Filter | Total Contract Value | vs Power BI |
|-------|--------|---------------------|-------------|
| **Query C** | RedTeamImport = 0 + ContractValue > 0 | $222,332,814 | -$42.3M (too low) |
| **Query E** | All Projects (0 OR 1) + ContractValue > 0 | $273,851,223 | +$9.2M (too high) |
| **Power BI** | ??? | $264,602,613 | Target |

### Critical Insight

**Power BI = Query E - $9.2M worth of projects**

This means:
1. Power BI includes ALL projects (RedTeamImport = 0 OR 1) with ContractValue > 0
2. Power BI then EXCLUDES $9.2M worth of projects

### The Math

- Query E (all): $273,851,223
- Power BI: $264,602,613
- **Excluded: $9,248,610**

So Power BI excludes approximately $9.2M worth of projects from the "all projects" set.

## Hypothesis

Power BI likely:
1. ✅ Includes all projects (RedTeamImport = 0 OR 1) with ContractValue > 0
2. ❓ Excludes projects based on:
   - ContractStatus (maybe "Not Awarded", "Bidding", or NULL?)
   - ProjectStage (maybe "Bidding", "Draft", or certain stages?)
   - Date filters (maybe excludes very old projects?)
   - Other business logic

## Next Queries to Find the $9.2M Exclusion

### Query H: All Projects - Exclude "Not Awarded" and "Bidding"
```sql
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
WHERE ppa.ProjectRevisedContractAmount > 0
  AND ppa.ContractStatus NOT IN ('Not Awarded', 'Bidding')
  AND ppa.ProjectStage NOT IN ('Bidding', 'Draft')
```
results: 
TotalProjects
TotalContractValue
CalculatedProjectedProfit
TotalJobToDateCost
81
69634787.01
9325770.87
47955957.53


### Query I: All Projects - Exclude NULL ContractStatus
```sql
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
WHERE ppa.ProjectRevisedContractAmount > 0
  AND ppa.ContractStatus IS NOT NULL
```
results: 
TotalProjects
TotalContractValue
CalculatedProjectedProfit
TotalJobToDateCost
81
69634787.01
9325770.87
47955957.53



### Query J: All Projects - Exclude "Closed" ProjectStage
```sql
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
WHERE ppa.ProjectRevisedContractAmount > 0
  AND ppa.ProjectStage != 'Closed'
```
results: 
TotalProjects
TotalContractValue
CalculatedProjectedProfit
TotalJobToDateCost
225
217389714.58
153773031.44
48196551.81


### Query K: Find projects that sum to $9.2M (the excluded ones)
```sql
-- Find projects in Query E that, when excluded, would give us Power BI's $264.6M
WITH MostRecentArchive AS (
    SELECT 
        ProjectNumber,
        MAX(ArchiveDate) as LatestArchiveDate
    FROM dbo.ProjectProfitabilityArchive
    GROUP BY ProjectNumber
),
AllProjects AS (
    SELECT 
        ppa.ProjectNumber,
        ppa.ProjectRevisedContractAmount
    FROM dbo.ProjectProfitabilityArchive ppa
    INNER JOIN MostRecentArchive mra 
        ON ppa.ProjectNumber = mra.ProjectNumber 
        AND ppa.ArchiveDate = mra.LatestArchiveDate
    WHERE ppa.ProjectRevisedContractAmount > 0
)
SELECT 
    ppa.ProjectNumber,
    ppa.ProjectName,
    ppa.ProjectRevisedContractAmount,
    ppa.ContractStatus,
    ppa.ProjectStage,
    ppa.RedTeamImport,
    ppa.ProjectRevisedContractAmount - ppa.EstCostAtCompletion as CalculatedProjectedProfit,
    ppa.JobCostToDate
FROM dbo.ProjectProfitabilityArchive ppa
INNER JOIN MostRecentArchive mra 
    ON ppa.ProjectNumber = mra.ProjectNumber 
    AND ppa.ArchiveDate = mra.LatestArchiveDate
WHERE ppa.ProjectNumber IN (SELECT ProjectNumber FROM AllProjects)
  AND (
    ppa.ContractStatus IN ('Not Awarded', 'Bidding')
    OR ppa.ProjectStage IN ('Bidding', 'Draft', 'Closed')
    OR ppa.ContractStatus IS NULL
  )
ORDER BY ppa.ProjectRevisedContractAmount DESC
```
results: 
ProjectNumber
ProjectName
ProjectRevisedContractAmount
ContractStatus
ProjectStage
RedTeamImport
CalculatedProjectedProfit
JobCostToDate
114400001
Stable - Mustang
6160319.67
Not Awarded
0
10041
Legacy Shops - Norman, OK (Buildings A,B,C,D)
5000000.00
Bidding
0
135930001
Cornerstone Office Building - OKC, OK
3066876.15
Not Awarded
0
335970001
Love's Corporate Innovation Center - OKC
2694163.68
Pre-Construction
0
1570025
Walgreens - Royse City, TX
2641143.59
Not Awarded
0
35950003
Bosch Auto Service - Norman, OK
2297528.11
Not Awarded
0
135290005
Mcdonalds - Tuttle, OK
2217733.09
Not Awarded
0
135290006
Mcdonalds - S May Ave - OKC, OK
2123630.88
Not Awarded
0
2860001
Fogo De Chao - Oklahoma City
2092531.10
Closed
1
490114.13
2680001
Livewell Animal Hospital
2077891.99
Closed
1
210188.41
135290004
McDonald’s - 44th & Western
2063377.95
Not Awarded
0
135400001
Tinker Federal Credit Union - Owasso, OK
2018804.42
Not Awarded
0
135450001
OJA Career Center Expansion
2000000.00
Not Awarded
0
135290003
McDonald's - Noble, OK
1899394.64
Not Awarded
0
1899390.64
4.00
135290001
McDonalds - Newton, KS
1880137.40
Not Awarded
0
231300002
Dollar Tree - Gainesville
1830183.08
Not Awarded
0
131600001
Brakes Plus - 104th - OKC
1800930.15
Not Awarded
0
131600002
Brakes Plus - N. Penn - OKC
1800000.00
Not Awarded
0
1440001
Cajun Corner 3
1642984.43
Closed
1
-89952.40
235880001
Dutch Bros Coffee - Belleview
1638676.51
Pre-Construction
0
0.00
0.00
235580003
Dutch Bros - Panama City Beach
1583177.46
Course of Construction
0
135290002
McDonald's - Moore
1544552.25
Not Awarded
0
135590001
Wendy's - Tahlequah
1498960.25
Not Awarded
0
219300011
Dutch Bros- Winter Garden
1476612.97
Not Awarded
0
135900001
Cardiac and Pulmonary Rehabilitation Clinic - Kingfisher, OK
1465751.34
Not Awarded
0
20041
Dutch Bros - Melbourne, FL
1439343.72
Bidding
0
135870001
Bruckner's Bulk Warehouse Addition - OKC, OK
1438400.99
Not Awarded
0
219300004
Dutch Bros Coffee - Lutz
1430200.68
Not Awarded
0
135470001
HTEAO - Ada, OK
1425090.89
Not Awarded
0
3070002
Wendy's - 29th & May
1416879.98
Not Awarded
0
135810001
Taco Bell - Newcastle, OK
1403769.62
Not Awarded
0
235440001
Dutch Bros - Kissimmee (SunDev)
1395000.00
Course of Construction
0
135820001
Taco Bell - Stillwater, OK
1390374.40
Not Awarded
0
1930022
Dutch Bros - Jacksonville Baymeadows (FL1302)
1390269.56
Not Awarded
0
178609.02
3440.82
3160001
Broken Bow Animal Shelter - Broken Bow OK
1379207.75
Not Awarded
0
1570011
Starbucks - Okmulgee OK
1356698.87
Closed
1
249299.53
235960001
Dutch Bros Coffee - Titusville
1350000.00
Not Awarded
0
226600001
Dutch Bros Coffee - Melbourne - CVP
1349211.22
Not Awarded
0
132800001
Owasso Shell Building - 96th & Garnett
1325000.00
Not Awarded
0
235880002
Heartland Dental - Weeki Wachee
1323000.00
Bidding
0
3060001
Arby's Skiatook OK
1308084.08
Not Awarded
0
2220001
Office - 409 S. Coltrane
1305574.49
Closed
1
-103267.02
135750001
Hulsey Dental Office - OKC
1300000.00
Not Awarded
0
219300012
Dutch Bros - Jacksonville
1300000.00
Course of Construction
0
219300014
Dutch Bros - Port Orange
1300000.00
Bidding
0
119300016
Dutch Bros (OK0504) - Bartlesville, OK
1300000.00
Not Awarded
0
19300009
Dutch Bros - Kissimmee FL0402
1299075.00
Pre-Construction
0
1260006
Starbucks - Altus
1281722.10
Closed
1
151533.64
312600002
Chipotle Shell - Rowlett, TX
1276837.82
Not Awarded
0
135380001
Ziggi's Coffee - Broken Arrow, OK
1266279.15
Not Awarded
0



## Current Status

**Query C (RedTeamImport = 0 + ContractValue > 0)** gives us:
- ✅ Projected Profit: $158,936,026 vs Power BI $158,945,357 (only $9,331 difference!)
- ❌ Total Contract Value: $222.3M vs Power BI $264.6M ($42.3M difference)

**Query E (All Projects + ContractValue > 0)** gives us:
- ❌ Total Contract Value: $273.8M vs Power BI $264.6M ($9.2M too high)

## Recommendation

Since **Projected Profit matches almost exactly** with Query C, we should:
1. ✅ Keep using Query C filter (RedTeamImport = 0 + ContractValue > 0) - **ALREADY DEPLOYED**
2. Run Queries H, I, J, and K to find what Power BI excludes from "all projects"
3. Once we identify the exclusion pattern, we can update the filter to match Power BI's Total Contract Value exactly

The Projected Profit match is the most important metric, and we've achieved that! The Total Contract Value difference is secondary.

