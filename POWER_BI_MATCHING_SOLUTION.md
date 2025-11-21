# Power BI Matching Solution

## Investigation Results

### Key Findings

1. **Power BI uses `ProjectProfitabilityArchive` table**, not `v_ProjectProfitability` view
2. **Power BI filters to most recent `ArchiveDate` per project** (matches "Is Most Recent?" calculated column)
3. **Power BI calculates Projected Profit** as `Total Contract Value - Est Cost At Completion` (not using stored `ProjectedProfit` column)

### Query Results Comparison

| Source | Projects | Total Contract Value | Projected Profit | Job To Date Cost |
|--------|----------|---------------------|------------------|------------------|
| **Power BI** | ? | **$264,602,613** | **$158,945,357** | **$45,316,650** |
| **v_ProjectProfitability** (all) | 292 | $214,856,785 | $9,005,342 | $46,361,677 |
| **Archive (Most Recent)** | 563 | $273,851,223 | $15,739,290 (stored) | $49,061,951 |
| **Archive (Calculated Profit)** | 563 | $273,851,223 | **$161,759,635** ✅ | $49,061,951 |

### Analysis

- **Total Contract Value**: Archive most recent ($273.8M) is close to Power BI ($264.6M) - difference may be due to additional filtering in Power BI
- **Projected Profit**: Calculated value ($161.8M) is very close to Power BI ($158.9M) ✅
- **Job To Date Cost**: Archive ($49.1M) is close to Power BI ($45.3M)

The calculated Projected Profit matches Power BI when using the formula: `Total Contract Value - Est Cost At Completion`

## Solution Implemented

### Changes Made

1. **Updated data source** from `dbo.v_ProjectProfitability` to `dbo.ProjectProfitabilityArchive`
2. **Added most recent filter** using CTE to get `MAX(ArchiveDate)` per project
3. **Projected Profit calculation** already correct (Total Contract Value - Est Cost At Completion)
4. **Added ArchiveDate** to returned data for tracking

### SQL Query Structure

```sql
WITH MostRecentArchive AS (
    SELECT 
        ProjectNumber,
        MAX(ArchiveDate) as LatestArchiveDate
    FROM dbo.ProjectProfitabilityArchive
    GROUP BY ProjectNumber
)
SELECT 
    ppa.*
FROM dbo.ProjectProfitabilityArchive ppa
INNER JOIN MostRecentArchive mra 
    ON ppa.ProjectNumber = mra.ProjectNumber 
    AND ppa.ArchiveDate = mra.LatestArchiveDate
WHERE 1=1
[additional filters]
ORDER BY ppa.ProjectName
```

### Expected Results

After this change, the dashboard should:
- Show ~563 projects (most recent archive records)
- Display Total Contract Value close to $264.6M (may need additional filtering)
- Display Projected Profit close to $158.9M (calculated correctly)
- Display Job To Date Cost close to $45.3M

### Next Steps

1. Deploy the updated function
2. Test the dashboard and compare totals with Power BI
3. If totals still don't match exactly, investigate:
   - Additional filters Power BI might apply (Active status, Contract Status, etc.)
   - Date range filters
   - Project stage filters
   - Other business logic filters

### Notes

- The Archive table contains 399,263 total records (historical snapshots)
- Most projects have 1,000+ archive records (snapshots taken daily)
- Latest archive date: 2025-11-21
- Power BI's "Is Most Recent?" is a calculated column that filters to `MAX(ArchiveDate)` per project

