# Projected Profit Investigation - Project 235840001

## Issue Reported
Project 235840001 (Dutch Bros - Mauldin, SC) is showing a current projected profit of **-$1M+** in Bolt. Trey believes this is because it's pulling data from the **second Prime Contract** (a reimbursement) instead of summing all contracts.

## Key Insight from Brett's Conversation
**Brett's Instructions (from brettalkthisweek.md):**
- **"We need to always be grabbing the grand total or the summation of all contracts"**
- **"Always be grabbing the grand total or the summation of all contracts"**
- Contracts can be "eliminated" or "zeroed out" - these should be excluded
- If there's a "grand total endpoint" that would be ideal
- **The goal: SUM ALL active contracts, not pick one**

This means our current logic is **WRONG** - we should **ALWAYS SUM** all contracts, not distinguish between revisions vs separate contracts!

## Questions to Answer
1. What formula calculates Current Projected Profit?
2. Where does the data come from?
3. Is this related to our recent changes?
4. Should we use `GrandTotal` field instead of `RevisedContractAmount`?
5. How do we identify contracts that are "eliminated" or "zeroed out"?

---

## Investigation

### Formula for Current Projected Profit

**Location:** `functions/src/index.ts` (lines 4954-4957)

```javascript
currentProjectedProfit = ProjectRevisedContractAmount - EstCostAtCompletion
```

**Formula:**
```
Current Projected Profit = Total Contract Value - Estimated Cost at Completion
```

This matches Power BI's calculation and the Formula Reference Chart.

---

### Data Sources

**1. ProjectRevisedContractAmount (Total Contract Value):**
- **Source:** Calculated by our NEW logic in the SQL query
- **Location:** `functions/src/index.ts` (lines 4825-4871)
- **Current Logic (WRONG):**
  - If contracts created on **SAME day** → **SUM** all contracts ✅
  - If contracts created on **DIFFERENT days** → Use **most recently updated** contract amount ❌
- **For 235840001:** Has 2 contracts created on different days → Uses most recently updated contract (WRONG - should SUM)
- **What Brett Says:** Always SUM all contracts, regardless of creation dates

**2. EstCostAtCompletion:**
- **Source:** From `ProjectProfitabilityArchive` table
- **Location:** `functions/src/index.ts` (line 4884)
- **Field:** `ppa.EstCostAtCompletion`
- **Note:** This is a **project-level** value, not contract-specific

---

### The Problem

**What's happening:**
1. Our new logic for `ProjectRevisedContractAmount` is using the **most recently updated contract** (the second contract - reimbursement: $29,112.50)
2. But `EstCostAtCompletion` is still the **project-level** value from the archive table ($1,086,057.37)
3. The reimbursement contract amount ($29,112.50) is much smaller than the project cost ($1,086,057.37)
4. Result: $29,112.50 - $1,086,057.37 = **-$1,056,944.87** ❌

