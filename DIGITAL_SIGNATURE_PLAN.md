# Digital Signature Implementation Plan

## Overview
This document outlines the plan for implementing digital signature functionality for stakeholders to sign their profit sharing award documents.

## Requirements
- Stakeholders (users with "user" role) should be able to digitally sign their award documents
- Signatures should be embedded in the document
- Signed documents should be stored separately from unsigned versions
- Admin should be notified when a document is signed
- Signature should include timestamp and user information

## Implementation Phases

### Phase 1: Signature Capture Component
**Status**: Pending

**Components Needed**:
1. `SignatureCanvas` component using `react-signature-canvas`
2. Signature preview/confirmation modal
3. Clear and save signature buttons

**Features**:
- Draw signature on canvas
- Clear signature
- Save signature as image (base64)
- Validate signature (not empty)

**Files to Create**:
- `src/components/shared/SignaturePad.jsx`
- `src/components/shared/SignatureModal.jsx`

### Phase 2: Document Integration
**Status**: Pending

**Components Needed**:
1. Update document templates to include signature field placeholder
2. Modify document generation to embed signature image
3. Store signature metadata in Firestore

**Features**:
- Add `{SIGNATURE}` placeholder to award document template
- Embed signature image in generated document
- Store signature image and metadata with award document
- Generate signed version of document

**Files to Modify**:
- `src/services/DocumentGenerationService.js`
- `src/views/ProfitSharing/StakeholderDetail.jsx`
- Award document template in Firebase Storage

### Phase 3: Signature Workflow
**Status**: Pending

**User Flow**:
1. Stakeholder receives notification about finalized award
2. Stakeholder navigates to their award detail page
3. Stakeholder sees "Sign Document" button (only for finalized awards without signature)
4. Stakeholder clicks button, signature modal opens
5. Stakeholder draws signature and confirms
6. System generates signed version of document
7. Signed document is stored and linked to award
8. Admin is notified that document has been signed
9. Original unsigned document is preserved

**Features**:
- "Sign Document" button only visible to stakeholder (not admin)
- Button only shows for finalized awards without existing signature
- Signature timestamp and user info stored
- Signed document URL stored in award record
- Notification sent to admins when signed

**Files to Modify**:
- `src/views/ProfitSharing/StakeholderDetail.jsx`
- `src/utils/notificationHelper.js`
- Award document template

### Phase 4: Signature Display
**Status**: Pending

**Features**:
- Show signature status in awards table
- Display signature image in award detail
- Show signature timestamp
- Indicate if document is signed or unsigned
- Allow viewing signed document

**UI Elements**:
- Signature badge/icon in awards table
- Signature preview in award detail drawer
- "View Signed Document" button

## Technical Considerations

### Signature Storage
- **Option A**: Store signature as base64 image in Firestore (simple, but increases document size)
- **Option B**: Store signature image in Firebase Storage, reference URL in Firestore (recommended)
- **Option C**: Store in**: `profitSharing/signatures/{stakeholderId}/{awardId}/signature.png`

### Document Embedding
- Use docxtemplater's image module to embed signature
- Signature should be placed at designated location in template
- Maintain document formatting and layout

### Legal Compliance
- Store signature metadata: timestamp, user ID, IP address (optional)
- Maintain audit trail of signature events
- Ensure signature meets legal requirements for your jurisdiction

### Security
- Only allow stakeholder to sign their own awards
- Prevent signature tampering
- Validate signature before saving
- Store signature with timestamp for non-repudiation

## Dependencies Needed

```bash
npm install react-signature-canvas
```

## Database Schema Updates

### Award Document Fields (additions)
```javascript
{
  // ... existing fields
  signatureUrl: string | null,           // URL to signature image
  signatureStoragePath: string | null,   // Storage path for signature
  signedDocumentUrl: string | null,     // URL to signed document
  signedDocumentStoragePath: string | null,
  signatureMetadata: {
    signedAt: Timestamp,
    signedBy: string,                    // User ID
    signedByEmail: string,
    ipAddress: string | null             // Optional
  } | null
}
```

## Next Steps

1. Install `react-signature-canvas` package
2. Create `SignaturePad` component
3. Add signature button to award detail page
4. Update document template with signature placeholder
5. Implement signature embedding in document generation
6. Add signature storage and metadata tracking
7. Implement admin notifications for signed documents

## Estimated Implementation Time
- Phase 1: 2-3 hours
- Phase 2: 3-4 hours
- Phase 3: 2-3 hours
- Phase 4: 1-2 hours
- **Total**: 8-12 hours

