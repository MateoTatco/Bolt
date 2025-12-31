# Profit Sharing Pending Tasks - Implementation Plan

Based on the conversation with Brett on `newLastMeetingWithBrett.md`, this document outlines all pending tasks and their implementation plan.

## Summary of Requirements

### 1. Profile Page Changes
**Priority: High** | **Status: Pending**

**Requirements:**
- Change first two fields from "First Name" and "User Name" to "First Name" and "Last Name"
- Remove "Phone Number" field completely
- Update all references throughout the app that use `userName` to use `lastName` instead
- Ensure backward compatibility for existing data

**Files to Modify:**
- `src/views/Profile.jsx` - Update form fields and state
- Search entire codebase for `userName` references and update to `lastName` where appropriate
- Update user data structure in Firebase/Firestore
- Update any components that display user names

**Implementation Steps:**
1. Update Profile.jsx form fields (firstName, lastName instead of firstName, userName)
2. Remove phoneNumber field from form and state
3. Update user data saving logic to use lastName
4. Search codebase for all `userName` references
5. Create migration script or handle backward compatibility (map userName to lastName for existing users)
6. Update all display components that show user names

---

### 2. Overview Tab - Plan Agreements Filtering
**Priority: High** | **Status: Pending**

**Requirements:**
- Currently showing ALL plan agreements for all users
- Should only show plan agreements for plans where the user has been awarded
- Filter based on user's profit awards (check if user has an award for that plan)

**Files to Modify:**
- `src/views/ProfitSharing/OverviewTab.jsx` - Filter plans based on user's awards

**Current Implementation:**
- Line 835-879: Shows all plans without filtering
- `plans` array contains all plans for the selected company

**Implementation Steps:**
1. Get user's stakeholder data (across all companies)
2. Extract all planIds from user's profit awards
3. Filter `plans` array to only include plans where `plan.id` is in the user's award planIds
4. Update the display logic to show filtered plans
5. Handle case where user has no awards (show empty state)

---

### 3. Company Profits Page - Filtering and Display
**Priority: Medium** | **Status: Pending**

**Requirements:**
- Add a dropdown to filter by profit plan (in addition to existing company dropdown)
- Change profit date display from numbers to dates (currently showing as numbers)
- Keep current structure (selecting plan and company) but add filtering capability
- Allow filtering by both company and plan simultaneously

**Files to Modify:**
- `src/views/ProfitSharing/ValuationsTab.jsx` - Add plan filter dropdown and fix date display

**Current Implementation:**
- Line 622-631: Only has company dropdown
- Line 615-632: Header section with company selector
- Need to check where dates are displayed as numbers

**Implementation Steps:**
1. Add plan dropdown next to company dropdown
2. Load plans for selected company
3. Filter valuations by both selected company AND selected plan
4. Find where dates are displayed as numbers and convert to date format
5. Update table/display to show dates properly formatted
6. Handle "All Plans" option to show all plans

---

### 4. Stakeholder Detail Page - KPI Updates (CRITICAL)
**Priority: Critical** | **Status: Pending**

**Requirements:**
- KPIs are currently showing data from ALL plans/companies, causing confusion
- Need to make KPIs specific to the selected award/plan
- Add a dropdown to select which profit plan to view KPIs for
- Update KPIs to show:
  - **Estimated Profit** (next period estimated profit for selected plan)
  - **Estimated Payout** (estimated payout for selected plan)
  - **Last Quarter Payout** (actual payout from last quarter for selected plan)
  - **Total Payout** (total actual payouts for selected plan)
- KPIs should be tied to the specific award/plan selected

**Files to Modify:**
- `src/views/ProfitSharing/StakeholderDetail.jsx` - Major refactoring of KPI section

**Current Implementation:**
- Line 1478-1606: Three KPI cards showing:
  - "Next Period Estimated Profit" - Shows from ALL valuations (not plan-specific)
  - "Last Quarter Actual Profit" - Shows from ALL valuations (not plan-specific)
  - "Annual Total (Actuals Only)" - Shows from ALL valuations (not plan-specific)
- Line 1608-1764: "Next Estimated Profit Payment" card - Shows total across all awards
- Problem: When user has awards from multiple plans/companies, KPIs mix data from all of them

