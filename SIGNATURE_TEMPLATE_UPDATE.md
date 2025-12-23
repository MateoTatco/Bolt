# Signature Template Update Instructions

## Overview
To enable digital signatures in award documents, you need to add a `{SIGNATURE}` placeholder to the "Profit Award Agreement Template.docx" file in Firebase Storage.

## Steps to Update the Template

### 1. Download the Current Template
1. Go to Firebase Console → Storage
2. Navigate to: `profitSharing/templates/Profit Award Agreement Template.docx`
3. Download the template file

### 2. Add Signature Placeholder
1. Open the downloaded template in Microsoft Word
2. Navigate to the end of the document where the signature section should be (typically after all the terms and conditions, before or after the date fields)
3. Add a new line or section for the signature
4. Type `{SIGNATURE}` where you want the signature image to appear
5. Format the placeholder as needed (you can add text like "Signature:" before it, or place it in a table cell)

### 3. Recommended Placement
The signature placeholder should be placed:
- **After all document content** (terms, conditions, dates, etc.)
- **In a dedicated signature section** at the bottom of the document
- **With appropriate spacing** (leave some room above and below)
- **Optionally in a table** for better alignment:
  ```
  Signature: {SIGNATURE}
  ```

### 4. Example Layout
```
... (document content) ...

By signing below, I acknowledge that I have read and agree to the terms of this agreement.

Signature: {SIGNATURE}

Date: {AWARD DATE}

Employee Name: {EMPLOYEE NAME}
```

### 5. Upload Updated Template
1. Save the updated template in Word
2. Go back to Firebase Console → Storage
3. Navigate to: `profitSharing/templates/`
4. Delete the old "Profit Award Agreement Template.docx" (or rename it as backup)
5. Upload the new template with the exact same name: `Profit Award Agreement Template.docx`

### 6. Important Notes
- The placeholder must be exactly `{SIGNATURE}` (case-sensitive, with curly braces)
- The signature image will be automatically sized to 120x32 pixels when embedded
- The signature will only appear in documents that have been signed
- For unsigned documents, the placeholder will be replaced with an empty string
- The signature image is generated from the signer's typed name using their selected font

### 7. Testing
After updating the template:
1. Create a new award document (or regenerate an existing one)
2. Sign the document using the signature feature
3. View the signed document PDF to verify the signature appears correctly
4. Check that the signature is properly positioned and sized

## Technical Details

The signature embedding works as follows:
- When a document is signed, a signature image is generated from the typed name
- The image is converted to a base64 data URL
- The `{SIGNATURE}` placeholder in the template is replaced with this image
- The image module (`docxtemplater-image-module-free`) handles the embedding
- The final document is converted to PDF for viewing

## Current Template Placeholders

The template currently supports these placeholders:
- `{COMPANY NAME}`
- `{EMPLOYEE NAME}`
- `{AWARD DATE}`
- `{START DATE}`
- `{END DATE}`
- `{NUMBER OF PROFIT SHARES ISSUED}`
- `{PROFIT PLAN NAME}`
- `{SCHEDULE}`
- `{PAYMENT DATES}`
- `{PAYMENT TERMS}`
- `{PROFIT DEFINITION}`
- `{TRIGGER AMOUNT}`
- `{TOTAL PROFIT SHARES}`
- `{SIGNATURE}` ← **NEW - Add this one**

## Support

If you encounter any issues:
1. Verify the placeholder is exactly `{SIGNATURE}` (no spaces, correct case)
2. Check that the template file name matches exactly: `Profit Award Agreement Template.docx`
3. Ensure the template is in the correct Firebase Storage path: `profitSharing/templates/`
4. Check browser console for any error messages during document generation


