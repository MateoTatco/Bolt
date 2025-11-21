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

## Current Best Match
**RedTeamImport = 0** appears to be the primary filter, giving us $222.3M vs Power BI's $264.6M.

The $42.3M difference suggests Power BI might:
1. Include some RedTeamImport = 1 projects (selective inclusion)
2. Exclude certain ContractStatus or ProjectStage values from RedTeamImport = 0
3. Have additional business logic filters

## Recommendation
Run Query A, B, and C to narrow down the exact filter combination.

