# Love's Corporate Investigation - Contract Value Issue

## Issue
Love's Corporate (335970001) is now showing only $1,779,753.78 (Prime Contract 2) instead of the correct total of $2,737,636.55 (should be $957,882.77 + $1,779,753.78).

## Investigation Query

Please run this query to see the ContractorIds for Love's Corporate contracts:

```sql
-- Check ContractorIds for Love's Corporate (335970001)
SELECT 
    p.ProjectNumber,
    p.ProjectName,
    pc.PrimeContractId,
    pc.PrimeContractProcoreId,
    pc.ContractorId,
    pc.RevisedContractAmount,
    pc.ContractStatus,
    pc.CreatedAt,
    pc.UpdatedAt,
    pc.ContractStartDate
FROM dbo.PrimeContracts pc
INNER JOIN dbo.Projects p ON pc.ProjectId = p.ProcoreId
WHERE p.ProjectNumber = 335970001
ORDER BY pc.PrimeContractId;
```

**Paste results here:**

```text
-- RESULTS:
```
ProjectNumber
ProjectName
PrimeContractId
PrimeContractProcoreId
ContractorId
RevisedContractAmount
ContractStatus
CreatedAt
UpdatedAt
ContractStartDate
335970001
Love's Corporate Innovation Center - OKC
69500
598134327500497
598134328397562
957882.77
Approved
2025-12-24T16:13:45.0000000
2026-01-22T21:51:36.0000000
335970001
Love's Corporate Innovation Center - OKC
69501
598134327500511
598134328397562
1786526.48
Approved
2025-12-24T16:16:29.0000000
2026-01-22T21:52:11.0000000

---

## What We Need to Know

The current logic uses `ContractorId` to distinguish between:
- **Multiple separate contracts** (different ContractorIds) → SUM
- **Contract revisions** (same ContractorId) → MAX

If Love's Corporate's 2 contracts have the **same ContractorId**, the logic is incorrectly treating them as revisions and using MAX instead of SUM.

We need to find a better way to distinguish between revisions vs separate contracts. Possible indicators:
- Different `PrimeContractProcoreId` → separate contracts
- Different `ContractStartDate` → separate contracts  
- Or a combination of factors