**Implementation Steps:**
1. Add plan/award selector dropdown above KPI cards
2. Filter valuations by selected plan (planId)
3. Update "Next Period Estimated Profit" KPI:
   - Filter valuations by selected plan
   - Show only next estimated profit for that plan
4. Update "Estimated Payout" KPI (rename from "Next Estimated Profit Payment"):
   - Calculate payout for selected award/plan only
   - Use plan-specific valuations
5. Add "Last Quarter Payout" KPI:
   - Filter by selected plan
   - Show actual payouts from last quarter (last 3 months)
   - Only include actual profit entries (not estimated)
6. Add "Total Payout" KPI:
   - Filter by selected plan
   - Sum all actual payouts for the selected plan
   - Exclude estimated payouts
7. Default to first award/plan if user has multiple awards
8. Handle case where user has no awards or no plan selected

---

### 5. Payout History - Column Rename and Filtering
**Priority: Medium** | **Status: Pending**

**Requirements:**
- Change column name from "Estimated Payout" to "Payout"
- Only show actual payouts (not estimated ones) in payout history
- Filter out entries where profitType = 'estimated'

**Files to Modify:**
- `src/views/ProfitSharing/StakeholderDetail.jsx` - Update payout history table

**Current Implementation:**
- Line 1962-2014: Payout History table
- Line 1970: Column header says "Estimated Payout"
- Line 1974-2004: Shows all payouts (both estimated and actual)
- Need to check `calculateAwardPayouts` function to see how payouts are calculated

**Implementation Steps:**
1. Rename column header from "Estimated Payout" to "Payout"
2. Find where payouts are calculated (likely in `calculateAwardPayouts` function)
3. Filter payout history to only include entries where `profitType === 'actual'`
4. Update the payout calculation logic to exclude estimated profits
5. Ensure the "Total estimated payout" footer only shows actual payouts (or rename to "Total payout")

---

## Implementation Priority Order

1. **Profile Page Changes** (High Priority - Affects entire app)
2. **Stakeholder Detail KPI Updates** (Critical - Core functionality issue)
3. **Overview Tab Plan Agreements Filtering** (High Priority - Data privacy/accuracy)
4. **Payout History Updates** (Medium Priority - UX improvement)
5. **Company Profits Page Filtering** (Medium Priority - UX improvement)

---

## Technical Considerations

### Data Structure Changes
- **User Profile**: Need to handle migration from `userName` to `lastName`
  - Option 1: Keep both fields, populate lastName from userName for existing users
  - Option 2: Migrate all userName to lastName in database
  - Option 3: Use lastName as primary, fallback to userName for backward compatibility

### KPI Calculation Logic
- Need to ensure valuations are properly filtered by planId
- Need to distinguish between estimated and actual profits
- Need to calculate payouts correctly per plan/award
- Need to handle edge cases (no valuations, no awards, multiple companies)

### Performance Considerations
- Filtering plans by user awards may require additional queries
- KPI calculations may need optimization if user has many awards
- Consider caching plan/award selections

### Testing Scenarios
1. User with single award from single plan
2. User with multiple awards from same plan
3. User with awards from multiple plans
4. User with awards from multiple companies
5. User with no awards
6. Plans with no valuations
7. Mix of estimated and actual profits

---

## Files Summary

### Files to Create/Modify:
1. `src/views/Profile.jsx` - Profile form changes
2. `src/views/ProfitSharing/OverviewTab.jsx` - Plan agreements filtering
3. `src/views/ProfitSharing/StakeholderDetail.jsx` - KPI updates and payout history
4. `src/views/ProfitSharing/ValuationsTab.jsx` - Plan filter and date display
5. Search entire codebase for `userName` references
6. Potentially create migration utility for userName → lastName

---

## Notes from Conversation

- Brett mentioned KPIs are "getting confused" when he has multiple plans
- Next period estimated profit is showing June 30, 2026 from a different plan
- KPIs need to be "within the dropdown or somehow tied to the specific award"
- Payout history should only show actual payouts, not estimates
- Company profits page needs plan filtering dropdown
- Profile changes are straightforward but affect entire app

---

## Next Steps

1. Review this plan with team
2. Start with Profile Page changes (affects entire app)
3. Implement Stakeholder Detail KPI updates (most critical)
4. Continue with remaining tasks in priority order
5. Test thoroughly with multiple scenarios
6. Deploy incrementally if possible

