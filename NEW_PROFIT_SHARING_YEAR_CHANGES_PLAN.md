# New Profit Sharing Year Changes - Implementation Plan

Based on the conversation transcript in `newProfitSharingYear.md`, this document outlines all requested changes for the profit sharing module.

## Summary of Changes

### 1. **Document Preview Modal Scrolling Fix** ⚠️ (Still an issue)
- **Location**: `src/views/ProfitSharing/components/DocumentPreviewModal.jsx`
- **Issue**: Scrolling issues still present on "view draft" modal
- **Action**: Review and fix the modal height/scrolling implementation (may need additional adjustments)

### 2. **Signature Font Styling**
- **Location**: `src/services/DocumentGenerationService.js` (or document template processing)
- **Issue**: Names in documents (e.g., "Brett Tatum") should appear in a script font to look like signatures
- **Action**: Apply script/cursive font styling to signature names in generated documents
- **Note**: This affects both plan documents and award documents where names appear

### 3. **Stakeholder Full Name Override** ⚠️ (Still an issue)
- **Location**: 
  - `src/views/ProfitSharing/StakeholdersTab.jsx`
  - `src/views/ProfitSharing/StakeholderDetail.jsx`
- **Issue**: Full name entered in "Add Stakeholder" modal (e.g., "Brett Tatum") is being overridden by username
- **Action**: Ensure the `name` field from the stakeholder record is preserved and displayed, not overridden by linked user profile name
- **Note**: This was supposedly fixed before but still appears to be an issue

### 4. **Remove "My Summary" Section**
- **Location**: `src/views/ProfitSharing/OverviewTab.jsx` (lines 781-809)
- **Issue**: For non-admin users, the "My Summary" section with KPI cards (Total Awards, Total Shares, Companies) should be removed
- **Action**: 
  - Remove the "My Summary" section (lines 781-809)
  - Keep "My Awards" section at the top
  - Keep "Plan Agreements" section below awards
- **Rationale**: User wants to see awards first, not summary statistics

### 5. **Combine Overview and My Awards into One Page**
- **Location**: `src/views/ProfitSharing/OverviewTab.jsx`
- **Issue**: Currently there are separate "Overview" and "My Awards" concepts for non-admin users
- **Action**: 
  - For non-admin users, the Overview tab should show:
    1. "My Awards" section at the top (list of awards with clickable rows)
    2. "Plan Agreements" section below awards
  - Remove any separation between "Overview" and "My Awards" - they should be one unified view
  - Update the page title from "My Awards Overview" to just "My Awards" or "Overview"

### 6. **Rename "Profit Entries" to "Company Profits"**
- **Location**: `src/views/ProfitSharing/ValuationsTab.jsx`
- **Issue**: Tab/label says "Profit entries" but should say "Company Profits"
- **Action**: 
  - Change all instances of "Profit entries" to "Company Profits"
  - Update page heading (line 537, 553, 569)
  - Update any other references in the component

### 7. **Add Company Selection Dropdown for Multi-Company Users**
- **Location**: `src/views/ProfitSharing/ValuationsTab.jsx`
- **Issue**: If a user has awards from multiple companies, profit entries/valuations should be filterable by company
- **Action**: 
  - Add a dropdown selector at the top of the ValuationsTab
  - Dropdown should show: "Select profit sharing plan" or "Select company"
  - Filter the profit entries table and chart based on selected company
  - Only show dropdown if user has access to multiple companies
  - Default to first company or selected company from settings

### 8. **KPI Rendering Issue Investigation**
- **Location**: `src/views/ProfitSharing/OverviewTab.jsx`
- **Issue**: KPIs not filling in initially, requires page reload or clicking overview again
- **Action**: 
  - Investigate why KPIs don't render on first load
  - Check data loading order and state updates
  - Ensure proper dependency arrays in useEffect hooks
  - May need to add loading states or force re-render

### 9. **Document Formatting** (Ongoing - Lower Priority)
- **Location**: Document generation service and templates
- **Issue**: Missing numbers, weird cutoffs in documents
- **Action**: This is acknowledged as ongoing work, lower priority for this round
- **Note**: User understands this is challenging and will be addressed later

---

## Implementation Priority

### High Priority (Must Fix)
1. Remove "My Summary" section (#4)
2. Combine Overview and My Awards (#5)
3. Rename "Profit Entries" to "Company Profits" (#6)
4. Fix stakeholder full name override (#3)

### Medium Priority (Should Fix)
5. Add company selection dropdown (#7)
6. Fix document preview modal scrolling (#1)
7. Apply script font to signature names (#2)

### Low Priority (Investigate/Fix if Time Permits)
8. KPI rendering issue (#8)
9. Document formatting improvements (#9)

---

## Files to Modify

1. `src/views/ProfitSharing/OverviewTab.jsx` - Remove My Summary, restructure non-admin view
2. `src/views/ProfitSharing/ValuationsTab.jsx` - Rename labels, add company dropdown
3. `src/views/ProfitSharing/StakeholdersTab.jsx` - Fix name override issue
4. `src/views/ProfitSharing/StakeholderDetail.jsx` - Fix name override issue
5. `src/views/ProfitSharing/components/DocumentPreviewModal.jsx` - Fix scrolling
6. `src/services/DocumentGenerationService.js` - Apply script font to signatures
7. `src/views/ProfitSharing.jsx` - Update tab labels if needed

---

## Testing Checklist

After implementation, test:
- [ ] Non-admin user sees "My Awards" at top, no "My Summary" section
- [ ] "Plan Agreements" appears below awards for non-admin users
- [ ] "Profit Entries" tab is renamed to "Company Profits"
- [ ] Company dropdown appears in ValuationsTab for multi-company users
- [ ] Stakeholder names display correctly (not overridden by username)
- [ ] Document preview modal scrolls properly
- [ ] Signature names appear in script font in documents
- [ ] KPIs render correctly on first load

---

## Notes

- User mentioned they will create a 2025 plan for testing purposes
- Profile name fields (first name, last name) change is separate from profit sharing module
- User invitation feature is still in development (separate feature)

