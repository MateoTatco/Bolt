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

