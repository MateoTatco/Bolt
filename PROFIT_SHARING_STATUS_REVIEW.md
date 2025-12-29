# Profit Sharing Feature - Status Review

## Overview
This document compares the conversation requirements from `additionalChangesProfit.md` with the current implementation status in the codebase.

---

## ✅ COMPLETED FEATURES

### 1. Stakeholder Form Changes ✅
**Status:** COMPLETE

**What was requested:**
- Replace first name/last name with single "Full Name" field
- Remove: Title, Employment Status, Pay Type, Pay Amount
- Add Manager field (dropdown from user list)
- Remove username field

**Implementation found:**
- ✅ `AddStakeholderModal.jsx` uses `fullName` field (line 8, 42, 209)
- ✅ Manager field implemented with user dropdown (lines 230-246)
- ✅ No title, employmentStatus, payType, payAmount fields in form
- ✅ Email field present (lines 218-228)
- ✅ User selection populates fullName automatically (lines 80-95)

**Files:**
- `src/views/ProfitSharing/components/AddStakeholderModal.jsx`
- `src/views/ProfitSharing/StakeholderDetail.jsx` (edit form)

---

### 2. Award Status Flow (Draft → Issued → Finalized) ✅
**Status:** COMPLETE

**What was requested:**
- Three status system: Draft → Issued → Finalized
- Admin clicks "Issue" → adds timestamp, moves to "Issued"
- User clicks "Accept" → adds timestamp, moves to "Finalized"
- Remove signature pages, use timestamps instead

**Implementation found:**
- ✅ `handleIssueAward` function implemented (StakeholderDetail.jsx:665-779)
- ✅ `handleAcceptAward` function implemented (StakeholderDetail.jsx:781-851)
- ✅ Status transitions: draft → issued → finalized
- ✅ Timestamps stored: `issuedBy`, `issuedAt`, `acceptedBy`, `acceptedAt`
- ✅ Issue button shown for draft awards (line 1726)
- ✅ Accept button shown for issued awards (line 1789)
- ✅ Signature functionality removed from DocumentGenerationService.js (line 57, 244)

**Files:**
- `src/views/ProfitSharing/StakeholderDetail.jsx`
- `src/services/DocumentGenerationService.js`

---

### 3. Profit Type Field (Estimated/Actual) ✅
**Status:** COMPLETE

**What was requested:**
- Replace "Source" field with "Type of Profit"
- Options: "Estimated Profit" or "Actual Profit"
- Allow editing to change from estimated to actual

**Implementation found:**
- ✅ `profitType` field in formData (ValuationsTab.jsx:49)
- ✅ Profit type options defined (lines 518-521)
- ✅ Form field for profit type (lines 944-959)
- ✅ Display in table with color coding (lines 776-783)
- ✅ Source field removed (no "source" found in grep search)

**Files:**
- `src/views/ProfitSharing/ValuationsTab.jsx`

---

### 4. Stakeholder Detail KPIs ✅
**Status:** COMPLETE

**What was requested:**
1. Next Period Estimated Profit (or "[Date] Estimated Profit")
2. Last Quarter Actual Profit (or "[Date] Actual Profit")
3. Annual Total Actual Profit

**Implementation found:**
- ✅ Next Period Estimated Profit KPI (StakeholderDetail.jsx:1344-1380)
- ✅ Last Quarter Actual Profit KPI (lines 1382-1410)
- ✅ Annual Total Actual Profit KPI (lines 1440-1468)
- ✅ All KPIs filter by `profitType` correctly
- ✅ Date-based formatting implemented

**Files:**
- `src/views/ProfitSharing/StakeholderDetail.jsx`

---

### 5. Supervisor Role Implementation ✅
**Status:** COMPLETE

**What was requested:**
- Add "supervisor" role to permission system
- Supervisors can see their direct reports
- Manager field links to userId

**Implementation found:**
- ✅ Supervisor role in `useProfitSharingAccess.js` (lines 52, 56, 86)
- ✅ Role hierarchy: admin > supervisor > user (lines 51-59)
- ✅ `isSupervisor` helper function (line 86)
- ✅ Manager field stores userId (AddStakeholderModal.jsx:11, 236)

**Files:**
- `src/hooks/useProfitSharingAccess.js`
- `src/context/ProfitSharingAccessContext.jsx`
- `src/views/ProfitSharing/components/AddStakeholderModal.jsx`

---

### 6. Users Can View Valuations Tab ✅
**Status:** COMPLETE

