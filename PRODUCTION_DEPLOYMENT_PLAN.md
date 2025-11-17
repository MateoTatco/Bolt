# Production Deployment Plan - Project Profitability Integration

## Overview
This document outlines the plan to move the Procore Project Profitability integration from development to production.

---

## 1. Pre-Deployment Checklist

### 1.1 Environment Configuration
- [ ] **Procore API Environment**
  - Current: Using `PROCORE_CONFIG.apiBaseUrl` (check if pointing to sandbox or production)
  - Action: Verify production Procore API base URL
  - Location: `functions/src/index.ts` - `PROCORE_CONFIG`
  - Note: Ensure OAuth redirect URIs are configured for production domain

- [ ] **Firebase Configuration**
  - Current: Using `tatco-crm` Firebase project
  - Action: Verify this is the production Firebase project
  - Location: `.firebaserc` and `firebase.json`

- [ ] **Environment Variables**
  - [ ] Verify `PROCORE_CLIENT_ID` is production client ID
  - [ ] Verify `PROCORE_CLIENT_SECRET` is production client secret
  - [ ] Verify `PROCORE_REDIRECT_URI` matches production domain
  - [ ] Verify `PROCORE_COMPANY_ID` is correct for production
  - Location: Firebase Functions environment variables

### 1.2 OAuth Configuration
- [ ] **Procore Developer Portal**
  - [ ] Verify OAuth app is configured for production
  - [ ] Verify redirect URI matches production URL: `https://www.mybolt.pro/project-profitability`
  - [ ] Verify OAuth app has correct scopes/permissions
  - [ ] Test OAuth flow in production environment

### 1.3 Permissions Verification
- [ ] **Procore User Permissions**
  - [ ] Verify user has required project-level permissions:
    - Prime Contracts (Read)
    - Payment Applications (Read)
    - Requisitions (Read)
    - Budget (Read)
    - Commitments (Read)
    - Project Roles (Read)
  - [ ] Test with production Procore account
  - [ ] Verify access to all projects that need to be displayed

### 1.4 Code Review
- [ ] **Remove Test Functions** (Optional - can keep for debugging)
  - Consider keeping test functions but restricting access
  - Or remove: `procoreTestAllVariations`, `procoreTestCostEndpoints`, etc.
  
- [ ] **Remove Debug Logging** (Optional)
  - Review console.log statements
  - Keep error logging, remove verbose debug logs
  
- [ ] **Error Handling**
  - [ ] Verify all error cases are handled gracefully
  - [ ] Verify user-friendly error messages
  - [ ] Test rate limiting handling

---

## 2. Testing Checklist

### 2.1 Functional Testing
- [ ] **OAuth Flow**
  - [ ] Test authorization URL generation
  - [ ] Test OAuth callback handling
  - [ ] Test token exchange
  - [ ] Test token refresh

- [ ] **Data Fetching**
  - [ ] Test fetching all projects
  - [ ] Test fetching project profitability data
  - [ ] Verify all columns populate correctly
  - [ ] Test with projects that have missing data
  - [ ] Test with archived projects

- [ ] **UI/UX**
  - [ ] Test filters (search, project, project stage, etc.)
  - [ ] Test column visibility toggles
  - [ ] Test column reordering
  - [ ] Test pagination
  - [ ] Test sorting
  - [ ] Test responsive design (mobile/tablet)

- [ ] **Edge Cases**
  - [ ] Test with no projects
  - [ ] Test with projects missing financial data
  - [ ] Test rate limiting scenarios
  - [ ] Test expired tokens
  - [ ] Test network errors

### 2.2 Performance Testing
- [ ] **Load Testing**
  - [ ] Test with 5 projects (default limit)
  - [ ] Test with 10 projects
  - [ ] Test with 20 projects (max limit)
  - [ ] Verify timeout handling (currently 9 minutes)

- [ ] **Rate Limiting**
  - [ ] Verify delays between API calls (currently 50ms)
  - [ ] Test retry logic for 429 errors
  - [ ] Monitor API usage

### 2.3 Data Accuracy
- [ ] **Compare with Power BI**
  - [ ] Compare Total Contract Value
  - [ ] Compare Total Invoiced
  - [ ] Compare Balance Left on Contract
  - [ ] Compare Project Manager names
  - [ ] Compare Project Status values
  - [ ] Note discrepancies in marked columns (*)

---

## 3. Deployment Steps

### 3.1 Pre-Deployment
1. **Backup Current State**
   ```bash
   git tag pre-procore-deployment-$(date +%Y%m%d)
   git push origin --tags
   ```

2. **Verify Branch**
   - Ensure all changes are committed
   - Create release branch: `git checkout -b release/procore-profitability-v1.0`

