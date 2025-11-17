# Handling 100+ Projects - Implementation Guide

## Overview
The system has been updated to handle 100+ projects with progress tracking. This document explains the changes and recommendations.

---

## Changes Made

### 1. Removed Project Limit
- **Before:** Default limit of 5 projects (configurable up to 20)
- **After:** Default to all projects (no limit)
- **Location:** `functions/src/index.ts` - `procoreGetAllProjectsProfitability`

### 2. Added Progress Tracking
- **Firestore Collection:** `procoreSyncProgress`
- **Document Structure:**
  ```typescript
  {
    userId: string,
    totalProjects: number,
    processedProjects: number,
    currentProject: string,
    status: 'processing' | 'completed' | 'failed',
    startedAt: Timestamp,
    updatedAt: Timestamp,
    completedAt?: Timestamp,
    failedAt?: Timestamp,
    errors?: Array<{ projectId, projectName, error, timestamp }>
  }
  ```

### 3. Progress Updates
- Progress is updated after each project is processed
- Frontend can listen to progress document for real-time updates
- Progress document ID is returned in function response

---

## Timeout Considerations

### Current Setup
- **Timeout:** 540 seconds (9 minutes) - Maximum for Firebase Functions Gen 1
- **Estimated Time for 100 Projects:**
  - ~50ms delay between projects = 5 seconds
  - ~30-60 seconds per project (API calls, data processing)
  - **Total: ~50-100 minutes** (exceeds 9-minute timeout)

### Solutions

#### Option 1: Upgrade to Cloud Functions Gen 2 (Recommended)
- **Max Timeout:** 60 minutes
- **Benefits:**
  - Can handle 100+ projects in single function call
  - Better performance and scaling
  - More memory options
- **Migration:** Requires updating function definition to Gen 2 syntax

#### Option 2: Batch Processing (Current Recommendation)
- **Implementation:** Process projects in batches of 20-30
- **How it works:**
  1. First call processes projects 1-20
  2. Store results in Firestore
  3. Frontend triggers second call for projects 21-40
  4. Continue until all projects processed
- **Benefits:**
  - Works with current Gen 1 Functions
  - No migration needed
  - Progress tracking per batch
- **Drawbacks:**
  - Requires multiple function calls
  - More complex frontend logic

#### Option 3: Cloud Tasks (Background Processing)
- **Implementation:** Use Cloud Tasks to process projects asynchronously
- **Benefits:**
  - No timeout limits
  - Can process overnight
  - Better for very large datasets
- **Drawbacks:**
  - More complex setup
  - Results not immediately available
  - Requires additional infrastructure

---

## Frontend Progress Tracking (To Be Implemented)

### Recommended Implementation

1. **Listen to Progress Document**
   ```javascript
   import { doc, onSnapshot } from 'firebase/firestore'
   
   // After calling getAllProjectsProfitability
   const progressDocRef = doc(db, 'procoreSyncProgress', progressDocId)
   const unsubscribe = onSnapshot(progressDocRef, (snapshot) => {
     const progress = snapshot.data()
     setProgressPercent((progress.processedProjects / progress.totalProjects) * 100)
     setCurrentProject(progress.currentProject)
   })
   ```

2. **Progress UI Component**
   - Show progress bar
   - Display current project being processed
   - Show estimated time remaining
   - Allow cancellation (optional)

3. **Update handleFetchData**
   - Remove `maxProjects: 5` limit
   - Add progress tracking listener
   - Show progress UI during fetch

---

## Recommendations for Production

### Immediate (Current Implementation)
1. ✅ **Remove project limit** - Process all projects
2. ✅ **Add progress tracking** - Real-time updates via Firestore
3. ⚠️ **Monitor timeout** - May timeout with 100+ projects

### Short-term (1-2 weeks)
1. **Implement batch processing** - Process in chunks of 20-30 projects
2. **Add frontend progress UI** - Show progress bar and current project
3. **Add error handling** - Handle partial failures gracefully

### Long-term (1-2 months)
1. **Upgrade to Gen 2 Functions** - Support 60-minute timeout
2. **Implement Cloud Tasks** - For very large datasets (200+ projects)
3. **Add caching** - Cache project data to reduce API calls

---

## Testing Recommendations

### Test Scenarios
1. **5 projects** - Baseline (should complete in 2-3 minutes)
2. **20 projects** - Current max comfortable (should complete in 7-9 minutes)
3. **50 projects** - Medium load (may timeout, test batch processing)
4. **100 projects** - Full production load (requires batch processing or Gen 2)

### Monitoring
- Track function execution time
- Monitor timeout errors
- Track API rate limit usage
- Monitor Firestore read/write operations

---

## Estimated Processing Times

Based on current implementation (50ms delay, ~30-60 seconds per project):

| Projects | Estimated Time | Status |
|----------|---------------|--------|
| 5        | 2-3 minutes   | ✅ Within timeout |
| 10       | 4-5 minutes   | ✅ Within timeout |
| 20       | 7-9 minutes   | ⚠️ Near timeout limit |
| 50       | 25-50 minutes | ❌ Exceeds timeout |
| 100      | 50-100 minutes| ❌ Exceeds timeout |

**Note:** These are estimates. Actual time depends on:
- API response times
- Amount of data per project
- Network conditions
- Procore API rate limits

---

## Next Steps

1. **Deploy current changes** - Remove limit, add progress tracking
2. **Test with 20 projects** - Verify progress tracking works
3. **Implement batch processing** - For 100+ projects
4. **Add frontend progress UI** - Show real-time progress
5. **Monitor and optimize** - Based on production usage

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-17  
**Author:** Development Team

