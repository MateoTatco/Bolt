# Power BI Filter Analysis

## Power BI Target Values
- **Total Contract Value**: $264,602,613
- **Projected Profit**: $158,945,357
- **Job To Date Cost**: $45,316,650

## Query Results Analysis

### Query 1: Active Filter
- **All Projects**: $273,851,223 (too high by $9.2M)
- **Active Only**: $87,660,821 (too low)

### Query 2: ContractStatus
- **NULL/481**: $204,216,436 (too low by $60.4M)
- **Approved**: $60,902,785 (too low)
- **Complete**: $4,279,994 (too low)

### Query 7: RedTeamImport
- **RedTeamImport = 0**: $222,332,814 (close! Only $42.3M difference)
- **RedTeamImport = 1**: $51,518,409

### Key Finding
**RedTeamImport = 0** gives us $222.3M, which is much closer to Power BI's $264.6M than "All Projects" ($273.8M).

The difference: $264.6M - $222.3M = $42.3M

## Hypothesis
Power BI likely filters by:
1. **RedTeamImport = 0** (excludes RedTeam projects)
2. Possibly excludes certain ContractStatus values (NULL/481?)
3. Possibly excludes certain ProjectStage values

## Next Queries to Run

### Query A: RedTeamImport = 0 + Exclude NULL ContractStatus
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
  AND ppa.ContractStatus IS NOT NULL
```

results: 
TotalProjects
TotalContractValue
CalculatedProjectedProfit
TotalJobToDateCost
82
69634787.01
7737730.16
48276633.50


### Query B: RedTeamImport = 0 + Exclude "Not Awarded" and "Bidding"
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
  AND ppa.ContractStatus NOT IN ('Not Awarded', 'Bidding')
  AND ppa.ProjectStage NOT IN ('Bidding', 'Draft')
```
results: 

TotalProjects
TotalContractValue
CalculatedProjectedProfit
TotalJobToDateCost
82
69634787.01
7737730.16
48276633.50


### Query C: RedTeamImport = 0 + ContractValue > 0
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


### Query D: Find projects that sum to the $42.3M difference
```sql
-- Find projects in RedTeamImport = 1 that might explain the difference
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
    ppa.RedTeamImport,
    ppa.ProjectRevisedContractAmount - ppa.EstCostAtCompletion as CalculatedProjectedProfit,
    ppa.JobCostToDate
FROM dbo.ProjectProfitabilityArchive ppa
INNER JOIN MostRecentArchive mra 
    ON ppa.ProjectNumber = mra.ProjectNumber 
    AND ppa.ArchiveDate = mra.LatestArchiveDate
WHERE ppa.RedTeamImport = 1
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



## Current Best Match
**RedTeamImport = 0** appears to be the primary filter, giving us $222.3M vs Power BI's $264.6M.

The $42.3M difference suggests Power BI might:
1. Include some RedTeamImport = 1 projects (selective inclusion)
2. Exclude certain ContractStatus or ProjectStage values from RedTeamImport = 0
3. Have additional business logic filters

## Recommendation
Run Query A, B, and C to narrow down the exact filter combination.

