# Profit Sharing - Pending Tasks Plan

## Overview
This document outlines the specific tasks that need to be coded based on the conversation with Brett. Tasks are organized by priority and include implementation details.

---

## 🔴 HIGH PRIORITY

### Task 1: Implement Supervisor Direct Reports View
**Priority:** High  
**Estimated Time:** 2-3 hours

**Description:**
Supervisors should only see stakeholders where they are listed as the manager. Currently, supervisors can see all stakeholders, but they should only see their direct reports.

**Requirements:**
- Filter stakeholders by `managerId === currentUserId` when user role is 'supervisor'
- Apply filter in StakeholdersTab
- Apply filter in OverviewTab (if showing stakeholder data)
- Ensure supervisors cannot see stakeholders they don't manage

**Files to Modify:**
1. `src/views/ProfitSharing/StakeholdersTab.jsx`
   - Add filtering logic in stakeholder queries
   - Filter by `managerId` when `userRole === 'supervisor'`

2. `src/views/ProfitSharing/OverviewTab.jsx`
   - Check if stakeholders are displayed here
   - Apply same filtering logic

3. `src/hooks/useProfitSharingAccess.js` (if needed)
   - May need helper function to get current user's direct reports

**Implementation Steps:**
1. Get current user ID from auth context
2. Check if user role is 'supervisor'
3. If supervisor, add filter: `where('managerId', '==', currentUserId)`
4. If admin, show all stakeholders (no filter)
5. Test with supervisor account

**Testing:**
- Create test supervisor user
- Assign managerId to some stakeholders
- Verify supervisor only sees their direct reports
- Verify admin still sees all stakeholders

---

## 🟡 MEDIUM PRIORITY

### Task 2: Fix Document Preview Scrolling
**Priority:** Medium  
**Estimated Time:** 1-2 hours

**Description:**
Users cannot scroll in document preview modals, making it impossible to see the bottom of long documents.

**Requirements:**
- Enable proper scrolling in all document preview modals
- Ensure preview containers have correct height constraints
- Test on different screen sizes

**Files to Modify:**
1. `src/views/ProfitSharing/components/DocumentPreviewModal.jsx`
   - Line 159: Check `overflow-y-auto` and height constraints
   - Ensure container has `max-height` and proper scrolling

2. `src/views/ProfitSharing/components/PdfViewerModal.jsx`
   - Lines 323-341: Review overflow handling
   - Ensure PDF viewer can scroll properly

3. `src/views/ProfitSharing/components/AwardDocumentModal.jsx`
   - Line 712: Check `overflow-auto` implementation
   - Ensure proper height constraints

**Implementation Steps:**
1. Review current modal structure
2. Add proper `max-height` to preview containers
3. Ensure `overflow-y-auto` is working
4. Test with long documents
5. Test on mobile/tablet/desktop

**CSS Changes Needed:**
```css
/* Example fix */
.preview-container {
  max-height: calc(100vh - 200px);
  overflow-y: auto;
  overflow-x: hidden;
}
```

---

### Task 3: Update Save Button Behavior
**Priority:** Medium  
**Estimated Time:** 30 minutes

**Description:**
Change "Save" button text to "Save and Close" to indicate that clicking save will close the modal.

