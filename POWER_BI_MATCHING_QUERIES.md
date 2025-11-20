# Power BI Matching Queries

## Power BI Values (from dashboard)
- **Total Contract Value (Sum):** $264,602,613
- **Total Projected Profit (Sum):** $158,945,357
- **Job To Date Cost (Sum):** $45,316,650

## Query Results Comparison

### Query 1: Active Only
- TotalProjects: 90
- TotalContractValue: $79,744,026.64 ❌ (too low)
- TotalProjectedProfit: $1,636,403.19 ❌ (too low)
- TotalJobToDateCost: $26,310,607.21 ❌ (too low)

### Query 2: Active, No NULLs
- TotalProjects: 58
- TotalContractValue: $41,459,695.70 ❌ (too low)
- TotalProjectedProfit: $1,636,403.19 ❌ (too low)
- TotalJobToDateCost: $26,310,607.21 ❌ (too low)

### Query 3: Active, Approved
- TotalProjects: 32
- TotalContractValue: $36,388,147.78 ❌ (too low)
- TotalProjectedProfit: $1,679,334.91 ❌ (too low)
- TotalJobToDateCost: $24,642,586.36 ❌ (too low)

### Query 0: All Projects (from earlier)
- TotalProjects: 292
- TotalContractValue: $214,856,785.56 ❌ (still lower than Power BI)
- TotalProjectedProfit: $9,005,341.60 ❌ (much lower than Power BI)
- TotalJobToDateCost: $46,361,677.26 ✅ (close to Power BI's $45,316,650)

## Analysis

The "All Projects" query is closest, but still doesn't match exactly:
- **Total Contract Value:** $214.8M vs $264.6M (Power BI) - difference of ~$50M
- **Total Projected Profit:** $9.0M vs $158.9M (Power BI) - **HUGE difference!**
- **Job To Date Cost:** $46.4M vs $45.3M (Power BI) - very close!

The Projected Profit difference is the biggest issue. This suggests Power BI might be:
1. Using a different calculation for Projected Profit
2. Using a different view or table
3. Applying different filters or date ranges
4. Including projects that are excluded in our view

## Additional Queries to Try

### Query 4: All Projects, Approved Only
```sql
SELECT 
    COUNT(*) as TotalProjects,
    SUM(ProjectRevisedContractAmount) as TotalContractValue,
    SUM(ProjectedProfit) as TotalProjectedProfit,
    SUM(JobCostToDate) as TotalJobToDateCost
FROM dbo.v_ProjectProfitability
WHERE ContractStatus = 'Approved'
```

### Query 5: All Projects, No NULLs
```sql
SELECT 
    COUNT(*) as TotalProjects,
    SUM(ProjectRevisedContractAmount) as TotalContractValue,
    SUM(ProjectedProfit) as TotalProjectedProfit,
    SUM(JobCostToDate) as TotalJobToDateCost
FROM dbo.v_ProjectProfitability
WHERE ProjectRevisedContractAmount IS NOT NULL 
  AND ProjectedProfit IS NOT NULL 
  AND JobCostToDate IS NOT NULL
```

### Query 6: Check for NULL ProjectedProfit values
```sql
SELECT 
    COUNT(*) as TotalProjects,
    COUNT(CASE WHEN ProjectedProfit IS NULL THEN 1 END) as NullProjectedProfit,
    SUM(ProjectRevisedContractAmount) as TotalContractValue,
    SUM(COALESCE(ProjectedProfit, 0)) as TotalProjectedProfitWithNulls,
    SUM(ProjectedProfit) as TotalProjectedProfitNoNulls,
    SUM(JobCostToDate) as TotalJobToDateCost
FROM dbo.v_ProjectProfitability
```

### Query 7: Check if Power BI uses a different calculation
```sql
-- Calculate Projected Profit manually: Total Contract Value - Est Cost At Completion
SELECT 
    COUNT(*) as TotalProjects,
    SUM(ProjectRevisedContractAmount) as TotalContractValue,
    SUM(EstCostAtCompletion) as TotalEstCostAtCompletion,
    SUM(ProjectRevisedContractAmount) - SUM(EstCostAtCompletion) as CalculatedProjectedProfit,
    SUM(ProjectedProfit) as StoredProjectedProfit,
    SUM(JobCostToDate) as TotalJobToDateCost
FROM dbo.v_ProjectProfitability
```

