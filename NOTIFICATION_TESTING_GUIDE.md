# Notification Testing Guide

This guide covers testing all notification types in the application.

## Prerequisites

Before testing, ensure you have:
1. **Multiple users set up** in Firebase Authentication
2. **Entities (Leads, Clients, Projects)** with members assigned in their task sections
3. **Notification preferences enabled** in your profile (Profile → Notification tab)

> **Important**: Notifications are only sent to users who are **members** of the entity's task sections. To add members:
> - Go to any Lead/Client/Project detail page
> - Click the "Tasks" tab
> - Click "Members" button on any section
> - Add users to that section
> - Click "Done"

---

## Task Notifications

### Test 1: Task Assigned
1. Navigate to any Lead, Client, or Project detail page
2. Go to the "Tasks" tab
3. Click "Create Task"
4. Fill in task details
5. **Select an assignee** (must be a member of the section)
6. Save the task
7. **Expected**: Assignee receives notification: "You have been assigned to task [task name]"

### Test 2: Task Completed
1. Find a task assigned to you (or assign one to yourself)
2. Toggle the task to "Completed"
3. **Expected**: You receive notification: "Task [task name] has been completed"

### Test 3: Task Updated
1. Edit a task that's assigned to you
2. Make changes (name, priority, due date, assignee, etc.)
3. Save the changes
4. **Expected**: Assignee receives notification: "Task [task name] has been updated"

---

## Entity Notifications

### Test 4: Entity Updated (Lead)
1. Navigate to a Lead detail page
2. Go to "Settings" tab
3. Click "Edit" on the information section
4. Make changes to any field (company name, contact, status, etc.)
5. Click "Save Changes"
6. **Expected**: All members of the lead's task sections receive notification: "[Lead Name] has been updated"

### Test 5: Entity Status Changed (Lead)
1. Navigate to a Lead detail page
2. Go to "Settings" tab
3. Click "Edit" on the information section
4. **Change the Status field** (e.g., from "New" to "Contacted")
5. Click "Save Changes"
6. **Expected**: All members receive notification: "[Lead Name] status changed from [old] to [new]"

### Test 6: Entity Updated (Client)
1. Navigate to a Client detail page
2. Go to "Settings" tab
3. Click "Edit" on the information section
4. Make changes to any field
5. Click "Save Changes"
6. **Expected**: All members receive notification: "[Client Name] has been updated"

### Test 7: Entity Updated (Project)
1. Navigate to a Project detail page
2. Go to "Settings" tab
3. Make changes to any field (Project Name, Status, Manager, etc.)
4. Click "Save Changes"
5. **Expected**: All members receive notification: "[Project Name] has been updated"

### Test 8: Entity Status Changed (Project)
1. Navigate to a Project detail page
2. Go to "Settings" tab
3. **Change the Project Status** (e.g., from "Bidding" to "Pre-Construction")
4. Click "Save Changes"
5. **Expected**: All members receive notification: "[Project Name] status changed from [old] to [new]"

### Test 9: Entity Deleted (Lead)
1. Navigate to a Lead detail page
2. Click the delete button (usually in settings or header)
3. Confirm deletion
4. **Expected**: All members receive notification: "[Lead Name] has been deleted"

### Test 10: Entity Deleted (Client)
1. Navigate to a Client detail page
2. Click the delete button
3. Confirm deletion
4. **Expected**: All members receive notification: "[Client Name] has been deleted"

### Test 11: Entity Deleted (Project)
1. Navigate to a Project detail page
2. Click the delete button
3. Confirm deletion
4. **Expected**: All members receive notification: "[Project Name] has been deleted"

---

## Attachment Notifications

### Test 12: Attachment Added
1. Navigate to any Lead, Client, or Project detail page
2. Go to the "Attachments" tab
3. Click "Upload" button
4. Select a file and upload it
5. **Expected**: All members receive notification: "New file '[filename]' added to [Entity Name]"

### Test 13: Attachment Deleted
1. Navigate to any Lead, Client, or Project detail page
2. Go to the "Attachments" tab
3. Find an existing file
4. Click the delete/trash icon
5. Confirm deletion
6. **Expected**: All members receive notification: "File '[filename]' has been deleted from [Entity Name]"

---

## Activity Notifications

### Test 14: Activity Added
Activities are automatically logged when you perform actions. To test:

1. Navigate to any Lead, Client, or Project detail page
2. Perform any action that logs an activity:
   - Update entity information
   - Upload a file
   - Create/complete a task
   - Delete a file
