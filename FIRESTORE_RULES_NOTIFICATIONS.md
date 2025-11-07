# Firestore Security Rules for Notifications

Add the following rules to your Firestore security rules to enable the notifications system:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ... existing rules ...
    
    // Notifications collection
    match /notifications/{notificationId} {
      // Users can only read their own notifications
      allow read: if request.auth != null && request.auth.uid == resource.data.userId;
      
      // Users can only create notifications for themselves (or system can create for any user)
      allow create: if request.auth != null && 
        (request.resource.data.userId == request.auth.uid || 
         request.resource.data.userId == resource.data.userId);
      
      // Users can only update their own notifications (mark as read, etc.)
      allow update: if request.auth != null && 
        request.auth.uid == resource.data.userId &&
        request.resource.data.userId == resource.data.userId;
      
      // Users can only delete their own notifications
      allow delete: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
  }
}
```

## Firestore Indexes Required

The notifications system requires the following composite indexes. Firestore will automatically prompt you to create these when you first use the queries, but you can also create them manually:

1. **Collection**: `notifications`
   - Fields: `userId` (Ascending), `createdAt` (Descending)

2. **Collection**: `notifications`
   - Fields: `userId` (Ascending), `read` (Ascending), `createdAt` (Descending)

To create these indexes:
1. Go to Firebase Console → Firestore Database → Indexes
2. Click "Create Index"
3. Add the fields as specified above
4. Wait for the index to build (usually takes a few minutes)

