# Procore Integration Plan - Auto-Generated Project Numbers

## Overview
Implement automatic project number generation and Procore API integration for new projects created in the Master Tracker Page.

## Requirements Summary
1. **Auto-generate 6-digit project numbers** (100000-999999, cannot start with 0)
2. **Display but make non-editable** in the create project wizard
3. **Push new projects to Procore** via API when created
4. **Map Bolt fields to Procore fields** for proper data transfer
5. **Maintain Firebase integration** - projects still saved to Firebase
6. **Only apply to NEW projects** - existing projects remain unchanged

## Implementation Plan

### Phase 1: Project Number Generation
**File: `src/views/ProjectsList.jsx`**

1. **Create utility function for random 6-digit generation**
   - Generate random number between 100000 and 999999
   - Check for uniqueness against existing projects (optional but recommended)
   - Store in `wizardData.ProjectNumber` automatically

2. **Update Wizard UI**
   - Change Project Number input from editable `<Input>` to read-only display
   - Generate number when wizard opens or when Project Name is entered
   - Show generated number with visual indicator (e.g., "Auto-generated")

3. **Update `resetWizard` function**
   - Generate new random number on reset

4. **Update `handleCreateProject`**
   - Ensure generated number is included in payload
   - Convert to number format (already handled)

### Phase 2: Procore API Integration - Backend
**File: `functions/src/index.ts`**

1. **Create Firebase Function: `procoreCreateProject`**
   - Accepts project data payload
   - Authenticates with Procore using existing OAuth token system
   - Maps Bolt fields to Procore API fields
   - POST to Procore API: `/rest/v1.0/companies/{company_id}/projects`
   - Returns Procore project ID and data
   - Handles errors gracefully

2. **Field Mapping Logic**
   - Create mapping object/function to translate Bolt fields to Procore fields
   - Handle date format conversions
   - Handle null/empty values appropriately
   - Map required vs optional fields

### Phase 3: Procore API Integration - Frontend
**File: `src/services/ProcoreService.js`**

1. **Add `createProject` method**
   - Calls Firebase Function `procoreCreateProject`
   - Handles errors and success responses
   - Returns Procore project data

**File: `src/store/projectsStore.js`**

1. **Update `addProject` function**
   - After successful Firebase save, call Procore API
   - Store Procore project ID in Firebase project document (new field: `procoreProjectId`)
   - Handle Procore errors without failing Firebase save
   - Show appropriate success/error messages

### Phase 4: Field Mapping Configuration
**File: `src/configs/procoreFieldMapping.js` (NEW)**

1. **Create field mapping configuration**
   - Define mapping between Bolt fields and Procore API fields
   - Include field type conversions (dates, numbers, strings)
   - Include default values for required Procore fields
   - Document Procore field requirements

### Phase 5: Error Handling & User Feedback
1. **Success scenarios**
   - Project saved to Firebase ✓
   - Project pushed to Procore ✓
   - Show success message with both confirmations

2. **Partial success scenarios**
   - Firebase save succeeds, Procore push fails
   - Show warning message but allow project creation
   - Log error for admin review
   - Store `procoreSyncStatus: 'failed'` in project

3. **Complete failure scenarios**
   - Firebase save fails - show error, don't proceed
   - Procore authentication fails - show warning, proceed with Firebase save

## Technical Details

### Project Number Generation
```javascript
const generateProjectNumber = () => {
    // Generate random number between 100000 and 999999
    return Math.floor(Math.random() * 900000) + 100000
}

// Optional: Check uniqueness
const generateUniqueProjectNumber = async (existingProjects) => {
    let number
    let attempts = 0
    const maxAttempts = 100
    
    do {
        number = generateProjectNumber()
        attempts++
        if (attempts > maxAttempts) {
            throw new Error('Unable to generate unique project number')
        }
    } while (existingProjects.some(p => p.ProjectNumber === number))
    
    return number
}
```

### Procore Field Mapping (Initial - to be confirmed with Procore API docs)
**Bolt Field → Procore Field:**
- `ProjectName` → `name`
- `ProjectNumber` → `project_number` (or `code`)
- `address` → `address`
- `city` → `city`
- `State` → `state`
- `zip` → `zip_code`
- `StartDate` → `start_date`
- `CompletionDate` → `completion_date`
- `ProjectManager` → `project_manager` (may need user ID lookup)
- `ProjectStatus` → `status` (may need status mapping)

### Procore API Endpoint
```
POST /rest/v1.0/companies/{company_id}/projects
Headers:
  - Authorization: Bearer {access_token}
  - Procore-Company-Id: {company_id}
  - Content-Type: application/json
Body: { project data }
```

## Files to Modify/Create

### Modify:
1. `src/views/ProjectsList.jsx` - Wizard UI and project number generation
2. `src/store/projectsStore.js` - Add Procore sync after Firebase save
3. `functions/src/index.ts` - Add `procoreCreateProject` function
4. `src/services/ProcoreService.js` - Add `createProject` method

### Create:
1. `src/configs/procoreFieldMapping.js` - Field mapping configuration
2. `src/utils/projectNumberGenerator.js` - Project number generation utility

## Testing Checklist
- [ ] Project number auto-generates when wizard opens
- [ ] Project number is 6 digits, between 100000-999999
- [ ] Project number field is read-only in UI
- [ ] Project saves to Firebase successfully
- [ ] Project pushes to Procore successfully
- [ ] Procore project ID stored in Firebase
- [ ] Error handling works for Procore failures
- [ ] Existing projects remain unchanged
- [ ] Field mapping correctly translates all fields
- [ ] Date formats are correct for Procore

## Next Steps
1. Wait for Procore OAuth credentials
2. Review Procore API documentation for exact field names and requirements
3. Confirm field mapping with user
4. Implement Phase 1 (project number generation)
5. Implement Phase 2-3 (Procore integration)
6. Test with Procore sandbox/production environment









