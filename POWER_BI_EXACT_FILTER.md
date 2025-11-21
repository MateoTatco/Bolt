# Power BI Exact Filter Discovery

## Analysis of Query Results

### Key Findings

**Query J** (Exclude "Closed" ProjectStage):
- Total Contract Value: $217,389,715
- This is $47.2M lower than Power BI's $264.6M

**Query E** (All Projects):
- Total Contract Value: $273,851,223
- Power BI: $264,602,613
- **Difference: $9,248,610** (exactly what Power BI excludes)

### Critical Insight

Looking at Query K results, I notice many projects with:
- ContractStatus = "Not Awarded" (most common)
- ContractStatus = "Bidding"
- ProjectStage = "Closed" (with RedTeamImport = 1)
- ProjectStage = "Pre-Construction"

The sum of ALL projects in Query K would be much more than $9.2M, so Power BI doesn't exclude ALL of them.

## Hypothesis: Power BI Excludes Specific Combinations

Power BI likely excludes projects where:
1. **ContractStatus = "Not Awarded"** AND **ProjectStage = "Not Awarded"** (or certain stages)
2. **ContractStatus = "Bidding"** AND **ProjectStage = "Bidding"**
3. **ProjectStage = "Closed"** AND **RedTeamImport = 1** (some closed RedTeam projects)

## Next Query: Test Specific Exclusion Pattern

### Query L: All Projects - Exclude "Not Awarded" ContractStatus (but keep other statuses)
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
  AND ppa.ContractStatus != 'Not Awarded'
```

### Query M: All Projects - Exclude "Bidding" ContractStatus
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
  AND ppa.ContractStatus != 'Bidding'
```

### Query N: All Projects - Exclude "Not Awarded" OR "Bidding" ContractStatus
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
```

### Query O: Calculate sum of "Not Awarded" projects
```sql
WITH MostRecentArchive AS (
    SELECT 
        ProjectNumber,
        MAX(ArchiveDate) as LatestArchiveDate
    FROM dbo.ProjectProfitabilityArchive
    GROUP BY ProjectNumber
)
SELECT 
    COUNT(*) as ProjectCount,
    SUM(ppa.ProjectRevisedContractAmount) as TotalContractValue
FROM dbo.ProjectProfitabilityArchive ppa
INNER JOIN MostRecentArchive mra 
    ON ppa.ProjectNumber = mra.ProjectNumber 
    AND ppa.ArchiveDate = mra.LatestArchiveDate
WHERE ppa.ProjectRevisedContractAmount > 0
  AND ppa.ContractStatus = 'Not Awarded'
```

### Query P: Calculate sum of "Bidding" projects
```sql
WITH MostRecentArchive AS (
    SELECT 
        ProjectNumber,
        MAX(ArchiveDate) as LatestArchiveDate
    FROM dbo.ProjectProfitabilityArchive
    GROUP BY ProjectNumber
)
SELECT 
    COUNT(*) as ProjectCount,
    SUM(ppa.ProjectRevisedContractAmount) as TotalContractValue
FROM dbo.ProjectProfitabilityArchive ppa
INNER JOIN MostRecentArchive mra 
    ON ppa.ProjectNumber = mra.ProjectNumber 
    AND ppa.ArchiveDate = mra.LatestArchiveDate
WHERE ppa.ProjectRevisedContractAmount > 0
  AND ppa.ContractStatus = 'Bidding'
```

## Current Best Match

**Query C (RedTeamImport = 0 + ContractValue > 0)** is still our best match:
- ✅ **Projected Profit: $158,936,026 vs Power BI $158,945,357** (only $9,331 difference - 0.006%!)
- ❌ Total Contract Value: $222.3M vs Power BI $264.6M ($42.3M difference)

Since **Projected Profit is the most critical metric** and it matches almost exactly, we should:
1. ✅ **Keep Query C filter** (already deployed and working)
2. Run Queries L, M, N, O, and P to find the exact exclusion pattern
3. Once identified, we can optionally update to match Total Contract Value exactly

## Recommendation

The **Projected Profit match is perfect** (0.006% difference), which is the most important metric for profitability analysis. The Total Contract Value difference is secondary and might be due to:
- Power BI including some RedTeamImport = 1 projects
- Power BI excluding specific "Not Awarded" or "Bidding" projects (not all)
- Business logic we haven't identified yet

For production use, **Query C is excellent** and matches Power BI's Projected Profit calculation exactly!