3. **Update Documentation**
   - Update README with Procore integration details
   - Document known limitations (marked columns)

### 3.2 Deployment
1. **Deploy Firebase Functions**
   ```bash
   firebase deploy --only functions
   ```
   - Monitor deployment for errors
   - Verify all functions deployed successfully

2. **Deploy Frontend** (if separate deployment)
   ```bash
   npm run build
   # Deploy to your hosting platform
   ```

3. **Verify Deployment**
   - Check Firebase Functions logs
   - Test OAuth flow
   - Test data fetching

### 3.3 Post-Deployment
1. **Smoke Tests**
   - [ ] Authorize Procore connection
   - [ ] Fetch project data
   - [ ] Verify data displays correctly
   - [ ] Test filters and sorting

2. **Monitor**
   - [ ] Check Firebase Functions logs for errors
   - [ ] Monitor API rate limits
   - [ ] Check user feedback

---

## 4. Configuration Changes Needed

### 4.1 Production Procore API
**Current Configuration** (check `functions/src/index.ts`):
```typescript
const PROCORE_CONFIG = {
    apiBaseUrl: process.env.PROCORE_API_BASE_URL || 'https://api.procore.com',
    clientId: process.env.PROCORE_CLIENT_ID,
    clientSecret: process.env.PROCORE_CLIENT_SECRET,
    redirectUri: process.env.PROCORE_REDIRECT_URI,
    companyId: process.env.PROCORE_COMPANY_ID,
}
```

**Action Items:**
- [ ] Set `PROCORE_API_BASE_URL` to `https://api.procore.com` (production)
- [ ] Verify `PROCORE_CLIENT_ID` is production OAuth app ID
- [ ] Verify `PROCORE_CLIENT_SECRET` is production OAuth app secret
- [ ] Set `PROCORE_REDIRECT_URI` to production URL: `https://www.mybolt.pro/project-profitability`
- [ ] Verify `PROCORE_COMPANY_ID` is production company ID

### 4.2 Firebase Environment Variables
Set in Firebase Console or via CLI:
```bash
firebase functions:config:set \
  procore.client_id="YOUR_PRODUCTION_CLIENT_ID" \
  procore.client_secret="YOUR_PRODUCTION_CLIENT_SECRET" \
  procore.redirect_uri="https://www.mybolt.pro/project-profitability" \
  procore.company_id="YOUR_PRODUCTION_COMPANY_ID" \
  procore.api_base_url="https://api.procore.com"
```

---

## 5. Rollback Plan

### 5.1 If Deployment Fails
1. **Revert Firebase Functions**
   ```bash
   firebase deploy --only functions --force
   # Or rollback to previous version in Firebase Console
   ```

2. **Revert Frontend** (if needed)
   ```bash
   git revert HEAD
   # Redeploy frontend
   ```

### 5.2 If Issues Found Post-Deployment
1. **Disable Feature** (temporary)
   - Hide "Project Profitability" menu item
   - Or show maintenance message

2. **Fix and Redeploy**
   - Create hotfix branch
   - Fix issues
   - Deploy fix
   - Re-enable feature

---

## 6. Monitoring & Alerts

### 6.1 Firebase Functions Monitoring
- [ ] Set up alerts for function errors
- [ ] Monitor function execution time
- [ ] Monitor function invocations
- [ ] Set up alerts for timeout errors

### 6.2 Procore API Monitoring
- [ ] Monitor rate limit usage
- [ ] Monitor 403/404 errors (permission issues)
- [ ] Monitor 429 errors (rate limiting)
- [ ] Track API response times

### 6.3 User Feedback
- [ ] Monitor user reports
- [ ] Track data accuracy issues
- [ ] Monitor performance complaints

---

## 7. Known Limitations (Marked Columns)

### 7.1 Est. Cost At Completion*
- **Issue**: Budget Views endpoint not available in Procore API
- **Workaround**: Using Budget Line Items + Commitments
- **Impact**: May not match Power BI exactly
- **Future**: Monitor for API updates or alternative endpoints

### 7.2 Initial Estimated Profit*
- **Issue**: Depends on Est. Cost At Completion
- **Impact**: Calculated value may differ from Power BI
- **Future**: Will improve when Est. Cost At Completion is fixed

### 7.3 Remaining Cost*
- **Issue**: Depends on Est. Cost At Completion
- **Impact**: Calculated value may differ from Power BI
- **Future**: Will improve when Est. Cost At Completion is fixed

### 7.4 Archive Date*
- **Issue**: Endpoint not found in Procore API
- **Impact**: Field will be empty
- **Future**: Need to identify correct endpoint or use custom field

---

## 8. User Communication

### 8.1 Pre-Launch
- [ ] Notify users about new feature
- [ ] Provide training/documentation
- [ ] Explain known limitations