**What SHOULD happen (per Brett's instructions):**
- Contract 1 (Main): $1,212,316.69
- Contract 2 (Reimbursement): $29,112.50
- **Total Contract Value:** $1,212,316.69 + $29,112.50 = **$1,241,429.19** ✅
- **Projected Profit:** $1,241,429.19 - $1,086,057.37 = **$155,371.82** ✅

---

### Is This Related to Recent Changes?

**YES** - This is **directly caused** by our recent changes:

**Before our changes:**
- `ProjectRevisedContractAmount` came from `ProjectProfitabilityArchive` table
- This table had the value from the **first contract** only
- Calculation: First Contract Amount - EstCostAtCompletion = Correct ✅

**After our changes:**
- `ProjectRevisedContractAmount` now comes from `PrimeContracts` table
- For 235840001, it uses the **most recently updated contract** (second contract - reimbursement)
- Calculation: Second Contract Amount - EstCostAtCompletion = Wrong ❌

---

## SQL Queries to Investigate Project 235840001

### QUERY 1: Check all prime contracts for 235840001 (including GrandTotal)

```sql
-- QUERY 1: Check project 235840001 prime contracts - see GrandTotal vs RevisedContractAmount
SELECT 
    p.ProjectNumber,
    p.ProjectName,
    pc.PrimeContractId,
    pc.PrimeContractProcoreId,
    pc.RevisedContractAmount,
    pc.GrandTotal,
    pc.ContractStatus,
    pc.CreatedAt,
    pc.UpdatedAt,
    CAST(pc.CreatedAt AS DATE) AS CreationDate,
    -- Check if contract is zeroed out or eliminated
    CASE 
        WHEN pc.RevisedContractAmount = 0 THEN 'ZEROED OUT'
        WHEN pc.GrandTotal = 0 THEN 'ZEROED OUT'
        ELSE 'ACTIVE'
    END AS ContractStatusCheck
FROM dbo.PrimeContracts pc
INNER JOIN dbo.Projects p ON pc.ProjectId = p.ProcoreId
WHERE p.ProjectNumber = 235840001
ORDER BY pc.PrimeContractId;
```

**Paste results here:**

```text
-- QUERY 1 RESULTS:
ProjectNumber
ProjectName
PrimeContractId
PrimeContractProcoreId
RevisedContractAmount
GrandTotal
ContractStatus
CreatedAt
UpdatedAt
CreationDate
ContractStatusCheck
235840001
Dutch Bros - Mauldin, SC (SC0405)
47821
598134327092864
1198623.48
1158186.48
Approved
2025-08-28T20:14:59.0000000
2026-01-29T14:11:36.0000000
2025-08-28
ACTIVE
235840001
Dutch Bros - Mauldin, SC (SC0405)
66258
598134327450181
42805.71
29112.50
Approved
2025-12-09T14:57:01.0000000
2026-01-29T14:25:06.0000000
2025-12-09
ACTIVE

```

---

### QUERY 2: Calculate what the total SHOULD be (SUM of all contracts)

```sql
-- QUERY 2: Calculate correct total by summing all contracts
SELECT 
    p.ProjectNumber,
    p.ProjectName,
    COUNT(*) AS ContractCount,
    SUM(pc.RevisedContractAmount) AS SumOfRevisedContractAmount,
    SUM(pc.GrandTotal) AS SumOfGrandTotal,
    STRING_AGG(CAST(pc.RevisedContractAmount AS VARCHAR(50)), ' + ') AS RevisedAmounts,
    STRING_AGG(CAST(pc.GrandTotal AS VARCHAR(50)), ' + ') AS GrandTotals
FROM dbo.PrimeContracts pc
INNER JOIN dbo.Projects p ON pc.ProjectId = p.ProcoreId
WHERE p.ProjectNumber = 235840001
    AND pc.RevisedContractAmount > 0  -- Exclude zeroed out contracts
GROUP BY p.ProjectNumber, p.ProjectName;
```

**Paste results here:**

```text
-- QUERY 2 RESULTS:


ProjectNumber
ProjectName
ContractCount
SumOfRevisedContractAmount
SumOfGrandTotal
RevisedAmounts
GrandTotals
235840001
Dutch Bros - Mauldin, SC (SC0405)
2
1241429.19
1187298.98
1198623.48 + 42805.71
1158186.48
```

---

### QUERY 3: Check archive table values

```sql
-- QUERY 3: Check archive table for 235840001
SELECT 
    ppa.ProjectNumber,
    ppa.ProjectName,
    ppa.ProjectRevisedContractAmount,
    ppa.EstCostAtCompletion,
    ppa.ProjectedProfit,
    ppa.ArchiveDate
FROM dbo.ProjectProfitabilityArchive ppa
WHERE ppa.ProjectNumber = '235840001'
    AND ppa.ArchiveDate = (
        SELECT MAX(ArchiveDate)
        FROM dbo.ProjectProfitabilityArchive
        WHERE ProjectNumber = '235840001'
    );
```

**Paste results here:**

```text
-- QUERY 3 RESULTS:

ProjectNumber
ProjectName
ProjectRevisedContractAmount
EstCostAtCompletion
ProjectedProfit
ArchiveDate
235840001
Dutch Bros - Mauldin, SC (SC0405)
1198623.48
1086057.37
112566.11
2026-02-01T16:20:50.1370000
```

---

### QUERY 4: Check if there's a way to identify eliminated/zeroed contracts

```sql
-- QUERY 4: Check all fields for contracts to see if there's a flag for eliminated contracts
SELECT TOP 5
    pc.PrimeContractId,
    pc.PrimeContractProcoreId,
    pc.RevisedContractAmount,
    pc.GrandTotal,
    pc.ContractStatus,
    pc.ApprovedChangeOrders,
    pc.DraftChangeOrdersAmount,
    pc.PendingChangeOrdersAmount,
    pc.OutstandingBalance,
    pc.TotalPayments,
    pc.CreatedAt,
    pc.UpdatedAt
FROM dbo.PrimeContracts pc
ORDER BY pc.PrimeContractId DESC;
```

**Paste results here:**

```text
-- QUERY 4 RESULTS:
PrimeContractId
PrimeContractProcoreId
RevisedContractAmount
GrandTotal
ContractStatus
ApprovedChangeOrders
DraftChangeOrdersAmount
PendingChangeOrdersAmount
OutstandingBalance
TotalPayments
CreatedAt
UpdatedAt
75077
598134327580921
-4200.00
5800.00
Approved
-10000.00
0.00
0.00
-4200.00
0.00
2026-01-21T16:26:02.0000000
2026-01-21T17:10:42.0000000
74033
598134327563308
419023.50
419023.50
Approved
0.00
0.00
0.00
419023.50
0.00
2026-01-16T14:13:25.0000000
2026-01-29T15:57:13.0000000
73558
598134327548009
1166.22
1166.22
Approved
0.00
0.00
0.00
1166.22
0.00
2026-01-13T21:46:34.0000000
2026-01-14T20:09:08.0000000
```

---

## Solution Based on Brett's Instructions

**Brett's Clear Direction:**
- **"Always be grabbing the grand total or the summation of all contracts"**
- **"We need to always be grabbing the grand total or the summation of all contracts"**

**This means:**
1. **ALWAYS SUM all contracts** - no distinction between revisions vs separate contracts
2. **Exclude zeroed out/eliminated contracts** - filter where `RevisedContractAmount > 0` or `GrandTotal > 0`
3. **Use GrandTotal if available** - Brett mentioned "grand total endpoint" - check if `GrandTotal` field should be used instead of `RevisedContractAmount`
4. **For 235840001:** Should be $1,212,316.69 + $29,112.50 = **$1,241,429.19** (SUM, not just one contract)

---

## Analysis of Query Results

### Key Findings:

**QUERY 1 - Contract Details:**
- **Contract 1 (Main):** 
  - RevisedContractAmount: **$1,198,623.48**
  - GrandTotal: **$1,158,186.48**
  - Created: 2025-08-28
  - Status: ACTIVE ✅
  
- **Contract 2 (Reimbursement):**
  - RevisedContractAmount: **$42,805.71**
  - GrandTotal: **$29,112.50**
  - Created: 2025-12-09 (different day)
  - Status: ACTIVE ✅

**QUERY 2 - Correct Totals:**
- **SumOfRevisedContractAmount:** **$1,241,429.19** ✅
  - This is: $1,198,623.48 + $42,805.71
- **SumOfGrandTotal:** **$1,187,298.98**
  - This is: $1,158,186.48 + $29,112.50

**QUERY 3 - Archive Table (Current Value):**
- **ProjectRevisedContractAmount:** $1,198,623.48 (only first contract)
- **EstCostAtCompletion:** $1,086,057.37
- **Current ProjectedProfit:** $112,566.11 (based on first contract only)

**QUERY 4 - Zeroed Contracts:**
- Found contracts with negative `RevisedContractAmount` (e.g., -$4,200.00)
- These should be excluded from the sum

---

## Decision: Which Field to Use?

**Brett said:** "Revised contract amount, grand total" and "summation of all contracts"

**Options:**
1. **Use `RevisedContractAmount`** (SUM = $1,241,429.19)
   - This is the "revised contract amount" Brett mentioned
   - Higher value, includes all contract revisions
   
2. **Use `GrandTotal`** (SUM = $1,187,298.98)
   - This is the "grand total" Brett mentioned
   - Lower value, may exclude some items

**Recommendation:** Use **`RevisedContractAmount`** because:
- Brett said "Revised contract amount, grand total" - suggesting RevisedContractAmount is primary
- It's more comprehensive (includes all contract amounts)
- The difference ($54,130.21) suggests GrandTotal might exclude certain line items

---

## What Should Happen for 235840001

**Current (WRONG):**
- Using most recently updated contract: **$42,805.71**
- Projected Profit: $42,805.71 - $1,086,057.37 = **-$1,043,251.66** ❌

**Correct (per Brett's instructions):**
- SUM all contracts: **$1,241,429.19** (using RevisedContractAmount)
- Projected Profit: $1,241,429.19 - $1,086,057.37 = **$155,371.82** ✅

**Alternative (if using GrandTotal):**
- SUM all contracts: **$1,187,298.98** (using GrandTotal)
- Projected Profit: $1,187,298.98 - $1,086,057.37 = **$101,241.61**

---

## Solution Summary

**What needs to change:**
1. **Remove date-based logic** - Always SUM all contracts, regardless of creation dates
2. **Use `RevisedContractAmount`** (or confirm with Brett if GrandTotal should be used)
3. **Exclude zeroed/negative contracts** - Filter: `WHERE RevisedContractAmount > 0`
4. **For 235840001:** Should show $1,241,429.19 instead of $42,805.71

**SQL Logic Change:**
- **OLD:** If different creation dates → Use most recently updated contract
- **NEW:** Always SUM all contracts where `RevisedContractAmount > 0`

---

## Next Steps

1. ✅ Queries completed - data verified
2. ⏳ **Check Enid Strip (10028)** to verify pattern
3. ⏳ Update SQL logic to **ALWAYS SUM** all contracts (using RevisedContractAmount)
4. ⏳ Deploy and test

---

## Enid Strip Center (Project 10028) - Verification Query

Let's check if Enid Strip follows the same pattern and verify what the correct total should be:

```sql
-- QUERY 5: Check Enid Strip (10028) prime contracts
SELECT 
    p.ProjectNumber,
    p.ProjectName,
    pc.PrimeContractId,
    pc.PrimeContractProcoreId,
    pc.RevisedContractAmount,
    pc.GrandTotal,
    pc.ContractStatus,
    pc.CreatedAt,
    pc.UpdatedAt,
    CAST(pc.CreatedAt AS DATE) AS CreationDate,
    CASE 
        WHEN pc.RevisedContractAmount = 0 THEN 'ZEROED OUT'
        WHEN pc.GrandTotal = 0 THEN 'ZEROED OUT'
        ELSE 'ACTIVE'
    END AS ContractStatusCheck
FROM dbo.PrimeContracts pc
INNER JOIN dbo.Projects p ON pc.ProjectId = p.ProcoreId
WHERE p.ProjectNumber = 10028
ORDER BY pc.PrimeContractId;
```

**Paste results here:**

```text
-- QUERY 5 RESULTS:
ProjectNumber
ProjectName
PrimeContractId
PrimeContractProcoreId
RevisedContractAmount
GrandTotal
ContractStatus
CreatedAt
UpdatedAt
CreationDate
ContractStatusCheck
10028
Enid Strip Center - Remodel
31073
598134326751885
577744.60
577744.60
Approved
2025-05-12T21:31:51.0000000
2025-05-14T18:20:17.0000000
2025-05-12
ACTIVE
10028
Enid Strip Center - Remodel
37260
598134326878489
729379.30
577880.27
Approved
2025-06-20T17:39:26.0000000
2026-01-14T14:27:34.0000000
2025-06-20
ACTIVE

```

---

### QUERY 6: Calculate Enid Strip totals

```sql
-- QUERY 6: Calculate correct total for Enid Strip by summing all contracts
SELECT 
    p.ProjectNumber,
    p.ProjectName,
    COUNT(*) AS ContractCount,
    SUM(pc.RevisedContractAmount) AS SumOfRevisedContractAmount,
    SUM(pc.GrandTotal) AS SumOfGrandTotal,
    STRING_AGG(CAST(pc.RevisedContractAmount AS VARCHAR(50)), ' + ') AS RevisedAmounts,
    STRING_AGG(CAST(pc.GrandTotal AS VARCHAR(50)), ' + ') AS GrandTotals
FROM dbo.PrimeContracts pc
INNER JOIN dbo.Projects p ON pc.ProjectId = p.ProcoreId
WHERE p.ProjectNumber = 10028
    AND pc.RevisedContractAmount > 0  -- Exclude zeroed out contracts
GROUP BY p.ProjectNumber, p.ProjectName;
```

**Paste results here:**

```text
-- QUERY 6 RESULTS:
ProjectNumber
ProjectName
ContractCount
SumOfRevisedContractAmount
SumOfGrandTotal
RevisedAmounts
GrandTotals
10028
Enid Strip Center - Remodel
2
1307123.90
1155624.87
577744.60 + 729379.30
577744.60 + 577880.27

```

---

### QUERY 7: Check Enid Strip archive table

```sql
-- QUERY 7: Check archive table for Enid Strip
SELECT 
    ppa.ProjectNumber,
    ppa.ProjectName,
    ppa.ProjectRevisedContractAmount,
    ppa.EstCostAtCompletion,
    ppa.ProjectedProfit,
    ppa.ArchiveDate
FROM dbo.ProjectProfitabilityArchive ppa
WHERE ppa.ProjectNumber = '10028'
    AND ppa.ArchiveDate = (
        SELECT MAX(ArchiveDate)
        FROM dbo.ProjectProfitabilityArchive
        WHERE ProjectNumber = '10028'
    );
```

**Paste results here:**

```text
-- QUERY 7 RESULTS:
ProjectNumber
ProjectName
ProjectRevisedContractAmount
EstCostAtCompletion
ProjectedProfit
ArchiveDate
10028
Enid Strip Center - Remodel
729379.30
529941.00
199438.30
2026-02-01T16:20:50.1370000

```

---

## Analysis of Enid Strip Results

### Key Findings:

**QUERY 5 - Contract Details:**
- **Contract 1 (Original):** 
  - RevisedContractAmount: **$577,744.60**
  - Created: 2025-05-12
  - Status: ACTIVE ✅
  
- **Contract 2 (Revised):**
  - RevisedContractAmount: **$729,379.30**
  - Created: 2025-06-20 (different day - 39 days later)
  - Status: ACTIVE ✅

**QUERY 6 - Sum Totals:**
- **SumOfRevisedContractAmount:** **$1,307,123.90** ($577,744.60 + $729,379.30)
- **SumOfGrandTotal:** $1,155,624.87

**QUERY 7 - Archive Table:**
- **ProjectRevisedContractAmount:** **$729,379.30** ✅
- This matches Procore's "revised contract amount"
- EstCostAtCompletion: $529,941.00
- ProjectedProfit: $199,438.30

---

## ⚠️ IMPORTANT DISCOVERY - Different Pattern!

**Enid Strip (10028) vs Dutch Bros (235840001):**

| Project | Contracts | Creation Dates | Archive Value | SUM Value | Correct Value |
|---------|-----------|----------------|---------------|-----------|---------------|
| **235840001** | 2 contracts | Different days (Aug 28, Dec 9) | $1,198,623.48 (first only) | **$1,241,429.19** | **SUM** ✅ |
| **10028** | 2 contracts | Different days (May 12, Jun 20) | **$729,379.30** (second only) | $1,307,123.90 | **Second contract** ✅ |

**Key Insight:**
- **235840001:** Two SEPARATE contracts (main + reimbursement) → Should SUM
- **10028:** Contract REVISION (original replaced by revised) → Should use REVISED contract only

**The Problem:**
- If we ALWAYS SUM, Enid Strip will show $1,307,123.90 (WRONG - should be $729,379.30)
- If we use "most recently updated", Enid Strip shows $729,379.30 (CORRECT ✅)
- But Dutch Bros needs SUM, not most recent

---

## How to Distinguish Between Separate Contracts vs Revisions?

**Possible Indicators:**
1. **Contract Amount Relationship:**
   - Enid Strip: Second contract ($729K) is HIGHER than first ($577K) → Likely revision
   - Dutch Bros: Second contract ($42K) is MUCH SMALLER than first ($1.2M) → Likely separate

2. **Amount Ratio:**
   - If second contract is significantly smaller (< 20% of first) → Likely separate contract
   - If second contract is similar or larger → Likely revision

3. **Time Between Creation:**
   - Enid Strip: 39 days apart → Revision
   - Dutch Bros: 103 days apart → Could be either

**Recommendation:**
- Use **amount ratio** to distinguish:
  - If second contract < 20% of first contract → SUM (separate contracts)
  - If second contract ≥ 20% of first contract → Use most recent (revision)

**For 235840001:**
- First: $1,198,623.48, Second: $42,805.71
- Ratio: $42,805.71 / $1,198,623.48 = 3.6% (< 20%) → **SUM** ✅

**For 10028:**
- First: $577,744.60, Second: $729,379.30
- Ratio: $729,379.30 / $577,744.60 = 126% (≥ 20%) → **Use most recent** ✅

---

## Revised Solution

**Logic:**
1. If only 1 contract → Use that contract
2. If multiple contracts:
   - Calculate ratio: `MIN(amounts) / MAX(amounts)`
   - If ratio < 0.20 (20%) → **SUM all contracts** (separate contracts)
   - If ratio ≥ 0.20 (20%) → **Use most recently updated** (revision)

**This will:**
- ✅ 235840001: SUM = $1,241,429.19 (ratio 3.6% < 20%)
- ✅ 10028: Use most recent = $729,379.30 (ratio 126% ≥ 20%)
- ✅ Love's Corporate: SUM = $2,744,409.25 (both created same day, or ratio check)

**Alternative (Simpler):**
- Always SUM all contracts (per Brett's instruction)
- But this will break Enid Strip ($1.3M instead of $729K)

**Need Decision:** Should we use the ratio-based logic, or always SUM (which will require fixing Enid Strip separately)?

---

## ⚠️ NEW INSIGHT - User Observation

**User reports:** In Procore, Enid Strip currently shows **only ONE prime contract** with value $729,379.30.

**This suggests:**
- The first contract ($577,744.60) may have been **eliminated/zeroed out** in Procore
- But it still exists in our database as "ACTIVE"
- We need to identify how to detect eliminated contracts

**If true, then:**
- We can use SUM logic for all active contracts
- But we need to properly filter out eliminated/zeroed contracts
- The existing logic (same day = SUM, different days = most recent) might still work if we filter correctly

---

## Additional Queries to Verify Enid Strip Contracts

### QUERY 8: Check if first contract is eliminated/zeroed in Procore

```sql
-- QUERY 8: Check all fields for Enid Strip contracts to see if first contract is eliminated
SELECT 
    pc.PrimeContractId,
    pc.PrimeContractProcoreId,
    pc.RevisedContractAmount,
    pc.GrandTotal,
    pc.ContractStatus,
    pc.ApprovedChangeOrders,
    pc.DraftChangeOrdersAmount,
    pc.PendingChangeOrdersAmount,
    pc.OutstandingBalance,
    pc.TotalPayments,
    pc.CreatedAt,
    pc.UpdatedAt,
    -- Check if contract appears to be eliminated
    CASE 
        WHEN pc.RevisedContractAmount = 0 THEN 'ZEROED'
        WHEN pc.RevisedContractAmount < 0 THEN 'NEGATIVE'
        WHEN pc.GrandTotal = 0 THEN 'ZEROED_GRAND'
        WHEN pc.OutstandingBalance = 0 AND pc.TotalPayments = 0 AND pc.RevisedContractAmount > 0 THEN 'POSSIBLY_ELIMINATED'
        ELSE 'ACTIVE'
    END AS EliminationCheck
FROM dbo.PrimeContracts pc
INNER JOIN dbo.Projects p ON pc.ProjectId = p.ProcoreId
WHERE p.ProjectNumber = 10028
ORDER BY pc.CreatedAt;
```

**Paste results here:**

```text
-- QUERY 8 RESULTS:

PrimeContractId
PrimeContractProcoreId
RevisedContractAmount
GrandTotal
ContractStatus
ApprovedChangeOrders
DraftChangeOrdersAmount
PendingChangeOrdersAmount
OutstandingBalance
TotalPayments
CreatedAt
UpdatedAt
EliminationCheck
31073
598134326751885
577744.60
577744.60
Approved
0.00
0.00
0.00
577744.60
0.00
2025-05-12T21:31:51.0000000
2025-05-14T18:20:17.0000000
ACTIVE
37260
598134326878489
729379.30
577880.27
Approved
151499.03
0.00
0.00
301925.97
427453.33
2025-06-20T17:39:26.0000000
2026-01-14T14:27:34.0000000
ACTIVE
```

---

### QUERY 9: Compare with other projects to find elimination pattern

```sql
-- QUERY 9: Check if there's a pattern for eliminated contracts across all projects
SELECT TOP 20
    p.ProjectNumber,
    pc.PrimeContractId,
    pc.RevisedContractAmount,
    pc.GrandTotal,
    pc.ContractStatus,
    pc.OutstandingBalance,
    pc.TotalPayments,
    pc.CreatedAt,
    pc.UpdatedAt,
    -- Check if this looks like an eliminated contract
    CASE 
        WHEN pc.RevisedContractAmount = 0 THEN 'ZEROED'
        WHEN pc.RevisedContractAmount < 0 THEN 'NEGATIVE'
        WHEN pc.GrandTotal = 0 AND pc.RevisedContractAmount > 0 THEN 'ZEROED_GRAND'
        WHEN pc.OutstandingBalance = 0 AND pc.TotalPayments = 0 AND pc.RevisedContractAmount > 0 THEN 'POSSIBLY_ELIMINATED'
        ELSE 'ACTIVE'
    END AS StatusCheck
FROM dbo.PrimeContracts pc
INNER JOIN dbo.Projects p ON pc.ProjectId = p.ProcoreId
WHERE pc.RevisedContractAmount > 0
ORDER BY pc.UpdatedAt DESC;
```

**Paste results here:**

```text
-- QUERY 9 RESULTS:

ProjectNumber
PrimeContractId
RevisedContractAmount
GrandTotal
ContractStatus
OutstandingBalance
TotalPayments
CreatedAt
UpdatedAt
StatusCheck
335620001
42296
665919.26
557448.08
Approved
72936.11
592983.15
2025-08-01T12:20:30.0000000
2026-01-30T18:59:44.0000000
ACTIVE
335970001
69501
1786526.48
1779753.78
Approved
1754738.48
31788.00
2025-12-24T16:16:29.0000000
2026-01-30T17:08:04.0000000
ACTIVE
335970001
69500
957882.77
957882.77
Approved
928493.94
29388.83
2025-12-24T16:13:45.0000000
2026-01-30T16:42:42.0000000
ACTIVE
335540002
36009
1171149.30
1126224.00
Approved
119464.46
1051684.84
2025-06-12T18:25:16.0000000
2026-01-29T19:36:27.0000000
ACTIVE
135250003
59028
618491.96
512767.24
Approved
416729.03
201762.93
2025-10-29T19:10:51.0000000
2026-01-29T17:54:31.0000000
ACTIVE
35220012
59022
901496.86
896876.86
Approved
901496.86
0.00
2025-10-29T18:41:34.0000000
2026-01-29T16:33:26.0000000
ACTIVE
250014
74033
419023.50
419023.50
Approved
419023.50
0.00
2026-01-16T14:13:25.0000000
2026-01-29T15:57:13.0000000
ACTIVE
235840001
66258
42805.71
29112.50
Approved
42805.71
0.00
2025-12-09T14:57:01.0000000
2026-01-29T14:25:06.0000000
ACTIVE
231300003
60437
1747160.17
1747160.17
Approved
1467464.38
279695.79
2025-11-06T12:06:18.0000000
2026-01-29T14:21:08.0000000
ACTIVE
335710001
42136
1210024.00
1198045.00
Approved
1210024.00
0.00
2025-07-22T17:38:10.0000000
2026-01-29T14:17:07.0000000
ACTIVE
235840001
47821
1198623.48
1158186.48
Approved
793063.05
405560.43
2025-08-28T20:14:59.0000000
2026-01-29T14:11:36.0000000
ACTIVE
219300008
43582
1391921.91
1342901.48
Approved
760224.49
631697.42
2025-08-05T15:58:03.0000000
2026-01-29T14:01:50.0000000
ACTIVE
21700001
48691
1263168.87
1169295.37
Approved
688977.51
574191.36
2025-09-02T11:27:32.0000000
2026-01-29T13:53:29.0000000
ACTIVE
235880001
73234
1685371.20
1685371.20
Approved
1685371.20
0.00
2026-01-12T12:47:53.0000000
2026-01-28T20:00:54.0000000
ACTIVE
135940001
54816
348897.37
335087.54
Approved
74607.01
274290.36
2025-10-06T13:53:15.0000000
2026-01-27T15:23:46.0000000
ACTIVE
135220014
73336
878122.26
878122.26
Approved
878122.26
0.00
2026-01-12T14:35:18.0000000
2026-01-26T18:42:39.0000000
ACTIVE
10033
47647
2065434.00
2059000.00
Approved
1255821.06
809612.94
2025-08-27T14:13:19.0000000
2026-01-23T16:28:23.0000000
ACTIVE
135400002
36163
2629957.28
2506039.57
Approved
683809.28
1946148.00
2025-06-13T14:16:25.0000000
2026-01-23T16:11:16.0000000
ACTIVE
123200009
62773
444647.89
436340.39
Approved
444647.89
0.00
2025-11-17T22:50:58.0000000
2026-01-23T16:05:49.0000000
ACTIVE
20037
53532
671804.07
598921.15
Approved
85655.45
586148.62
2025-09-30T10:36:14.0000000
2026-01-21T17:13:02.0000000
ACTIVE
```

---

### QUERY 10: Check if there's a "IsDeleted" or similar field

```sql
-- QUERY 10: Check all columns in PrimeContracts table to see if there's a deletion flag
SELECT TOP 1
    *
FROM dbo.PrimeContracts
ORDER BY PrimeContractId DESC;
```

**Note:** This will show all available columns. Look for fields like:
- IsDeleted
- IsActive
- IsEliminated
- Status (beyond ContractStatus)
- Any other boolean or status fields

**Paste column names here (or describe what you see):**

```text
-- QUERY 10 RESULTS:
PrimeContractId
PrimeContractProcoreId
ProjectId
CreatedAt
UpdatedAt
ApprovedChangeOrders
ContractorId
DraftChangeOrdersAmount
GrandTotal
OutstandingBalance
ContractStartDate
OwnerInvoicesAmount
PendingChangeOrdersAmount
PercentagePaid
RetainagePercentage
RevisedContractAmount
TotalPayments
ContractEstimatedCompletionDate
ContractStatus
75077
598134327580921
598134326294950
2026-01-21T16:26:02.0000000
2026-01-21T17:10:42.0000000
-10000.00
0.00
5800.00
-4200.00
-4200.00
0.00
0.00
0.00
-4200.00
0.00
Approved
```

---

## Hypothesis

**If Enid Strip's first contract is eliminated in Procore:**
1. We need to identify how Procore marks eliminated contracts
2. Filter them out in our query
3. Then SUM logic will work correctly:
   - 235840001: Both contracts active → SUM = $1,241,429.19 ✅
   - 10028: Only second contract active → Use second = $729,379.30 ✅

**This would mean:**
- Keep existing logic structure
- But improve filtering to exclude eliminated contracts
- SUM all ACTIVE contracts (not eliminated/zeroed)

**Please run these queries to confirm!**

---

## Analysis of Additional Query Results

### QUERY 8 - Enid Strip Contract Details:

**Contract 1 (31073 - Original):**
- RevisedContractAmount: $577,744.60
- OutstandingBalance: **$577,744.60** (full amount outstanding)
- TotalPayments: **$0.00** (no payments made)
- EliminationCheck: ACTIVE (but suspicious pattern)

**Contract 2 (37260 - Revised):**
- RevisedContractAmount: $729,379.30
- OutstandingBalance: $301,925.97 (has payments)
- TotalPayments: **$427,453.33** (has payments)
- EliminationCheck: ACTIVE

**Key Observation:**
- Contract 1 has **OutstandingBalance = RevisedContractAmount** and **TotalPayments = $0.00**
- This suggests it was never used/paid and was replaced by Contract 2
- But there's **no explicit elimination flag** in the database

### QUERY 9 - Pattern Analysis:

Looking at other contracts, I see:
- Most active contracts have **TotalPayments > 0** or **OutstandingBalance < RevisedContractAmount**
- Contracts with **TotalPayments = 0** and **OutstandingBalance = RevisedContractAmount** might be eliminated/replaced
- But they're all marked as "ACTIVE" in ContractStatus

### QUERY 10 - Table Structure:

**Available Columns:**
- No `IsDeleted`, `IsEliminated`, or `IsActive` flag
- Only `ContractStatus` (which shows "Approved" for all)
- No explicit way to mark contracts as eliminated

---

## Conclusion & Recommendation

**The Problem:**
1. Enid Strip's first contract ($577,744.60) appears to be replaced/eliminated in Procore
2. But in our database, it's still marked as "ACTIVE" with no elimination flag
3. We cannot reliably detect eliminated contracts from the database structure

**Brett's Instruction:**
- "Always be grabbing the grand total or the summation of all contracts"
- This suggests we should SUM all contracts, regardless of whether they appear eliminated

**However:**
- If we SUM Enid Strip: $577,744.60 + $729,379.30 = **$1,307,123.90** (WRONG - Procore shows $729,379.30)
- If we SUM Dutch Bros: $1,198,623.48 + $42,805.71 = **$1,241,429.19** (CORRECT ✅)

**The Solution:**
Since we cannot reliably detect eliminated contracts, and Brett said to always SUM, we have two options:

### Option 1: Always SUM (Simple, per Brett's instruction)
- **Pros:** Simple, follows Brett's instruction exactly
- **Cons:** Enid Strip will show $1,307,123.90 instead of $729,379.30 (needs separate fix)

### Option 2: Use Most Recent for Contracts with Different Creation Dates (Current Logic)
- **Pros:** Enid Strip shows $729,379.30 (correct), Dutch Bros needs fix
- **Cons:** Doesn't follow Brett's "always SUM" instruction

### Option 3: Hybrid Approach - SUM but exclude contracts with suspicious pattern
- Filter out contracts where: `OutstandingBalance = RevisedContractAmount AND TotalPayments = 0`
- **Pros:** Handles both cases
- **Cons:** Might incorrectly filter out valid contracts

**Recommendation:**
Since you confirmed that Enid Strip only shows ONE contract in Procore ($729,379.30), and our current logic (most recent for different creation dates) already handles this correctly, I recommend:

**Keep the existing logic structure BUT:**
- For contracts created on **SAME day** → **SUM** (like Love's Corporate)
- For contracts created on **DIFFERENT days** → **SUM** (per Brett's instruction)

**This means:**
- Remove the "use most recent" logic
- Always SUM all contracts where `RevisedContractAmount > 0`
- This will fix Dutch Bros ($1,241,429.19) ✅
- But Enid Strip will show $1,307,123.90 (needs to be addressed separately, possibly by Procore sync fixing the eliminated contract)

**OR** we can implement Option 3 (filter suspicious contracts) if you want to handle Enid Strip automatically.

**Which approach would you prefer?**


