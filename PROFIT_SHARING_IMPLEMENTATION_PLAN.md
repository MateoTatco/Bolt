# Profit Sharing New Features - Implementation Plan

## Summary of Changes Requested by Brett

Based on the conversation transcript, here are all the changes needed:

---

## Phase 1: Quick Fixes & Terminology Updates

### 1.1 Fix Scrolling Issue in Add Stakeholder Dialog
**File**: `src/views/ProfitSharing/components/AddStakeholderModal.jsx`
- **Issue**: Scrolling moves the back screen instead of the front dialog
- **Fix**: Ensure dialog content has proper overflow handling and z-index

### 1.2 Terminology Change: "Milestone" → "Trigger"
**Files Affected**:
- `src/views/ProfitSharing/CreateProfitPlan.jsx`
- `src/views/ProfitSharing/ValuationsTab.jsx`
- `src/views/ProfitSharing/StakeholderDetail.jsx`
- `src/views/ProfitSharing/MilestonesTab.jsx` (Note: This tab might need renaming or refactoring)

**Changes**:
- "Milestone Amount" → "Trigger Amount"
- "Select your milestones" → "Select your trigger" or "Trigger Amount"
- "Milestone" → "Trigger" (where applicable)
- Update all labels, tooltips, and UI text
- **Note**: Keep `milestoneAmount` field name in database for backwards compatibility, but display as "Trigger Amount" in UI

---

## Phase 2: Price Per Share Calculation Update

### 2.1 Conditional Price Per Share Formula
**File**: `src/views/ProfitSharing/ValuationsTab.jsx`

**Current Formula**: `pricePerShare = profitAmount / totalShares`

**New Logic**:
- If plan's `poolShareType === 'above-trigger'`:
  - Formula: `pricePerShare = (profitAmount - milestoneAmount) / totalShares`
- If plan's `poolShareType === 'total'` (or not set):
  - Formula: `pricePerShare = profitAmount / totalShares` (current behavior)

**Implementation Steps**:
1. When plan is selected in profit entry form, fetch the plan's `poolShareType`
2. Update calculation logic in `handleInputChange` function
3. Update calculation when saving valuation
4. Update help text to explain the conditional formula

---

## Phase 3: Plan Form Enhancements

### 3.1 Add Company Field to Plan Creation
**File**: `src/views/ProfitSharing/CreateProfitPlan.jsx`

**Changes**:
- Add company dropdown/select field in the plan form
- Load companies from `useSelectedCompany` or fetch all companies
- Store `companyId` in plan document
- Company name will be used in document generation

**Data Structure**:
- Add `companyId` field to plan schema
- Ensure company is selected before plan can be saved

---

## Phase 4: Award Form Enhancements

### 4.1 Add Award Date Field
**File**: `src/views/ProfitSharing/StakeholderDetail.jsx`

**Changes**:
- Add new field "Award Date" (or "Issue Date") to award creation form
- Default to current date
- Allow date picker to select different date
- Store as `awardDate` in award document
- This is different from `awardStartDate` and `awardEndDate`
- Used in award document generation

**Data Structure**:
- Add `awardDate` field to award schema (optional, defaults to current date)

---

## Phase 5: Document Generation System (Major Feature)

### 5.1 Document Templates
**Files to Create**:
- `src/utils/documentTemplates/planDocumentTemplate.js`
- `src/utils/documentTemplates/awardDocumentTemplate.js`
- `src/utils/documentGenerator.js`

**Plan Document Fields** (from conversation):
- Company name (bold)
- Plan name
- Effective start date
- Plan description
- Schedule (e.g., "Quarterly")
- Payment schedule dates
- Payment terms
- Profit measurement description
- Trigger amount
- Total outstanding shares
- Signer name (default: Brett Tatum)

**Award Document Fields** (from conversation):
- Company name
- Employee name
- Company name (again)
- Award date
- Award start date
- Award end date
- Number of profit shares issued
- Schedule (from plan)
- Payment dates (from plan)
- Payment terms (from plan)
- Profit measurement description (from plan)
- Trigger amount (from plan)
- Total outstanding shares (from plan)
- Employee name (for signature)

### 5.2 Document Generation Service
**File**: `src/services/DocumentService.js` (or similar)

**Features**:
- Generate PDF documents from templates
- Populate fields from plan/award data
- Support for Word document generation (if needed)
- Store generated documents in Firebase Storage
- Return document URL for viewing/downloading

**Libraries to Consider**:
- `pdfkit` or `jspdf` for PDF generation
- `docx` for Word document generation
- `react-pdf` for PDF rendering in browser

