import * as functions from 'firebase-functions/v1';
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
export const checkTaskDueDates = functions
    .region('us-central1') // Specify region for better performance
    .pubsub
    .schedule('every 1 hours')
    .timeZone('UTC')
    .onRun(async () => {
        console.log('Starting task due date check...');
        
        const now = new Date();
        
        try {
            // Get all leads, clients, and projects
            const entityTypes = ['leads', 'clients', 'projects'];
            
            for (const entityType of entityTypes) {
                const entitiesSnapshot = await admin.firestore()
                    .collection(entityType)
                    .get();
                
                console.log(`Checking ${entitiesSnapshot.size} ${entityType}...`);
                
                for (const entityDoc of entitiesSnapshot.docs) {
                    const entityId = entityDoc.id;
                    
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
                                console.log(`Created "due soon" notification for task: ${task.name}`);
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
                                    console.log(`Created "overdue" notification for task: ${task.name}`);
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

