# Sync Firebase Auth Users to Firestore Guide

## Problem
Some users exist in Firebase Authentication but don't have corresponding documents in the Firestore `users` collection. This causes them not to appear in the "Manage Members" dialog.

## Solution

### Option 1: Have Users Sign In (Recommended)
The easiest solution is to have each user sign in at least once. The sign-in process now automatically creates a Firestore document if one doesn't exist.

**Steps:**
1. Have each user (troberts@tatco.construction, rbilly@tatco.construction, jmartin@tatco.construction) sign in to the app
2. Their Firestore document will be created automatically
3. They will then appear in the "Manage Members" dialog

### Option 2: Manual Firestore Document Creation
If you need to create Firestore documents without users signing in:

1. Go to Firebase Console → Firestore Database
2. Navigate to the `users` collection
3. For each missing user, you need their Firebase Auth UID:
   - Go to Firebase Console → Authentication → Users
   - Find the user and copy their UID
4. Create a new document in the `users` collection with:
   - Document ID: The user's Firebase Auth UID
   - Fields:
     ```json
     {
       "email": "user@tatco.construction",
       "userName": "",
       "firstName": "",
       "phoneNumber": "",
       "avatar": "",
       "createdAt": [SERVER_TIMESTAMP],
       "updatedAt": [SERVER_TIMESTAMP]
     }
     ```

### Option 3: Use Cloud Function (Advanced)
Create a Cloud Function that:
1. Uses Firebase Admin SDK to list all Auth users
2. Creates/updates Firestore documents for each user
3. Runs on a schedule or manually triggers

## Current Users in Firebase Auth
Based on your list:
- troberts@tatco.construction
- brett@tatco.construction
- rbilly@tatco.construction
- jmartin@tatco.construction
- simon@tatco.construction
- admin-01@tatco.construction

**Currently visible (have Firestore documents):**
- simon@tatco.construction
- admin-01@tatco.construction
- brett@tatco.construction

**Missing (need Firestore documents):**
- troberts@tatco.construction
- rbilly@tatco.construction
- jmartin@tatco.construction

## Quick Fix
Have these 3 users sign in once, and they'll automatically get Firestore documents created.