3. Go to the "Activities" tab to see the activity
4. **Expected**: All members receive notification: "New Activity" with the activity message

**Note**: Activities are logged for:
- Entity updates
- File uploads/deletions
- Task creation/completion
- Status changes
- And other system actions

---

## System Notifications

### Test 15: System Notifications
System notifications are for system-level events (currently not automatically triggered, but can be created manually for testing).

---

## Testing Checklist

### Task Notifications
- [ ] Create task and assign → Notification appears
- [ ] Complete task → Notification appears
- [ ] Update task → Notification appears
- [ ] Change task assignee → New assignee gets notification

### Entity Notifications
- [ ] Update Lead → Members get notification
- [ ] Change Lead status → Members get status change notification
- [ ] Update Client → Members get notification
- [ ] Update Project → Members get notification
- [ ] Change Project status → Members get status change notification
- [ ] Delete Lead → Members get deletion notification
- [ ] Delete Client → Members get deletion notification
- [ ] Delete Project → Members get deletion notification

### Attachment Notifications
- [ ] Upload file → Members get notification
- [ ] Delete file → Members get notification

### Activity Notifications
- [ ] Perform any action → Members get activity notification

### Notification Center Features
- [ ] Click notification bell → Notification center opens
- [ ] Click on notification → Navigates to related entity
- [ ] Mark notification as read → Badge count decreases
- [ ] Delete notification → Notification disappears
- [ ] Filter by type → Filters correctly
- [ ] Real-time updates → New notifications appear automatically
- [ ] Load more → Pagination works

### User Preferences
- [ ] Disable notification type in Profile → No notifications for that type
- [ ] Enable notification type → Notifications resume
- [ ] Save preferences → Changes persist

---

## Testing with Multiple Users

To properly test notifications between users:

1. **User A Setup**:
   - Sign in as User A
   - Create a Lead/Client/Project
   - Go to Tasks tab → Add User B as a member to a section

2. **User B Setup**:
   - Sign in as User B
   - Verify you can see the entity
   - Ensure notification preferences are enabled

3. **Test Flow**:
   - Sign in as User A
   - Perform an action (update entity, upload file, etc.)
   - Sign in as User B
   - Check notification center → Should see notification

---

## Quick Testing Methods

### Method 1: Direct Firestore Creation (Advanced)

If you want to test notifications directly in Firestore:

1. Go to Firebase Console → Firestore Database
2. Navigate to the `notifications` collection
3. Click "Add document"
4. Use the following structure:

```json
{
  "userId": "YOUR_USER_ID",
  "type": "entity_updated",
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

### Method 2: Getting Your User ID

To find your user ID for testing:

1. **Browser Console Method**:
   ```javascript
   // Open browser console (F12)
   // The user ID is available in the auth store
   ```

2. **Firebase Console**:
   - Go to Firebase Console → Authentication → Users
   - Copy the User UID

3. **Application Storage**:
   - Open DevTools → Application → Local Storage
   - Look for session data

---

## Troubleshooting

### Notifications Not Appearing?

1. **Check User Membership**:
   - Ensure the user is added as a member in the entity's task sections
   - Go to Tasks tab → Click "Members" → Verify user is listed

2. **Check Notification Preferences**:
   - Go to Profile → Notification tab
   - Ensure the notification type is enabled

3. **Check Firebase Rules**:
   - Verify Firestore rules allow notification creation
   - Check browser console for errors

4. **Check Real-time Connection**:
   - Ensure you're connected to Firebase
   - Check browser console for connection errors

5. **Check User ID**:
   - Verify the user ID matches Firebase Authentication UID
   - Check that the user is authenticated

### Notifications Appearing for Wrong Users?

- Verify members are correctly assigned to entity sections
- Check that `getUsersToNotify()` is fetching the correct members
- Ensure entity sections have the `members` array populated

---

## Expected Behavior

- **Real-time Updates**: Notifications should appear immediately without page refresh
- **Badge Count**: Unread count should update in real-time
- **Toast Notifications**: Some notifications (like task assignments) show toast messages
- **Navigation**: Clicking a notification should navigate to the related entity
- **Read Status**: Marking as read should update the badge count
- **Filtering**: Filtering by type should work correctly
- **Pagination**: "Load More" should load additional notifications

---

## Notes

- Notifications respect user preferences set in Profile → Notification tab
- Only members of entity task sections receive notifications
- Notifications are created asynchronously and may take a moment to appear
- The notification system uses real-time Firestore listeners for instant updates

