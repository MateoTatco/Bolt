# Profit Sharing - Additional Changes Plan

## Overview
This document outlines all the changes requested by Brett Tatum during the conversation on the Profit Sharing feature. The changes are organized by feature area and priority.

---

## 1. Document Preview & UI Improvements

### 1.1 Document Preview Scrolling Issue
**Current State:** Cannot scroll in document preview, cannot see bottom of preview page
**Requested Change:** Fix scrolling in document preview modal
**Priority:** High
**Files Affected:**
- `src/views/ProfitSharing/components/DocumentPreviewModal.jsx` (or similar)
- `src/views/ProfitSharing/components/PdfViewerModal.jsx`

### 1.2 Save Button Behavior
**Current State:** Clicking "Save" closes the modal/form
**Requested Change:** 
- Option 1: Keep modal open after save
- Option 2: Change button text to "Save and Close" to indicate it will close
**Priority:** Medium
**Files Affected:**
- `src/views/ProfitSharing/CreateProfitPlan.jsx`
- `src/views/ProfitSharing/StakeholderDetail.jsx` (award save functionality)

### 1.3 Remove Blank Front Page
**Current State:** Documents have a blank front page
**Requested Change:** Remove blank front page from document templates
**Priority:** Medium
**Files Affected:**
- Document generation service
- Template files in Firebase Storage

---

## 2. Stakeholder Form Changes

### 2.1 Name Field Simplification
**Current State:** Separate first name and last name fields, username field
**Requested Change:**
- Replace with single "Full Name" field
- Remove username field (users will log in with email)
- If user profile has name filled, auto-populate from profile
**Priority:** High
**Files Affected:**
- `src/views/ProfitSharing/components/AddStakeholderModal.jsx`
- `src/views/ProfitSharing/StakeholderDetail.jsx`

### 2.2 Remove Fields
**Current State:** Form includes: Title, Employment Status, Pay Type, Pay Amount
**Requested Change:** Remove all these fields
**Priority:** High
**Files Affected:**
- `src/views/ProfitSharing/components/AddStakeholderModal.jsx`
- `src/views/ProfitSharing/StakeholderDetail.jsx`
- Database schema (stakeholders collection)

### 2.3 Add Manager Field
**Current State:** No manager/supervisor field
**Requested Change:**
- Add "Manager" field (not "Supervisor")
- Field should be a dropdown/select from full user list in Bolt
- Managers need to be able to see all their direct reports (requires supervisor role/permission)
**Priority:** High
**Files Affected:**
- `src/views/ProfitSharing/components/AddStakeholderModal.jsx`
- `src/views/ProfitSharing/StakeholderDetail.jsx`
- Database schema (stakeholders collection)
- Permission/role system (need to add "supervisor" role)

**Note:** This requires:
- Adding "supervisor" role to the permission system (currently only "admin" and "user")
- Supervisor role should allow viewing people below them
- Manager field should link to userId

---

## 3. Date Picker Enhancement

### 3.1 Allow Typing Dates
**Current State:** Date picker only allows calendar selection
**Requested Change:** Allow typing dates directly in addition to calendar selection
**Priority:** Medium
**Files Affected:**
- Date picker component (likely in `src/components/ui`)
- All date picker usages in Profit Sharing

---

## 4. Award Status Flow Changes

### 4.1 Three-Status System
**Current State:** Draft → Finalized
**Requested Change:** Draft → Issued → Finalized

**New Flow:**
1. **Draft:** Admin creates award, can edit
2. **Issued:** Admin clicks "Issue" button
   - Adds admin signature (timestamp)
   - Moves status to "Issued"
   - Notifies user
   - User can now see award in their view
3. **Finalized:** User clicks "Accept" (or "Accept Award")
   - Adds user signature (timestamp)
   - Moves status to "Finalized"
   - Admin can see finalized document

**Priority:** High
**Files Affected:**
- `src/views/ProfitSharing/StakeholderDetail.jsx`
- `src/views/ProfitSharing/OverviewTab.jsx` (user view)
- Award document generation
- Database schema (awards collection)

### 4.2 Remove Signature Pages from Documents
**Current State:** Documents include signature pages with signature blocks
**Requested Change:** 
- Remove signature pages entirely
- Use timestamps instead:
  - "Issued by [Admin Name] on [Date/Time]" when admin issues
  - "Accepted by [User Name] on [Date/Time]" when user accepts
**Priority:** High
**Files Affected:**
- Document generation service
- Template files in Firebase Storage
- Award document components

---

## 5. Profit Entry (Valuations) Changes

