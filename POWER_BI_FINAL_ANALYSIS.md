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

