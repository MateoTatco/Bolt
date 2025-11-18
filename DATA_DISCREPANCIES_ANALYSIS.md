# Data Discrepancies Analysis - Chicken Salad Chick - Norman

## Current Status
**Project ID:** 598134326177405  
**Project Name:** Chicken Salad Chick - Norman

## Discrepancies Found

### 1. Total Contract Value
- **Our Value:** $350,803.88
- **Power BI Value:** $354,621
- **Status:** ✅ FIXED - Now using `contract_sum_to_date` from Payment Applications g702
- **Expected Result:** Should now match $354,621

### 2. Est. Cost At Completion
- **Our Value:** $248,650.93 (from 14 commitments)
- **Power BI Value:** $284,851
- **Difference:** $36,200.07
- **Issue:** We're using Commitments as fallback (Budget Line Items returns 404)
- **Possible Solutions:**
  - Check if we're missing some commitments (we limit to 20 detail fetches)
  - Check if there's a different field in Commitments that has the total
  - Check if Payment Applications g702 has cost fields
  - Check if there's a summary endpoint that has the total

### 3. Job To Date Cost
- **Our Value:** $81,807.66 (from Requisitions `total_completed_and_stored_to_date`)
- **Power BI Value:** ~$276,305 (97% of $284,851)
- **Difference:** $194,497.34
- **Issue:** We're using the wrong field from Requisitions
- **Possible Solutions:**
  - Try `total_cost_to_date` instead of `total_completed_and_stored_to_date`
  - Try `cost_to_date` field
  - Check if Payment Applications g702 has cost-to-date fields
  - The value we're getting (81,807.66) is 32.9% of our Est Cost (248,650.93), which matches our Percent Complete (Cost) calculation

### 4. Percent Complete (Cost)
- **Our Value:** 32.9% (81,807.66 / 248,650.93)
- **Power BI Value:** 97%
- **Status:** Will fix once Est Cost and Job To Date Cost are correct

### 5. Current Projected Profit
- **Our Value:** $102,152.95
- **Power BI Value:** $69,770
- **Calculation:** Contract Value - Est Cost = 350,803.88 - 248,650.93 = 102,152.95
- **Expected:** 354,621 - 284,851 = 69,770
- **Status:** Will fix once Contract Value and Est Cost are correct

### 6. Customer Retainage
- **Our Value:** $35,462.19 (from `completed_work_retainage_amount`)
- **Power BI Value:** $9,142
- **Difference:** $26,320.19
- **Issue:** We're using the wrong field from Payment Applications g702
- **Possible Solutions:**
  - Try `retainage_amount` field
  - Try `retainage` field
  - Check if it's a percentage that needs to be calculated
  - The value 35,462.19 is about 10% of contract value (354,621), which might be a percentage-based retainage

### 7. Remaining Cost
- **Our Value:** $166,843.27
- **Power BI Value:** $16,020
- **Calculation:** Est Cost - Job To Date Cost = 248,650.93 - 81,807.66 = 166,843.27
- **Expected:** 284,851 - 276,305 = 16,020
- **Status:** Will fix once Est Cost and Job To Date Cost are correct

### 8. Balance Left On Contract
- **Our Value:** -$3,817 (now showing $0 after fix)
- **Power BI Value:** $0
- **Status:** ✅ FIXED - Now shows $0 when contract equals invoiced

### 9. Percent Complete (Revenue)
- **Our Value:** 100%
- **Power BI Value:** (blank/empty)
- **Status:** ✅ FIXED - Now only uses value from API, doesn't calculate

### 10. Archive Date
- **Our Value:** null
- **Power BI Value:** 10/11/2025 8:20:33
- **Status:** Need to check if `updated_at` should be used when project is archived

## Next Steps

1. **Wait for Rate Limit Reset** (15-60 minutes)
2. **Fetch Projects Again** to get detailed logs
3. **Check Logs For:**
   - Payment Application g702 all fields and values
   - Requisition Summary all numeric values
   - Budget Line Items structure (if available)
4. **Identify Correct Fields:**
   - Customer Retainage field (should be 9142)
   - Job To Date Cost field (should be ~276,305)
   - Est Cost At Completion source (should be 284,851)

## Rate Limit Information
- **Error:** "You have surpassed the max number of requests for your rate limit"
- **Solution:** Wait 15-60 minutes for limit to reset
- **Prevention:** Reduce API calls, increase delays between calls, or implement caching


