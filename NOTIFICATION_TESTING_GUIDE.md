# Notification Testing Guide

## Quick Testing Methods

### Method 1: Create a Task and Assign It

The easiest way to test notifications is to create a task and assign it to a user:

1. Navigate to any Lead, Client, or Project detail page
2. Go to the "Tasks" tab
3. Click "Create Task"
4. Fill in the task details
5. **Select an assignee** (this will trigger a notification)
6. Save the task

The assigned user should receive a notification: "You have been assigned to task [task name]"

### Method 2: Complete a Task

1. Find a task that's assigned to you
2. Toggle it to "Completed"
3. You should receive a notification: "Task [task name] has been completed"

### Method 3: Update a Task

1. Edit a task that's assigned to you
2. Make changes (name, priority, due date, etc.)
3. Save the changes
4. You should receive a notification: "Task [task name] has been updated"

### Method 4: Direct Firestore Creation (Advanced)

If you want to test notifications directly in Firestore:

1. Go to Firebase Console → Firestore Database
2. Navigate to the `notifications` collection
3. Click "Add document"
4. Use the following structure:

```json
{
  "userId": "YOUR_USER_ID",  // Get this from Firebase Auth or your user profile
  "type": "task_assigned",
  "title": "Test Notification",
  "message": "This is a test notification",
  "entityType": "lead",
  "entityId": "SOME_LEAD_ID",
  "read": false,
  "createdAt": [SERVER_TIMESTAMP],
  "updatedAt": [SERVER_TIMESTAMP],
  "metadata": {}
}
```

**Available notification types:**
- `task_assigned`
- `task_completed`
- `task_updated`
- `task_due_soon`
- `task_overdue`
- `entity_created`
- `entity_updated`
- `entity_status_changed`
- `entity_deleted`
- `attachment_added`
- `attachment_deleted`
- `activity_added`
- `system`

### Method 5: Using Browser Console (Quick Test)

Open your browser console and run:

```javascript
// First, get your user ID
import { getAuth } from 'firebase/auth';
const auth = getAuth();
console.log('Your User ID:', auth.currentUser?.uid);

// Then create a test notification (you'll need to import the helper)
// This would be done in your app's context, not directly in console
```

## Testing Checklist

- [ ] Create a task and assign it → Should see notification
- [ ] Complete a task → Should see notification
- [ ] Update a task → Should see notification
- [ ] Click on notification → Should navigate to related entity
- [ ] Mark notification as read → Badge count should decrease
- [ ] Delete notification → Should disappear from list
- [ ] Filter notifications → Should filter correctly
- [ ] Real-time updates → New notifications should appear automatically

## Getting Your User ID

To find your user ID for testing:

1. Open browser console
2. Go to Application/Storage → Local Storage
3. Look for `sessionUser` key
4. The `user` object contains your user info
5. Or check Firebase Console → Authentication → Users

## Testing with Multiple Users

To test notifications between users:

1. Sign in as User A
2. Create a task and assign it to User B (you'll need User B's ID)
3. Sign in as User B
4. User B should see the notification

Note: Currently, task assignments use user IDs from the `availableUsers` array in TasksManager.jsx. Make sure the assignee ID matches an actual user ID in your system.

