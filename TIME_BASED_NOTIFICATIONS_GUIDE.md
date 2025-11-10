# Time-Based Notifications Implementation Guide

This guide explains how to implement time-based notifications for `task_due_soon` and `task_overdue` using Firebase Cloud Functions.

## Overview

Time-based notifications require a scheduled job that:
1. Checks all tasks with due dates
2. Compares due dates with current time
3. Checks user notification preferences
4. Sends notifications based on user's time settings

## Prerequisites

- Firebase project with Cloud Functions enabled
- Node.js and npm installed
- Firebase CLI installed (`npm install -g firebase-tools`)
- Admin SDK access (for listing all users and tasks)

## Step 1: Initialize Cloud Functions

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Initialize Functions** (in your project root):
   ```bash
   firebase init functions
   ```
   - Select your Firebase project
   - Choose JavaScript or TypeScript (TypeScript recommended)
   - Install dependencies: Yes

4. **Install Admin SDK** (if using TypeScript):
   ```bash
   cd functions
   npm install firebase-admin
   ```

## Step 2: Create the Scheduled Function

Create a new file: `functions/src/index.ts` (or `functions/index.js` for JavaScript):

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

// Helper function to parse time preference (e.g., "1d" = 1 day, "2h" = 2 hours)
function parseTimePreference(timeStr: string): number {
    const match = timeStr.match(/^(\d+)([mhdw])$/);
    if (!match) return 0;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
        case 'm': return value * 60 * 1000; // minutes to milliseconds
        case 'h': return value * 60 * 60 * 1000; // hours to milliseconds
        case 'd': return value * 24 * 60 * 60 * 1000; // days to milliseconds
        case 'w': return value * 7 * 24 * 60 * 60 * 1000; // weeks to milliseconds
        default: return 0;
    }
}

// Helper function to check if notification should be sent
async function shouldNotifyUser(
    userId: string,
    notificationType: string,
    taskDueDate: Date,
    userPreference: string
): Promise<boolean> {
    try {
        // Get user preferences
        const userDoc = await admin.firestore().collection('users').doc(userId).get();
        if (!userDoc.exists) return false;
        
        const preferences = userDoc.data()?.notificationPreferences || {};
        
        // Check if notification type is enabled
        if (preferences[notificationType] === false) {
            return false;
        }
        
        // Get time preference
        const timePreference = preferences[`${notificationType}_time`] || 
            (notificationType === 'task_due_soon' ? '1d' : '0h');
        
        const timeOffset = parseTimePreference(timePreference);
        const now = new Date();
        const notificationTime = new Date(taskDueDate.getTime() - timeOffset);
        
        if (notificationType === 'task_due_soon') {
            // Notify if current time is within 1 hour of notification time
            const timeDiff = Math.abs(now.getTime() - notificationTime.getTime());
            return timeDiff <= 60 * 60 * 1000; // 1 hour window
        } else if (notificationType === 'task_overdue') {
            // Notify if task is overdue and we've passed the notification time
            return now >= taskDueDate && now >= notificationTime;
        }
        
        return false;
    } catch (error) {
        console.error(`Error checking user preferences for ${userId}:`, error);
        return false;
    }
}