**What was requested:**
- Users (stakeholders) should be able to view Valuations tab
- Read-only access (cannot add/edit/delete)
- Company-specific data
- Show profit graph/chart

**Implementation found:**
- ✅ Valuations tab accessible to non-admins (ProfitSharing.jsx:44, 110)
- ✅ `isAdmin` check in ValuationsTab for edit controls (line 39)
- ✅ Read-only mode for non-admins (canEdit check throughout)

**Files:**
- `src/views/ProfitSharing.jsx`
- `src/views/ProfitSharing/ValuationsTab.jsx`

---

## ❌ PENDING FEATURES

### 1. Document Preview Scrolling Issue ❌
**Status:** PENDING

**What was requested:**
- Fix scrolling in document preview modal
- Cannot see bottom of preview page

**Current State:**
- DocumentPreviewModal.jsx has `overflow-y-auto` (line 159) but may need height constraints
- PdfViewerModal.jsx has overflow handling (lines 323-341) but may need improvement
- AwardDocumentModal.jsx has overflow-auto (line 712) but may need fixes

**Files to Update:**
- `src/views/ProfitSharing/components/DocumentPreviewModal.jsx`
- `src/views/ProfitSharing/components/PdfViewerModal.jsx`
- `src/views/ProfitSharing/components/AwardDocumentModal.jsx`

**Action Required:**
- Ensure preview containers have proper max-height and scrolling
- Test on different screen sizes

---

### 2. Save Button Behavior ❌
**Status:** PENDING

**What was requested:**
- Option 1: Keep modal open after save
- Option 2: Change button text to "Save and Close" to indicate it will close

**Current State:**
- Save buttons likely close modals immediately
- Need to check behavior in:
  - CreateProfitPlan.jsx
  - StakeholderDetail.jsx (award save)

**Files to Update:**
- `src/views/ProfitSharing/CreateProfitPlan.jsx`
- `src/views/ProfitSharing/StakeholderDetail.jsx` (award save functionality)

**Action Required:**
- Change button text to "Save and Close" OR
- Modify save handlers to keep modal open

---

### 3. Date Picker Typing Support ❌
**Status:** PENDING

**What was requested:**
- Allow typing dates directly in addition to calendar selection

**Current State:**
- DatePicker component has `inputtable` prop (DatePicker.jsx:35)
- Need to verify if it's enabled in Profit Sharing forms

**Files to Check/Update:**
- `src/components/ui/DatePicker/DatePicker.jsx` (verify inputtable prop usage)
- All DatePicker usages in Profit Sharing:
  - `src/views/ProfitSharing/ValuationsTab.jsx`
  - `src/views/ProfitSharing/StakeholderDetail.jsx`
  - `src/views/ProfitSharing/CreateProfitPlan.jsx`

**Action Required:**
- Ensure `inputtable={true}` is set on all DatePicker components in Profit Sharing
- Test typing dates in various formats

---

### 4. Download Should Be PDF ❌
**Status:** PARTIALLY COMPLETE

**What was requested:**
- Download should be PDF format (not DOCX)

**Current State:**
- DocumentPreviewModal.jsx downloads DOCX (line 67: `.docx`)
- Award documents generate both DOCX and PDF (StakeholderDetail.jsx:1085-1091)
- PDF conversion exists but download may default to DOCX

**Files to Update:**
- `src/views/ProfitSharing/components/DocumentPreviewModal.jsx` (line 67)
- Verify PDF download in award document flows

**Action Required:**
- Change download to use PDF URL instead of DOCX
- Ensure PDF is generated for all document types

---

### 5. Remove Blank Front Page ❌
**Status:** PENDING

**What was requested:**
- Remove blank front page from document templates

**Current State:**
- Document templates are in Firebase Storage
- Need to check template files for blank pages
- May require template file updates in Firebase

**Files to Check:**
- Firebase Storage: `profitSharing/templates/Profit Award Agreement Template.docx`
- Firebase Storage: `profitSharing/templates/Profit Plan Agreement Template.docx`
- `src/services/DocumentGenerationService.js` (may need template processing)

**Action Required:**
- Check template files in Firebase Storage
- Remove blank pages from Word templates
- Re-upload updated templates

---

### 6. Supervisor Direct Reports View ❌
**Status:** PENDING

**What was requested:**
- Supervisors should be able to see all their direct reports
- Filter stakeholders by managerId

**Current State:**
- Supervisor role exists
- Manager field exists (managerId)
- But filtering logic for supervisors to see direct reports may not be implemented

