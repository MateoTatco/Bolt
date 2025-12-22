# Document Generation Setup Guide

This guide will help you set up the automatic document generation system for Profit Sharing plans and awards.

## Step 1: Install Required Packages

First, you need to install the required npm packages. Run this command in your terminal:

```bash
npm install docxtemplater pizzip
```

**Note:** If you encounter PowerShell execution policy errors, you can:
- Run PowerShell as Administrator and execute: `Set-ExecutionPolicy RemoteSigned`
- Or use Command Prompt (cmd) instead of PowerShell
- Or run: `npm.cmd install docxtemplater pizzip`

## Step 2: Upload Templates to Firebase Storage

You need to upload your Word template files to Firebase Storage so they can be accessed by the document generation service.

### Option A: Using Firebase Console (Recommended)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `tatco-crm`
3. Navigate to **Storage**
4. Create the following folder structure:
   ```
   profitSharing/
     └── templates/
   ```
5. Upload both template files:
   - `Profit Sharing Plan Template.docx` → `profitSharing/templates/Profit Sharing Plan Template.docx`
   - `Profit Award Agreement Template.docx` → `profitSharing/templates/Profit Award Agreement Template.docx`

### Option B: Using Firebase CLI

If you have Firebase CLI installed:

```bash
firebase storage:upload "Profit Sharing Plan Template.docx" profitSharing/templates/
firebase storage:upload "Profit Award Agreement Template.docx" profitSharing/templates/
```

### Option C: Programmatically (One-time script)

You can create a one-time script to upload the templates. Create a file `upload-templates.js`:

```javascript
import { initializeApp } from 'firebase/app'
import { getStorage, ref, uploadBytes } from 'firebase/storage'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const firebaseConfig = {
  // Your Firebase config
}

const app = initializeApp(firebaseConfig)
const storage = getStorage(app)

async function uploadTemplate(fileName, storagePath) {
  const filePath = join(__dirname, fileName)
  const fileBuffer = readFileSync(filePath)
  
  const storageRef = ref(storage, storagePath)
  await uploadBytes(storageRef, fileBuffer)
  console.log(`Uploaded ${fileName} to ${storagePath}`)
}

// Upload templates
await uploadTemplate('Profit Sharing Plan Template.docx', 'profitSharing/templates/Profit Sharing Plan Template.docx')
await uploadTemplate('Profit Award Agreement Template.docx', 'profitSharing/templates/Profit Award Agreement Template.docx')
```

## Step 3: Identify All Placeholders in Your Templates

Before we can fully configure the document generation, we need to know all the placeholder names used in your Word templates.

### Manual Method:
1. Open each Word template
2. Look for all text in curly braces like `{COMPANY NAME}`, `{START DATE}`, etc.
3. Make a list of all unique placeholders

### Automated Method (After templates are uploaded):
We can create a utility function to extract placeholders, but this requires reading the Word document's XML content.

## Step 4: Update Placeholder Mappings

Once you have the list of all placeholders, we need to update the mapping functions in `src/services/DocumentGenerationService.js`:

1. **For Plan Documents**: Update the `mapPlanDataToTemplate` function to include all placeholders from your Plan template
2. **For Award Documents**: Update the `mapAwardDataToTemplate` function to include all placeholders from your Award template

The placeholders should match exactly (case-sensitive) with what's in your Word templates.

## Step 5: Test Document Generation

After setup, you can test the document generation:

1. Create or edit a Profit Sharing Plan
2. Save or finalize the plan
3. The system should automatically generate the document
4. Check Firebase Storage to see if the document was created

## Current Placeholder Mappings

Based on the conversation, here are the expected placeholders:

### Plan Document Placeholders:
- `{COMPANY NAME}` - Company name (bold)
- `{PLAN NAME}` - Plan name
- `{START DATE}` or `{EFFECTIVE START DATE}` - Plan start date
- `{SCHEDULE}` - Payment schedule (Quarterly, Bi-Annually, Annually)
- `{PAYMENT SCHEDULE DATES}` - List of payment dates
- `{PAYMENT TERMS}` - Payment terms (Within 30 days, etc.)
- `{PROFIT DESCRIPTION}` - Profit measurement description
- `{TRIGGER AMOUNT}` - Trigger/milestone amount
- `{TOTAL SHARES}` or `{OUTSTANDING SHARES}` - Total shares in plan
- `{SIGNER NAME}` - Default: "Brett Tatum"

### Award Document Placeholders (Verified from Template):
- `{COMPANY NAME}` - Company name
- `{EMPLOYEE NAME}` - Stakeholder/employee name
- `{AWARD DATE}` - Date award was issued
- `{START DATE}` - Award start date
- `{END DATE}` - Award end date
- `{NUMBER OF PROFIT SHARES ISSUED}` - Number of shares issued
- `{PROFIT PLAN NAME}` - Name of the profit plan
- `{SCHEDULE}` - Payment schedule from plan
- `{PAYMENT DATES}` - Payment dates from plan
- `{PAYMENT TERMS}` - Payment terms from plan
- `{PROFIT DEFINITION}` - Profit description/definition from plan
- `{TRIGGER AMOUNT}` - Trigger/milestone amount from plan
- `{TOTAL PROFIT SHARES}` - Total shares from plan
- `{SIGNATURE}` - **Digital signature image** (will be embedded when document is signed - see SIGNATURE_TEMPLATE_UPDATE.md for setup instructions) ⚠️ **Add this placeholder to your template**

## Next Steps

1. **Install packages**: `npm install docxtemplater pizzip`
2. **Upload templates** to Firebase Storage
3. **Share the list of all placeholders** from your templates so we can update the mapping functions
4. **Test the generation** with a sample plan/award

## Troubleshooting

### Error: "Failed to load template"
- Check that templates are uploaded to the correct path in Firebase Storage
- Verify Firebase Storage rules allow read access
- Check that the template file names match exactly

### Error: "Document rendering failed"
- Check that all placeholders in the template have corresponding data
- Verify placeholder names match exactly (case-sensitive)
- Check for typos in placeholder names

### Documents not generating
- Check browser console for errors
- Verify Firebase Storage write permissions
- Check that all required data fields are present

## Questions?

If you encounter any issues or need to add additional placeholders, let me know and we can update the mapping functions accordingly.