**Requirements:**
- Update button text in all save operations
- Keep existing close behavior (don't change functionality)

**Files to Modify:**
1. `src/views/ProfitSharing/CreateProfitPlan.jsx`
   - Find "Save" button
   - Change text to "Save and Close"

2. `src/views/ProfitSharing/StakeholderDetail.jsx`
   - Find award save button
   - Change text to "Save and Close"

**Implementation Steps:**
1. Search for "Save" button text in both files
2. Replace with "Save and Close"
3. Test save functionality still works

**Alternative Approach:**
- Keep modal open after save (more complex, requires state management)

---

### Task 4: Enable Date Picker Typing
**Priority:** Medium  
**Estimated Time:** 1 hour

**Description:**
Allow users to type dates directly into date picker fields instead of only using calendar selection.

**Requirements:**
- Enable `inputtable` prop on all DatePicker components in Profit Sharing
- Support common date formats (MM/DD/YYYY, YYYY-MM-DD, etc.)

**Files to Modify:**
1. `src/views/ProfitSharing/ValuationsTab.jsx`
   - Find DatePicker components
   - Add `inputtable={true}` prop

2. `src/views/ProfitSharing/StakeholderDetail.jsx`
   - Find DatePicker components (for award dates)
   - Add `inputtable={true}` prop

3. `src/views/ProfitSharing/CreateProfitPlan.jsx`
   - Find DatePicker components
   - Add `inputtable={true}` prop

**Implementation Steps:**
1. Search for `<DatePicker` in all Profit Sharing files
2. Add `inputtable={true}` to each DatePicker
3. Test typing dates in various formats
4. Verify date validation works

**Example Change:**
```jsx
// Before
<DatePicker
  value={formData.valuationDate}
  onChange={(date) => handleInputChange('valuationDate', date)}
/>

// After
<DatePicker
  value={formData.valuationDate}
  onChange={(date) => handleInputChange('valuationDate', date)}
  inputtable={true}
/>
```

---

### Task 5: Ensure PDF Download (Not DOCX)
**Priority:** Medium  
**Estimated Time:** 1 hour

**Description:**
Ensure all document downloads are PDF format, not DOCX. Currently some downloads may default to DOCX.

**Requirements:**
- Change document preview download to PDF
- Ensure award document downloads use PDF
- Verify PDF generation is working

**Files to Modify:**
1. `src/views/ProfitSharing/components/DocumentPreviewModal.jsx`
   - Line 67: Change download from `.docx` to `.pdf`
   - Use `previewData.pdfUrl` instead of `previewData.docxUrl`

2. `src/views/ProfitSharing/StakeholderDetail.jsx`
   - Check award document download flows
   - Ensure PDF URL is used for downloads

**Implementation Steps:**
1. Check DocumentPreviewModal download handler
2. Change to use PDF URL if available
3. Ensure PDF is generated before download
4. Test download functionality
5. Verify PDF opens correctly

**Code Changes:**
```jsx
// In DocumentPreviewModal.jsx handleDownload
const handleDownload = () => {
    if (previewData?.pdfUrl) {
        const link = document.createElement('a')
        link.href = previewData.pdfUrl
        link.download = `${documentName || 'document'}.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    } else if (previewData?.docxUrl) {
        // Fallback to DOCX if PDF not available
        // But generate PDF first if possible
    }
}
```

---

## 🟢 LOW PRIORITY

### Task 6: Remove Blank Front Page from Templates
**Priority:** Low  
**Estimated Time:** 30 minutes (manual work)

**Description:**
Remove blank front pages from document templates stored in Firebase Storage.

**Requirements:**
- Download templates from Firebase Storage
- Remove blank pages in Word
- Re-upload updated templates

**Files to Check:**
- Firebase Storage: `profitSharing/templates/Profit Award Agreement Template.docx`
- Firebase Storage: `profitSharing/templates/Profit Plan Agreement Template.docx`

**Implementation Steps:**
1. Go to Firebase Console → Storage
2. Navigate to `profitSharing/templates/`
3. Download both template files
4. Open in Microsoft Word
5. Remove blank first page
6. Save files
7. Re-upload to Firebase Storage (same path/name)

**Note:** This is a manual process, not a code change. May need to coordinate with template owner.

---

## 📋 TASK CHECKLIST

### High Priority
- [ ] Task 1: Implement Supervisor Direct Reports View

### Medium Priority
- [ ] Task 2: Fix Document Preview Scrolling
- [ ] Task 3: Update Save Button Behavior
- [ ] Task 4: Enable Date Picker Typing
- [ ] Task 5: Ensure PDF Download

### Low Priority
- [ ] Task 6: Remove Blank Front Page (Manual)

---

## 🎯 RECOMMENDED IMPLEMENTATION ORDER

1. **Task 1** (Supervisor Direct Reports) - Core functionality
2. **Task 2** (Document Scrolling) - High user impact
3. **Task 3** (Save Button Text) - Quick win
4. **Task 4** (Date Picker Typing) - UX improvement
5. **Task 5** (PDF Download) - Ensure consistency
6. **Task 6** (Blank Page) - Manual, can be done anytime

---

## 📝 ADDITIONAL NOTES

1. **Supervisor Role:** The infrastructure exists, but the filtering logic needs to be implemented. This is critical for the manager/supervisor feature to work correctly.

2. **Date Picker:** The component already supports `inputtable` prop, we just need to enable it everywhere.

3. **PDF Downloads:** PDF generation is already implemented, we just need to ensure downloads use PDF instead of DOCX.

4. **Template Updates:** The blank page removal is a manual process that requires access to Firebase Storage and Word documents.

5. **Testing:** After implementing each task, test thoroughly:
   - Test with different user roles (admin, supervisor, user)
   - Test on different screen sizes
   - Test with various data scenarios

---

## 🔍 FILES TO REVIEW BEFORE CODING

1. `src/views/ProfitSharing/StakeholdersTab.jsx` - For supervisor filtering
2. `src/views/ProfitSharing/components/DocumentPreviewModal.jsx` - For scrolling and download
3. `src/components/ui/DatePicker/DatePicker.jsx` - To understand inputtable prop
4. `src/services/DocumentGenerationService.js` - To understand PDF generation
5. `src/hooks/useProfitSharingAccess.js` - To understand role system

---

## ✅ VERIFICATION CHECKLIST

After implementing all tasks, verify:

- [ ] Supervisors can only see their direct reports
- [ ] Document previews scroll correctly
- [ ] Save buttons say "Save and Close"
- [ ] Date pickers allow typing dates
- [ ] Downloads are PDF format
- [ ] Templates don't have blank front pages (manual check)

