# Testing Instructions for Profit Sharing Changes

## Overview
All requested changes from the meeting with Brett have been implemented. Follow these steps to test each feature.

---

## 1. Profile Page Changes ✅

### What Changed:
- "First Name" and "User Name" fields → "First Name" and "Last Name" fields
- "Phone Number" field removed

### How to Test:
1. **Navigate to Profile:**
   - Click on your profile icon in the top right corner
   - Select "Profile" from the dropdown

2. **Verify Fields:**
   - ✅ Should see "First name" and "Last name" fields (not "User name")
   - ✅ Should NOT see "Phone number" field
   - ✅ Email field should still be present

3. **Test Saving:**
   - Enter first name and last name
   - Click "Save"
   - Verify the data saves correctly
   - Refresh the page and verify data persists

4. **Backward Compatibility:**
   - If you had a "userName" before, it should automatically populate the "Last name" field
   - Verify existing users can still access their profile

---

## 2. Overview Tab - Plan Agreements Filtering ✅

### What Changed:
- Plan Agreements section now only shows plans where the user has been awarded
- Previously showed ALL plans

### How to Test:
1. **As a Regular User:**
   - Log in as a non-admin user who has awards
   - Navigate to Profit Sharing → Overview tab
   - Scroll down to "Plan Agreements" section

2. **Verify Filtering:**
   - ✅ Should only see plan agreements for plans where you have awards
   - ✅ Should NOT see plans where you don't have awards
   - ✅ If you have no awards, the section should be empty or not show

3. **Test with Multiple Plans:**
   - Create awards for user in Plan A
   - Create awards for user in Plan B
   - Verify both Plan A and Plan B agreements appear
   - Create Plan C (no awards for user)
   - Verify Plan C does NOT appear

---

## 3. Stakeholder Detail - KPI Updates (CRITICAL) ✅

### What Changed:
- Added plan selector dropdown above KPIs
- KPIs are now plan-specific (not mixing data from all plans)
- Updated KPI cards:
  - **Estimated Profit** - Next period estimated profit for selected plan
  - **Estimated Payout** - Estimated payout for selected plan
  - **Last Quarter Payout** - Actual payouts from last quarter for selected plan
  - **Total Payout** - Total actual payouts for selected plan

### How to Test:

1. **Navigate to Stakeholder Detail:**
   - Go to Profit Sharing → Stakeholders
   - Click on a stakeholder who has multiple awards from different plans

2. **Verify Plan Selector:**
   - ✅ Should see a dropdown above the KPI cards labeled "View KPIs for Plan:"
   - ✅ Dropdown should list all plans where the stakeholder has awards
   - ✅ Default selection should be the first plan

3. **Test KPI Filtering:**
   - Select Plan A from dropdown
   - ✅ "Estimated Profit" should show next estimated profit for Plan A only
   - ✅ "Estimated Payout" should calculate based on Plan A awards only
   - ✅ "Last Quarter Payout" should show actual payouts from Plan A only
   - ✅ "Total Payout" should show total actual payouts from Plan A only

4. **Test Plan Switching:**
   - Switch to Plan B in dropdown
   - ✅ All KPIs should update to show Plan B data
   - ✅ Values should be different from Plan A (if they have different data)

5. **Test with Single Plan:**
   - View a stakeholder with only one plan
   - ✅ Dropdown should still appear
   - ✅ KPIs should show correct data for that plan

6. **Test with No Plans:**
   - View a stakeholder with no awards
   - ✅ Dropdown should not appear
   - ✅ KPIs should show $0.00 or "No awards" messages

---

## 4. Payout History Updates ✅

### What Changed:
- Column renamed from "Estimated Payout" to "Payout"
- Only shows actual payouts (excludes estimated profits)
- Footer text changed from "Total estimated payout" to "Total payout"

### How to Test:

1. **Navigate to Stakeholder Detail:**
   - Go to Profit Sharing → Stakeholders
   - Click on a stakeholder with awards
   - Click on the "Profit" tab

2. **Expand Payout History:**
   - Find an award in the table
   - Click the expand arrow (chevron) to see payout history

3. **Verify Column Name:**
   - ✅ Column header should say "Payout" (not "Estimated Payout")

4. **Verify Filtering:**
   - If you have both estimated and actual profit entries:
     - ✅ Should only see rows for actual profits
     - ✅ Should NOT see rows for estimated profits
   - If you only have estimated profits:
     - ✅ Payout history should be empty (no rows)

5. **Verify Footer:**
   - ✅ Footer should say "Total payout:" (not "Total estimated payout")
   - ✅ Total should only include actual payouts

---

## 5. Company Profits Page - Plan Filtering ✅

### What Changed:
- Added plan filter dropdown (in addition to company dropdown)
- Dates are displayed properly (already formatted as dates)

