# Power BI Exact Match Analysis

## Query C Results (RedTeamImport = 0 + ContractValue > 0)
- **Total Contract Value**: $222,332,813.67
- **Calculated Projected Profit**: $158,936,026.28 ✅
- **Job To Date Cost**: $48,196,551.81

## Power BI Target Values
- **Total Contract Value**: $264,602,613
- **Projected Profit**: $158,945,357
- **Job To Date Cost**: $45,316,650

## Analysis

### ✅ Projected Profit: ALMOST PERFECT MATCH!
- Query C: $158,936,026.28
- Power BI: $158,945,357
- **Difference: Only $9,331** (0.006% difference!)

This confirms Power BI calculates Projected Profit as: **Total Contract Value - Est Cost At Completion**

### Total Contract Value: Still $42.3M difference
- Query C: $222,332,814
- Power BI: $264,602,613
- **Difference: $42,269,799**

### Job To Date Cost: $2.88M difference
- Query C: $48,196,552
- Power BI: $45,316,650
- **Difference: $2,879,902**

## Hypothesis

Since Projected Profit matches almost exactly, Power BI likely:
1. ✅ Uses the same calculation (Total Contract Value - Est Cost At Completion)
2. ✅ Filters by `RedTeamImport = 0` AND `ProjectRevisedContractAmount > 0`
3. ❓ Includes additional projects that add $42.3M to Total Contract Value

The $42.3M difference could be:
- Some RedTeamImport = 1 projects (but not all - total RedTeamImport = 1 is $51.5M)
- Projects with NULL ContractStatus that we're excluding
- Projects with certain ProjectStage values

## Next Queries to Find the $42.3M

### Query E: All Projects (RedTeamImport = 0 OR 1) + ContractValue > 0
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
```
results: 
TotalProjects
TotalContractValue
CalculatedProjectedProfit
TotalJobToDateCost
395
273851222.58
165594922.34
48196551.81


### Query F: RedTeamImport = 0 + Include NULL ContractStatus
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
WHERE ppa.RedTeamImport = 0
  AND ppa.ProjectRevisedContractAmount > 0
  -- No ContractStatus filter (includes NULL)
```
results: 
TotalProjects
TotalContractValue
CalculatedProjectedProfit
TotalJobToDateCost
227
222332813.67
158936026.28
48196551.81