### 8.2 Launch
- [ ] Announce feature availability
- [ ] Provide support contact for issues
- [ ] Monitor initial user feedback

### 8.3 Post-Launch
- [ ] Collect user feedback
- [ ] Address issues promptly
- [ ] Plan improvements based on feedback

---

## 9. Success Criteria

### 9.1 Technical
- [ ] All functions deploy successfully
- [ ] OAuth flow works correctly
- [ ] Data fetches without errors
- [ ] No critical errors in logs

### 9.2 Functional
- [ ] Users can authorize Procore connection
- [ ] Project data displays correctly
- [ ] Filters and sorting work
- [ ] Data matches Power BI (within known limitations)

### 9.3 Performance
- [ ] Data loads within acceptable time (< 10 minutes for 20 projects)
- [ ] No rate limiting issues
- [ ] UI remains responsive

---

## 10. Timeline Estimate

### Phase 1: Preparation (1-2 days)
- Environment configuration
- OAuth setup verification
- Permissions verification
- Code review

### Phase 2: Testing (2-3 days)
- Functional testing
- Performance testing
- Data accuracy verification
- Edge case testing

### Phase 3: Deployment (1 day)
- Deploy to production
- Smoke tests
- Monitor initial usage

### Phase 4: Post-Deployment (Ongoing)
- Monitor for issues
- Collect user feedback
- Plan improvements

**Total Estimated Time: 4-6 days**

---

## 11. Risk Assessment

### High Risk
- **OAuth Configuration**: Incorrect redirect URI will break authorization
  - **Mitigation**: Test thoroughly in staging environment first

- **API Rate Limiting**: Exceeding limits will break functionality
  - **Mitigation**: Current delays (50ms) should prevent this, monitor closely

### Medium Risk
- **Data Accuracy**: Marked columns may not match Power BI
  - **Mitigation**: Document limitations, set user expectations

- **Performance**: Large number of projects may timeout
  - **Mitigation**: Current limit of 20 projects, 9-minute timeout

### Low Risk
- **UI Issues**: Minor display issues
  - **Mitigation**: Test on multiple browsers/devices

---

## 12. Next Steps

1. **Review this plan** with team
2. **Set up production environment** configuration
3. **Perform testing** checklist
4. **Schedule deployment** window
5. **Execute deployment** following steps above
6. **Monitor** post-deployment
7. **Iterate** based on feedback

---

## Questions to Resolve Before Deployment

1. ✅ **Is the current Firebase project (`tatco-crm`) the production project?**
   - **Answer:** Yes, `tatco-crm` is the production Firebase project.

2. ✅ **What is the production domain URL?**
   - **Answer:** `https://www.mybolt.pro`

3. ✅ **Is the Procore OAuth app configured for production?**
   - **Answer:** Yes, configured
   - **Client ID:** `cnOtyAY1YcKSCGdzQp88vB5ETGOknRvao3VT7cY2HoM`
   - **Redirect URI:** `https://www.mybolt.pro/project-profitability` (added)
   - **Client Secret:** Already configured in environment variables
   - **Action Required:** Verify app is set to **Production** (not Sandbox) in Procore Developer Portal

4. ✅ **What is the production Procore Company ID?**
   - **Answer:** Already configured in environment variables

5. ✅ **Should test functions be removed or restricted?**
   - **Answer:** Test functions should be restricted to admin account only, placed at bottom of page

6. ✅ **What is the acceptable data load time?**
   - **Answer:** User can wait for 100+ projects to load
   - **Current Implementation:**
     - ✅ Removed project limit (defaults to all projects)
     - ✅ Added progress tracking via Firestore
     - ⚠️ **Timeout Issue:** 9-minute timeout may not be enough for 100+ projects
   - **Recommendations:**
     - **Option 1 (Recommended):** Implement batch processing (20-30 projects per batch)
     - **Option 2:** Upgrade to Cloud Functions Gen 2 (60-minute timeout)
     - **Option 3:** Use Cloud Tasks for background processing
   - **See:** `HANDLING_100_PLUS_PROJECTS.md` for detailed implementation guide

7. ✅ **How should we handle discrepancies with Power BI data?**
   - **Answer:** Document known limitations, add legend on page, monitor user feedback
   - **Implementation:**
     - ✅ Legend added to page explaining marked columns (*)
     - ✅ Columns marked with asterisk for visibility
     - **Recommendation:**
       - Monitor user feedback on data accuracy
       - Compare sample projects with Power BI weekly
       - Document any patterns in discrepancies
       - Consider adding a "Report Issue" button for data accuracy
       - Create internal dashboard to track data differences

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-17  
**Author:** Mateo Roldan