### How to Test:

1. **Navigate to Company Profits:**
   - Go to Profit Sharing → Company Profits (or Valuations tab)

2. **Verify Plan Dropdown:**
   - ✅ Should see company dropdown (if multiple companies)
   - ✅ Should see plan dropdown next to company dropdown
   - ✅ Plan dropdown should show "All Plans" as default
   - ✅ Plan dropdown should list all plans for the selected company

3. **Test Filtering:**
   - Select a specific plan from dropdown
   - ✅ Table should only show profit entries for that plan
   - ✅ Chart should only show data for that plan
   - ✅ Current value card should show data for that plan (if applicable)

4. **Test "All Plans" Option:**
   - Select "All Plans" from dropdown
   - ✅ Should show all profit entries for the company
   - ✅ Chart should show all data

5. **Test Date Display:**
   - ✅ "Profit Date" column should show dates in format: "Month Day, Year" (e.g., "March 31, 2025")
   - ✅ Should NOT show numbers or timestamps

6. **Test Company Switching:**
   - Switch to a different company
   - ✅ Plan dropdown should reset to "All Plans"
   - ✅ Plan dropdown should update to show plans for new company

---

## Common Test Scenarios

### Scenario 1: User with Multiple Plans
1. Create a user with awards in Plan A and Plan B
2. Log in as that user
3. Go to Overview tab
4. ✅ Should only see Plan A and Plan B agreements (not Plan C)
5. Go to Stakeholder Detail → Profit tab
6. ✅ Should see plan selector with Plan A and Plan B
7. ✅ KPIs should update when switching between plans

### Scenario 2: User with Single Plan
1. Create a user with award in Plan A only
2. Log in as that user
3. Go to Overview tab
4. ✅ Should only see Plan A agreement
5. Go to Stakeholder Detail → Profit tab
6. ✅ Plan selector should show Plan A
7. ✅ KPIs should show Plan A data

### Scenario 3: User with No Awards
1. Create a user with no awards
2. Log in as that user
3. Go to Overview tab
4. ✅ Should NOT see Plan Agreements section (or it should be empty)
5. Go to Stakeholder Detail → Profit tab
6. ✅ Should NOT see plan selector
7. ✅ KPIs should show $0.00 or "No awards" messages

### Scenario 4: Mixed Estimated and Actual Profits
1. Create profit entries:
   - Actual profit for March 31, 2025
   - Estimated profit for June 30, 2025
   - Actual profit for September 30, 2025
2. View stakeholder with award covering these dates
3. Expand payout history
4. ✅ Should only see March 31 and September 30 entries
5. ✅ Should NOT see June 30 entry (it's estimated)

---

## Known Issues / Notes

1. **Profile Page:**
   - Existing users with `userName` will have it automatically mapped to `lastName` for backward compatibility
   - If you see any components still showing `userName`, those need to be updated separately

2. **KPI Calculations:**
   - KPIs are calculated based on the selected plan's valuations
   - If a plan has no valuations, KPIs will show $0.00
   - Last Quarter Payout only includes actual profits from the last 3 months

3. **Payout History:**
   - Only shows actual payouts (profitType === 'actual')
   - Estimated profits are excluded from payout history

4. **Plan Filtering:**
   - Company Profits page filters by both company and plan
   - When switching companies, plan filter resets to "All Plans"

---

## Quick Verification Checklist

- [ ] Profile page shows "First name" and "Last name" (not "User name")
- [ ] Profile page does NOT show "Phone number" field
- [ ] Overview tab only shows plan agreements where user has awards
- [ ] Stakeholder Detail has plan selector dropdown above KPIs
- [ ] KPIs update when switching plans in dropdown
- [ ] Payout History column says "Payout" (not "Estimated Payout")
- [ ] Payout History only shows actual payouts
- [ ] Company Profits page has plan filter dropdown
- [ ] Company Profits page filters correctly by plan
- [ ] Dates are displayed properly (not as numbers)

---

## If You Find Issues

1. **Check Browser Console:**
   - Open Developer Tools (F12)
   - Look for any JavaScript errors
   - Check Network tab for failed API calls

2. **Verify Data:**
   - Check Firebase/Firestore to ensure data structure is correct
   - Verify `planId` is set correctly on awards and valuations
   - Verify `profitType` is set correctly on valuations ('actual' or 'estimated')

3. **Clear Cache:**
   - Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
   - Clear browser cache if issues persist

4. **Check Permissions:**
   - Ensure user has proper access to profit sharing features
   - Verify company selection is correct

---

## Success Criteria

✅ All features work as described above
✅ No console errors
✅ Data displays correctly
✅ Filtering works properly
✅ KPIs are accurate and plan-specific
✅ User experience is smooth and intuitive