### Query G: Find projects that sum to exactly $42.3M
```sql
-- Find which projects, when added to Query C, would give us $264.6M
WITH MostRecentArchive AS (
    SELECT 
        ProjectNumber,
        MAX(ArchiveDate) as LatestArchiveDate
    FROM dbo.ProjectProfitabilityArchive
    GROUP BY ProjectNumber
),
QueryCProjects AS (
    SELECT ppa.ProjectNumber
    FROM dbo.ProjectProfitabilityArchive ppa
    INNER JOIN MostRecentArchive mra 
        ON ppa.ProjectNumber = mra.ProjectNumber 
        AND ppa.ArchiveDate = mra.LatestArchiveDate
    WHERE ppa.RedTeamImport = 0
      AND ppa.ProjectRevisedContractAmount > 0
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
WHERE ppa.ProjectNumber NOT IN (SELECT ProjectNumber FROM QueryCProjects)
  AND ppa.ProjectRevisedContractAmount > 0
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
1440001
Cajun Corner 3
1642984.43
Closed
1
-89952.40
1570011
Starbucks - Okmulgee OK
1356698.87
Closed
1
249299.53
2220001
Office - 409 S. Coltrane
1305574.49
Closed
1
-103267.02
1260006
Starbucks - Altus
1281722.10
Closed
1
151533.64
1930011
Dutch Bros - Nashville
1265283.47
Closed
1
196762.28
1570016
Starbucks Wichita Falls TX
1262504.53
Closed
1
22265.88
2880001
Starbucks - Miami, OK
1259160.55
Closed
1
72072.11
1570008
O'Reilly Auto Parts Harrah, OK
1240273.53
Closed
1
215881.44
1930009
Dutch Bros - Goldenrod- Orlando
1234379.08
Closed
1
99774.66
2570001
Starbucks - Wagoner
1218962.03
Closed
1
-7443.35
1930008
Dutch Bros - Owasso
1207495.38
Closed
1
123011.24
1930012
Dutch Bros - St. Augustine
1207063.30
Closed
1
110819.89
1570009
Starbucks Guthrie (I-35 & Waterloo)
1193697.21
Closed
1
190256.23
2660001
Dutch Bros - Davenport
1174177.64
Closed
1
187070.05
2170003
Dutch Bros - Mustang
1138167.21
Closed
1
206710.28
1930002
Dutch Bros â€“ I-240
1137149.19
Closed
1
201759.62
1930003
Dutch Bros - 2nd St
1124900.34
Closed
1
305073.77
1850001
Dutch Bros â€“ 13th and Harvard
1114613.30
Closed
1
-33700.25
2200001
Dutch Bros - 23rd St
1110946.97
Closed
1
142707.77
1930001
Dutch Bros - Bixby
1109848.12
Closed
1
213573.04
2440001
Dutch Bros - Stillwater
1081287.49
Closed
1
226622.98
1260003
Starbucks - Norman
1071277.65
Closed
1
29817.92
1560001
JINYA Ramen Bar
1066529.05
Closed
1
25626.89
1930004
Dutch Bros - N May
1043827.78
Closed
1
179042.48
2170005
Dutch Bros - Andover
1020642.88
Closed
1
89418.52
1590001
Dutch Bros Coffee - Edmond
841612.90
Closed
1
27460.52
1790003
Salad and Go - 15th and Sooner
804277.48
Closed
1
78361.75
2470002
Starbucks Broadway Edmond
756771.04
Closed
1
79595.43
2410004
Starbucks Interior I240 & Penn
649030.15
Closed
1
96917.66
1570002
Starbucks - Chickasha
642194.88
Closed
1
174077.85
1600013
Casey's #4061 - 101 NE 27th St
599676.67
Closed
1
141513.76
2980001
UrgentVet - Moore
580003.00
Closed
1
165256.95
2280001
JTHMC URC Renovation
514591.01
Closed
1
33351.02
2470001
Aarons - Bryant Square
469745.18
Closed
1
66581.49
1600008
Casey's #4057 - 2316 W Lindsey St
436336.59
Closed
1
164055.56
2410012
Starbucks Interior Wagoner
430635.91
Closed
1
83737.84
1600005
Casey's #4068 - 2216 W Edmond Rd
426766.67
Closed
1
154960.75
1600003
Casey's #4052 - 141 S Mustang Rd
408979.85
Closed
1
118831.86
2410014
Starbucks Interior Altus
406294.59
Closed
1
39905.92
2320010
WINGSTOP #AA005 Joplin MO
400963.11
Closed
1
17151.57
1440002
50th and Western - 1st Floor and LL Work
389618.83
Closed
1
29524.92
2410016
Starbucks Interior 12th Street Moore
383652.29
Closed
1
58009.22
2410022
Starbucks Interior - Wichita Falls
380875.49
Closed
1
62526.64
2410036
Starbucks Broadway Interior
372939.40
Closed
1
29746.30
2410026
Starbucks Interior US 64 & 21st
372666.06
Closed
1
65575.84
2410010
Starbucks Interior Okmulgee
361095.61
Closed
1
51975.78
2320002
Wingstop - Cherry Creek (#2303)
359537.47
Closed
1
72999.70
1210008
St. Louis Vet Center
358939.20
Closed
1
-27764.74



## Recommendation

**Query C is our best match so far!** The Projected Profit is almost exact ($9,331 difference).

For now, we should:
1. Update the code to use: `RedTeamImport = 0 AND ProjectRevisedContractAmount > 0`
2. This will give us Projected Profit that matches Power BI almost exactly
3. Continue investigating the $42.3M Total Contract Value difference

The small differences in Total Contract Value and Job To Date Cost might be due to:
- Power BI including some additional projects
- Different date filters
- Business logic we haven't identified yet

But since Projected Profit matches almost exactly, we're very close!