### 5.3 Document Viewing in UI
**Files to Update**:
- `src/views/ProfitSharing/CreateProfitPlan.jsx`
- `src/views/ProfitSharing/StakeholderDetail.jsx`

**Plan Document Viewing**:
- Add "View Agreement" or "View Plan Document" button in plan detail/edit page
- Generate document on-demand or cache after plan is saved/finalized
- Display in modal or new tab

**Award Document Viewing**:
- In stakeholder detail page, in the documents section:
  - Show "Plan Agreement" document (from the award's plan)
  - Show "Award Agreement" document (from the award)
- Add "View Draft" button in award drawer before finalizing
- Generate document automatically when award is saved (draft or finalized)
- Replace current "Upload Document" functionality with auto-generated documents

### 5.4 Document Storage
- Store generated documents in Firebase Storage
- Store document URLs in Firestore:
  - Plans: `planDocumentUrl`, `planDocumentStoragePath`
  - Awards: `awardDocumentUrl`, `awardDocumentStoragePath`
- Regenerate documents when plan/award data changes

---

## Phase 6: Document Preview Feature

### 6.1 Preview Before Finalizing
**File**: `src/views/ProfitSharing/StakeholderDetail.jsx`

**Changes**:
- Add "View Draft" button in award drawer
- Generate preview document with current form data
- Display in modal or drawer
- Allow admin to review before clicking "Finalize"
- Document should match what will be generated when finalized

---

## Phase 7: Digital Signature Feature (Lower Priority)

### 7.1 Signature Capture
**Files to Create**:
- `src/components/shared/SignaturePad.jsx` or use library
- Update document generation to include signature

**Features**:
- Allow users to sign documents within Bolt
- Simple typed signature (cursive font) or signature pad
- Store signature data/image
- Mark document as "signed" with timestamp
- Notification to stakeholder when award is finalized to sign document

**Implementation**:
- Add signature field to award document
- Store `signedBy`, `signedAt`, `signatureData` in award document
- Add "Sign Document" button for stakeholders
- More symbolic than legal authentication (per conversation)

**Libraries to Consider**:
- `react-signature-canvas` for signature pad
- Simple text input with cursive font as alternative

---

## Implementation Order (Recommended)

### Sprint 1: Quick Wins
1. ✅ Fix scrolling issue in Add Stakeholder dialog
2. ✅ Terminology change: Milestone → Trigger
3. ✅ Price per share calculation update

### Sprint 2: Form Enhancements
4. ✅ Add company field to plan creation
5. ✅ Add award date field to award creation

### Sprint 3: Document Generation (Core)
6. ✅ Create document templates
7. ✅ Build document generation service
8. ✅ Integrate document viewing in plan pages
9. ✅ Integrate document viewing in award pages
10. ✅ Replace upload document with auto-generation

### Sprint 4: Preview & Polish
11. ✅ Add document preview before finalizing
12. ✅ Test document generation with real data
13. ✅ Handle edge cases and error states

### Sprint 5: Digital Signature (If Time Permits)
14. ⏳ Implement signature capture
15. ⏳ Add signature to documents
16. ⏳ Add notification for signing

---

## Technical Considerations

### Data Migration
- Existing plans may not have `companyId` - need migration or default
- Existing awards may not have `awardDate` - use `awardStartDate` as fallback
- Existing documents may need regeneration

### Performance
- Document generation can be expensive - consider:
  - Lazy generation (on-demand)
  - Caching generated documents
  - Background job for generation
  - Store in Firebase Storage for fast retrieval

### Error Handling
- Handle missing data gracefully
- Show helpful error messages
- Fallback values for optional fields

### Testing
- Test with various plan configurations
- Test with different poolShareType values
- Test document generation with all field combinations
- Test signature capture on different devices

---

## Questions to Clarify

1. **Document Format**: PDF, Word, or both? (Conversation mentions Word templates)
2. **Document Library**: Which library should we use for generation?
3. **Signature Method**: Typed signature vs signature pad - which is preferred?
4. **Company List**: Brett mentioned sending a list of companies - need that list
5. **Document Templates**: Brett mentioned sending Word doc templates - need those files
6. **Default Signer**: Brett mentioned defaulting his name - should this be configurable?

---

## Notes from Conversation

- Brett wants to send out award documents by first week of January
- Timeline: ~6 working days (by Tuesday mentioned in conversation)
- Priority: Get admin side working first, then user-facing features
- Document generation is the most complex feature
- Signature feature is lower priority but still desired

---

*Last Updated: Based on conversation transcript from profitSharingNewFeatures.md*