### 5.1 Remove Source Field
**Current State:** Profit entry form has "Source" field (Manual, Third-party, Calculated)
**Requested Change:** Remove "Source" field (it's always manual)
**Priority:** Medium
**Files Affected:**
- `src/views/ProfitSharing/ValuationsTab.jsx`
- Database schema (valuations collection)

### 5.2 Add Profit Type Field
**Current State:** Only one type of profit entry
**Requested Change:**
- Replace "Source" with "Type of Profit" field
- Options: "Estimated Profit" or "Actual Profit"
- Allow editing profit entries to change from estimated to actual
**Priority:** High
**Files Affected:**
- `src/views/ProfitSharing/ValuationsTab.jsx`
- Database schema (valuations collection - add `profitType` field)

### 5.3 Remove Reminder Feature
**Current State:** (Implied) Reminder before end date
**Requested Change:** No reminder needed (profit won't be known until 30 days after period ends)
**Priority:** Low (if it exists)

---

## 6. Stakeholder Detail View - KPI Changes

### 6.1 New KPIs for Stakeholders
**Current State:** Basic stakeholder information
**Requested Change:** Add three KPIs:

1. **Next Period Estimated Profit** (or "[Date] Estimated Profit")
   - Shows the latest estimated profit entry for the upcoming period
   - Format: "[Date] Estimated Profit: $X"
   - If no estimate exists, show $0

2. **Last Quarter Actual Profit** (or "[Date] Actual Profit")
   - Shows the latest actual profit entry from the previous period
   - Format: "[Date] Actual Profit: $X"
   - If no actual exists, show $0

3. **Annual Total Actual Profit**
   - Sum of all actual profit entries for the current year
   - Only counts "Actual Profit" entries, not estimates
   - Format: "Annual Total Actual Profit: $X"

**Priority:** High
**Files Affected:**
- `src/views/ProfitSharing/StakeholderDetail.jsx`
- Need to query valuations filtered by:
  - `profitType` = "estimated" for next period
  - `profitType` = "actual" for last quarter and annual total
  - Filter by company and date ranges

---

## 7. Valuations Tab - User Access

### 7.1 Allow Users to View Valuations
**Current State:** Valuations tab is admin-only
**Requested Change:**
- Users (stakeholders) should be able to view the Valuations tab
- Read-only access (cannot add/edit/delete)
- Company-specific (only see their company's data)
- Show the profit graph/chart
**Priority:** Medium
**Files Affected:**
- `src/views/ProfitSharing.jsx` (tab visibility)
- `src/views/ProfitSharing/ValuationsTab.jsx` (add read-only mode)
- Permission checks

---

## 8. Supervisor Role Implementation

### 8.1 Add Supervisor Role
**Current State:** Only "admin" and "user" roles exist
**Requested Change:**
- Add "supervisor" role
- Supervisors can see all their direct reports (people who have them as manager)
- Supervisors have more access than regular users but less than admins
**Priority:** High (required for Manager field functionality)
**Files Affected:**
- `src/context/ProfitSharingAccessContext.jsx`
- `src/hooks/useProfitSharingAccess.js`
- `src/views/ProfitSharing/SettingsTab.jsx` (role selection)
- Permission checks throughout Profit Sharing

---

## Implementation Priority Summary

### High Priority (Core Functionality)
1. ✅ Stakeholder form changes (name, remove fields, add manager)
2. ✅ Award status flow (Draft → Issued → Finalized)
3. ✅ Remove signature pages, use timestamps
4. ✅ Profit type field (Estimated/Actual)
5. ✅ Stakeholder detail KPIs (estimated, actual, annual total)
6. ✅ Supervisor role implementation

### Medium Priority (UX Improvements)
1. Document preview scrolling fix
2. Save button behavior
3. Date picker typing support
4. Remove source field from profit entries
5. User access to Valuations tab (read-only)

### Low Priority (Polish)
1. Remove blank front page from documents

---

## Database Schema Changes Required

### Stakeholders Collection
- Remove: `title`, `employmentStatus`, `payType`, `payAmount`, `username`
- Change: `firstName`, `lastName` → `fullName` (or keep both but use `fullName` as primary)
- Add: `managerId` (userId of the manager)

### Awards Collection
- Change: `status` enum: `['draft', 'issued', 'finalized']` (was `['draft', 'finalized']`)
- Add: `issuedBy` (userId), `issuedAt` (timestamp)
- Add: `acceptedBy` (userId), `acceptedAt` (timestamp)
- Remove: Signature-related fields (if any)

### Valuations Collection
- Remove: `source` field (or mark as deprecated)
- Add: `profitType` field: `'estimated' | 'actual'`

### Profit Sharing Access Collection
- Update: `role` enum: `['admin', 'supervisor', 'user']` (was `['admin', 'user']`)

---

## Testing Checklist

- [ ] Document preview scrolls correctly
- [ ] Save button behavior works as expected
- [ ] Stakeholder form shows only required fields
- [ ] Manager field populates from user list
- [ ] Award flow: Draft → Issue → Accept → Finalized
- [ ] Timestamps show correctly (no signature pages)
- [ ] Profit entries can be marked as Estimated or Actual
- [ ] Stakeholder detail shows all three KPIs correctly
- [ ] Users can view Valuations tab (read-only)
- [ ] Supervisors can see their direct reports
- [ ] Date picker allows typing dates
- [ ] Blank front page removed from documents

---

## Notes

1. **Manager/Supervisor Relationship:** The manager field links stakeholders to their manager (another user). Managers need supervisor role to see their direct reports. This is a new permission level.

2. **Profit Type Logic:** 
   - Estimated profits are entered before the period ends
   - Actual profits are entered after the period ends (30+ days later)
   - Users can edit a profit entry to change from estimated to actual

3. **Award Status Flow:**
   - Admin creates award → Status: "Draft"
   - Admin clicks "Issue" → Status: "Issued", timestamp recorded
   - User clicks "Accept" → Status: "Finalized", timestamp recorded
   - Both timestamps are visible in the UI

4. **Signature Removal:** Instead of signature images/pages, use:
   - "Issued by [Name] on [Date/Time]"
   - "Accepted by [Name] on [Date/Time]"
   - These are stored as metadata, not in the document itself