// Helper function to create notification
async function createNotification(notificationData: {
    userId: string;
    type: string;
    title: string;
    message: string;
    entityType: string;
    entityId: string;
    metadata?: any;
}) {
    try {
        await admin.firestore().collection('notifications').add({
            ...notificationData,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error creating notification:', error);
    }
}

// Main scheduled function - runs every hour
export const checkTaskDueDates = functions.pubsub
    .schedule('every 1 hours')
    .onRun(async (context) => {
        console.log('Starting task due date check...');
        
        const now = new Date();
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
        
        try {
            // Get all leads, clients, and projects
            const entityTypes = ['leads', 'clients', 'projects'];
            
            for (const entityType of entityTypes) {
                const entitiesSnapshot = await admin.firestore()
                    .collection(entityType)
                    .get();
                
                for (const entityDoc of entitiesSnapshot.docs) {
                    const entityId = entityDoc.id;
                    const entityData = entityDoc.data();
                    const entityName = entityData.companyName || 
                                     entityData.clientName || 
                                     entityData.projectName || 
                                     entityData.ProjectName || 
                                     `${entityType.slice(0, -1)}`;
                    
                    // Get all tasks for this entity
                    const tasksSnapshot = await admin.firestore()
                        .collection(entityType)
                        .doc(entityId)
                        .collection('tasks')
                        .where('status', '!=', 'completed')
                        .get();
                    
                    for (const taskDoc of tasksSnapshot.docs) {
                        const task = taskDoc.data();
                        const taskId = taskDoc.id;
                        
                        if (!task.dueDate || !task.assignee) continue;
                        
                        // Parse due date
                        let dueDate: Date;
                        if (task.dueDate instanceof admin.firestore.Timestamp) {
                            dueDate = task.dueDate.toDate();
                        } else if (typeof task.dueDate === 'string') {
                            dueDate = new Date(task.dueDate);
                        } else {
                            continue;
                        }
                        
                        // Check for "due soon" notifications
                        if (await shouldNotifyUser(
                            task.assignee,
                            'task_due_soon',
                            dueDate,
                            'task_due_soon_time'
                        )) {
                            // Check if notification was already sent (prevent duplicates)
                            const existingNotifications = await admin.firestore()
                                .collection('notifications')
                                .where('userId', '==', task.assignee)
                                .where('type', '==', 'task_due_soon')
                                .where('metadata.taskId', '==', taskId)
                                .where('read', '==', false)
                                .limit(1)
                                .get();
                            
                            if (existingNotifications.empty) {
                                await createNotification({
                                    userId: task.assignee,
                                    type: 'task_due_soon',
                                    title: 'Task Due Soon',
                                    message: `Task "${task.name}" is due soon`,
                                    entityType: entityType.slice(0, -1), // Remove 's'
                                    entityId: entityId,
                                    metadata: {
                                        taskId: taskId,
                                        taskName: task.name,
                                        dueDate: dueDate.toISOString()
                                    }
                                });
                            }
                        }
                        
                        // Check for "overdue" notifications
                        if (now > dueDate) {
                            if (await shouldNotifyUser(
                                task.assignee,
                                'task_overdue',
                                dueDate,
                                'task_overdue_time'
                            )) {
                                // Check if notification was already sent today (prevent spam)
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                
                                const existingNotifications = await admin.firestore()
                                    .collection('notifications')
                                    .where('userId', '==', task.assignee)
                                    .where('type', '==', 'task_overdue')
                                    .where('metadata.taskId', '==', taskId)
                                    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(today))
                                    .limit(1)
                                    .get();
                                
                                if (existingNotifications.empty) {
                                    await createNotification({
                                        userId: task.assignee,
                                        type: 'task_overdue',
                                        title: 'Task Overdue',
                                        message: `Task "${task.name}" is overdue`,
                                        entityType: entityType.slice(0, -1),
                                        entityId: entityId,
                                        metadata: {
                                            taskId: taskId,
                                            taskName: task.name,
                                            dueDate: dueDate.toISOString()
                                        }
                                    });
                                }
                            }
                        }
                    }
                }
            }
            
            console.log('Task due date check completed');
        } catch (error) {
            console.error('Error in task due date check:', error);
        }
    });
```

## Step 3: Deploy the Function

1. **Build the functions** (if using TypeScript):
   ```bash
   cd functions
   npm run build
   ```

2. **Deploy to Firebase**:
   ```bash
   firebase deploy --only functions:checkTaskDueDates
   ```

## Step 4: Test the Function

1. **Test locally** (optional):
   ```bash
   firebase emulators:start --only functions
   ```

2. **Trigger manually** (for testing):
   ```bash
   firebase functions:shell
   ```
   Then in the shell:
   ```javascript
   checkTaskDueDates()
   ```

3. **Check logs**:
   ```bash
   firebase functions:log
   ```

## Step 5: Monitor and Adjust

1. **View function logs** in Firebase Console:
   - Go to Firebase Console → Functions → Logs

2. **Adjust schedule frequency**:
   - Change `every 1 hours` to `every 30 minutes` for more frequent checks
   - Or `every 6 hours` for less frequent checks

3. **Monitor costs**:
   - Cloud Functions have a free tier
   - Check usage in Firebase Console → Usage and Billing

## Alternative: Client-Side Scheduler (Not Recommended)

If you can't use Cloud Functions, you could implement a client-side scheduler, but this has limitations:

1. Only runs when users are logged in
2. Requires each user's browser to run the check
3. Less reliable and efficient

**Implementation** (in your React app):

```javascript
// In a component or service
useEffect(() => {
    const checkTaskDueDates = async () => {
        // Similar logic to Cloud Function
        // Check tasks and send notifications
    };
    
    // Run immediately
    checkTaskDueDates();
    
    // Then run every hour
    const interval = setInterval(checkTaskDueDates, 60 * 60 * 1000);
    
    return () => clearInterval(interval);
}, []);
```

## Troubleshooting

1. **Function not running**:
   - Check Firebase Console → Functions → Logs for errors
   - Verify the schedule is set correctly
   - Ensure billing is enabled (required for scheduled functions)

2. **Notifications not appearing**:
   - Check user preferences are saved correctly
   - Verify task due dates are in correct format
   - Check Firestore rules allow notification creation

3. **Too many notifications**:
   - Adjust the duplicate check logic
   - Increase the time window for "due soon" checks
   - Add rate limiting

## Next Steps

1. Deploy the Cloud Function
2. Test with a task that has a due date in the near future
3. Monitor logs to ensure it's working
4. Adjust the schedule frequency as needed

## Cost Considerations

- Cloud Functions: Free tier includes 2 million invocations/month
- Firestore reads: Free tier includes 50,000 reads/day
- For most use cases, this should be well within free tier limits