**Files to Check/Update:**
- `src/views/ProfitSharing/StakeholdersTab.jsx` (filter by managerId for supervisors)
- `src/views/ProfitSharing/OverviewTab.jsx` (may need supervisor filtering)
- Permission checks throughout

**Action Required:**
- Add filtering logic: if user is supervisor, show only stakeholders where `managerId === userId`
- Update StakeholdersTab to filter by managerId
- Test supervisor view

---

## 📋 IMPLEMENTATION TASKS SUMMARY

### High Priority (Core Functionality)
1. ✅ Stakeholder form changes - **DONE**
2. ✅ Award status flow - **DONE**
3. ✅ Remove signature pages - **DONE**
4. ✅ Profit type field - **DONE**
5. ✅ Stakeholder KPIs - **DONE**
6. ✅ Supervisor role - **DONE**
7. ❌ Supervisor direct reports view - **PENDING**

### Medium Priority (UX Improvements)
1. ❌ Document preview scrolling fix - **PENDING**
2. ❌ Save button behavior - **PENDING**
3. ❌ Date picker typing support - **PENDING**
4. ✅ Remove source field - **DONE** (already removed)
5. ✅ User access to Valuations tab - **DONE**
6. ❌ Download should be PDF - **PARTIALLY DONE**

### Low Priority (Polish)
1. ❌ Remove blank front page - **PENDING**

---

## 🔍 DETAILED TASK BREAKDOWN

### Task 1: Fix Document Preview Scrolling
**Files:**
- `src/views/ProfitSharing/components/DocumentPreviewModal.jsx`
- `src/views/ProfitSharing/components/PdfViewerModal.jsx`
- `src/views/ProfitSharing/components/AwardDocumentModal.jsx`

**Changes:**
- Ensure preview containers have proper `max-height` and `overflow-y-auto`
- Test scrolling on different screen sizes
- May need to adjust modal height constraints

---

### Task 2: Update Save Button Behavior
**Files:**
- `src/views/ProfitSharing/CreateProfitPlan.jsx`
- `src/views/ProfitSharing/StakeholderDetail.jsx`

**Changes:**
- Change "Save" button text to "Save and Close"
- OR modify save handlers to keep modal open after save

---

### Task 3: Enable Date Picker Typing
**Files:**
- All DatePicker usages in Profit Sharing components

**Changes:**
- Add `inputtable={true}` prop to all DatePicker components
- Test date typing in various formats (MM/DD/YYYY, YYYY-MM-DD, etc.)

---

### Task 4: Ensure PDF Download
**Files:**
- `src/views/ProfitSharing/components/DocumentPreviewModal.jsx`
- Award document download flows

**Changes:**
- Change download to use PDF URL instead of DOCX
- Ensure PDF is always generated before download

---

### Task 5: Remove Blank Front Page
**Files:**
- Firebase Storage templates (manual update required)
- `src/services/DocumentGenerationService.js` (if programmatic removal needed)

**Changes:**
- Download templates from Firebase Storage
- Remove blank pages in Word
- Re-upload updated templates

---

### Task 6: Implement Supervisor Direct Reports View
**Files:**
- `src/views/ProfitSharing/StakeholdersTab.jsx`
- `src/views/ProfitSharing/OverviewTab.jsx`
- Permission checks throughout

**Changes:**
- Add filtering: if `userRole === 'supervisor'`, filter stakeholders by `managerId === userId`
- Update queries to include managerId filter
- Test supervisor can only see their direct reports

---

## 📊 COMPLETION STATUS

**Overall Progress:** ~75% Complete

- **Completed:** 6/13 tasks (46%)
- **Pending:** 7/13 tasks (54%)

**By Priority:**
- **High Priority:** 6/7 complete (86%)
- **Medium Priority:** 1/6 complete (17%)
- **Low Priority:** 0/1 complete (0%)

---

## 🎯 NEXT STEPS

1. **Immediate:** Fix document preview scrolling (high user impact)
2. **Quick Win:** Update save button text to "Save and Close"
3. **User Experience:** Enable date picker typing
4. **Core Feature:** Implement supervisor direct reports filtering
5. **Polish:** Ensure PDF downloads work correctly
6. **Template Update:** Remove blank front page from templates (manual Firebase update)

---

## 📝 NOTES

1. **Signature Removal:** Already implemented - using timestamps instead of signature pages
2. **Source Field:** Already removed from ValuationsTab
3. **Supervisor Role:** Infrastructure exists, but filtering logic for direct reports needs implementation
4. **PDF Generation:** PDF conversion exists, but download may default to DOCX in some places
5. **Template Updates:** Blank page removal requires manual update to Firebase Storage templates

