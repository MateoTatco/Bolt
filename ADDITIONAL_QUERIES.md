# Additional Queries to Match Power BI

## Power BI Values
- **Total Contract Value:** $264,602,613
- **Total Projected Profit:** $158,945,357
- **Job To Date Cost:** $45,316,650

## Current Best Match: "All Projects"
- Total Contract Value: $214,856,785.56 (still $50M lower)
- Total Projected Profit: $9,005,341.60 (MUCH lower - $150M difference!)
- Job To Date Cost: $46,361,677.26 (very close!)

## Critical Investigation: Projected Profit

The Projected Profit difference is huge. Run these queries to investigate:

### Query A: Check NULL ProjectedProfit values
```sql
SELECT 
    COUNT(*) as TotalProjects,
    COUNT(CASE WHEN ProjectedProfit IS NULL THEN 1 END) as NullProjectedProfit,
    COUNT(CASE WHEN ProjectedProfit IS NOT NULL THEN 1 END) as NonNullProjectedProfit,
    SUM(ProjectRevisedContractAmount) as TotalContractValue,
    SUM(COALESCE(ProjectedProfit, 0)) as TotalProjectedProfit_WithNullsAsZero,
    SUM(ProjectedProfit) as TotalProjectedProfit_ExcludeNulls,
    SUM(JobCostToDate) as TotalJobToDateCost
FROM dbo.v_ProjectProfitability
```

### Query B: Calculate Projected Profit manually
```sql
-- Formula: Projected Profit = Total Contract Value - Est Cost At Completion
SELECT 
    COUNT(*) as TotalProjects,
    SUM(ProjectRevisedContractAmount) as TotalContractValue,
    SUM(EstCostAtCompletion) as TotalEstCostAtCompletion,
    SUM(ProjectRevisedContractAmount) - SUM(EstCostAtCompletion) as CalculatedProjectedProfit,
    SUM(ProjectedProfit) as StoredProjectedProfit,
    SUM(JobCostToDate) as TotalJobToDateCost
FROM dbo.v_ProjectProfitability
```

### Query C: Check for negative ProjectedProfit values
```sql
SELECT 
    COUNT(*) as TotalProjects,
    COUNT(CASE WHEN ProjectedProfit < 0 THEN 1 END) as NegativeProjectedProfit,
    SUM(CASE WHEN ProjectedProfit >= 0 THEN ProjectedProfit ELSE 0 END) as SumPositiveProjectedProfit,
    SUM(ProjectedProfit) as SumAllProjectedProfit,
    SUM(ProjectRevisedContractAmount) as TotalContractValue
FROM dbo.v_ProjectProfitability
```

### Query D: All Projects with Approved Status (no Active filter)
```sql
SELECT 
    COUNT(*) as TotalProjects,
    SUM(ProjectRevisedContractAmount) as TotalContractValue,
    SUM(ProjectedProfit) as TotalProjectedProfit,
    SUM(JobCostToDate) as TotalJobToDateCost
FROM dbo.v_ProjectProfitability
WHERE ContractStatus = 'Approved'
```

### Query E: Check if Power BI excludes certain project stages
```sql
SELECT 
    ProjectStage,
    COUNT(*) as ProjectCount,
    SUM(ProjectRevisedContractAmount) as TotalContractValue,
    SUM(ProjectedProfit) as TotalProjectedProfit,
    SUM(JobCostToDate) as TotalJobToDateCost
FROM dbo.v_ProjectProfitability
GROUP BY ProjectStage
ORDER BY TotalContractValue DESC
```

### Query F: Check RedTeamImport flag
```sql
SELECT 
    RedTeamImport,
    COUNT(*) as ProjectCount,
    SUM(ProjectRevisedContractAmount) as TotalContractValue,
    SUM(ProjectedProfit) as TotalProjectedProfit,
    SUM(JobCostToDate) as TotalJobToDateCost
FROM dbo.v_ProjectProfitability
GROUP BY RedTeamImport
```

## Next Steps

1. Run Query A to see if NULL values are the issue
2. Run Query B to see if Power BI calculates Projected Profit differently
3. Run Query C to check for negative values
4. Share results so we can identify the correct filter/calculation

