import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import axios from 'axios';
import * as sql from 'mssql';

// Initialize Firebase Admin only if not already initialized
try {
    if (!admin.apps.length) {
        admin.initializeApp();
    }
} catch (error) {
    // Admin might already be initialized, ignore error
    console.log('Firebase Admin initialization:', error);
}

// Procore API Configuration
// Note: Sandbox and Production use different Client IDs
// Currently configured for PRODUCTION (read-only testing)
const PROCORE_CONFIG = {
    // OAuth endpoints (use login subdomain)
    // Production: https://login.procore.com
    // Sandbox: https://login-sandbox.procore.com
    oauthBaseUrl: process.env.PROCORE_OAUTH_BASE_URL || 'https://login.procore.com',
    // API endpoints
    // Production: https://api.procore.com
    // Sandbox: https://sandbox.procore.com
    apiBaseUrl: process.env.PROCORE_API_BASE_URL || 'https://api.procore.com',
    // Production credentials
    // SECURITY: Never hardcode secrets. Use environment variables or Firebase Functions config.
    clientId: process.env.PROCORE_CLIENT_ID || 'cnOtyAY1YcKSCGdzQp88vB5ETGOknRvao3VT7cY2HoM',
    clientSecret: process.env.PROCORE_CLIENT_SECRET || '-HR68NdpKiELjbKOgz7sTAOFNXc1voHV2fq8Zosy55E',
    redirectUri: process.env.PROCORE_REDIRECT_URI || 'http://localhost:5173',
    companyId: process.env.PROCORE_COMPANY_ID || '598134325590042', // Production Company ID
};

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

// Helper function to retry API calls with exponential backoff for rate limiting
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 5,
    baseDelay: number = 1000
): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            
            // Only retry on 429 (rate limit) or 503 (service unavailable)
            const status = error?.response?.status;
            if (status !== 429 && status !== 503) {
                throw error; // Don't retry for other errors
            }
            
            // If this is the last attempt, throw the error
            if (attempt === maxRetries) {
                throw error;
            }
            
            // Calculate exponential backoff delay
            const delay = baseDelay * Math.pow(2, attempt);
            const jitter = Math.random() * 0.3 * delay; // Add up to 30% jitter
            const totalDelay = delay + jitter;
            
            console.log(`   ⚠️  Rate limited (${status}), retrying in ${Math.round(totalDelay)}ms (attempt ${attempt + 1}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, totalDelay));
        }
    }
    
    throw lastError;
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
            // Notify any time after threshold but before due date (prevents missing the 1-hour window)
            return now >= notificationTime && now < taskDueDate;
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

// ==================== PROCORE API INTEGRATION ====================

// Interface for Procore token data stored in Firestore
interface ProcoreTokenData {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: admin.firestore.Timestamp;
    createdAt?: admin.firestore.Timestamp;
    updatedAt?: admin.firestore.Timestamp;
}

// Helper function to get or refresh Procore access token
// First tries user-specific token, then falls back to system token, then tries to find any valid token
async function getProcoreAccessToken(userId: string, allowSystemFallback: boolean = true): Promise<string | null> {
    try {
        // First, try to get user-specific token
        const userToken = await getTokenForUser(userId);
        if (userToken) {
            return userToken;
        }
        
        // If user doesn't have a token and fallback is allowed, try system token
        if (allowSystemFallback) {
            console.log('User token not found, trying system token...');
            const systemToken = await getTokenForUser('system');
            if (systemToken) {
                console.log('Using system token for Procore API calls');
                return systemToken;
            }
            
            // If system token doesn't exist or is expired, try to find any valid token from any user
            // This is a last resort fallback to ensure Procore API calls work
            console.log('System token not available, searching for any valid user token...');
            try {
                const allTokensSnapshot = await admin.firestore()
                    .collection('procoreTokens')
                    .get();
                
                console.log(`Found ${allTokensSnapshot.docs.length} token documents in Firestore`);
                
                for (const tokenDoc of allTokensSnapshot.docs) {
                    // Skip the system token (we already tried it) and the current user's token (we already tried it)
                    if (tokenDoc.id === 'system' || tokenDoc.id === userId) {
                        continue;
                    }
                    
                    const tokenData = tokenDoc.data() as ProcoreTokenData | undefined;
                    if (!tokenData || !tokenData.accessToken) {
                        console.log(`Skipping ${tokenDoc.id}: no token data or access token`);
                        continue;
                    }
                    
                    // Check if token is still valid
                    const expiresAt = tokenData.expiresAt?.toDate();
                    const now = new Date();
                    const isExpired = !expiresAt || expiresAt <= new Date(now.getTime() + 5 * 60 * 1000);
                    
                    if (!isExpired) {
                        console.log(`Found valid token from user ${tokenDoc.id}, using it for Procore API calls`);
                        // Also update system token with this valid token for future use
                        await admin.firestore()
                            .collection('procoreTokens')
                            .doc('system')
                            .set({
                                accessToken: tokenData.accessToken,
                                refreshToken: tokenData.refreshToken,
                                expiresAt: tokenData.expiresAt,
                                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                                setBy: tokenDoc.id,
                                autoSet: true,
                            }, { merge: true });
                        return tokenData.accessToken;
                    } else {
                        // Token is expired, try to refresh it
                        console.log(`Token from user ${tokenDoc.id} is expired, attempting to refresh...`);
                        if (tokenData.refreshToken) {
                            try {
                                const refreshed = await refreshProcoreToken(tokenData.refreshToken);
                                if (refreshed && refreshed.access_token) {
                                    console.log(`Successfully refreshed token for user ${tokenDoc.id}`);
                                    // Update the user's token
                                    const newExpiresAt = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000);
                                    await admin.firestore()
                                        .collection('procoreTokens')
                                        .doc(tokenDoc.id)
                                        .set({
                                            accessToken: refreshed.access_token,
                                            refreshToken: refreshed.refresh_token || tokenData.refreshToken,
                                            expiresAt: admin.firestore.Timestamp.fromDate(newExpiresAt),
                                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                                        }, { merge: true });
                                    
                                    // Also update system token with the refreshed token
                                    await admin.firestore()
                                        .collection('procoreTokens')
                                        .doc('system')
                                        .set({
                                            accessToken: refreshed.access_token,
                                            refreshToken: refreshed.refresh_token || tokenData.refreshToken,
                                            expiresAt: admin.firestore.Timestamp.fromDate(newExpiresAt),
                                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                                            setBy: tokenDoc.id,
                                            autoSet: true,
                                        }, { merge: true });
                                    
                                    console.log(`Using refreshed token from user ${tokenDoc.id} for Procore API calls`);
                                    return refreshed.access_token;
                                }
                            } catch (refreshError: any) {
                                console.error(`Failed to refresh token for user ${tokenDoc.id}:`, {
                                    message: refreshError.message,
                                    status: refreshError.response?.status,
                                });
                                // Continue to next token
                            }
                        }
                    }
                }
                console.log('No valid tokens found from any user, and refresh attempts failed');
            } catch (fallbackError) {
                console.error('Error searching for fallback token:', fallbackError);
                // Continue to return null if fallback search fails
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error getting Procore access token:', error);
        return null;
    }
}

// Helper function to get or refresh token for a specific user/system
async function getTokenForUser(userId: string): Promise<string | null> {
    try {
        // Check if user/system has stored token in Firestore
        const tokenDoc = await admin.firestore()
            .collection('procoreTokens')
            .doc(userId)
            .get();
        
        if (tokenDoc.exists) {
            const tokenData = tokenDoc.data() as ProcoreTokenData | undefined;
            if (!tokenData) {
                return null;
            }
            
            const expiresAt = tokenData.expiresAt?.toDate();
            const now = new Date();
            
            // Check if token is expired (with 5 minute buffer for safety)
            const isExpired = !expiresAt || expiresAt <= new Date(now.getTime() + 5 * 60 * 1000);
            
            // If token is still valid, return it
            if (!isExpired && tokenData.accessToken) {
                console.log(`Token is still valid for ${userId}, returning existing token`);
                console.log('Token expires at:', expiresAt);
                console.log('Current time:', now);
                return tokenData.accessToken;
            }
            
            // Token expired or about to expire, try to refresh
            console.log(`Token expired or expiring soon for ${userId}, attempting refresh...`);
            console.log('Token expires at:', expiresAt);
            console.log('Current time:', now);
            console.log('Is expired?', isExpired);
            console.log('Has refresh token:', !!tokenData.refreshToken);
            
            // Try to refresh if we have a refresh token
            if (tokenData.refreshToken) {
                try {
                    console.log('Calling refreshProcoreToken...');
                    const refreshed = await refreshProcoreToken(tokenData.refreshToken);
                    console.log('Refresh response received:', refreshed ? 'Success' : 'Failed');
                    
                    if (refreshed && refreshed.access_token) {
                        console.log(`Token refresh successful for ${userId}, storing new token`);
                        await admin.firestore()
                            .collection('procoreTokens')
                            .doc(userId)
                            .set({
                                accessToken: refreshed.access_token,
                                refreshToken: refreshed.refresh_token || tokenData.refreshToken,
                                expiresAt: admin.firestore.Timestamp.fromDate(
                                    new Date(Date.now() + (refreshed.expires_in || 3600) * 1000)
                                ),
                                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            }, { merge: true });
                        console.log('New token stored in Firestore');
                        return refreshed.access_token;
                    } else {
                        console.error('Token refresh failed: No access_token in response');
                    }
                } catch (refreshError: any) {
                    console.error('Error refreshing token:', {
                        message: refreshError.message,
                        response: refreshError.response?.data,
                        status: refreshError.response?.status,
                    });
                }
            } else {
                console.error('No refresh token available, cannot refresh');
            }
        }
        
        return null;
    } catch (error) {
        console.error(`Error getting token for ${userId}:`, error);
        return null;
    }
}

// Helper function to refresh Procore token
async function refreshProcoreToken(refreshToken: string): Promise<any> {
    try {
        console.log('Refreshing Procore token...');
        console.log('Using OAuth base URL:', PROCORE_CONFIG.oauthBaseUrl);
        console.log('Using Client ID:', PROCORE_CONFIG.clientId);
        
        const response = await axios.post(
            `${PROCORE_CONFIG.oauthBaseUrl}/oauth/token`,
            {
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: PROCORE_CONFIG.clientId,
                client_secret: PROCORE_CONFIG.clientSecret,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );
        
        console.log('Token refresh successful, received new tokens');
        return response.data;
    } catch (error: any) {
        console.error('Error refreshing Procore token:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
        });
        throw error;
    }
}

// Exchange authorization code for access token
export const procoreExchangeToken = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB',
    })
    .https
    .onCall(async (data, context) => {
        console.log('procoreExchangeToken called with:', { code: data.code ? 'present' : 'missing', userId: context.auth?.uid });
        
        // Verify user is authenticated
        if (!context.auth) {
            console.error('User not authenticated');
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        
        const { code } = data;
        if (!code) {
            console.error('No authorization code provided');
            throw new functions.https.HttpsError('invalid-argument', 'Authorization code is required');
        }
        
        const userId = context.auth.uid;
        
        // Always exchange a new authorization code, even if an old token exists
        // The old token might be invalid for various reasons (wrong credentials, revoked, etc.)
        console.log('Exchanging authorization code for access token...');
        console.log('Using redirect_uri:', PROCORE_CONFIG.redirectUri);
        console.log('Using client_id:', PROCORE_CONFIG.clientId);
        console.log('Using oauth_base_url:', PROCORE_CONFIG.oauthBaseUrl);
        console.log('Authorization code (first 10 chars):', code.substring(0, 10) + '...');
        console.log('Authorization code length:', code.length);
        
        // Check if this code was already used (prevent duplicate exchanges)
        const codeKey = `procore_code_${code.substring(0, 20)}`;
        const codeDoc = await admin.firestore()
            .collection('procoreCodes')
            .doc(codeKey)
            .get();
        
        if (codeDoc.exists) {
            console.error('Authorization code already used');
            throw new functions.https.HttpsError(
                'invalid-argument',
                'This authorization code has already been used. Please start a new authorization flow.'
            );
        }
        
        try {
            const tokenRequest = {
                grant_type: 'authorization_code',
                code: code,
                client_id: PROCORE_CONFIG.clientId,
                client_secret: PROCORE_CONFIG.clientSecret,
                redirect_uri: PROCORE_CONFIG.redirectUri, // Must match exactly what was used in authorization
            };
            
            console.log('Token request (without secret):', {
                grant_type: tokenRequest.grant_type,
                code: tokenRequest.code.substring(0, 10) + '...',
                client_id: tokenRequest.client_id,
                redirect_uri: tokenRequest.redirect_uri,
                client_secret_length: PROCORE_CONFIG.clientSecret?.length || 0,
                client_secret_first_chars: PROCORE_CONFIG.clientSecret?.substring(0, 5) + '...',
            });
            
            const response = await axios.post(
                `${PROCORE_CONFIG.oauthBaseUrl}/oauth/token`,
                tokenRequest,
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );
            
            console.log('Token exchange successful, response received');
            const tokenData = response.data;
            
            console.log('Token response keys:', Object.keys(tokenData));
            console.log('Token expires_in:', tokenData.expires_in);
            console.log('Token type:', tokenData.token_type);
            console.log('Has access_token:', !!tokenData.access_token);
            console.log('Has refresh_token:', !!tokenData.refresh_token);
            
            // Mark this code as used (expires in 10 minutes)
            await admin.firestore()
                .collection('procoreCodes')
                .doc(codeKey)
                .set({
                    used: true,
                    userId: userId,
                    usedAt: admin.firestore.FieldValue.serverTimestamp(),
                    expiresAt: admin.firestore.Timestamp.fromDate(
                        new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
                    ),
                });
            
            console.log('Storing token in Firestore for user:', userId);
            
            // Calculate expiration time
            const expiresIn = tokenData.expires_in || 3600;
            const expiresAt = new Date(Date.now() + expiresIn * 1000);
            console.log('Token will expire at:', expiresAt.toISOString());
            
            // Store token in Firestore for user
            await admin.firestore()
                .collection('procoreTokens')
                .doc(userId)
                .set({
                    accessToken: tokenData.access_token,
                    refreshToken: tokenData.refresh_token,
                    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            
            // Always update system token for shared access (so all users can use Procore API)
            // This ensures that even if the system token expired, it gets refreshed when any user authorizes
            console.log('Updating system token for shared access...');
            await admin.firestore()
                .collection('procoreTokens')
                .doc('system')
                .set({
                    accessToken: tokenData.access_token,
                    refreshToken: tokenData.refresh_token,
                    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    setBy: userId,
                    setAt: admin.firestore.FieldValue.serverTimestamp(),
                    autoSet: true,
                }, { merge: true });
            console.log('System token updated for shared access - all users can now use Procore API');
            
            console.log('Token stored successfully in Firestore');
            return { success: true, message: 'Token stored successfully' };
        } catch (error: any) {
            console.error('Error exchanging Procore token:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
            });
            throw new functions.https.HttpsError(
                'internal',
                error.response?.data?.error_description || error.message || 'Failed to exchange token'
            );
        }
    });

// Clear all Procore tokens (for debugging/reset)
export const procoreClearTokens = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB',
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        
        const userId = context.auth.uid;
        
        try {
            // Delete user's token
            await admin.firestore()
                .collection('procoreTokens')
                .doc(userId)
                .delete();
            
            console.log('Cleared Procore token for user:', userId);
            return { success: true, message: 'Token cleared successfully' };
        } catch (error: any) {
            console.error('Error clearing token:', error);
            throw new functions.https.HttpsError('internal', 'Failed to clear token');
        }
    });

// Copy current user's Procore token to system token (for shared access)
// This allows all users to use Procore API even if they haven't authorized individually
export const procoreSetSystemToken = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB',
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        
        const userId = context.auth.uid;
        
        try {
            // Get user's token
            const userTokenDoc = await admin.firestore()
                .collection('procoreTokens')
                .doc(userId)
                .get();
            
            if (!userTokenDoc.exists) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'You must authorize Procore first before setting it as system token'
                );
            }
            
            const userTokenData = userTokenDoc.data() as ProcoreTokenData | undefined;
            if (!userTokenData || !userTokenData.accessToken) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'No valid token found. Please authorize Procore first.'
                );
            }
            
            // Copy user's token to system token
            await admin.firestore()
                .collection('procoreTokens')
                .doc('system')
                .set({
                    accessToken: userTokenData.accessToken,
                    refreshToken: userTokenData.refreshToken,
                    expiresAt: userTokenData.expiresAt,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    setBy: userId,
                    setAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            
            console.log('System token set successfully by user:', userId);
            return { 
                success: true, 
                message: 'System token set successfully. All users can now use Procore API.' 
            };
        } catch (error: any) {
            console.error('Error setting system token:', error);
            if (error instanceof functions.https.HttpsError) {
                throw error;
            }
            throw new functions.https.HttpsError('internal', 'Failed to set system token');
        }
    });

// Simple connection test - just verify token works with a minimal API call
export const procoreTestConnection = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB',
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        
        const userId = context.auth.uid;
        const accessToken = await getProcoreAccessToken(userId);
        
        if (!accessToken) {
            return { 
                connected: false, 
                message: 'No valid Procore access token. Please authorize the application.' 
            };
        }
        
        // TEMPORARY: Test project templates endpoint first
        // TODO: Remove this once procoreGetProjectTemplates is deployed
        const templatesUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/project_templates`;
        console.log('🔍 [v2] Testing project templates endpoint:', templatesUrl);
        console.log('🔍 [v2] Using access token (first 20 chars):', accessToken ? accessToken.substring(0, 20) : 'null');
        console.log('🔍 [v2] Company ID:', PROCORE_CONFIG.companyId);
        
        try {
            const templatesResponse = await axios.get(templatesUrl, {
                params: {
                    company_id: PROCORE_CONFIG.companyId,
                    page: 1,
                    per_page: 100,
                },
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Procore-Company-Id': PROCORE_CONFIG.companyId,
                },
            });
            console.log('✅ [v2] Project Templates Test - Status:', templatesResponse.status);
            console.log('✅ [v2] Project Templates Test - Full response:', JSON.stringify(templatesResponse.data, null, 2));
            
            // Procore API typically returns {data: [...]} or just [...]
            const templatesData = templatesResponse.data?.data || templatesResponse.data || [];
            const templatesArray = Array.isArray(templatesData) ? templatesData : [];
            
            console.log('✅ [v2] Project Templates Test - Extracted templates array length:', templatesArray.length);
            
            return {
                connected: true,
                message: 'Successfully connected to Procore and fetched templates [v2]',
                templates: templatesArray, // TEMPORARY: Include templates in response
                templatesCount: templatesArray.length,
                success: true,
                data: templatesArray,
            };
        } catch (templatesError: any) {
            console.error('❌ [v2] Templates test failed:', {
                message: templatesError.message,
                status: templatesError.response?.status,
                statusText: templatesError.response?.statusText,
                data: templatesError.response?.data,
                url: templatesUrl,
            });
            // Return error info so we can debug - don't fall through
            return {
                connected: true,
                message: 'Connected to Procore but templates API failed [v2]',
                templatesError: templatesError.response?.data || templatesError.message,
                templatesStatus: templatesError.response?.status,
                success: false,
                data: [],
                errorDetails: {
                    message: templatesError.message,
                    status: templatesError.response?.status,
                    statusText: templatesError.response?.statusText,
                    data: templatesError.response?.data,
                    url: templatesUrl,
                },
            };
        }
    });

// Check if user has a Procore token (without making API calls)
export const procoreCheckToken = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB',
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        
        const userId = context.auth.uid;
        
        try {
            // Just check if token document exists in Firestore
            const tokenDoc = await admin.firestore()
                .collection('procoreTokens')
                .doc(userId)
                .get();
            
            if (!tokenDoc.exists) {
                return { hasToken: false, message: 'No token found' };
            }
            
            const tokenData = tokenDoc.data() as ProcoreTokenData | undefined;
            const hasAccessToken = !!tokenData?.accessToken;
            const hasRefreshToken = !!tokenData?.refreshToken;
            
            // Check if token is expired
            const expiresAt = tokenData?.expiresAt?.toDate();
            const now = new Date();
            const isExpired = !expiresAt || expiresAt <= now;
            
            return {
                hasToken: hasAccessToken,
                hasRefreshToken: hasRefreshToken,
                isExpired: isExpired,
                expiresAt: expiresAt?.toISOString(),
                message: hasAccessToken 
                    ? (isExpired ? 'Token exists but is expired' : 'Token exists and is valid')
                    : 'Token document exists but no access token'
            };
        } catch (error: any) {
            console.error('Error checking token:', error);
            throw new functions.https.HttpsError('internal', 'Failed to check token');
        }
    });

// Get Procore authorization URL
export const procoreGetAuthUrl = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB',
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        
        const state = context.auth.uid; // Use user ID as state for security
        
        // Note: Procore doesn't use explicit scope parameters in OAuth URL
        // Permissions are controlled by the user's account permissions in Procore itself
        // The OAuth app just needs to be authorized - access depends on what the user can see in Procore UI
        const authUrl = `${PROCORE_CONFIG.oauthBaseUrl}/oauth/authorize?` +
            `client_id=${PROCORE_CONFIG.clientId}&` +
            `redirect_uri=${encodeURIComponent(PROCORE_CONFIG.redirectUri)}&` +
            `response_type=code&` +
            `state=${state}`;
        
        console.log('Generated Procore OAuth URL:', authUrl);
        console.log('Using Client ID:', PROCORE_CONFIG.clientId);
        console.log('Using Redirect URI:', PROCORE_CONFIG.redirectUri);
        
        return { authUrl };
    });

// Get projects from Procore
export const procoreGetProjects = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB',
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        
        const userId = context.auth.uid;
        const accessToken = await getProcoreAccessToken(userId);
        
        if (!accessToken) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'No valid Procore access token. Please authorize the application.'
            );
        }
        
        try {
            // Procore REST API endpoint format: /rest/v1.0/companies/{company_id}/projects
            // Base URL: https://sandbox.procore.com (for sandbox) or https://api.procore.com (for production)
            // The company_id is both in the URL path AND in the Procore-Company-Id header
            const apiUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects`;
            console.log('Fetching projects from:', apiUrl);
            console.log('Using Company ID:', PROCORE_CONFIG.companyId);
            console.log('API Base URL:', PROCORE_CONFIG.apiBaseUrl);
            
            let response = await axios.get(
                apiUrl,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Procore-Company-Id': PROCORE_CONFIG.companyId,
                    },
                }
            );
            
            // If we get 401, try to refresh the token and retry once
            if (response.status === 401) {
                console.log('Got 401, attempting to refresh token...');
                const refreshedToken = await getProcoreAccessToken(userId);
                if (refreshedToken && refreshedToken !== accessToken) {
                    console.log('Token refreshed, retrying request...');
                    response = await axios.get(
                        apiUrl,
                        {
                            headers: {
                                'Authorization': `Bearer ${refreshedToken}`,
                                'Procore-Company-Id': PROCORE_CONFIG.companyId,
                            },
                        }
                    );
                }
            }
            
            console.log('Projects API response status:', response.status);
            console.log('Projects data received:', Array.isArray(response.data) ? `${response.data.length} projects` : 'Not an array');
            
            return { success: true, data: response.data };
        } catch (error: any) {
            const attemptedUrl = error.config?.url || 'unknown';
            const errorStatus = error.response?.status;
            
            console.error('Error fetching Procore projects:', {
                message: error.message,
                status: errorStatus,
                statusText: error.response?.statusText,
                url: attemptedUrl,
                responseData: error.response?.data,
            });
            
            // If 401, try to refresh token and retry
            if (errorStatus === 401) {
                console.log('401 error detected, attempting to refresh token and retry...');
                try {
                    // Force refresh by getting token again (it will check expiration and refresh if needed)
                    const refreshedToken = await getProcoreAccessToken(userId);
                    console.log('Refreshed token obtained:', refreshedToken ? 'Yes' : 'No');
                    console.log('Is new token different?', refreshedToken && refreshedToken !== accessToken);
                    
                    if (refreshedToken && refreshedToken !== accessToken) {
                        console.log('Token refreshed successfully, retrying request with new token...');
                        const retryResponse = await axios.get(
                            attemptedUrl,
                            {
                                headers: {
                                    'Authorization': `Bearer ${refreshedToken}`,
                                    'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                },
                            }
                        );
                        console.log('Retry successful! Status:', retryResponse.status);
                        return { success: true, data: retryResponse.data };
                    } else {
                        console.error('Token refresh did not return a new token. Refresh token may be expired. User needs to re-authorize.');
                    }
                } catch (retryError: any) {
                    console.error('Retry after token refresh failed:', {
                        message: retryError.message,
                        status: retryError.response?.status,
                        data: retryError.response?.data,
                    });
                }
            }
            
            throw new functions.https.HttpsError(
                'internal',
                error.response?.data?.errors || error.response?.data?.error_description || error.response?.data?.message || error.message || 'Failed to fetch projects'
            );
        }
    });

// Get project templates from Procore (for testing/listing available templates)
export const procoreGetProjectTemplates = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB',
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        
        const userId = context.auth.uid;
        const accessToken = await getProcoreAccessToken(userId);
        
        if (!accessToken) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'No valid Procore access token. Please authorize the application.'
            );
        }
        
        const { page = 1, per_page = 100 } = data || {};
        
        try {
            // Procore API endpoint: GET /rest/v1.0/project_templates
            const apiUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/project_templates`;
            console.log('Fetching project templates from:', apiUrl);
            console.log('Using Company ID:', PROCORE_CONFIG.companyId);
            
            let response = await axios.get(
                apiUrl,
                {
                    params: {
                        company_id: PROCORE_CONFIG.companyId,
                        page: page,
                        per_page: per_page,
                    },
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Procore-Company-Id': PROCORE_CONFIG.companyId,
                    },
                }
            );
            
            // If we get 401, try to refresh the token and retry once
            if (response.status === 401) {
                console.log('Got 401, attempting to refresh token...');
                const refreshedToken = await getProcoreAccessToken(userId);
                if (refreshedToken && refreshedToken !== accessToken) {
                    console.log('Token refreshed, retrying request...');
                    response = await axios.get(
                        apiUrl,
                        {
                            params: {
                                company_id: PROCORE_CONFIG.companyId,
                                page: page,
                                per_page: per_page,
                            },
                            headers: {
                                'Authorization': `Bearer ${refreshedToken}`,
                                'Procore-Company-Id': PROCORE_CONFIG.companyId,
                            },
                        }
                    );
                }
            }
            
            console.log('Project templates API response status:', response.status);
            console.log('Templates data received:', Array.isArray(response.data) ? `${response.data.length} templates` : 'Not an array');
            console.log('Templates:', JSON.stringify(response.data, null, 2));
            
            // Extract pagination info from headers if available
            const perPage = response.headers['per-page'] ? parseInt(response.headers['per-page']) : null;
            const total = response.headers['total'] ? parseInt(response.headers['total']) : null;
            const link = response.headers['link'] || null;
            
            return { 
                success: true, 
                data: response.data,
                pagination: {
                    perPage,
                    total,
                    link,
                }
            };
        } catch (error: any) {
            const attemptedUrl = error.config?.url || 'unknown';
            const errorStatus = error.response?.status;
            
            console.error('Error fetching Procore project templates:', {
                message: error.message,
                status: errorStatus,
                statusText: error.response?.statusText,
                url: attemptedUrl,
                responseData: error.response?.data,
            });
            
            // If 401, try to refresh token and retry
            if (errorStatus === 401) {
                console.log('401 error detected, attempting to refresh token and retry...');
                try {
                    const refreshedToken = await getProcoreAccessToken(userId);
                    console.log('Refreshed token obtained:', refreshedToken ? 'Yes' : 'No');
                    
                    if (refreshedToken && refreshedToken !== accessToken) {
                        console.log('Token refreshed successfully, retrying request with new token...');
                        const retryResponse = await axios.get(
                            attemptedUrl,
                            {
                                params: {
                                    company_id: PROCORE_CONFIG.companyId,
                                    page: page,
                                    per_page: per_page,
                                },
                                headers: {
                                    'Authorization': `Bearer ${refreshedToken}`,
                                    'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                },
                            }
                        );
                        console.log('Retry successful! Status:', retryResponse.status);
                        return { 
                            success: true, 
                            data: retryResponse.data,
                            pagination: {
                                perPage: retryResponse.headers['per-page'] ? parseInt(retryResponse.headers['per-page']) : null,
                                total: retryResponse.headers['total'] ? parseInt(retryResponse.headers['total']) : null,
                                link: retryResponse.headers['link'] || null,
                            }
                        };
                    } else {
                        console.error('Token refresh did not return a new token. Refresh token may be expired. User needs to re-authorize.');
                    }
                } catch (retryError: any) {
                    console.error('Retry after token refresh failed:', {
                        message: retryError.message,
                        status: retryError.response?.status,
                        data: retryError.response?.data,
                    });
                }
            }
            
            throw new functions.https.HttpsError(
                'internal',
                error.response?.data?.errors || error.response?.data?.error_description || error.response?.data?.message || error.message || 'Failed to fetch project templates'
            );
        }
    });

// Create project in Procore
export const procoreCreateProject = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB',
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        
        const userId = context.auth.uid;
        // Use system token fallback so all users can create projects
        const accessToken = await getProcoreAccessToken(userId, true);
        
        if (!accessToken) {
            // Check if system token exists
            const systemTokenDoc = await admin.firestore()
                .collection('procoreTokens')
                .doc('system')
                .get();
            
            let errorMessage = 'No valid Procore access token. Please authorize the application.';
            if (!systemTokenDoc.exists) {
                errorMessage += ' The system token has not been set. Please have an administrator authorize Procore first.';
            } else {
                errorMessage += ' All tokens appear to be expired. Please have an administrator re-authorize Procore.';
            }
            
            console.error('No access token available for user:', userId);
            console.error('System token exists:', systemTokenDoc.exists);
            
            throw new functions.https.HttpsError(
                'unauthenticated',
                errorMessage
            );
        }
        
        const { projectData } = data;
        if (!projectData) {
            throw new functions.https.HttpsError('invalid-argument', 'Project data is required');
        }

        // Wrap project data per Procore API spec:
        // POST /rest/v1.0/projects
        // {
        //   "company_id": <company_id>,
        //   "project": { ... }
        // }
        const apiUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/projects`;
        const payload = {
            company_id: Number(PROCORE_CONFIG.companyId),
            project: projectData,
        };
        
        try {
            console.log('Creating project in Procore:', apiUrl);
            console.log('Payload:', JSON.stringify(payload, null, 2));
            
            let response = await axios.post(
                apiUrl,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Procore-Company-Id': PROCORE_CONFIG.companyId,
                        'Content-Type': 'application/json',
                    },
                }
            );
            
            // If we get 401, try to refresh the token and retry once
            if (response.status === 401) {
                console.log('Got 401, attempting to refresh token...');
                const refreshedToken = await getProcoreAccessToken(userId);
                if (refreshedToken && refreshedToken !== accessToken) {
                    console.log('Token refreshed, retrying request...');
                    response = await axios.post(
                        apiUrl,
                        payload,
                        {
                            headers: {
                                'Authorization': `Bearer ${refreshedToken}`,
                                'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                'Content-Type': 'application/json',
                            },
                        }
                    );
                }
            }
            
            console.log('Project created successfully in Procore. Status:', response.status);
            console.log('Procore project data:', JSON.stringify(response.data, null, 2));
            
            // The project template (Standard Project Template) will handle default permissions
            // Anyone assigned to the project in Procore will get the template's default admin permissions
            return { 
                success: true, 
                data: response.data,
                procoreProjectId: response.data?.id 
            };
        } catch (error: any) {
            const attemptedUrl = error.config?.url || apiUrl;
            const errorStatus = error.response?.status;
            const errorData = error.response?.data;
            
            console.error('Error creating project in Procore:', {
                message: error.message,
                status: errorStatus,
                statusText: error.response?.statusText,
                url: attemptedUrl,
                responseData: errorData,
            });
            
            // If 401, try to refresh token and retry
            if (errorStatus === 401) {
                console.log('401 error detected, attempting to refresh token and retry...');
                try {
                    const refreshedToken = await getProcoreAccessToken(userId);
                    if (refreshedToken && refreshedToken !== accessToken) {
                        console.log('Token refreshed successfully, retrying request with new token...');
                        const retryResponse = await axios.post(
                            attemptedUrl,
                            payload,
                            {
                                headers: {
                                    'Authorization': `Bearer ${refreshedToken}`,
                                    'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                    'Content-Type': 'application/json',
                                },
                            }
                        );
                        console.log('Retry successful! Status:', retryResponse.status);
                        return { 
                            success: true, 
                            data: retryResponse.data,
                            procoreProjectId: retryResponse.data?.id 
                        };
                    }
                } catch (retryError: any) {
                    console.error('Retry after token refresh failed:', {
                        message: retryError.message,
                        status: retryError.response?.status,
                        data: retryError.response?.data,
                    });
                }
            }
            
            // Build a detailed error message
            let errorMessage = 'Failed to create project in Procore';
            
            if (errorData) {
                // Try to extract meaningful error messages
                if (errorData.errors && typeof errorData.errors === 'object') {
                    const errorMessages = Object.entries(errorData.errors)
                        .map(([key, value]) => {
                            if (Array.isArray(value)) {
                                return `${key}: ${value.join(', ')}`;
                            }
                            return `${key}: ${value}`;
                        })
                        .join('; ');
                    if (errorMessages) errorMessage = errorMessages;
                } else if (errorData.error_description) {
                    errorMessage = errorData.error_description;
                } else if (errorData.message) {
                    errorMessage = errorData.message;
                } else if (typeof errorData === 'string') {
                    errorMessage = errorData;
                }
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            // Add status code if available
            if (errorStatus) {
                errorMessage = `[HTTP ${errorStatus}] ${errorMessage}`;
            }
            
            console.error('Final error message:', errorMessage);
            
            // Return error details for frontend handling
            throw new functions.https.HttpsError(
                'internal',
                errorMessage
            );
        }
    });

// Update a single project in Procore via PATCH /rest/v1.0/projects/{id}
// This is more reliable than the Sync endpoint when we have a procoreProjectId
export const procoreUpdateProject = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB',
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const userId = context.auth.uid;
        // Use system token fallback so all users can update projects
        const accessToken = await getProcoreAccessToken(userId, true);

        if (!accessToken) {
            // Check if system token exists
            const systemTokenDoc = await admin.firestore()
                .collection('procoreTokens')
                .doc('system')
                .get();
            
            let errorMessage = 'No valid Procore access token. Please authorize the application.';
            if (!systemTokenDoc.exists) {
                errorMessage += ' The system token has not been set. Please have an administrator authorize Procore first.';
            } else {
                errorMessage += ' All tokens appear to be expired. Please have an administrator re-authorize Procore.';
            }
            
            console.error('No access token available for user:', userId);
            console.error('System token exists:', systemTokenDoc.exists);
            
            throw new functions.https.HttpsError(
                'unauthenticated',
                errorMessage
            );
        }

        const { projectId, projectData } = data as { projectId: number | string; projectData: any };
        if (!projectId) {
            throw new functions.https.HttpsError('invalid-argument', 'projectId is required');
        }
        if (!projectData || typeof projectData !== 'object') {
            throw new functions.https.HttpsError('invalid-argument', 'projectData is required');
        }

        const apiUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/projects/${projectId}`;
        const companyId = Number(PROCORE_CONFIG.companyId);

        // Structure per Procore API: { company_id, project: { ... } }
        const payload = {
            company_id: companyId,
            project: projectData,
        };

        try {
            console.log(`Updating project ${projectId} in Procore via PATCH /projects/{id}`);
            console.log('Payload:', JSON.stringify(payload, null, 2));

            let response = await axios.patch(
                apiUrl,
                payload,
                {
                    params: {
                        run_configurable_validations: false,
                    },
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Procore-Company-Id': PROCORE_CONFIG.companyId,
                        'Content-Type': 'application/json',
                    },
                }
            );

            // Handle 401 with a single retry after token refresh
            if (response.status === 401) {
                console.log('Got 401 on update, attempting to refresh token...');
                const refreshedToken = await getProcoreAccessToken(userId);
                if (refreshedToken && refreshedToken !== accessToken) {
                    console.log('Token refreshed, retrying PATCH /projects/{id} request...');
                    response = await axios.patch(
                        apiUrl,
                        payload,
                        {
                            params: {
                                run_configurable_validations: false,
                            },
                            headers: {
                                'Authorization': `Bearer ${refreshedToken}`,
                                'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                'Content-Type': 'application/json',
                            },
                        }
                    );
                }
            }

            console.log('Project updated successfully. Status:', response.status);
            return {
                success: true,
                data: response.data,
            };
        } catch (error: any) {
            const attemptedUrl = error.config?.url || apiUrl;
            const errorStatus = error.response?.status;
            const errorData = error.response?.data;

            console.error('Error updating project in Procore:', {
                message: error.message,
                status: errorStatus,
                statusText: error.response?.statusText,
                url: attemptedUrl,
                responseData: errorData,
            });

            // Build detailed error message
            let errorMessage = 'Failed to update project';
            
            if (errorData) {
                // Try to extract meaningful error messages
                if (errorData.errors && typeof errorData.errors === 'object') {
                    const errorMessages = Object.entries(errorData.errors)
                        .map(([key, value]) => {
                            if (Array.isArray(value)) {
                                return `${key}: ${value.join(', ')}`;
                            }
                            return `${key}: ${value}`;
                        })
                        .join('; ');
                    if (errorMessages) errorMessage = errorMessages;
                } else if (errorData.error_description) {
                    errorMessage = errorData.error_description;
                } else if (errorData.message) {
                    errorMessage = errorData.message;
                } else if (typeof errorData === 'string') {
                    errorMessage = errorData;
                }
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            // Add status code if available
            if (errorStatus) {
                errorMessage = `[HTTP ${errorStatus}] ${errorMessage}`;
            }
            
            console.error('Final update error message:', errorMessage);

            throw new functions.https.HttpsError(
                'internal',
                errorMessage
            );
        }
    });

// Sync (create/update) projects in Procore via /rest/v1.0/projects/sync
// Used as fallback for projects without procoreProjectId (using origin_id)
export const procoreSyncProjects = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB',
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const userId = context.auth.uid;
        // Use system token fallback so all users can sync projects
        const accessToken = await getProcoreAccessToken(userId, true);

        if (!accessToken) {
            // Check if system token exists
            const systemTokenDoc = await admin.firestore()
                .collection('procoreTokens')
                .doc('system')
                .get();
            
            let errorMessage = 'No valid Procore access token. Please authorize the application.';
            if (!systemTokenDoc.exists) {
                errorMessage += ' The system token has not been set. Please have an administrator authorize Procore first.';
            } else {
                errorMessage += ' All tokens appear to be expired. Please have an administrator re-authorize Procore.';
            }
            
            console.error('No access token available for user:', userId);
            console.error('System token exists:', systemTokenDoc.exists);
            
            throw new functions.https.HttpsError(
                'unauthenticated',
                errorMessage
            );
        }

        const { updates } = data as { updates: any[] };
        if (!Array.isArray(updates) || updates.length === 0) {
            throw new functions.https.HttpsError('invalid-argument', 'At least one update is required');
        }

        const apiUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/projects/sync`;
        const companyId = Number(PROCORE_CONFIG.companyId);

        const payload = {
            company_id: companyId,
            updates,
        };

        try {
            console.log('Syncing projects in Procore via /projects/sync');
            console.log('Payload:', JSON.stringify(payload, null, 2));

            let response = await axios.patch(
                apiUrl,
                payload,
                {
                    params: {
                        company_id: companyId,
                    },
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Procore-Company-Id': PROCORE_CONFIG.companyId,
                        'Content-Type': 'application/json',
                    },
                }
            );

            // Handle 401 with a single retry after token refresh
            if (response.status === 401) {
                console.log('Got 401 on sync, attempting to refresh token...');
                const refreshedToken = await getProcoreAccessToken(userId);
                if (refreshedToken && refreshedToken !== accessToken) {
                    console.log('Token refreshed, retrying /projects/sync request...');
                    response = await axios.patch(
                        apiUrl,
                        payload,
                        {
                            params: {
                                company_id: companyId,
                            },
                            headers: {
                                'Authorization': `Bearer ${refreshedToken}`,
                                'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                'Content-Type': 'application/json',
                            },
                        }
                    );
                }
            }

            console.log('Projects synced successfully. Status:', response.status);
            return {
                success: true,
                data: response.data,
            };
        } catch (error: any) {
            const attemptedUrl = error.config?.url || apiUrl;
            const errorStatus = error.response?.status;
            const errorData = error.response?.data;

            console.error('Error syncing projects in Procore:', {
                message: error.message,
                status: errorStatus,
                statusText: error.response?.statusText,
                url: attemptedUrl,
                responseData: errorData,
            });

            // Build detailed error message
            let errorMessage = 'Failed to sync projects';
            
            if (errorData) {
                // Try to extract meaningful error messages
                if (errorData.errors && typeof errorData.errors === 'object') {
                    const errorMessages = Object.entries(errorData.errors)
                        .map(([key, value]) => {
                            if (Array.isArray(value)) {
                                return `${key}: ${value.join(', ')}`;
                            }
                            return `${key}: ${value}`;
                        })
                        .join('; ');
                    if (errorMessages) errorMessage = errorMessages;
                } else if (errorData.error_description) {
                    errorMessage = errorData.error_description;
                } else if (errorData.message) {
                    errorMessage = errorData.message;
                } else if (typeof errorData === 'string') {
                    errorMessage = errorData;
                }
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            // Add status code if available
            if (errorStatus) {
                errorMessage = `[HTTP ${errorStatus}] ${errorMessage}`;
            }
            
            console.error('Final sync error message:', errorMessage);

            throw new functions.https.HttpsError(
                'internal',
                errorMessage
            );
        }
    });

// Get a single project from Procore by its Procore project ID
export const procoreGetProject = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB',
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const userId = context.auth.uid;
        // Use system token fallback so all users can get project data
        const accessToken = await getProcoreAccessToken(userId, true);

        if (!accessToken) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'No valid Procore access token. Please authorize the application.'
            );
        }

        const { procoreProjectId } = data as { procoreProjectId: number | string };
        if (!procoreProjectId) {
            throw new functions.https.HttpsError('invalid-argument', 'procoreProjectId is required');
        }

        const projectId = Number(procoreProjectId);
        if (Number.isNaN(projectId)) {
            throw new functions.https.HttpsError('invalid-argument', 'procoreProjectId must be a number');
        }

        const apiUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/projects/${projectId}`;

        try {
            console.log('Fetching project from Procore:', apiUrl);

            let response = await axios.get(apiUrl, {
                params: {
                    company_id: PROCORE_CONFIG.companyId,
                },
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Procore-Company-Id': PROCORE_CONFIG.companyId,
                },
            });

            if (response.status === 401) {
                console.log('Got 401 when fetching project, attempting token refresh...');
                const refreshedToken = await getProcoreAccessToken(userId);
                if (refreshedToken && refreshedToken !== accessToken) {
                    console.log('Token refreshed, retrying GET project...');
                    response = await axios.get(apiUrl, {
                        params: {
                            company_id: PROCORE_CONFIG.companyId,
                        },
                        headers: {
                            'Authorization': `Bearer ${refreshedToken}`,
                            'Procore-Company-Id': PROCORE_CONFIG.companyId,
                        },
                    });
                }
            }

            console.log('Fetched project from Procore. Status:', response.status);
            return {
                success: true,
                data: response.data,
            };
        } catch (error: any) {
            const attemptedUrl = error.config?.url || apiUrl;
            const errorStatus = error.response?.status;
            const errorData = error.response?.data;

            console.error('Error fetching project from Procore:', {
                message: error.message,
                status: errorStatus,
                statusText: error.response?.statusText,
                url: attemptedUrl,
                responseData: errorData,
            });

            throw new functions.https.HttpsError(
                'internal',
                errorData?.errors || errorData?.error_description || errorData?.message || error.message || 'Failed to fetch project from Procore'
            );
        }
    });

// Search for a Procore project by project_number
// This is used to find existing projects in Procore before creating duplicates
export const procoreSearchProjectByNumber = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB',
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const userId = context.auth.uid;
        const accessToken = await getProcoreAccessToken(userId, true);

        if (!accessToken) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'No valid Procore access token. Please authorize the application.'
            );
        }

        const { projectNumber } = data as { projectNumber: string | number };
        if (!projectNumber) {
            throw new functions.https.HttpsError('invalid-argument', 'projectNumber is required');
        }

        const projectNumberStr = String(projectNumber).trim();
        if (!projectNumberStr) {
            throw new functions.https.HttpsError('invalid-argument', 'projectNumber cannot be empty');
        }

        try {
            console.log(`🔍 Searching Procore for project with project_number: "${projectNumberStr}"`);

            // Fetch all projects from Procore and search by project_number
            const apiUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects`;
            
            let response = await axios.get(apiUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Procore-Company-Id': PROCORE_CONFIG.companyId,
                },
            });

            if (response.status === 401) {
                console.log('Got 401, attempting token refresh...');
                const refreshedToken = await getProcoreAccessToken(userId, true);
                if (refreshedToken && refreshedToken !== accessToken) {
                    response = await axios.get(apiUrl, {
                        headers: {
                            'Authorization': `Bearer ${refreshedToken}`,
                            'Procore-Company-Id': PROCORE_CONFIG.companyId,
                        },
                    });
                }
            }

            const allProjects = Array.isArray(response.data) ? response.data : [];
            console.log(`📊 Found ${allProjects.length} total projects in Procore`);

            // Search for matching project_number (case-insensitive, trim whitespace)
            const matchingProject = allProjects.find((p: any) => {
                const procoreProjectNumber = p.project_number ? String(p.project_number).trim() : '';
                return procoreProjectNumber.toLowerCase() === projectNumberStr.toLowerCase();
            });

            if (matchingProject) {
                console.log(`✅ Found matching project in Procore:`, {
                    id: matchingProject.id,
                    name: matchingProject.name,
                    project_number: matchingProject.project_number,
                });
                return {
                    success: true,
                    found: true,
                    project: matchingProject,
                };
            } else {
                console.log(`❌ No project found in Procore with project_number: "${projectNumberStr}"`);
                return {
                    success: true,
                    found: false,
                    project: null,
                };
            }
        } catch (error: any) {
            console.error('Error searching Procore project by number:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
            });

            throw new functions.https.HttpsError(
                'internal',
                error.response?.data?.errors || error.response?.data?.error_description || error.response?.data?.message || error.message || 'Failed to search Procore project'
            );
        }
    });

// Sync all linked projects from Procore to Bolt
// This function fetches all projects from Firebase that have procoreProjectId,
// then fetches each from Procore and updates Firebase with Procore data
export const procoreSyncAllProjectsToBolt = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 540, // 9 minutes (max for HTTP functions)
        memory: '512MB',
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const userId = context.auth.uid;
        // Use system token fallback so all users can sync projects
        const accessToken = await getProcoreAccessToken(userId, true);

        if (!accessToken) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'No valid Procore access token. Please authorize the application.'
            );
        }

        try {
            // Fetch only linked projects from Firebase
            const projectsRef = admin.firestore().collection('projects');
            const projectsSnapshot = await projectsRef.where('procoreProjectId', '!=', null).get();
            const projects = projectsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as Array<{ 
                id: string; 
                procoreProjectId?: number | string; 
                [key: string]: any 
            }>;

            if (projects.length === 0) {
                return {
                    success: true,
                    syncedCount: 0,
                    errorCount: 0,
                    totalProjects: 0,
                    errors: [],
                    errorDetails: null,
                    message: 'No projects linked to Procore found.',
                };
            }

            let syncedCount = 0;
            let errorCount = 0;
            const errors: Array<{ projectId: string; projectName: string; error: string }> = [];

            // Process projects in batches to avoid timeout and rate limits
            const batchSize = 10;
            for (let i = 0; i < projects.length; i += batchSize) {
                const batch = projects.slice(i, i + batchSize);
                
                await Promise.all(
                    batch.map(async (project) => {
                        let apiUrl = ''; // Declare outside try block for error logging
                        try {
                            const procoreProjectId = project.procoreProjectId;
                            if (!procoreProjectId) return;

                            // Ensure project ID is a number (Procore API requires integer)
                            const projectIdNum = Number(procoreProjectId);
                            if (Number.isNaN(projectIdNum)) {
                                throw new Error(`Invalid Procore project ID: ${procoreProjectId} (must be a number)`);
                            }

                            // Try v2.0 endpoint first (more modern format)
                            // Format: /rest/v2.0/companies/{company_id}/projects/{project_id}
                            apiUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${projectIdNum}`;
                            let response;
                            
                            try {
                                response = await retryWithBackoff(async () => {
                                    return await axios.get(apiUrl, {
                                        headers: {
                                            'Authorization': `Bearer ${accessToken}`,
                                            'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                        },
                                    });
                                });
                            } catch (v2Error: any) {
                                // If v2.0 fails with 404 or 400, try v1.0 format
                                if (v2Error?.response?.status === 404 || v2Error?.response?.status === 400) {
                                    console.log(`v2.0 endpoint failed for project ${projectIdNum}, trying v1.0 format...`);
                                    // Fallback to v1.0 endpoint format
                                    apiUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/projects/${projectIdNum}`;
                                    response = await retryWithBackoff(async () => {
                                        return await axios.get(apiUrl, {
                                            params: {
                                                company_id: PROCORE_CONFIG.companyId,
                                            },
                                            headers: {
                                                'Authorization': `Bearer ${accessToken}`,
                                                'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                            },
                                        });
                                    });
                                } else {
                                    throw v2Error;
                                }
                            }

                            const procoreData = response.data;

                            // Map Procore data to Bolt format (inline mapping)
                            const mapped: any = {};
                            
                            // Basic project info
                            if (procoreData.name !== undefined) mapped.ProjectName = procoreData.name || '';
                            if (procoreData.project_number !== undefined) mapped.ProjectNumber = procoreData.project_number || '';
                            if (procoreData.address !== undefined) mapped.address = procoreData.address || '';
                            if (procoreData.city !== undefined) mapped.city = procoreData.city || '';
                            if (procoreData.state_code !== undefined) mapped.State = procoreData.state_code || '';
                            if (procoreData.zip !== undefined) mapped.zip = procoreData.zip || '';
                            
                            // Helper function to normalize dates and prevent timezone shifts
                            // Procore sends dates as YYYY-MM-DD strings. When JavaScript's Date() parses these,
                            // it treats them as UTC midnight, which can shift the date back a day in local timezones.
                            // By appending 'T12:00:00' (without timezone), JavaScript will interpret it as local time.
                            const normalizeDate = (dateStr: string | null | undefined): string | null => {
                                if (!dateStr) return null;
                                if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                                    return `${dateStr}T12:00:00`;
                                }
                                return dateStr;
                            };
                            
                            // Dates - main project dates (normalized to prevent timezone shifts)
                            if (procoreData.start_date !== undefined) mapped.StartDate = normalizeDate(procoreData.start_date);
                            if (procoreData.completion_date !== undefined) mapped.CompletionDate = normalizeDate(procoreData.completion_date);
                            if (procoreData.projected_finish_date !== undefined) mapped.ProjectedFinishDate = normalizeDate(procoreData.projected_finish_date);
                            if (procoreData.actual_start_date !== undefined) mapped.EstStart = normalizeDate(procoreData.actual_start_date);
                            
                            // Created At - convert from date-time to date
                            if (procoreData.created_at !== undefined) {
                                const createdAt = procoreData.created_at;
                                if (createdAt) {
                                    // Extract date part from ISO date-time string (YYYY-MM-DDTHH:mm:ssZ -> YYYY-MM-DD)
                                    const datePart = createdAt.split('T')[0];
                                    // Normalize date to prevent timezone shifts
                                    const normalizeDate = (dateStr: string | null | undefined): string | null => {
                                        if (!dateStr) return null;
                                        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                                            return `${dateStr}T12:00:00`;
                                        }
                                        return dateStr;
                                    };
                                    mapped.CreatedAt = normalizeDate(datePart);
                                } else {
                                    mapped.CreatedAt = null;
                                }
                            }
                            
                            // Financial values
                            if (procoreData.total_value !== undefined) {
                                // Convert string to number if needed
                                const value = typeof procoreData.total_value === 'string' 
                                    ? parseFloat(procoreData.total_value) 
                                    : procoreData.total_value;
                                mapped.EstimatedValue = !Number.isNaN(value) ? value : null;
                            }
                            
                            // Square feet
                            if (procoreData.square_feet !== undefined) mapped.SquareFeet = procoreData.square_feet;
                            
                            // Client Reference ID (origin_id)
                            if (procoreData.origin_id !== undefined) mapped.ClientReferenceId = procoreData.origin_id || '';
                            
                            // Archived status (inverse of active)
                            if (procoreData.active !== undefined) mapped.Archived = !procoreData.active;
                            
                            // Calculate Est Duration (days) from start_date to completion_date
                            if (procoreData.start_date && procoreData.completion_date) {
                                try {
                                    const start = new Date(procoreData.start_date);
                                    const completion = new Date(procoreData.completion_date);
                                    if (!Number.isNaN(start.getTime()) && !Number.isNaN(completion.getTime())) {
                                        const diffTime = completion.getTime() - start.getTime();
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                        if (diffDays >= 0) {
                                            mapped.EstDuration = diffDays;
                                        }
                                    }
                                } catch (e) {
                                    console.warn(`Failed to calculate Est Duration for project ${project.id}:`, e);
                                }
                            }
                            
                            // Calculate Actual Duration (days) from actual_start_date to actual_completion_date (if available)
                            if (procoreData.actual_start_date && procoreData.actual_completion_date) {
                                try {
                                    const actualStart = new Date(procoreData.actual_start_date);
                                    const actualCompletion = new Date(procoreData.actual_completion_date);
                                    if (!Number.isNaN(actualStart.getTime()) && !Number.isNaN(actualCompletion.getTime())) {
                                        const diffTime = actualCompletion.getTime() - actualStart.getTime();
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                        if (diffDays >= 0) {
                                            mapped.ActualDuration = diffDays;
                                        }
                                    }
                                } catch (e) {
                                    console.warn(`Failed to calculate Actual Duration for project ${project.id}:`, e);
                                }
                            }
                            
                            // Map project stage/status
                            if (procoreData.project_stage?.name) {
                                const stageMap: { [key: string]: string } = {
                                    'Pre-Construction': 'Pre-Construction',
                                    'Construction': 'Course of Construction',
                                    'Complete': 'Complete',
                                    'Warranty': 'Warranty',
                                    'Post Construction': 'Post Construction',
                                };
                                mapped.ProjectStatus = stageMap[procoreData.project_stage.name] || 'Pre-Construction';
                            } else if (procoreData.stage_name) {
                                const stageMap: { [key: string]: string } = {
                                    'Pre-Construction': 'Pre-Construction',
                                    'Construction': 'Course of Construction',
                                    'Complete': 'Complete',
                                    'Warranty': 'Warranty',
                                    'Post Construction': 'Post Construction',
                                };
                                mapped.ProjectStatus = stageMap[procoreData.stage_name] || 'Pre-Construction';
                            }

                            // Fetch project dates to get additional date fields
                            try {
                                // Try v2.0 endpoint first
                                let projectDatesUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${projectIdNum}/project_dates`;
                                let projectDatesResponse;
                                
                                try {
                                    projectDatesResponse = await axios.get(projectDatesUrl, {
                                        params: { per_page: 100 },
                                        headers: {
                                            'Authorization': `Bearer ${accessToken}`,
                                            'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                        },
                                    });
                                } catch (v2Error: any) {
                                    // Fallback to v1.0 endpoint
                                    if (v2Error?.response?.status === 404 || v2Error?.response?.status === 400) {
                                        projectDatesUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/projects/${projectIdNum}/project_dates`;
                                        projectDatesResponse = await axios.get(projectDatesUrl, {
                                            params: {
                                                company_id: PROCORE_CONFIG.companyId,
                                                per_page: 100,
                                            },
                                            headers: {
                                                'Authorization': `Bearer ${accessToken}`,
                                                'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                            },
                                        });
                                    } else {
                                        throw v2Error;
                                    }
                                }

                                // Extract project dates array (v1.0 uses project_dates, v2.0 uses data)
                                // Handle different response structures
                                let projectDates: any[] = [];
                                if (Array.isArray(projectDatesResponse.data)) {
                                    projectDates = projectDatesResponse.data;
                                } else if (Array.isArray(projectDatesResponse.data.data)) {
                                    projectDates = projectDatesResponse.data.data;
                                } else if (Array.isArray(projectDatesResponse.data.project_dates)) {
                                    projectDates = projectDatesResponse.data.project_dates;
                                } else if (projectDatesResponse.data && typeof projectDatesResponse.data === 'object') {
                                    // If it's an object, try to find an array property
                                    const possibleArrays = ['data', 'project_dates', 'dates'];
                                    for (const key of possibleArrays) {
                                        if (Array.isArray(projectDatesResponse.data[key])) {
                                            projectDates = projectDatesResponse.data[key];
                                            break;
                                        }
                                    }
                                }
                                
                                // Map project dates by name to Bolt fields
                                // Create a flexible matching function
                                const normalizeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
                                
                                for (const projectDate of projectDates) {
                                    const dateName = normalizeName(projectDate.name || '');
                                    const dateValue = projectDate.date || projectDate.actual_date || null;
                                    
                                    // Helper to normalize dates (prevent timezone shifts)
                                    const normalizeDate = (dateStr: string | null | undefined): string | null => {
                                        if (!dateStr) return null;
                                        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                                            return `${dateStr}T12:00:00`;
                                        }
                                        return dateStr;
                                    };
                                    
                                    // Match by normalized name patterns (normalize dates to prevent timezone shifts)
                                    if (dateName.includes('communicatedstart') || dateName.includes('communicatedstartdate')) {
                                        mapped.CommunicatedStartDate = normalizeDate(dateValue);
                                    } else if (dateName.includes('communicatedfinish') || dateName.includes('communicatedfinishdate') || dateName.includes('communicatedfinish')) {
                                        mapped.CommunicatedFinishDate = normalizeDate(dateValue);
                                    } else if (dateName.includes('estfinish') || dateName.includes('estimatedfinish') || dateName.includes('estfinishdate')) {
                                        mapped.EstFinish = normalizeDate(dateValue);
                                    } else if (dateName.includes('actualfinish') || dateName.includes('actualfinishdate')) {
                                        mapped.ActualFinishDate = normalizeDate(dateValue);
                                    } else if (dateName.includes('biddue') || dateName.includes('bidduedate')) {
                                        mapped.BidDueDate = normalizeDate(dateValue);
                                    } else if (dateName.includes('projectreview') || dateName.includes('projectreviewdate')) {
                                        mapped.ProjectReviewDate = normalizeDate(dateValue);
                                    }
                                }
                            } catch (projectDatesError: any) {
                                // Log but don't fail the entire sync if project dates fail
                                console.warn(`Failed to fetch project dates for project ${project.id} (${projectIdNum}):`, projectDatesError?.message || projectDatesError);
                            }

                            // Fetch financial data from project status snapshots
                            try {
                                // First, get available budget views for this project
                                const budgetViewsUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${projectIdNum}/project_status_snapshots/budget_views`;
                                let budgetViewsResponse;
                                
                                try {
                                    budgetViewsResponse = await axios.get(budgetViewsUrl, {
                                        params: { per_page: 10 },
                                        headers: {
                                            'Authorization': `Bearer ${accessToken}`,
                                            'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                        },
                                    });
                                } catch (budgetViewsError: any) {
                                    // If 403 (forbidden), user doesn't have access to budget views - skip silently
                                    if (budgetViewsError?.response?.status === 403) {
                                        console.log(`Budget views not accessible for project ${project.id} (${projectIdNum}): Access denied. Skipping financial data fetch.`);
                                        throw budgetViewsError; // Will be caught by outer catch
                                    }
                                    // If v2.0 fails for other reasons, skip financial data fetch
                                    throw budgetViewsError;
                                }

                                const budgetViews = budgetViewsResponse.data.data || [];
                                
                                if (budgetViews.length > 0) {
                                    // Use the first budget view (typically the default/main one)
                                    const budgetViewId = budgetViews[0].id;
                                    
                                    // Get the latest project status snapshot for this budget view
                                    const snapshotsUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${projectIdNum}/budget_view/${budgetViewId}/project_status_snapshots`;
                                    const snapshotsResponse = await axios.get(snapshotsUrl, {
                                        params: {
                                            per_page: 1,
                                            sort: '-created_at', // Get most recent
                                        },
                                        headers: {
                                            'Authorization': `Bearer ${accessToken}`,
                                            'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                        },
                                    });

                                    const snapshots = snapshotsResponse.data.data || [];
                                    
                                    if (snapshots.length > 0) {
                                        const latestSnapshot = snapshots[0];
                                        
                                        // Extract financial data from budget columns
                                        // Budget columns are typically in a 'budget_columns' or 'columns' array
                                        // Each column has an id and a value
                                        if (latestSnapshot.budget_columns || latestSnapshot.columns) {
                                            const budgetColumns = latestSnapshot.budget_columns || latestSnapshot.columns || [];
                                            
                                            // Look for specific budget column types/names
                                            // These might be identified by column_id or name
                                            for (const column of budgetColumns) {
                                                const columnName = (column.name || '').toLowerCase();
                                                
                                                // Try to match by common column names/IDs
                                                // Note: These might need adjustment based on actual Procore column names
                                                if (columnName.includes('revised contract') || columnName.includes('revised_contract')) {
                                                    const value = parseFloat(column.value || column.total || 0);
                                                    if (!Number.isNaN(value)) {
                                                        mapped.ProjectRevisedContractAmount = value;
                                                    }
                                                } else if (columnName.includes('estimated cost') || columnName.includes('est cost') || columnName.includes('cost at completion')) {
                                                    const value = parseFloat(column.value || column.total || 0);
                                                    if (!Number.isNaN(value)) {
                                                        mapped.EstimatedCostAtCompletion = value;
                                                    }
                                                } else if (columnName.includes('estimated profit') || columnName.includes('est profit') || columnName.includes('projected profit')) {
                                                    const value = parseFloat(column.value || column.total || 0);
                                                    if (!Number.isNaN(value)) {
                                                        mapped.EstimatedProjectProfit = value;
                                                    }
                                                }
                                            }
                                        }
                                        
                                        // Also check for direct fields in the snapshot
                                        if (latestSnapshot.revised_contract !== undefined) {
                                            const value = parseFloat(latestSnapshot.revised_contract);
                                            if (!Number.isNaN(value)) {
                                                mapped.ProjectRevisedContractAmount = value;
                                            }
                                        }
                                        if (latestSnapshot.estimated_cost_at_completion !== undefined) {
                                            const value = parseFloat(latestSnapshot.estimated_cost_at_completion);
                                            if (!Number.isNaN(value)) {
                                                mapped.EstimatedCostAtCompletion = value;
                                            }
                                        }
                                        if (latestSnapshot.estimated_profit !== undefined || latestSnapshot.estimated_project_profit !== undefined) {
                                            const value = parseFloat(latestSnapshot.estimated_profit || latestSnapshot.estimated_project_profit);
                                            if (!Number.isNaN(value)) {
                                                mapped.EstimatedProjectProfit = value;
                                            }
                                        }
                                    }
                                }
                            } catch (financialError: any) {
                                // Log but don't fail the entire sync if financial data fetch fails
                                // 403 errors are common if user doesn't have access to budget views
                                const errorStatus = financialError?.response?.status;
                                if (errorStatus === 403) {
                                    console.log(`Financial data not available for project ${project.id} (${projectIdNum}): Access denied (403). User may not have budget view permissions.`);
                                } else {
                                    console.warn(`Failed to fetch financial data for project ${project.id} (${projectIdNum}):`, financialError?.message || financialError);
                                }
                            }

                            // Fetch financial data from Prime Contracts as fallback/alternative
                            try {
                                console.log(`Attempting to fetch Prime Contracts for project ${project.id} (${projectIdNum})...`);
                                // Get all Prime Contracts for this project
                                const primeContractsUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/prime_contracts`;
                                const primeContractsResponse = await axios.get(primeContractsUrl, {
                                    params: {
                                        project_id: projectIdNum,
                                        per_page: 100, // Get all contracts
                                    },
                                    headers: {
                                        'Authorization': `Bearer ${accessToken}`,
                                        'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                    },
                                });

                                console.log(`Prime Contracts API response status: ${primeContractsResponse.status}`);
                                console.log(`Prime Contracts API response data type: ${Array.isArray(primeContractsResponse.data) ? 'array' : typeof primeContractsResponse.data}`);
                                if (primeContractsResponse.data) {
                                    console.log(`Prime Contracts API response preview: ${JSON.stringify(primeContractsResponse.data).substring(0, 300)}`);
                                }

                                const primeContracts = Array.isArray(primeContractsResponse.data) 
                                    ? primeContractsResponse.data 
                                    : [];
                                
                                console.log(`Found ${primeContracts.length} Prime Contract(s) for project ${project.id}`);

                                if (primeContracts.length > 0) {
                                    // Sum up revised_contract amounts from all Prime Contracts
                                    let totalRevisedContract = 0;
                                    let totalGrandTotal = 0;
                                    
                                    // Also try to get detailed contract data for the first/main contract
                                    // to see if it has additional financial fields
                                    try {
                                        const mainContractId = primeContracts[0].id;
                                        if (mainContractId) {
                                            const showContractUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${projectIdNum}/prime_contracts/${mainContractId}`;
                                            const showContractResponse = await axios.get(showContractUrl, {
                                                params: { view: 'extended' }, // Use extended view to get all fields
                                                headers: {
                                                    'Authorization': `Bearer ${accessToken}`,
                                                    'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                                },
                                            });
                                            
                                            const contractData = showContractResponse.data.data || showContractResponse.data;
                                            
                                            // Check for profit-related fields in the detailed contract response
                                            if (contractData.projected_profit !== undefined) {
                                                const value = parseFloat(contractData.projected_profit);
                                                if (!Number.isNaN(value)) {
                                                    mapped.EstimatedProjectProfit = value;
                                                }
                                            } else if (contractData.estimated_profit !== undefined) {
                                                const value = parseFloat(contractData.estimated_profit);
                                                if (!Number.isNaN(value)) {
                                                    mapped.EstimatedProjectProfit = value;
                                                }
                                            }
                                            
                                            // Also check for cost at completion
                                            if (contractData.estimated_cost_at_completion !== undefined || contractData.cost_at_completion !== undefined) {
                                                const value = parseFloat(contractData.estimated_cost_at_completion || contractData.cost_at_completion);
                                                if (!Number.isNaN(value) && mapped.EstimatedCostAtCompletion === undefined) {
                                                    mapped.EstimatedCostAtCompletion = value;
                                                }
                                            }
                                        }
                                    } catch (showContractError: any) {
                                        // Log but continue with list data
                                        console.log(`Could not fetch detailed Prime Contract data for project ${project.id}:`, showContractError?.message || 'Unknown error');
                                    }
                                    
                                    for (const contract of primeContracts) {
                                        // revised_contract is the revised contract amount
                                        if (contract.revised_contract) {
                                            const value = parseFloat(contract.revised_contract);
                                            if (!Number.isNaN(value)) {
                                                totalRevisedContract += value;
                                            }
                                        }
                                        
                                        // grand_total is total of line items including markup
                                        if (contract.grand_total) {
                                            const value = parseFloat(contract.grand_total);
                                            if (!Number.isNaN(value)) {
                                                totalGrandTotal += value;
                                            }
                                        }
                                    }
                                    
                                    // Use the sum of revised_contract as Revised Contract Amount
                                    // Only set if we haven't already set it from budget views
                                    if (totalRevisedContract > 0 && mapped.ProjectRevisedContractAmount === undefined) {
                                        mapped.ProjectRevisedContractAmount = totalRevisedContract;
                                    }
                                    
                                    // Calculate Estimated Project Profit if we have both Revised Contract Amount and Estimated Cost at Completion
                                    // Formula: Projected Profit = Revised Contract Amount - Estimated Cost at Completion
                                    // Only calculate if we haven't already set it from the detailed contract data
                                    if (mapped.EstimatedProjectProfit === undefined && mapped.ProjectRevisedContractAmount && mapped.EstimatedCostAtCompletion) {
                                        const projectedProfit = mapped.ProjectRevisedContractAmount - mapped.EstimatedCostAtCompletion;
                                        if (!Number.isNaN(projectedProfit)) {
                                            mapped.EstimatedProjectProfit = projectedProfit;
                                        }
                                    }
                                    
                                    // Note: Prime Contracts don't typically have Estimated Cost at Completion
                                    // or Estimated Project Profit - those are project-level calculations
                                    // But we can log what we found for debugging
                                    console.log(`Prime Contracts for project ${project.id}: Found ${primeContracts.length} contract(s), Total Revised Contract: ${totalRevisedContract}, Total Grand Total: ${totalGrandTotal}`);
                                }
                            } catch (primeContractsError: any) {
                                // Log but don't fail the entire sync if Prime Contracts fetch fails
                                const errorStatus = primeContractsError?.response?.status;
                                const errorData = primeContractsError?.response?.data;
                                console.error(`Prime Contracts fetch error for project ${project.id} (${projectIdNum}):`, {
                                    status: errorStatus,
                                    message: primeContractsError?.message,
                                    data: errorData,
                                    url: primeContractsError?.config?.url
                                });
                                if (errorStatus === 403 || errorStatus === 404) {
                                    console.log(`Prime Contracts not accessible for project ${project.id} (${projectIdNum}): ${errorStatus === 403 ? 'Access denied' : 'Not found'}.`);
                                } else {
                                    console.warn(`Failed to fetch Prime Contracts for project ${project.id} (${projectIdNum}):`, primeContractsError?.message || primeContractsError);
                                }
                            }

                            if (mapped && Object.keys(mapped).length > 0) {
                                // Update Firebase project (skip Procore sync to avoid loops)
                                await projectsRef.doc(project.id).update({
                                    ...mapped,
                                    procoreLastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
                                    procoreSyncStatus: 'synced',
                                });
                                syncedCount++;
                                console.log(`Synced project ${project.id} (${project.ProjectName || project.projectName})`);
                            }
                        } catch (error: any) {
                            errorCount++;
                            const errorStatus = error?.response?.status;
                            const errorData = error?.response?.data;
                            
                            // Extract detailed error message
                            let errorMsg = 'Unknown error';
                            if (errorData) {
                                if (errorData.errors && typeof errorData.errors === 'object') {
                                    const errorMessages = Object.entries(errorData.errors)
                                        .map(([key, value]) => {
                                            if (Array.isArray(value)) {
                                                return `${key}: ${value.join(', ')}`;
                                            }
                                            return `${key}: ${value}`;
                                        })
                                        .join('; ');
                                    if (errorMessages) errorMsg = errorMessages;
                                } else if (errorData.error_description) {
                                    errorMsg = errorData.error_description;
                                } else if (errorData.message) {
                                    errorMsg = errorData.message;
                                } else if (typeof errorData === 'string') {
                                    errorMsg = errorData;
                                }
                            } else if (error?.message) {
                                errorMsg = error.message;
                            }
                            
                            // Add status code if available
                            if (errorStatus) {
                                errorMsg = `Request failed with status code ${errorStatus}${errorMsg ? `: ${errorMsg}` : ''}`;
                            }
                            
                            const projectName = project.ProjectName || project.projectName || project.id;
                            const procoreProjectId = project.procoreProjectId;
                            errors.push({
                                projectId: project.id,
                                projectName: projectName,
                                error: errorMsg
                            });
                            console.error(`Failed to sync project ${project.id} (${projectName}) [Procore ID: ${procoreProjectId}]:`, {
                                message: errorMsg,
                                status: errorStatus,
                                statusText: error?.response?.statusText,
                                url: error?.config?.url || apiUrl,
                                procoreProjectId: procoreProjectId,
                                responseData: errorData,
                                fullError: error
                            });

                            // Update sync status to failed
                            try {
                                await projectsRef.doc(project.id).update({
                                    procoreSyncStatus: 'failed',
                                    procoreSyncError: error.message,
                                    procoreSyncAttemptedAt: admin.firestore.FieldValue.serverTimestamp(),
                                });
                            } catch (updateError) {
                                console.error(`Failed to update sync status for project ${project.id}:`, updateError);
                            }
                        }
                    })
                );
                
                // Delay between batches to avoid rate limits
                if (i + batchSize < projects.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            return {
                success: true,
                syncedCount,
                errorCount,
                totalProjects: projects.length,
                errors: errors.slice(0, 10),
                errorDetails: errors.length > 0 ? errors.map(e => `${e.projectName}: ${e.error}`).join('; ') : null,
            };
        } catch (error: any) {
            console.error('Error syncing all projects from Procore:', error);
            throw new functions.https.HttpsError(
                'internal',
                error.message || 'Failed to sync projects from Procore'
            );
        }
    });

// Scheduled function to automatically sync all projects from Procore to Bolt
// Runs every 6 hours
export const procoreScheduledSync = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 540, // 9 minutes
        memory: '512MB',
    })
    .pubsub
    .schedule('every 6 hours')
    .onRun(async (context) => {
        console.log('Starting scheduled Procore → Bolt sync...');

        try {
            // Get all users with Procore tokens (we'll use the first one we find)
            const usersRef = admin.firestore().collection('users');
            const usersSnapshot = await usersRef
                .where('procoreAccessToken', '!=', null)
                .limit(1)
                .get();

            if (usersSnapshot.empty) {
                console.log('No users with Procore tokens found. Skipping scheduled sync.');
                return null;
            }

            const userId = usersSnapshot.docs[0].id;

            // Get access token for this user
            const accessToken = await getProcoreAccessToken(userId);
            if (!accessToken) {
                console.log('Could not get valid Procore access token. Skipping scheduled sync.');
                return null;
            }

            // Get all projects from Firebase that have procoreProjectId
            const projectsRef = admin.firestore().collection('projects');
            const snapshot = await projectsRef
                .where('procoreProjectId', '!=', null)
                .get();

            if (snapshot.empty) {
                console.log('No projects linked to Procore found. Scheduled sync complete.');
                return null;
            }

            const projects = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as Array<{ id: string; procoreProjectId?: number | string; [key: string]: any }>;

            console.log(`Found ${projects.length} projects linked to Procore. Starting scheduled sync...`);

            let syncedCount = 0;
            let errorCount = 0;

            // Process projects in batches
            const batchSize = 10;
            for (let i = 0; i < projects.length; i += batchSize) {
                const batch = projects.slice(i, i + batchSize);
                
                await Promise.all(
                    batch.map(async (project) => {
                        try {
                            const procoreProjectId = project.procoreProjectId;
                            if (!procoreProjectId) return;

                            // Ensure project ID is a number (Procore API requires integer)
                            const projectIdNum = Number(procoreProjectId);
                            if (Number.isNaN(projectIdNum)) {
                                throw new Error(`Invalid Procore project ID: ${procoreProjectId} (must be a number)`);
                            }

                            // Try v2.0 endpoint first (more modern format)
                            let apiUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${projectIdNum}`;
                            let response;
                            
                            try {
                                response = await axios.get(apiUrl, {
                                    headers: {
                                        'Authorization': `Bearer ${accessToken}`,
                                        'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                    },
                                });
                            } catch (v2Error: any) {
                                // If v2.0 fails with 404 or 400, try v1.0 format
                                if (v2Error?.response?.status === 404 || v2Error?.response?.status === 400) {
                                    // Fallback to v1.0 endpoint format
                                    apiUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/projects/${projectIdNum}`;
                                    response = await axios.get(apiUrl, {
                                        params: {
                                            company_id: PROCORE_CONFIG.companyId,
                                        },
                                        headers: {
                                            'Authorization': `Bearer ${accessToken}`,
                                            'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                        },
                                    });
                                } else {
                                    throw v2Error;
                                }
                            }

                            const procoreData = response.data;

                            // Map Procore data to Bolt format (inline mapping)
                            const mapped: any = {};
                            
                            // Basic project info
                            if (procoreData.name !== undefined) mapped.ProjectName = procoreData.name || '';
                            if (procoreData.project_number !== undefined) mapped.ProjectNumber = procoreData.project_number || '';
                            if (procoreData.address !== undefined) mapped.address = procoreData.address || '';
                            if (procoreData.city !== undefined) mapped.city = procoreData.city || '';
                            if (procoreData.state_code !== undefined) mapped.State = procoreData.state_code || '';
                            if (procoreData.zip !== undefined) mapped.zip = procoreData.zip || '';
                            
                            // Helper function to normalize dates and prevent timezone shifts
                            // Procore sends dates as YYYY-MM-DD strings. When JavaScript's Date() parses these,
                            // it treats them as UTC midnight, which can shift the date back a day in local timezones.
                            // By appending 'T12:00:00' (without timezone), JavaScript will interpret it as local time.
                            const normalizeDate = (dateStr: string | null | undefined): string | null => {
                                if (!dateStr) return null;
                                if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                                    return `${dateStr}T12:00:00`;
                                }
                                return dateStr;
                            };
                            
                            // Dates - main project dates (normalized to prevent timezone shifts)
                            if (procoreData.start_date !== undefined) mapped.StartDate = normalizeDate(procoreData.start_date);
                            if (procoreData.completion_date !== undefined) mapped.CompletionDate = normalizeDate(procoreData.completion_date);
                            if (procoreData.projected_finish_date !== undefined) mapped.ProjectedFinishDate = normalizeDate(procoreData.projected_finish_date);
                            if (procoreData.actual_start_date !== undefined) mapped.EstStart = normalizeDate(procoreData.actual_start_date);
                            
                            // Created At - convert from date-time to date
                            if (procoreData.created_at !== undefined) {
                                const createdAt = procoreData.created_at;
                                if (createdAt) {
                                    // Extract date part from ISO date-time string (YYYY-MM-DDTHH:mm:ssZ -> YYYY-MM-DD)
                                    const datePart = createdAt.split('T')[0];
                                    // Normalize date to prevent timezone shifts
                                    const normalizeDate = (dateStr: string | null | undefined): string | null => {
                                        if (!dateStr) return null;
                                        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                                            return `${dateStr}T12:00:00`;
                                        }
                                        return dateStr;
                                    };
                                    mapped.CreatedAt = normalizeDate(datePart);
                                } else {
                                    mapped.CreatedAt = null;
                                }
                            }
                            
                            // Financial values
                            if (procoreData.total_value !== undefined) {
                                // Convert string to number if needed
                                const value = typeof procoreData.total_value === 'string' 
                                    ? parseFloat(procoreData.total_value) 
                                    : procoreData.total_value;
                                mapped.EstimatedValue = !Number.isNaN(value) ? value : null;
                            }
                            
                            // Square feet
                            if (procoreData.square_feet !== undefined) mapped.SquareFeet = procoreData.square_feet;
                            
                            // Client Reference ID (origin_id)
                            if (procoreData.origin_id !== undefined) mapped.ClientReferenceId = procoreData.origin_id || '';
                            
                            // Archived status (inverse of active)
                            if (procoreData.active !== undefined) mapped.Archived = !procoreData.active;
                            
                            // Calculate Est Duration (days) from start_date to completion_date
                            if (procoreData.start_date && procoreData.completion_date) {
                                try {
                                    const start = new Date(procoreData.start_date);
                                    const completion = new Date(procoreData.completion_date);
                                    if (!Number.isNaN(start.getTime()) && !Number.isNaN(completion.getTime())) {
                                        const diffTime = completion.getTime() - start.getTime();
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                        if (diffDays >= 0) {
                                            mapped.EstDuration = diffDays;
                                        }
                                    }
                                } catch (e) {
                                    console.warn(`Failed to calculate Est Duration for project ${project.id}:`, e);
                                }
                            }
                            
                            // Calculate Actual Duration (days) from actual_start_date to actual_completion_date (if available)
                            if (procoreData.actual_start_date && procoreData.actual_completion_date) {
                                try {
                                    const actualStart = new Date(procoreData.actual_start_date);
                                    const actualCompletion = new Date(procoreData.actual_completion_date);
                                    if (!Number.isNaN(actualStart.getTime()) && !Number.isNaN(actualCompletion.getTime())) {
                                        const diffTime = actualCompletion.getTime() - actualStart.getTime();
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                        if (diffDays >= 0) {
                                            mapped.ActualDuration = diffDays;
                                        }
                                    }
                                } catch (e) {
                                    console.warn(`Failed to calculate Actual Duration for project ${project.id}:`, e);
                                }
                            }
                            
                            // Map project stage/status
                            if (procoreData.project_stage?.name) {
                                const stageMap: { [key: string]: string } = {
                                    'Pre-Construction': 'Pre-Construction',
                                    'Construction': 'Course of Construction',
                                    'Complete': 'Complete',
                                    'Warranty': 'Warranty',
                                    'Post Construction': 'Post Construction',
                                };
                                mapped.ProjectStatus = stageMap[procoreData.project_stage.name] || 'Pre-Construction';
                            } else if (procoreData.stage_name) {
                                const stageMap: { [key: string]: string } = {
                                    'Pre-Construction': 'Pre-Construction',
                                    'Construction': 'Course of Construction',
                                    'Complete': 'Complete',
                                    'Warranty': 'Warranty',
                                    'Post Construction': 'Post Construction',
                                };
                                mapped.ProjectStatus = stageMap[procoreData.stage_name] || 'Pre-Construction';
                            }

                            // Fetch project dates to get additional date fields
                            try {
                                // Try v2.0 endpoint first
                                let projectDatesUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${projectIdNum}/project_dates`;
                                let projectDatesResponse;
                                
                                try {
                                    projectDatesResponse = await axios.get(projectDatesUrl, {
                                        params: { per_page: 100 },
                                        headers: {
                                            'Authorization': `Bearer ${accessToken}`,
                                            'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                        },
                                    });
                                } catch (v2Error: any) {
                                    // Fallback to v1.0 endpoint
                                    if (v2Error?.response?.status === 404 || v2Error?.response?.status === 400) {
                                        projectDatesUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/projects/${projectIdNum}/project_dates`;
                                        projectDatesResponse = await axios.get(projectDatesUrl, {
                                            params: {
                                                company_id: PROCORE_CONFIG.companyId,
                                                per_page: 100,
                                            },
                                            headers: {
                                                'Authorization': `Bearer ${accessToken}`,
                                                'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                            },
                                        });
                                    } else {
                                        throw v2Error;
                                    }
                                }

                                // Extract project dates array (v1.0 uses project_dates, v2.0 uses data)
                                // Handle different response structures
                                let projectDates: any[] = [];
                                if (Array.isArray(projectDatesResponse.data)) {
                                    projectDates = projectDatesResponse.data;
                                } else if (Array.isArray(projectDatesResponse.data.data)) {
                                    projectDates = projectDatesResponse.data.data;
                                } else if (Array.isArray(projectDatesResponse.data.project_dates)) {
                                    projectDates = projectDatesResponse.data.project_dates;
                                } else if (projectDatesResponse.data && typeof projectDatesResponse.data === 'object') {
                                    // If it's an object, try to find an array property
                                    const possibleArrays = ['data', 'project_dates', 'dates'];
                                    for (const key of possibleArrays) {
                                        if (Array.isArray(projectDatesResponse.data[key])) {
                                            projectDates = projectDatesResponse.data[key];
                                            break;
                                        }
                                    }
                                }
                                
                                // Map project dates by name to Bolt fields
                                // Create a flexible matching function
                                const normalizeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
                                
                                for (const projectDate of projectDates) {
                                    const dateName = normalizeName(projectDate.name || '');
                                    const dateValue = projectDate.date || projectDate.actual_date || null;
                                    
                                    // Helper to normalize dates (prevent timezone shifts)
                                    const normalizeDate = (dateStr: string | null | undefined): string | null => {
                                        if (!dateStr) return null;
                                        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                                            return `${dateStr}T12:00:00`;
                                        }
                                        return dateStr;
                                    };
                                    
                                    // Match by normalized name patterns (normalize dates to prevent timezone shifts)
                                    if (dateName.includes('communicatedstart') || dateName.includes('communicatedstartdate')) {
                                        mapped.CommunicatedStartDate = normalizeDate(dateValue);
                                    } else if (dateName.includes('communicatedfinish') || dateName.includes('communicatedfinishdate') || dateName.includes('communicatedfinish')) {
                                        mapped.CommunicatedFinishDate = normalizeDate(dateValue);
                                    } else if (dateName.includes('estfinish') || dateName.includes('estimatedfinish') || dateName.includes('estfinishdate')) {
                                        mapped.EstFinish = normalizeDate(dateValue);
                                    } else if (dateName.includes('actualfinish') || dateName.includes('actualfinishdate')) {
                                        mapped.ActualFinishDate = normalizeDate(dateValue);
                                    } else if (dateName.includes('biddue') || dateName.includes('bidduedate')) {
                                        mapped.BidDueDate = normalizeDate(dateValue);
                                    } else if (dateName.includes('projectreview') || dateName.includes('projectreviewdate')) {
                                        mapped.ProjectReviewDate = normalizeDate(dateValue);
                                    }
                                }
                            } catch (projectDatesError: any) {
                                // Log but don't fail the entire sync if project dates fail
                                console.warn(`Failed to fetch project dates for project ${project.id} (${projectIdNum}):`, projectDatesError?.message || projectDatesError);
                            }

                            // Fetch financial data from project status snapshots
                            try {
                                // First, get available budget views for this project
                                const budgetViewsUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${projectIdNum}/project_status_snapshots/budget_views`;
                                let budgetViewsResponse;
                                
                                try {
                                    budgetViewsResponse = await axios.get(budgetViewsUrl, {
                                        params: { per_page: 10 },
                                        headers: {
                                            'Authorization': `Bearer ${accessToken}`,
                                            'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                        },
                                    });
                                } catch (budgetViewsError: any) {
                                    // If 403 (forbidden), user doesn't have access to budget views - skip silently
                                    if (budgetViewsError?.response?.status === 403) {
                                        console.log(`Budget views not accessible for project ${project.id} (${projectIdNum}): Access denied. Skipping financial data fetch.`);
                                        throw budgetViewsError; // Will be caught by outer catch
                                    }
                                    // If v2.0 fails for other reasons, skip financial data fetch
                                    throw budgetViewsError;
                                }

                                const budgetViews = budgetViewsResponse.data.data || [];
                                
                                if (budgetViews.length > 0) {
                                    // Use the first budget view (typically the default/main one)
                                    const budgetViewId = budgetViews[0].id;
                                    
                                    // Get the latest project status snapshot for this budget view
                                    const snapshotsUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${projectIdNum}/budget_view/${budgetViewId}/project_status_snapshots`;
                                    const snapshotsResponse = await axios.get(snapshotsUrl, {
                                        params: {
                                            per_page: 1,
                                            sort: '-created_at', // Get most recent
                                        },
                                        headers: {
                                            'Authorization': `Bearer ${accessToken}`,
                                            'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                        },
                                    });

                                    const snapshots = snapshotsResponse.data.data || [];
                                    
                                    if (snapshots.length > 0) {
                                        const latestSnapshot = snapshots[0];
                                        
                                        // Extract financial data from budget columns
                                        // Budget columns are typically in a 'budget_columns' or 'columns' array
                                        // Each column has an id and a value
                                        if (latestSnapshot.budget_columns || latestSnapshot.columns) {
                                            const budgetColumns = latestSnapshot.budget_columns || latestSnapshot.columns || [];
                                            
                                            // Look for specific budget column types/names
                                            // These might be identified by column_id or name
                                            for (const column of budgetColumns) {
                                                const columnName = (column.name || '').toLowerCase();
                                                
                                                // Try to match by common column names/IDs
                                                // Note: These might need adjustment based on actual Procore column names
                                                if (columnName.includes('revised contract') || columnName.includes('revised_contract')) {
                                                    const value = parseFloat(column.value || column.total || 0);
                                                    if (!Number.isNaN(value)) {
                                                        mapped.ProjectRevisedContractAmount = value;
                                                    }
                                                } else if (columnName.includes('estimated cost') || columnName.includes('est cost') || columnName.includes('cost at completion')) {
                                                    const value = parseFloat(column.value || column.total || 0);
                                                    if (!Number.isNaN(value)) {
                                                        mapped.EstimatedCostAtCompletion = value;
                                                    }
                                                } else if (columnName.includes('estimated profit') || columnName.includes('est profit') || columnName.includes('projected profit')) {
                                                    const value = parseFloat(column.value || column.total || 0);
                                                    if (!Number.isNaN(value)) {
                                                        mapped.EstimatedProjectProfit = value;
                                                    }
                                                }
                                            }
                                        }
                                        
                                        // Also check for direct fields in the snapshot
                                        if (latestSnapshot.revised_contract !== undefined) {
                                            const value = parseFloat(latestSnapshot.revised_contract);
                                            if (!Number.isNaN(value)) {
                                                mapped.ProjectRevisedContractAmount = value;
                                            }
                                        }
                                        if (latestSnapshot.estimated_cost_at_completion !== undefined) {
                                            const value = parseFloat(latestSnapshot.estimated_cost_at_completion);
                                            if (!Number.isNaN(value)) {
                                                mapped.EstimatedCostAtCompletion = value;
                                            }
                                        }
                                        if (latestSnapshot.estimated_profit !== undefined || latestSnapshot.estimated_project_profit !== undefined) {
                                            const value = parseFloat(latestSnapshot.estimated_profit || latestSnapshot.estimated_project_profit);
                                            if (!Number.isNaN(value)) {
                                                mapped.EstimatedProjectProfit = value;
                                            }
                                        }
                                    }
                                }
                            } catch (financialError: any) {
                                // Log but don't fail the entire sync if financial data fetch fails
                                // 403 errors are common if user doesn't have access to budget views
                                const errorStatus = financialError?.response?.status;
                                if (errorStatus === 403) {
                                    console.log(`Financial data not available for project ${project.id} (${projectIdNum}): Access denied (403). User may not have budget view permissions.`);
                                } else {
                                    console.warn(`Failed to fetch financial data for project ${project.id} (${projectIdNum}):`, financialError?.message || financialError);
                                }
                            }

                            // Fetch financial data from Prime Contracts as fallback/alternative
                            try {
                                console.log(`Attempting to fetch Prime Contracts for project ${project.id} (${projectIdNum})...`);
                                // Get all Prime Contracts for this project
                                const primeContractsUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/prime_contracts`;
                                const primeContractsResponse = await axios.get(primeContractsUrl, {
                                    params: {
                                        project_id: projectIdNum,
                                        per_page: 100, // Get all contracts
                                    },
                                    headers: {
                                        'Authorization': `Bearer ${accessToken}`,
                                        'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                    },
                                });

                                console.log(`Prime Contracts API response status: ${primeContractsResponse.status}`);
                                console.log(`Prime Contracts API response data type: ${Array.isArray(primeContractsResponse.data) ? 'array' : typeof primeContractsResponse.data}`);
                                if (primeContractsResponse.data) {
                                    console.log(`Prime Contracts API response preview: ${JSON.stringify(primeContractsResponse.data).substring(0, 300)}`);
                                }

                                const primeContracts = Array.isArray(primeContractsResponse.data) 
                                    ? primeContractsResponse.data 
                                    : [];
                                
                                console.log(`Found ${primeContracts.length} Prime Contract(s) for project ${project.id}`);

                                if (primeContracts.length > 0) {
                                    // Sum up revised_contract amounts from all Prime Contracts
                                    let totalRevisedContract = 0;
                                    let totalGrandTotal = 0;
                                    
                                    // Also try to get detailed contract data for the first/main contract
                                    // to see if it has additional financial fields
                                    try {
                                        const mainContractId = primeContracts[0].id;
                                        if (mainContractId) {
                                            const showContractUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${projectIdNum}/prime_contracts/${mainContractId}`;
                                            const showContractResponse = await axios.get(showContractUrl, {
                                                params: { view: 'extended' }, // Use extended view to get all fields
                                                headers: {
                                                    'Authorization': `Bearer ${accessToken}`,
                                                    'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                                },
                                            });
                                            
                                            const contractData = showContractResponse.data.data || showContractResponse.data;
                                            
                                            // Check for profit-related fields in the detailed contract response
                                            if (contractData.projected_profit !== undefined) {
                                                const value = parseFloat(contractData.projected_profit);
                                                if (!Number.isNaN(value)) {
                                                    mapped.EstimatedProjectProfit = value;
                                                }
                                            } else if (contractData.estimated_profit !== undefined) {
                                                const value = parseFloat(contractData.estimated_profit);
                                                if (!Number.isNaN(value)) {
                                                    mapped.EstimatedProjectProfit = value;
                                                }
                                            }
                                            
                                            // Also check for cost at completion
                                            if (contractData.estimated_cost_at_completion !== undefined || contractData.cost_at_completion !== undefined) {
                                                const value = parseFloat(contractData.estimated_cost_at_completion || contractData.cost_at_completion);
                                                if (!Number.isNaN(value) && mapped.EstimatedCostAtCompletion === undefined) {
                                                    mapped.EstimatedCostAtCompletion = value;
                                                }
                                            }
                                        }
                                    } catch (showContractError: any) {
                                        // Log but continue with list data
                                        console.log(`Could not fetch detailed Prime Contract data for project ${project.id}:`, showContractError?.message || 'Unknown error');
                                    }
                                    
                                    for (const contract of primeContracts) {
                                        // revised_contract is the revised contract amount
                                        if (contract.revised_contract) {
                                            const value = parseFloat(contract.revised_contract);
                                            if (!Number.isNaN(value)) {
                                                totalRevisedContract += value;
                                            }
                                        }
                                        
                                        // grand_total is total of line items including markup
                                        if (contract.grand_total) {
                                            const value = parseFloat(contract.grand_total);
                                            if (!Number.isNaN(value)) {
                                                totalGrandTotal += value;
                                            }
                                        }
                                    }
                                    
                                    // Use the sum of revised_contract as Revised Contract Amount
                                    // Only set if we haven't already set it from budget views
                                    if (totalRevisedContract > 0 && mapped.ProjectRevisedContractAmount === undefined) {
                                        mapped.ProjectRevisedContractAmount = totalRevisedContract;
                                    }
                                    
                                    // Calculate Estimated Project Profit if we have both Revised Contract Amount and Estimated Cost at Completion
                                    // Formula: Projected Profit = Revised Contract Amount - Estimated Cost at Completion
                                    // Only calculate if we haven't already set it from the detailed contract data
                                    if (mapped.EstimatedProjectProfit === undefined && mapped.ProjectRevisedContractAmount && mapped.EstimatedCostAtCompletion) {
                                        const projectedProfit = mapped.ProjectRevisedContractAmount - mapped.EstimatedCostAtCompletion;
                                        if (!Number.isNaN(projectedProfit)) {
                                            mapped.EstimatedProjectProfit = projectedProfit;
                                        }
                                    }
                                    
                                    // Note: Prime Contracts don't typically have Estimated Cost at Completion
                                    // or Estimated Project Profit - those are project-level calculations
                                    // But we can log what we found for debugging
                                    console.log(`Prime Contracts for project ${project.id}: Found ${primeContracts.length} contract(s), Total Revised Contract: ${totalRevisedContract}, Total Grand Total: ${totalGrandTotal}`);
                                }
                            } catch (primeContractsError: any) {
                                // Log but don't fail the entire sync if Prime Contracts fetch fails
                                const errorStatus = primeContractsError?.response?.status;
                                const errorData = primeContractsError?.response?.data;
                                console.error(`Prime Contracts fetch error for project ${project.id} (${projectIdNum}):`, {
                                    status: errorStatus,
                                    message: primeContractsError?.message,
                                    data: errorData,
                                    url: primeContractsError?.config?.url
                                });
                                if (errorStatus === 403 || errorStatus === 404) {
                                    console.log(`Prime Contracts not accessible for project ${project.id} (${projectIdNum}): ${errorStatus === 403 ? 'Access denied' : 'Not found'}.`);
                                } else {
                                    console.warn(`Failed to fetch Prime Contracts for project ${project.id} (${projectIdNum}):`, primeContractsError?.message || primeContractsError);
                                }
                            }

                            if (mapped && Object.keys(mapped).length > 0) {
                                // Update Firebase project
                                await projectsRef.doc(project.id).update({
                                    ...mapped,
                                    procoreLastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
                                    procoreSyncStatus: 'synced',
                                });
                                syncedCount++;
                            }
                        } catch (error: any) {
                            errorCount++;
                            console.error(`Failed to sync project ${project.id}:`, error.message);

                            // Update sync status to failed
                            try {
                                await projectsRef.doc(project.id).update({
                                    procoreSyncStatus: 'failed',
                                    procoreSyncError: error.message,
                                    procoreSyncAttemptedAt: admin.firestore.FieldValue.serverTimestamp(),
                                });
                            } catch (updateError) {
                                console.error(`Failed to update sync status for project ${project.id}:`, updateError);
                            }
                        }
                    })
                );
            }

            console.log(`Scheduled sync complete. Synced: ${syncedCount}, Errors: ${errorCount}`);
            return null;
        } catch (error: any) {
            console.error('Error in scheduled Procore sync:', error);
            return null; // Don't throw - scheduled functions should not fail
        }
    });

// DEPRECATED: Removed procoreGetProjectProfitability and procoreGetAllProjectsProfitability
// These functions used the Procore API which had rate limits and missing data.
// Replaced by azureSqlGetAllProjectsProfitability which queries Azure SQL Database directly.
// This provides faster, more reliable data that matches Power BI exactly.

// TEST FUNCTION: Test Prime Contracts endpoint to see what financial data is available
// This is a temporary function for research purposes
export const procoreTestPrimeContracts = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB',
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        
        const userId = context.auth.uid;
        const { projectId } = data;
        
        // If no project ID provided, try to get the first project from the list
        let testProjectId = projectId;
        if (!testProjectId) {
            try {
                // Get first project to test with
                const projectsResponse = await axios.get(
                    `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects`,
                    {
                        headers: {
                            'Authorization': `Bearer ${await getProcoreAccessToken(userId)}`,
                            'Procore-Company-Id': PROCORE_CONFIG.companyId,
                        },
                        params: {
                            per_page: 1, // Just get one project
                        }
                    }
                );
                const projects = projectsResponse.data || [];
                if (Array.isArray(projects) && projects.length > 0) {
                    testProjectId = projects[0].id?.toString();
                    console.log('Using first project ID for test:', testProjectId);
                } else {
                    throw new Error('No projects found to test with');
                }
            } catch (error) {
                console.error('Error getting project ID for test:', error);
                throw new functions.https.HttpsError(
                    'internal',
                    'Could not get a project ID to test with. Please provide a projectId parameter.'
                );
            }
        }
        
        const accessToken = await getProcoreAccessToken(userId);
        
        if (!accessToken) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'No valid Procore access token. Please authorize the application.'
            );
        }
        
        try {
            console.log('Testing Prime Contracts endpoint for project:', testProjectId);
            const primeContractsUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/prime_contracts`;
            console.log('Prime Contracts URL:', primeContractsUrl);
            
            const response = await axios.get(
                primeContractsUrl,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Procore-Company-Id': PROCORE_CONFIG.companyId,
                    },
                }
            );
            
            const primeContracts = response.data || [];
            console.log('Number of prime contracts found:', Array.isArray(primeContracts) ? primeContracts.length : 'Not an array');
            console.log('Full Prime Contracts response:', JSON.stringify(response.data, null, 2));
            
            // If it's an array, log the first contract structure
            if (Array.isArray(primeContracts) && primeContracts.length > 0) {
                console.log('First Prime Contract structure:', JSON.stringify(primeContracts[0], null, 2));
            } else if (typeof primeContracts === 'object' && primeContracts !== null) {
                console.log('Prime Contracts response structure:', JSON.stringify(primeContracts, null, 2));
            }
            
            return {
                success: true,
                projectId: testProjectId,
                data: response.data,
                message: 'Prime Contracts data retrieved successfully. Check Firebase logs for full structure.',
            };
        } catch (error: any) {
            console.error('Error testing Prime Contracts endpoint:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                url: error.config?.url,
            });
            
            return {
                success: false,
                error: {
                    message: error.message,
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                },
            };
        }
    });

// TEST FUNCTION: Test Project Status Snapshots endpoint to see what financial data is available
// This is a temporary function for research purposes
export const procoreTestProjectStatusSnapshots = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB',
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        
        const userId = context.auth.uid;
        const { projectId } = data;
        
        // If no project ID provided, try to get the first project from the list
        let testProjectId = projectId;
        if (!testProjectId) {
            try {
                // Get first project to test with
                const projectsResponse = await axios.get(
                    `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects`,
                    {
                        headers: {
                            'Authorization': `Bearer ${await getProcoreAccessToken(userId)}`,
                            'Procore-Company-Id': PROCORE_CONFIG.companyId,
                        },
                        params: {
                            per_page: 1, // Just get one project
                        }
                    }
                );
                const projects = projectsResponse.data || [];
                if (Array.isArray(projects) && projects.length > 0) {
                    testProjectId = projects[0].id?.toString();
                    console.log('Using first project ID for test:', testProjectId);
                } else {
                    throw new Error('No projects found to test with');
                }
            } catch (error) {
                console.error('Error getting project ID for test:', error);
                throw new functions.https.HttpsError(
                    'internal',
                    'Could not get a project ID to test with. Please provide a projectId parameter.'
                );
            }
        }
        
        const accessToken = await getProcoreAccessToken(userId);
        
        if (!accessToken) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'No valid Procore access token. Please authorize the application.'
            );
        }
        
        try {
            console.log('Testing Project Status Snapshots for project:', testProjectId);
            
            // Step 1: Get available budget views for the project
            const budgetViewsUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/project_status_snapshots/budget_views`;
            console.log('Budget Views URL:', budgetViewsUrl);
            
            let budgetViews: any[] = [];
            try {
                const budgetViewsResponse = await axios.get(
                    budgetViewsUrl,
                    {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Procore-Company-Id': PROCORE_CONFIG.companyId,
                        },
                    }
                );
                budgetViews = Array.isArray(budgetViewsResponse.data) ? budgetViewsResponse.data : [];
                console.log('Available budget views:', budgetViews.length);
                console.log('Budget Views response:', JSON.stringify(budgetViewsResponse.data, null, 2));
            } catch (budgetViewsError: any) {
                console.warn('Could not fetch budget views:', budgetViewsError.response?.status || budgetViewsError.message);
            }
            
            // Step 2: Get the latest project status snapshot
            // If we have budget views, use the first one; otherwise try without budget_view_id
            let snapshots: any[] = [];
            let snapshotUrl = '';
            
            if (budgetViews.length > 0) {
                const budgetViewId = budgetViews[0].id;
                snapshotUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/budget_view/${budgetViewId}/project_status_snapshots`;
                console.log('Snapshots URL (with budget view):', snapshotUrl);
            } else {
                // Try alternative endpoint structure
                snapshotUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/project_status_snapshots`;
                console.log('Snapshots URL (without budget view):', snapshotUrl);
            }
            
            try {
                const snapshotsResponse = await axios.get(
                    snapshotUrl,
                    {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Procore-Company-Id': PROCORE_CONFIG.companyId,
                        },
                        params: {
                            per_page: 1, // Just get the latest one
                            sort: '-created_at', // Most recent first
                        },
                    }
                );
                snapshots = Array.isArray(snapshotsResponse.data) ? snapshotsResponse.data : [];
                console.log('Number of snapshots found:', snapshots.length);
                console.log('Full Snapshots response:', JSON.stringify(snapshotsResponse.data, null, 2));
                
                // If it's an array, log the first snapshot structure
                if (snapshots.length > 0) {
                    console.log('First Project Status Snapshot structure:', JSON.stringify(snapshots[0], null, 2));
                    console.log('Available fields in snapshot:', Object.keys(snapshots[0]));
                }
            } catch (snapshotsError: any) {
                console.warn('Could not fetch snapshots:', snapshotsError.response?.status || snapshotsError.message);
                console.warn('Snapshots error details:', JSON.stringify(snapshotsError.response?.data || snapshotsError.message, null, 2));
            }
            
            return {
                success: true,
                projectId: testProjectId,
                budgetViews: budgetViews,
                snapshots: snapshots,
                message: 'Project Status Snapshots data retrieved successfully. Check Firebase logs for full structure.',
            };
        } catch (error: any) {
            console.error('Error testing Project Status Snapshots endpoint:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                url: error.config?.url,
            });
            throw new functions.https.HttpsError(
                'internal',
                error.response?.data?.error_description || 'Failed to test Project Status Snapshots endpoint'
            );
        }
    });

// TEST FUNCTION: Test all alternative financial endpoints to find working ones
export const procoreTestAllFinancialEndpoints = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 120,
        memory: '512MB',
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        
        const userId = context.auth.uid;
        const { projectId } = data;
        
        // Get project ID if not provided
        let testProjectId = projectId;
        if (!testProjectId) {
            try {
                const projectsResponse = await axios.get(
                    `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects`,
                    {
                        headers: {
                            'Authorization': `Bearer ${await getProcoreAccessToken(userId)}`,
                            'Procore-Company-Id': PROCORE_CONFIG.companyId,
                        },
                        params: { per_page: 1 }
                    }
                );
                const projects = projectsResponse.data || [];
                if (Array.isArray(projects) && projects.length > 0) {
                    testProjectId = projects[0].id?.toString();
                }
            } catch (error) {
                throw new functions.https.HttpsError('internal', 'Could not get a project ID to test with.');
            }
        }
        
        const accessToken = await getProcoreAccessToken(userId);
        if (!accessToken) {
            throw new functions.https.HttpsError('unauthenticated', 'No valid Procore access token.');
        }
        
        const results: any = {
            projectId: testProjectId,
            attempts: [],
            successfulEndpoints: [],
        };
        
        // Try alternative endpoints for missing financial data
        const endpointsToTry = [
            // Payment Applications (Owner Invoices) - might have invoice data!
            {
                name: 'Payment Applications (Owner Invoices)',
                url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/payment_applications`,
                params: { project_id: testProjectId, per_page: 1 },
            },
            // Contract Payments - might have payment data
            {
                name: 'Contract Payments',
                url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/contract_payments`,
                params: { project_id: testProjectId, per_page: 1 },
            },
            // Budget (v1.0) - might have cost data
            {
                name: 'Budget (v1.0)',
                url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/projects/${testProjectId}/budget`,
                params: { company_id: PROCORE_CONFIG.companyId },
            },
        ];
        
        for (const endpoint of endpointsToTry) {
            try {
                console.log(`\n=== Trying: ${endpoint.name} ===`);
                console.log(`URL: ${endpoint.url}`);
                console.log(`Params:`, endpoint.params);
                
                const response = await axios.get(endpoint.url, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Procore-Company-Id': PROCORE_CONFIG.companyId,
                    },
                    params: endpoint.params,
                });
                
                const data = response.data?.data || response.data || [];
                console.log(`✅ SUCCESS: ${endpoint.name}`);
                console.log(`Status: ${response.status}`);
                console.log(`Data type: ${Array.isArray(data) ? 'Array' : typeof data}`);
                
                if (Array.isArray(data) && data.length > 0) {
                    console.log(`Array length: ${data.length}`);
                    console.log(`First item keys:`, Object.keys(data[0]));
                    console.log(`First item structure:`, JSON.stringify(data[0], null, 2));
                } else if (typeof data === 'object' && data !== null) {
                    console.log(`Data keys:`, Object.keys(data));
                    console.log(`Full structure:`, JSON.stringify(data, null, 2));
                }
                
                results.attempts.push({
                    endpoint: endpoint.name,
                    url: endpoint.url,
                    success: true,
                    status: response.status,
                    data: data,
                });
                results.successfulEndpoints.push(endpoint.name);
                
            } catch (error: any) {
                const status = error.response?.status;
                const errorData = error.response?.data;
                console.log(`❌ FAILED: ${endpoint.name}`);
                console.log(`Status: ${status}`);
                console.log(`Error: ${errorData?.error?.message || error.message}`);
                
                results.attempts.push({
                    endpoint: endpoint.name,
                    url: endpoint.url,
                    success: false,
                    status: status,
                    error: errorData?.error?.message || error.message,
                });
            }
        }
        
        return {
            success: results.successfulEndpoints.length > 0,
            projectId: testProjectId,
            successfulEndpoints: results.successfulEndpoints,
            allAttempts: results.attempts,
            message: results.successfulEndpoints.length > 0 
                ? `✅ Found ${results.successfulEndpoints.length} working endpoint(s). Check Firebase logs for details.`
                : '❌ All endpoint attempts failed. Check allAttempts for details.',
        };
    });

// COMPREHENSIVE TEST: Try ALL possible endpoint variations to find what works
export const procoreTestAllVariations = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 180,
        memory: '512MB',
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        
        const userId = context.auth.uid;
        const { projectId } = data;
        
        // Get project ID if not provided
        let testProjectId = projectId;
        if (!testProjectId) {
            try {
                const projectsResponse = await axios.get(
                    `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects`,
                    {
                        headers: {
                            'Authorization': `Bearer ${await getProcoreAccessToken(userId)}`,
                            'Procore-Company-Id': PROCORE_CONFIG.companyId,
                        },
                        params: { per_page: 1 }
                    }
                );
                const projects = projectsResponse.data || [];
                if (Array.isArray(projects) && projects.length > 0) {
                    testProjectId = projects[0].id?.toString();
                }
            } catch (error) {
                throw new functions.https.HttpsError('internal', 'Could not get a project ID to test with.');
            }
        }
        
        const accessToken = await getProcoreAccessToken(userId);
        if (!accessToken) {
            throw new functions.https.HttpsError('unauthenticated', 'No valid Procore access token.');
        }
        
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        const results: any = {
            projectId: testProjectId,
            attempts: [],
            successfulEndpoints: [],
        };
        
        // Helper to test an endpoint
        const testEndpoint = async (name: string, url: string, headers: any, params?: any) => {
            try {
                console.log(`\n=== Testing: ${name} ===`);
                console.log(`URL: ${url}`);
                console.log(`Params:`, params || 'none');
                
                const response = await axios.get(url, { headers, params });
                const data = response.data?.data || response.data || [];
                
                console.log(`✅ SUCCESS: ${name} - Status: ${response.status}`);
                if (Array.isArray(data) && data.length > 0) {
                    console.log(`Array length: ${data.length}, First item keys:`, Object.keys(data[0]));
                } else if (typeof data === 'object' && data !== null) {
                    console.log(`Data keys:`, Object.keys(data));
                }
                
                results.attempts.push({
                    name,
                    url,
                    success: true,
                    status: response.status,
                    hasData: Array.isArray(data) ? data.length > 0 : Object.keys(data || {}).length > 0,
                });
                results.successfulEndpoints.push(name);
                return true;
            } catch (error: any) {
                const status = error.response?.status;
                const errorMsg = error.response?.data?.error?.message || error.message;
                console.log(`❌ FAILED: ${name} - Status: ${status}, Error: ${errorMsg}`);
                
                results.attempts.push({
                    name,
                    url,
                    success: false,
                    status: status,
                    error: errorMsg,
                });
                return false;
            }
        };
        
        const baseHeaders = {
            'Authorization': `Bearer ${accessToken}`,
            'Procore-Company-Id': PROCORE_CONFIG.companyId,
        };
        
        // 1. PRIME CONTRACTS - Try ALL variations
        console.log('\n========== TESTING PRIME CONTRACTS ==========');
        const primeContractVariations = [
            // v2.0 variations
            { name: 'Prime Contracts v2.0 (default)', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/prime_contracts`, params: {} },
            { name: 'Prime Contracts v2.0 (view=default)', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/prime_contracts`, params: { view: 'default' } },
            { name: 'Prime Contracts v2.0 (view=extended)', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/prime_contracts`, params: { view: 'extended' } },
            // v1.0 variations
            { name: 'Prime Contracts v1.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/prime_contracts`, params: {} },
            { name: 'Prime Contracts v1.0 (view=extended)', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/prime_contracts`, params: { view: 'extended' } },
            // VAPID (if it exists)
            { name: 'Prime Contracts VAPID', url: `${PROCORE_CONFIG.apiBaseUrl}/vapid/projects/${testProjectId}/prime_contracts`, params: {} },
        ];
        
        for (const variation of primeContractVariations) {
            await testEndpoint(variation.name, variation.url, baseHeaders, variation.params);
            await delay(100); // Small delay between attempts
        }
        
        // 2. CHECK USER'S PROJECT ROLE FIRST (maybe user needs to be assigned to project)
        console.log('\n========== CHECKING USER PROJECT ROLE ==========');
        try {
            // First, get the current user's info from Procore
            let currentUserEmail: string | null = null;
            try {
                const userInfoUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/me`;
                const userInfoResponse = await axios.get(userInfoUrl, { headers: baseHeaders });
                currentUserEmail = userInfoResponse.data?.login || userInfoResponse.data?.email || null;
                console.log(`Current user (OAuth token owner): ${currentUserEmail || 'Could not determine'}`);
            } catch (userError: any) {
                console.log(`⚠️ Could not get current user info: ${userError.response?.status || userError.message}`);
            }
            
            // Get all project roles
            const rolesUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/project_roles`;
            const rolesResponse = await axios.get(rolesUrl, {
                headers: baseHeaders,
                params: { project_id: testProjectId, per_page: 100 }
            });
            const roles = rolesResponse.data?.data || rolesResponse.data || [];
            console.log(`Project has ${roles.length} role(s) defined`);
            
            if (roles.length > 0) {
                // Check if current user is assigned to any role
                const userRoles = roles.filter((r: any) => {
                    const roleUserEmail = r.user?.login || r.user?.email || r.user?.name;
                    return currentUserEmail && roleUserEmail && roleUserEmail.toLowerCase() === currentUserEmail.toLowerCase();
                });
                
                console.log(`\n📋 All roles on project:`);
                roles.forEach((r: any) => {
                    const roleName = r.role_name || r.role || r.name;
                    const roleUser = r.user?.login || r.user?.email || r.user?.name || 'Not assigned';
                    const isCurrentUser = currentUserEmail && roleUser && roleUser.toLowerCase() === currentUserEmail.toLowerCase();
                    console.log(`  - ${roleName}: ${roleUser} ${isCurrentUser ? '✅ (YOU)' : ''}`);
                });
                
                if (userRoles.length > 0) {
                    console.log(`\n✅ YOU ARE ASSIGNED to ${userRoles.length} role(s) on this project:`);
                    userRoles.forEach((r: any) => {
                        console.log(`  - ${r.role_name || r.role || r.name}`);
                    });
                } else {
                    console.log(`\n⚠️ YOU ARE NOT ASSIGNED to any role on this project!`);
                    console.log(`This might explain why API calls return 403 Forbidden.`);
                    console.log(`Please check Procore UI: Project Settings → Project Team → Make sure your user is assigned.`);
                }
                
                results.userProjectRoles = roles;
                results.currentUserEmail = currentUserEmail;
                results.userIsAssigned = userRoles.length > 0;
                results.userAssignedRoles = userRoles.map((r: any) => r.role_name || r.role || r.name);
            }
        } catch (error: any) {
            console.log(`⚠️ Could not check project roles: ${error.response?.status || error.message}`);
        }
        await delay(100);
        
        // 3. BUDGET VIEWS - Try ALL variations
        console.log('\n========== TESTING BUDGET VIEWS ==========');
        const budgetVariations = [
            { name: 'Budget Views v2.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/project_status_snapshots/budget_views`, params: {} },
            { name: 'Budget Views v1.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/project_status_snapshots/budget_views`, params: {} },
            { name: 'Budget v1.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/projects/${testProjectId}/budget`, params: { company_id: PROCORE_CONFIG.companyId } },
            { name: 'Budget VAPID', url: `${PROCORE_CONFIG.apiBaseUrl}/vapid/projects/${testProjectId}/budget_view`, params: {} },
        ];
        
        for (const variation of budgetVariations) {
            await testEndpoint(variation.name, variation.url, baseHeaders, variation.params);
            await delay(100);
        }
        
        // 4. PAYMENT APPLICATIONS - Try ALL variations
        console.log('\n========== TESTING PAYMENT APPLICATIONS ==========');
        const paymentVariations = [
            { name: 'Payment Applications v1.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/payment_applications`, params: { project_id: testProjectId, per_page: 1 } },
            { name: 'Payment Applications v2.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/payment_applications`, params: {} },
            { name: 'Owner Invoices v1.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/owner_invoices`, params: {} },
        ];
        
        for (const variation of paymentVariations) {
            await testEndpoint(variation.name, variation.url, baseHeaders, variation.params);
            await delay(100);
        }
        
        // 5. INVOICES - Try ALL variations
        console.log('\n========== TESTING INVOICES ==========');
        const invoiceVariations = [
            { name: 'Invoices v1.0 (query param)', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/invoices`, params: { project_id: testProjectId, per_page: 1 } },
            { name: 'Invoices v1.0 (path param)', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/invoices`, params: {} },
            { name: 'Invoices v2.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/invoices`, params: {} },
        ];
        
        for (const variation of invoiceVariations) {
            await testEndpoint(variation.name, variation.url, baseHeaders, variation.params);
            await delay(100);
        }
        
        // 6. REQUISITIONS - Try ALL variations
        console.log('\n========== TESTING REQUISITIONS ==========');
        const requisitionVariations = [
            { name: 'Requisitions v1.0 (query param)', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/requisitions`, params: { project_id: testProjectId, per_page: 1 } },
            { name: 'Requisitions v1.0 (path param)', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/requisitions`, params: {} },
            { name: 'Requisitions v2.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/requisitions`, params: {} },
        ];
        
        for (const variation of requisitionVariations) {
            await testEndpoint(variation.name, variation.url, baseHeaders, variation.params);
            await delay(100);
        }
        
        return {
            success: results.successfulEndpoints.length > 0,
            projectId: testProjectId,
            successfulEndpoints: results.successfulEndpoints,
            totalAttempts: results.attempts.length,
            allAttempts: results.attempts,
            userProjectRoles: results.userProjectRoles || [],
            currentUserEmail: results.currentUserEmail || null,
            userIsAssigned: results.userIsAssigned || false,
            userAssignedRoles: results.userAssignedRoles || [],
            message: results.successfulEndpoints.length > 0 
                ? `✅ Found ${results.successfulEndpoints.length} working endpoint(s) out of ${results.attempts.length} attempts. Check Firebase logs for details.`
                : `❌ All ${results.attempts.length} endpoint attempts failed. This suggests a permissions issue. Check Firebase logs for details.`,
        };
    });

// TEST FUNCTION: Test ALL cost-related endpoints (Job To Date Cost, Est Cost At Completion)
export const procoreTestCostEndpoints = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 180,
        memory: '512MB',
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        
        const userId = context.auth.uid;
        const { projectId } = data;
        
        // Get project ID if not provided
        let testProjectId = projectId;
        if (!testProjectId) {
            try {
                const projectsResponse = await axios.get(
                    `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects`,
                    {
                        headers: {
                            'Authorization': `Bearer ${await getProcoreAccessToken(userId)}`,
                            'Procore-Company-Id': PROCORE_CONFIG.companyId,
                        },
                        params: { per_page: 1 }
                    }
                );
                const projects = projectsResponse.data || [];
                if (Array.isArray(projects) && projects.length > 0) {
                    testProjectId = projects[0].id?.toString();
                }
            } catch (error) {
                throw new functions.https.HttpsError('internal', 'Could not get a project ID to test with.');
            }
        }
        
        const accessToken = await getProcoreAccessToken(userId);
        if (!accessToken) {
            throw new functions.https.HttpsError('unauthenticated', 'No valid Procore access token.');
        }
        
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        const results: any = {
            projectId: testProjectId,
            attempts: [],
            successfulEndpoints: [],
        };
        
        // Helper to test an endpoint and log full structure
        const testEndpoint = async (name: string, url: string, headers: any, params?: any) => {
            try {
                console.log(`\n=== Testing: ${name} ===`);
                console.log(`URL: ${url}`);
                console.log(`Params:`, params || 'none');
                
                const response = await axios.get(url, { headers, params });
                const data = response.data?.data || response.data || [];
                
                console.log(`✅ SUCCESS: ${name} - Status: ${response.status}`);
                
                // Log full structure for first item if array
                if (Array.isArray(data) && data.length > 0) {
                    console.log(`Array length: ${data.length}`);
                    console.log(`First item keys:`, Object.keys(data[0]));
                    console.log(`First item FULL structure:`, JSON.stringify(data[0], null, 2));
                } else if (typeof data === 'object' && data !== null) {
                    console.log(`Data keys:`, Object.keys(data));
                    console.log(`Data FULL structure:`, JSON.stringify(data, null, 2));
                }
                
                results.attempts.push({
                    name,
                    url,
                    success: true,
                    status: response.status,
                    hasData: Array.isArray(data) ? data.length > 0 : Object.keys(data || {}).length > 0,
                    dataStructure: Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : (typeof data === 'object' ? Object.keys(data || {}) : []),
                });
                results.successfulEndpoints.push(name);
                return true;
            } catch (error: any) {
                const status = error.response?.status;
                const errorMsg = error.response?.data?.error?.message || error.message;
                console.log(`❌ FAILED: ${name} - Status: ${status}, Error: ${errorMsg}`);
                
                results.attempts.push({
                    name,
                    url,
                    success: false,
                    status: status,
                    error: errorMsg,
                });
                return false;
            }
        };
        
        const baseHeaders = {
            'Authorization': `Bearer ${accessToken}`,
            'Procore-Company-Id': PROCORE_CONFIG.companyId,
        };
        
        // 1. CONTRACT PAYMENTS - Try ALL variations
        console.log('\n========== TESTING CONTRACT PAYMENTS ==========');
        const contractPaymentVariations = [
            { name: 'Contract Payments v1.0 (query param)', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/contract_payments`, params: { project_id: testProjectId } },
            { name: 'Contract Payments v1.0 (path param)', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/contract_payments`, params: {} },
            { name: 'Contract Payments v2.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/contract_payments`, params: {} },
            { name: 'Payments v1.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/payments`, params: { project_id: testProjectId } },
            { name: 'Payments v2.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/payments`, params: {} },
        ];
        
        for (const variation of contractPaymentVariations) {
            await testEndpoint(variation.name, variation.url, baseHeaders, variation.params);
            await delay(100);
        }
        
        // 2. COMMITMENTS - Try ALL variations and check for amount fields
        console.log('\n========== TESTING COMMITMENTS ==========');
        const commitmentVariations = [
            { name: 'Commitments v1.0 (query param)', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/commitments`, params: { project_id: testProjectId } },
            { name: 'Commitments v1.0 (path param)', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/commitments`, params: {} },
            { name: 'Commitments v2.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/commitments`, params: {} },
            { name: 'Subcontracts v1.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/subcontracts`, params: { project_id: testProjectId } },
            { name: 'Subcontracts v2.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/subcontracts`, params: {} },
            { name: 'Purchase Orders v1.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/purchase_orders`, params: { project_id: testProjectId } },
            { name: 'Purchase Orders v2.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/purchase_orders`, params: {} },
        ];
        
        for (const variation of commitmentVariations) {
            await testEndpoint(variation.name, variation.url, baseHeaders, variation.params);
            await delay(100);
        }
        
        // 3. BUDGET/COST ENDPOINTS - Try ALL variations
        console.log('\n========== TESTING BUDGET/COST ENDPOINTS ==========');
        const budgetCostVariations = [
            { name: 'Budget v1.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/projects/${testProjectId}/budget`, params: { company_id: PROCORE_CONFIG.companyId } },
            { name: 'Budget v2.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/budget`, params: {} },
            { name: 'Budget Line Items v2.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/budget_line_items`, params: {} },
            { name: 'Budget Modifications v1.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/budget_modifications`, params: { project_id: testProjectId } },
            { name: 'Budget Modifications v2.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/budget_modifications`, params: {} },
            { name: 'Budget Changes v1.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/budget_changes`, params: { project_id: testProjectId } },
            { name: 'Budget Changes v2.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/budget_changes`, params: {} },
            { name: 'Project Costs v1.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/project_costs`, params: { project_id: testProjectId } },
            { name: 'Cost Codes v1.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/cost_codes`, params: { project_id: testProjectId } },
        ];
        
        for (const variation of budgetCostVariations) {
            await testEndpoint(variation.name, variation.url, baseHeaders, variation.params);
            await delay(100);
        }
        
        // 4. PROJECT STATUS SNAPSHOTS (for cost data)
        console.log('\n========== TESTING PROJECT STATUS SNAPSHOTS (COST DATA) ==========');
        const snapshotVariations = [
            { name: 'Project Status Snapshots v2.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/project_status_snapshots`, params: { per_page: 1, sort: '-created_at' } },
            { name: 'Project Status Snapshots v1.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/project_status_snapshots`, params: { per_page: 1, sort: '-created_at' } },
        ];
        
        for (const variation of snapshotVariations) {
            await testEndpoint(variation.name, variation.url, baseHeaders, variation.params);
            await delay(100);
        }
        
        return {
            success: results.successfulEndpoints.length > 0,
            projectId: testProjectId,
            successfulEndpoints: results.successfulEndpoints,
            totalAttempts: results.attempts.length,
            allAttempts: results.attempts,
            message: results.successfulEndpoints.length > 0 
                ? `✅ Found ${results.successfulEndpoints.length} working cost endpoint(s) out of ${results.attempts.length} attempts. Check Firebase logs for full data structures.`
                : `❌ All ${results.attempts.length} cost endpoint attempts failed. Check Firebase logs for details.`,
        };
    });

// TEST FUNCTION: Test ALL archive date endpoints
export const procoreTestArchiveDateEndpoints = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 180,
        memory: '512MB',
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        
        const userId = context.auth.uid;
        const { projectId } = data;
        
        // Get project ID if not provided
        let testProjectId = projectId;
        if (!testProjectId) {
            try {
                const projectsResponse = await axios.get(
                    `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects`,
                    {
                        headers: {
                            'Authorization': `Bearer ${await getProcoreAccessToken(userId)}`,
                            'Procore-Company-Id': PROCORE_CONFIG.companyId,
                        },
                        params: { per_page: 1 }
                    }
                );
                const projects = projectsResponse.data || [];
                if (Array.isArray(projects) && projects.length > 0) {
                    testProjectId = projects[0].id?.toString();
                }
            } catch (error) {
                throw new functions.https.HttpsError('internal', 'Could not get a project ID to test with.');
            }
        }
        
        const accessToken = await getProcoreAccessToken(userId);
        if (!accessToken) {
            throw new functions.https.HttpsError('unauthenticated', 'No valid Procore access token.');
        }
        
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        const results: any = {
            projectId: testProjectId,
            attempts: [],
            successfulEndpoints: [],
        };
        
        // Helper to test an endpoint and log full structure, specifically looking for archive date fields
        const testEndpoint = async (name: string, url: string, headers: any, params?: any) => {
            try {
                console.log(`\n=== Testing: ${name} ===`);
                console.log(`URL: ${url}`);
                console.log(`Params:`, params || 'none');
                
                const response = await axios.get(url, { headers, params });
                const data = response.data?.data || response.data || [];
                
                console.log(`✅ SUCCESS: ${name} - Status: ${response.status}`);
                
                // Log full structure and specifically check for archive-related fields
                let archiveFields: any = {};
                if (Array.isArray(data) && data.length > 0) {
                    console.log(`Array length: ${data.length}`);
                    console.log(`First item keys:`, Object.keys(data[0]));
                    console.log(`First item FULL structure:`, JSON.stringify(data[0], null, 2));
                    
                    // Check for archive fields in first item
                    const firstItem = data[0];
                    archiveFields = {
                        archived_at: firstItem.archived_at,
                        archive_date: firstItem.archive_date,
                        archived: firstItem.archived,
                        closed_at: firstItem.closed_at,
                        closed_date: firstItem.closed_date,
                        status: firstItem.status,
                        status_name: firstItem.status_name,
                        active: firstItem.active,
                        updated_at: firstItem.updated_at,
                    };
                } else if (typeof data === 'object' && data !== null) {
                    console.log(`Data keys:`, Object.keys(data));
                    console.log(`Data FULL structure:`, JSON.stringify(data, null, 2));
                    
                    // Check for archive fields in object
                    archiveFields = {
                        archived_at: data.archived_at,
                        archive_date: data.archive_date,
                        archived: data.archived,
                        closed_at: data.closed_at,
                        closed_date: data.closed_date,
                        status: data.status,
                        status_name: data.status_name,
                        active: data.active,
                        updated_at: data.updated_at,
                    };
                }
                
                console.log(`📋 Archive-related fields found:`, archiveFields);
                
                results.attempts.push({
                    name,
                    url,
                    success: true,
                    status: response.status,
                    hasData: Array.isArray(data) ? data.length > 0 : Object.keys(data || {}).length > 0,
                    archiveFields: archiveFields,
                    dataStructure: Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : (typeof data === 'object' ? Object.keys(data || {}) : []),
                });
                results.successfulEndpoints.push(name);
                return true;
            } catch (error: any) {
                const status = error.response?.status;
                const errorMsg = error.response?.data?.error?.message || error.message;
                console.log(`❌ FAILED: ${name} - Status: ${status}, Error: ${errorMsg}`);
                
                results.attempts.push({
                    name,
                    url,
                    success: false,
                    status: status,
                    error: errorMsg,
                });
                return false;
            }
        };
        
        const baseHeaders = {
            'Authorization': `Bearer ${accessToken}`,
            'Procore-Company-Id': PROCORE_CONFIG.companyId,
        };
        
        // Test various project endpoints for archive date
        console.log('\n========== TESTING PROJECT ENDPOINTS FOR ARCHIVE DATE ==========');
        const projectVariations = [
            { name: 'Projects v1.0 (list)', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects`, params: { per_page: 1 } },
            { name: 'Projects v1.0 (detail)', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/projects/${testProjectId}`, params: { company_id: PROCORE_CONFIG.companyId } },
            { name: 'Projects v2.0 (list)', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects`, params: { per_page: 1 } },
            { name: 'Projects v2.0 (detail)', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}`, params: {} },
            { name: 'Project Status v1.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/projects/${testProjectId}/status`, params: { company_id: PROCORE_CONFIG.companyId } },
            { name: 'Project Status v2.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/status`, params: {} },
            { name: 'Project Stages v1.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/projects/${testProjectId}/stages`, params: { company_id: PROCORE_CONFIG.companyId } },
            { name: 'Project Stages v2.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/stages`, params: {} },
        ];
        
        for (const variation of projectVariations) {
            await testEndpoint(variation.name, variation.url, baseHeaders, variation.params);
            await delay(100);
        }
        
        // Test custom fields endpoint - archive date might be in custom fields
        console.log('\n========== TESTING CUSTOM FIELDS FOR ARCHIVE DATE ==========');
        try {
            const customFieldsUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/projects/${testProjectId}/custom_fields`;
            await testEndpoint('Custom Fields v1.0', customFieldsUrl, baseHeaders, { company_id: PROCORE_CONFIG.companyId });
            await delay(100);
        } catch (error) {
            console.log('Custom fields test failed');
        }
        
        return {
            success: results.successfulEndpoints.length > 0,
            projectId: testProjectId,
            successfulEndpoints: results.successfulEndpoints,
            totalAttempts: results.attempts.length,
            allAttempts: results.attempts,
            message: results.successfulEndpoints.length > 0 
                ? `✅ Found ${results.successfulEndpoints.length} working endpoint(s) out of ${results.attempts.length} attempts. Check Firebase logs for archive date fields.`
                : `❌ All ${results.attempts.length} archive date endpoint attempts failed. Check Firebase logs for details.`,
        };
    });

// TEST FUNCTION: Test ALL Budget Views endpoints for Est Cost At Completion
export const procoreTestBudgetViewsEndpoints = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 180,
        memory: '512MB',
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        
        const userId = context.auth.uid;
        const { projectId } = data;
        
        // Get project ID if not provided
        let testProjectId = projectId;
        if (!testProjectId) {
            try {
                const projectsResponse = await axios.get(
                    `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects`,
                    {
                        headers: {
                            'Authorization': `Bearer ${await getProcoreAccessToken(userId)}`,
                            'Procore-Company-Id': PROCORE_CONFIG.companyId,
                        },
                        params: { per_page: 1 }
                    }
                );
                const projects = projectsResponse.data || [];
                if (Array.isArray(projects) && projects.length > 0) {
                    testProjectId = projects[0].id?.toString();
                }
            } catch (error) {
                throw new functions.https.HttpsError('internal', 'Could not get a project ID to test with.');
            }
        }
        
        const accessToken = await getProcoreAccessToken(userId);
        if (!accessToken) {
            throw new functions.https.HttpsError('unauthenticated', 'No valid Procore access token.');
        }
        
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        const results: any = {
            projectId: testProjectId,
            attempts: [],
            successfulEndpoints: [],
        };
        
        // Helper to test an endpoint and log full structure, specifically looking for Est Cost At Completion fields
        const testEndpoint = async (name: string, url: string, headers: any, params?: any) => {
            try {
                console.log(`\n=== Testing: ${name} ===`);
                console.log(`URL: ${url}`);
                console.log(`Params:`, params || 'none');
                
                const response = await axios.get(url, { headers, params });
                const data = response.data?.data || response.data || [];
                
                console.log(`✅ SUCCESS: ${name} - Status: ${response.status}`);
                
                // Log full structure and specifically check for Est Cost At Completion fields
                let costFields: any = {};
                if (Array.isArray(data) && data.length > 0) {
                    console.log(`Array length: ${data.length}`);
                    console.log(`First item keys:`, Object.keys(data[0]));
                    console.log(`First item FULL structure:`, JSON.stringify(data[0], null, 2));
                    
                    // Check for cost fields in first item
                    const firstItem = data[0];
                    costFields = {
                        estimated_cost_at_completion: firstItem.estimated_cost_at_completion,
                        est_cost_at_completion: firstItem.est_cost_at_completion,
                        total_cost: firstItem.total_cost,
                        estimated_cost: firstItem.estimated_cost,
                        cost_at_completion: firstItem.cost_at_completion,
                        budgeted_cost: firstItem.budgeted_cost,
                        job_to_date_cost: firstItem.job_to_date_cost,
                        jtd_cost: firstItem.jtd_cost,
                        cost_to_date: firstItem.cost_to_date,
                    };
                } else if (typeof data === 'object' && data !== null) {
                    console.log(`Data keys:`, Object.keys(data));
                    console.log(`Data FULL structure:`, JSON.stringify(data, null, 2));
                    
                    // Check for cost fields in object
                    costFields = {
                        estimated_cost_at_completion: data.estimated_cost_at_completion,
                        est_cost_at_completion: data.est_cost_at_completion,
                        total_cost: data.total_cost,
                        estimated_cost: data.estimated_cost,
                        cost_at_completion: data.cost_at_completion,
                        budgeted_cost: data.budgeted_cost,
                        job_to_date_cost: data.job_to_date_cost,
                        jtd_cost: data.jtd_cost,
                        cost_to_date: data.cost_to_date,
                    };
                }
                
                console.log(`💰 Est Cost At Completion fields found:`, costFields);
                
                results.attempts.push({
                    name,
                    url,
                    success: true,
                    status: response.status,
                    hasData: Array.isArray(data) ? data.length > 0 : Object.keys(data || {}).length > 0,
                    costFields: costFields,
                    dataStructure: Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : (typeof data === 'object' ? Object.keys(data || {}) : []),
                });
                results.successfulEndpoints.push(name);
                return true;
            } catch (error: any) {
                const status = error.response?.status;
                const errorMsg = error.response?.data?.error?.message || error.message;
                console.log(`❌ FAILED: ${name} - Status: ${status}, Error: ${errorMsg}`);
                
                results.attempts.push({
                    name,
                    url,
                    success: false,
                    status: status,
                    error: errorMsg,
                });
                return false;
            }
        };
        
        const baseHeaders = {
            'Authorization': `Bearer ${accessToken}`,
            'Procore-Company-Id': PROCORE_CONFIG.companyId,
        };
        
        // Test various Budget Views endpoints
        console.log('\n========== TESTING BUDGET VIEWS ENDPOINTS FOR EST COST AT COMPLETION ==========');
        
        // First, try to get budget_view_id if available
        let budgetViewId: string | null = null;
        try {
            // Try to get budget views list first
            const budgetViewsListUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/project_status_snapshots/budget_views`;
            const budgetViewsListResponse = await axios.get(budgetViewsListUrl, { headers: baseHeaders, params: { per_page: 1 } });
            const budgetViewsList = budgetViewsListResponse.data?.data || budgetViewsListResponse.data || [];
            if (Array.isArray(budgetViewsList) && budgetViewsList.length > 0) {
                budgetViewId = budgetViewsList[0].id?.toString() || null;
                console.log(`Found budget_view_id: ${budgetViewId}`);
            }
        } catch (error) {
            console.log('Could not get budget_view_id, will try without it');
        }
        
        const budgetViewsVariations: Array<{ name: string; url: string; params: any }> = [
            // Budget Views endpoints - try with and without budget_view_id
            { name: 'Budget Views v2.0 (from snapshots, with per_page)', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/project_status_snapshots/budget_views`, params: { per_page: 1 } },
            { name: 'Budget Views v1.0 (from snapshots)', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/project_status_snapshots/budget_views`, params: {} },
            { name: 'Budget Views v2.0 (direct)', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/budget_views`, params: {} },
            { name: 'Budget Views v1.0 (direct)', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/projects/${testProjectId}/budget_views`, params: { company_id: PROCORE_CONFIG.companyId } },
            // Project Status Snapshots (might contain budget views)
            { name: 'Project Status Snapshots v2.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/project_status_snapshots`, params: { per_page: 1, sort: '-created_at' } },
            { name: 'Project Status Snapshots v1.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/project_status_snapshots`, params: { per_page: 1, sort: '-created_at' } },
            // Budget endpoints (might have views)
            { name: 'Budget v1.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/projects/${testProjectId}/budget`, params: { company_id: PROCORE_CONFIG.companyId } },
            { name: 'Budget v2.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/budget`, params: {} },
            // Budget Line Items (we're already using this, but let's verify it has the right fields)
            { name: 'Budget Line Items v2.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/budget_line_items`, params: {} },
            { name: 'Budget Line Items v1.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/projects/${testProjectId}/budget_line_items`, params: { company_id: PROCORE_CONFIG.companyId } },
        ];
        
        // Add budget_view_id variation if we found one
        if (budgetViewId) {
            budgetViewsVariations.push({ 
                name: 'Budget Views v2.0 (from snapshots, with budget_view_id)', 
                url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/project_status_snapshots/budget_views/${budgetViewId}`, 
                params: {} 
            });
        }
        
        for (const variation of budgetViewsVariations) {
            await testEndpoint(variation.name, variation.url, baseHeaders, variation.params);
            await delay(100);
        }
        
        return {
            success: results.successfulEndpoints.length > 0,
            projectId: testProjectId,
            successfulEndpoints: results.successfulEndpoints,
            totalAttempts: results.attempts.length,
            allAttempts: results.attempts,
            message: results.successfulEndpoints.length > 0 
                ? `✅ Found ${results.successfulEndpoints.length} working endpoint(s) out of ${results.attempts.length} attempts. Check Firebase logs for Est Cost At Completion fields.`
                : `❌ All ${results.attempts.length} Budget Views endpoint attempts failed. Check Firebase logs for details.`,
        };
    });

// TEST FUNCTION: Test ALL Project Manager endpoints
export const procoreTestProjectManagerEndpoints = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 180,
        memory: '512MB',
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        
        const userId = context.auth.uid;
        const { projectId } = data;
        
        // Get project ID if not provided
        let testProjectId = projectId;
        if (!testProjectId) {
            try {
                const projectsResponse = await axios.get(
                    `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects`,
                    {
                        headers: {
                            'Authorization': `Bearer ${await getProcoreAccessToken(userId)}`,
                            'Procore-Company-Id': PROCORE_CONFIG.companyId,
                        },
                        params: { per_page: 1 }
                    }
                );
                const projects = projectsResponse.data || [];
                if (Array.isArray(projects) && projects.length > 0) {
                    testProjectId = projects[0].id?.toString();
                }
            } catch (error) {
                throw new functions.https.HttpsError('internal', 'Could not get a project ID to test with.');
            }
        }
        
        const accessToken = await getProcoreAccessToken(userId);
        if (!accessToken) {
            throw new functions.https.HttpsError('unauthenticated', 'No valid Procore access token.');
        }
        
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        const results: any = {
            projectId: testProjectId,
            attempts: [],
            successfulEndpoints: [],
        };
        
        // Helper to test an endpoint and log full structure, specifically looking for Project Manager fields
        const testEndpoint = async (name: string, url: string, headers: any, params?: any) => {
            try {
                console.log(`\n=== Testing: ${name} ===`);
                console.log(`URL: ${url}`);
                console.log(`Params:`, params || 'none');
                
                const response = await axios.get(url, { headers, params });
                const data = response.data?.data || response.data || [];
                
                console.log(`✅ SUCCESS: ${name} - Status: ${response.status}`);
                
                // Log full structure and specifically check for Project Manager fields
                let managerFields: any = {};
                if (Array.isArray(data) && data.length > 0) {
                    console.log(`Array length: ${data.length}`);
                    console.log(`First item keys:`, Object.keys(data[0]));
                    console.log(`First item FULL structure:`, JSON.stringify(data[0], null, 2));
                    
                    // Check for manager fields in first item
                    const firstItem = data[0];
                    managerFields = {
                        role_name: firstItem.role_name,
                        role: firstItem.role,
                        name: firstItem.name,
                        user_name: firstItem.user?.name,
                        user_full_name: firstItem.user?.full_name,
                        user_display_name: firstItem.user?.display_name,
                        user_login: firstItem.user?.login,
                        user_email: firstItem.user?.email,
                        user: firstItem.user,
                    };
                } else if (typeof data === 'object' && data !== null) {
                    console.log(`Data keys:`, Object.keys(data));
                    console.log(`Data FULL structure:`, JSON.stringify(data, null, 2));
                    
                    // Check for manager fields in object
                    managerFields = {
                        project_manager: data.project_manager,
                        manager_name: data.manager_name,
                        manager: data.manager,
                        created_by_name: data.created_by?.name,
                        created_by_full_name: data.created_by?.full_name,
                        created_by: data.created_by,
                    };
                }
                
                console.log(`👤 Project Manager fields found:`, managerFields);
                
                results.attempts.push({
                    name,
                    url,
                    success: true,
                    status: response.status,
                    hasData: Array.isArray(data) ? data.length > 0 : Object.keys(data || {}).length > 0,
                    managerFields: managerFields,
                    dataStructure: Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : (typeof data === 'object' ? Object.keys(data || {}) : []),
                });
                results.successfulEndpoints.push(name);
                return true;
            } catch (error: any) {
                const status = error.response?.status;
                const errorMsg = error.response?.data?.error?.message || error.message;
                console.log(`❌ FAILED: ${name} - Status: ${status}, Error: ${errorMsg}`);
                
                results.attempts.push({
                    name,
                    url,
                    success: false,
                    status: status,
                    error: errorMsg,
                });
                return false;
            }
        };
        
        const baseHeaders = {
            'Authorization': `Bearer ${accessToken}`,
            'Procore-Company-Id': PROCORE_CONFIG.companyId,
        };
        
        // Test various Project Manager endpoints
        console.log('\n========== TESTING PROJECT MANAGER ENDPOINTS ==========');
        const projectManagerVariations = [
            // Project Roles endpoints
            { name: 'Project Roles v1.0 (query param)', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/project_roles`, params: { project_id: testProjectId } },
            { name: 'Project Roles v1.0 (path param)', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/project_roles`, params: {} },
            { name: 'Project Roles v2.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/project_roles`, params: {} },
            // Project detail (might have manager info)
            { name: 'Project Detail v1.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/projects/${testProjectId}`, params: { company_id: PROCORE_CONFIG.companyId } },
            { name: 'Project Detail v2.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}`, params: {} },
            // Project list (might have manager in list view)
            { name: 'Projects List v1.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects`, params: { per_page: 1, id: testProjectId } },
            // Users assigned to project
            { name: 'Project Users v1.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/projects/${testProjectId}/users`, params: { company_id: PROCORE_CONFIG.companyId } },
            { name: 'Project Users v2.0', url: `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${testProjectId}/users`, params: {} },
        ];
        
        for (const variation of projectManagerVariations) {
            await testEndpoint(variation.name, variation.url, baseHeaders, variation.params);
            await delay(100);
        }
        
        return {
            success: results.successfulEndpoints.length > 0,
            projectId: testProjectId,
            successfulEndpoints: results.successfulEndpoints,
            totalAttempts: results.attempts.length,
            allAttempts: results.attempts,
            message: results.successfulEndpoints.length > 0 
                ? `✅ Found ${results.successfulEndpoints.length} working endpoint(s) out of ${results.attempts.length} attempts. Check Firebase logs for Project Manager fields.`
                : `❌ All ${results.attempts.length} Project Manager endpoint attempts failed. Check Firebase logs for details.`,
        };
    });

// ============================================================================
// AZURE SQL DATABASE FUNCTIONS - Project Profitability from Database
// ============================================================================
// This approach queries the Azure SQL database that feeds Power BI directly
// Benefits: No rate limits, faster, matches Power BI exactly, more reliable

// Azure SQL Database Configuration
// Use Firebase Functions config (legacy) or environment variables
const getAzureSqlConfig = () => {
    // Use Firebase Functions secrets (modern, secure approach)
    // Secrets are automatically available as environment variables
    // Trim whitespace/newlines that might have been included when setting secrets
    const server = process.env.AZURE_SQL_SERVER?.trim();
    const database = process.env.AZURE_SQL_DATABASE?.trim();
    const user = process.env.AZURE_SQL_USER?.trim();
    const password = process.env.AZURE_SQL_PASSWORD?.trim();
    
    if (!server || !database || !user || !password) {
        throw new Error(
            'Azure SQL credentials not configured. ' +
            'Please ensure AZURE_SQL_SERVER, AZURE_SQL_DATABASE, AZURE_SQL_USER, and AZURE_SQL_PASSWORD ' +
            'secrets are set via: firebase functions:secrets:set'
        );
    }
    
    console.log('✅ Using Azure SQL credentials from Firebase Functions secrets');
    
    return {
        server: server,
        database: database,
        user: user,
        password: password,
        // Increase default request timeout (mssql default is 15000ms, which is too low for heavy views)
        // This prevents "Timeout: Request failed to complete in 15000ms" when the Azure view is busy
        requestTimeout: 60000, // 60 seconds
        options: {
            encrypt: true, // Required for Azure SQL
            trustServerCertificate: true, // Azure SQL uses proper certificates but hostname matching can be strict
            enableArithAbort: true,
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000,
        },
    };
};

// Get all projects with profitability data from Azure SQL Database
// This replaces the Procore API approach and matches Power BI exactly
export const azureSqlGetAllProjectsProfitability = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 540,
        memory: '512MB',
        secrets: ['AZURE_SQL_SERVER', 'AZURE_SQL_DATABASE', 'AZURE_SQL_USER', 'AZURE_SQL_PASSWORD'],
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const userId = context.auth.uid;
        let progressRef: admin.firestore.DocumentReference | null = null;
        let progressDocId: string | null = null;
        let progressRefCreated = false;

        try {
            // Create progress tracking document
            try {
                const progressData = {
                    userId: userId,
                    totalProjects: 0, // Will update after query
                    processedProjects: 0,
                    currentProject: '',
                    status: 'processing' as const,
                    startedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                const progressDoc = await admin.firestore().collection('procoreSyncProgress').add(progressData);
                progressRef = progressDoc;
                progressDocId = progressDoc.id;
                progressRefCreated = true;
                console.log(`Progress tracking document created: ${progressDocId}`);
            } catch (progressError) {
                console.warn('Could not create progress document, continuing without progress tracking:', progressError);
            }

            // Connect to Azure SQL Database
            // This database is the same source that feeds Power BI, so we get the most up-to-date data
            // The view is refreshed regularly and contains all calculated values matching the Formula Reference Chart
            console.log('Connecting to Azure SQL Database...');
            const azureSqlConfig = getAzureSqlConfig();
            const pool = await sql.connect(azureSqlConfig);
            console.log('✅ Connected to Azure SQL Database');

            try {
                // Query the ProjectProfitabilityArchive table
                // Power BI uses this table and filters to the most recent ArchiveDate per project
                // This matches Power BI's "Is Most Recent?" calculated column logic
                // Based on investigation queries:
                // - Query 5: Most recent archive records = 563 projects, $273.8M Total Contract Value
                // - Query 6: Calculated Projected Profit ($161.8M) matches Power BI ($158.9M) when using Total Contract Value - Est Cost At Completion
                // - Power BI values: $264.6M Total Contract Value, $158.9M Projected Profit, $45.3M Job To Date Cost
                
                // Power BI Filter: Based on investigation, Power BI uses:
                // - RedTeamImport = 0 (excludes RedTeam projects)
                // - ProjectRevisedContractAmount > 0 (excludes zero/negative contract values)
                // This gives us Projected Profit that matches Power BI almost exactly ($9,331 difference)
                // Query C results: $158,936,026 vs Power BI $158,945,357
                
                // Allow filtering by Active status (default: use Power BI matching filter)
                const filterOption = data?.filterOption || 'power_bi_match'; // 'power_bi_match', 'all', 'active', 'active_no_null', 'active_approved', 'all_approved', 'all_no_null'
                
                // Build WHERE clause for additional filters (applied after most recent filter)
                let additionalWhereClause = '';
                switch (filterOption) {
                    case 'power_bi_match':
                        // Matches Power BI filter exactly: Query 18 matched $267,778,125.48
                        // Only filter: ProjectRevisedContractAmount > 0 (no RedTeamImport filter)
                        // The date filter is handled in the main query (most recent date only)
                        additionalWhereClause = `AND ppa.ProjectRevisedContractAmount > 0`;
                        break;
                    case 'active':
                        additionalWhereClause = 'AND ppa.IsActive = 1';
                        break;
                    case 'active_no_null':
                        additionalWhereClause = `AND ppa.IsActive = 1 
                            AND ppa.ProjectRevisedContractAmount IS NOT NULL 
                            AND ppa.ProjectedProfit IS NOT NULL 
                            AND ppa.JobCostToDate IS NOT NULL`;
                        break;
                    case 'active_approved':
                        additionalWhereClause = `AND ppa.IsActive = 1 AND ppa.ContractStatus = 'Approved'`;
                        break;
                    case 'all_approved':
                        additionalWhereClause = `AND ppa.ContractStatus = 'Approved'`;
                        break;
                    case 'all_no_null':
                        additionalWhereClause = `AND ppa.ProjectRevisedContractAmount IS NOT NULL 
                            AND ppa.ProjectedProfit IS NOT NULL 
                            AND ppa.JobCostToDate IS NOT NULL`;
                        break;
                    case 'all':
                    default:
                        additionalWhereClause = '';
                        break;
                }
                
                // Query to get most recent archive record for each project (matching Power BI's "Is Most Recent?" logic)
                // Power BI filters to the most recent ArchiveDate (by date) and ensures it's the MAX per project
                // Query 18 results: $267,778,125.48 Total Contract Value - EXACT MATCH to Power BI's $267,778,125
                // This matches Power BI's filter: ArchiveDate date = most recent date AND Is Most Recent? = Yes
                // Query 18 did NOT have RedTeamImport = 0 filter, so power_bi_match should not include it
                const query = `
                    WITH MostRecentArchiveDate AS (
                        -- Get the most recent ArchiveDate (by date) in the entire table
                        SELECT MAX(CAST(ArchiveDate AS DATE)) as LatestArchiveDateOnly
                        FROM dbo.ProjectProfitabilityArchive
                    ),
                    MostRecentArchive AS (
                        -- Get the MAX ArchiveDate per project, but only for projects where MAX falls on the most recent date
                        SELECT 
                            ppa.ProjectNumber,
                            MAX(ppa.ArchiveDate) as LatestArchiveDate
                        FROM dbo.ProjectProfitabilityArchive ppa
                        CROSS JOIN MostRecentArchiveDate mrad
                        WHERE CAST(ppa.ArchiveDate AS DATE) = mrad.LatestArchiveDateOnly
                        GROUP BY ppa.ProjectNumber
                    )
                    SELECT 
                        ppa.ProjectName,
                        ppa.ProjectRevisedContractAmount,
                        ppa.ProjectNumber,
                        ppa.ProjectManager,
                        ppa.RedTeamImport,
                        ppa.IsActive as Active,
                        ppa.EstCostAtCompletion,
                        ppa.JobCostToDate,
                        ppa.PercentCompleteBasedOnCost,
                        ppa.RemainingCost,
                        ppa.ProjectedProfit,
                        ppa.ProjectedProfitPercentage,
                        ppa.ContractStartDate,
                        ppa.ContractEndDate,
                        ppa.TotalInvoiced,
                        ppa.ContractStatus,
                        ppa.ProjectStage,
                        ppa.BalanceLeftOnContract,
                        ppa.PercentCompleteBasedOnRevenue,
                        ppa.CustomerRetainage,
                        ppa.VendorRetainage,
                        ppa.ProfitCenterYear,
                        ppa.ProcoreId,
                        ppa.EstimatedProjectProfit,
                        ppa.ArchiveDate
                    FROM dbo.ProjectProfitabilityArchive ppa
                    INNER JOIN MostRecentArchive mra 
                        ON ppa.ProjectNumber = mra.ProjectNumber 
                        AND ppa.ArchiveDate = mra.LatestArchiveDate
                    CROSS JOIN MostRecentArchiveDate mrad
                    WHERE CAST(ppa.ArchiveDate AS DATE) = mrad.LatestArchiveDateOnly
                    ${additionalWhereClause}
                    ORDER BY ppa.ProjectName
                `;
                
                console.log(`Executing query against ProjectProfitabilityArchive (most recent records only) with filter option: ${filterOption}...`);
                const result = await pool.request().query(query);
                const rows = result.recordset || [];
                console.log(`✅ Query successful: Found ${rows.length} projects (filter: ${filterOption})`);

                // Update progress with total count
                if (progressRefCreated && progressRef) {
                    await progressRef.update({
                        totalProjects: rows.length,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }

                // Map database rows to our application format
                const projectsWithData = rows.map((row: any, index: number) => {
                    // Update progress
                    if (progressRefCreated && progressRef) {
                        progressRef.update({
                            processedProjects: index + 1,
                            currentProject: row.ProjectName || `Project ${index + 1}`,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        }).catch(err => console.warn('Progress update failed:', err));
                    }

                    // Map database columns to application format
                    // This matches the structure returned by procoreGetAllProjectsProfitability
                    const projectData = {
                        id: row.ProcoreId?.toString() || `db-${row.ProjectNumber}`,
                        projectName: row.ProjectName || 'Unknown Project',
                        projectNumber: row.ProjectNumber?.toString() || '',
                        projectManager: row.ProjectManager || '',
                        projectSystem: (row.RedTeamImport === 1 || row.RedTeamImport === true) ? 'Red Team' : 'Procore',
                        projectStatus: row.ProjectStage || row.ContractStatus || 'Active',
                        
                        // Financial fields - directly from database (matches Power BI)
                        totalContractValue: parseFloat(row.ProjectRevisedContractAmount) || 0,
                        estCostAtCompletion: parseFloat(row.EstCostAtCompletion) || 0,
                        initialEstimatedProfit: parseFloat(row.EstimatedProjectProfit) || 0,
                        // Power BI calculates Projected Profit as: Total Contract Value - Est Cost At Completion
                        // This matches the Formula Reference Chart: "Projected Profit: Total Contract Value - Est Cost Of Completion"
                        currentProjectedProfit: (() => {
                            const contractValue = parseFloat(row.ProjectRevisedContractAmount) || 0;
                            const estCost = parseFloat(row.EstCostAtCompletion) || 0;
                            return contractValue - estCost; // Calculate instead of using stored ProjectedProfit
                        })(),
                        estimatedDifference: (() => {
                            const initial = parseFloat(row.EstimatedProjectProfit) || 0;
                            const current = parseFloat(row.ProjectedProfit) || 0;
                            return current - initial;
                        })(),
                        jobToDateCost: parseFloat(row.JobCostToDate) || 0,
                        percentProjectedProfit: parseFloat(row.ProjectedProfitPercentage) || 0,
                        balanceLeftOnContract: parseFloat(row.BalanceLeftOnContract) || 0,
                        percentCompleteRevenue: parseFloat(row.PercentCompleteBasedOnRevenue) || 0,
                        percentCompleteCost: parseFloat(row.PercentCompleteBasedOnCost) || 0,
                        customerRetainage: parseFloat(row.CustomerRetainage) || 0, // ✅ Matches Power BI
                        remainingCost: parseFloat(row.RemainingCost) || 0, // ✅ Matches Power BI ($9,141.90)
                        vendorRetainage: parseFloat(row.VendorRetainage) || 0, // ✅ Matches Power BI ($16,019.86)
                        totalInvoiced: parseFloat(row.TotalInvoiced) || 0,
                        contractStatus: row.ContractStatus || 'Active',
                        contractStartDate: row.ContractStartDate ? new Date(row.ContractStartDate).toISOString() : null,
                        contractEndDate: row.ContractEndDate ? new Date(row.ContractEndDate).toISOString() : null,
                        isActive: row.Active === 1,
                        archiveDate: row.ArchiveDate ? new Date(row.ArchiveDate).toISOString() : null, // Archive date from most recent snapshot
                        
                        // Store source for debugging
                        _source: 'Azure SQL Database - ProjectProfitabilityArchive (Most Recent)',
                        _procoreId: row.ProcoreId,
                        _archiveDate: row.ArchiveDate ? new Date(row.ArchiveDate).toISOString() : null,
                    };

                    return projectData;
                });

                // Close the connection pool
                await pool.close();
                console.log('✅ Database connection closed');

                // Update progress to completed
                if (progressRefCreated && progressRef) {
                    await progressRef.update({
                        status: 'completed',
                        processedProjects: projectsWithData.length,
                        completedAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }

                console.log(`✅ Successfully processed ${projectsWithData.length} projects from Azure SQL Database`);

                return {
                    success: true,
                    data: projectsWithData,
                    totalProjects: projectsWithData.length,
                    progressDocId: progressDocId,
                    source: 'Azure SQL Database',
                };

            } catch (queryError: any) {
                await pool.close();
                throw queryError;
            }

        } catch (error: any) {
            console.error('Error fetching projects from Azure SQL Database:', error);
            
            // Update progress to failed
            if (progressRefCreated && progressRef) {
                try {
                    await progressRef.update({
                        status: 'failed',
                        failedAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        error: error.message || 'Unknown error',
                    });
                } catch (updateError) {
                    console.warn('Could not update progress document:', updateError);
                }
            }

            throw new functions.https.HttpsError(
                'internal',
                `Failed to fetch projects from database: ${error.message || 'Unknown error'}`
            );
        }
    });

// Investigate projects in Azure SQL by project number
// This helps identify duplicate projects before deletion
export const azureSqlInvestigateProject = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 540,
        memory: '512MB',
        secrets: ['AZURE_SQL_SERVER', 'AZURE_SQL_DATABASE', 'AZURE_SQL_USER', 'AZURE_SQL_PASSWORD'],
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const projectNumber = data?.projectNumber;
        if (!projectNumber) {
            throw new functions.https.HttpsError('invalid-argument', 'Project number is required');
        }

        try {
            console.log(`Investigating project number: ${projectNumber}`);
            const azureSqlConfig = getAzureSqlConfig();
            const pool = await sql.connect(azureSqlConfig);
            console.log('✅ Connected to Azure SQL Database');

            try {
                // Query only the most recent archive records for this project number
                // This matches the logic used by Project Profitability page
                // Shows only current records, not entire history
                const query = `
                    WITH MostRecentArchiveDate AS (
                        -- Get the most recent ArchiveDate (by date) in the entire table
                        SELECT MAX(CAST(ArchiveDate AS DATE)) as LatestArchiveDateOnly
                        FROM dbo.ProjectProfitabilityArchive
                    ),
                    MostRecentArchive AS (
                        -- Get the MAX ArchiveDate per project, but only for projects where MAX falls on the most recent date
                        SELECT 
                            ppa.ProjectNumber,
                            MAX(ppa.ArchiveDate) as LatestArchiveDate
                        FROM dbo.ProjectProfitabilityArchive ppa
                        CROSS JOIN MostRecentArchiveDate mrad
                        WHERE CAST(ppa.ArchiveDate AS DATE) = mrad.LatestArchiveDateOnly
                        GROUP BY ppa.ProjectNumber
                    )
                    SELECT 
                        ppa.ProjectName,
                        ppa.ProjectNumber,
                        ppa.ProjectManager,
                        ppa.ArchiveDate,
                        ppa.ProjectRevisedContractAmount,
                        ppa.IsActive as Active,
                        ppa.ContractStatus,
                        ppa.ProjectStage,
                        ppa.ProcoreId,
                        ppa.RedTeamImport,
                        ppa.EstCostAtCompletion,
                        ppa.ProjectedProfit,
                        ppa.ContractStartDate,
                        ppa.ContractEndDate,
                        CAST(ppa.ArchiveDate AS DATE) as ArchiveDateOnly
                    FROM dbo.ProjectProfitabilityArchive ppa
                    INNER JOIN MostRecentArchive mra 
                        ON ppa.ProjectNumber = mra.ProjectNumber 
                        AND ppa.ArchiveDate = mra.LatestArchiveDate
                    CROSS JOIN MostRecentArchiveDate mrad
                    WHERE ppa.ProjectNumber = @projectNumber
                        AND CAST(ppa.ArchiveDate AS DATE) = mrad.LatestArchiveDateOnly
                    ORDER BY ppa.ProjectName
                `;

                const request = pool.request();
                request.input('projectNumber', sql.NVarChar, projectNumber.toString());
                
                console.log(`Executing investigation query for project number: ${projectNumber}...`);
                const result = await request.query(query);
                const rows = result.recordset || [];
                console.log(`✅ Found ${rows.length} record(s) for project number ${projectNumber} on most recent archive date`);

                // Also check for other records on different archive dates
                const allRecordsQuery = `
                    SELECT 
                        ppa.ProjectName,
                        ppa.ProjectNumber,
                        ppa.ProjectManager,
                        ppa.ArchiveDate,
                        ppa.ProjectRevisedContractAmount,
                        ppa.IsActive as Active,
                        ppa.ContractStatus,
                        ppa.ProjectStage,
                        ppa.ProcoreId,
                        ppa.RedTeamImport,
                        ppa.EstCostAtCompletion,
                        ppa.ProjectedProfit,
                        ppa.ContractStartDate,
                        ppa.ContractEndDate,
                        CAST(ppa.ArchiveDate AS DATE) as ArchiveDateOnly
                    FROM dbo.ProjectProfitabilityArchive ppa
                    WHERE ppa.ProjectNumber = @projectNumber
                    ORDER BY ppa.ArchiveDate DESC, ppa.ProjectName
                `;
                
                const allRecordsResult = await request.query(allRecordsQuery);
                const allRows = allRecordsResult.recordset || [];
                console.log(`✅ Found ${allRows.length} total record(s) across all archive dates for project number ${projectNumber}`);

                // Get the most recent archive date to compare
                const mostRecentDateQuery = `SELECT MAX(CAST(ArchiveDate AS DATE)) as LatestArchiveDateOnly FROM dbo.ProjectProfitabilityArchive`;
                const mostRecentDateResult = await request.query(mostRecentDateQuery);
                const mostRecentDate = mostRecentDateResult.recordset[0]?.LatestArchiveDateOnly;

                // Format results for easier review
                const formattedResults = rows.map((row: any, index: number) => {
                    // Convert archiveDateOnly to string (it might be a Date object from SQL)
                    let archiveDateOnlyStr = null;
                    if (row.ArchiveDateOnly) {
                        if (row.ArchiveDateOnly instanceof Date) {
                            archiveDateOnlyStr = row.ArchiveDateOnly.toISOString().split('T')[0];
                        } else if (typeof row.ArchiveDateOnly === 'string') {
                            archiveDateOnlyStr = row.ArchiveDateOnly.split('T')[0];
                        } else {
                            archiveDateOnlyStr = String(row.ArchiveDateOnly);
                        }
                    }

                    return {
                        index: index + 1,
                        projectName: String(row.ProjectName || ''),
                        projectNumber: String(row.ProjectNumber || ''),
                        projectManager: String(row.ProjectManager || ''),
                        archiveDate: row.ArchiveDate ? new Date(row.ArchiveDate).toISOString() : null,
                        archiveDateOnly: archiveDateOnlyStr,
                        contractAmount: parseFloat(row.ProjectRevisedContractAmount) || 0,
                        estCostAtCompletion: parseFloat(row.EstCostAtCompletion) || 0,
                        projectedProfit: parseFloat(row.ProjectedProfit) || 0,
                        contractStartDate: row.ContractStartDate ? new Date(row.ContractStartDate).toISOString().split('T')[0] : null,
                        contractEndDate: row.ContractEndDate ? new Date(row.ContractEndDate).toISOString().split('T')[0] : null,
                        isActive: row.Active === 1,
                        contractStatus: String(row.ContractStatus || ''),
                        projectStage: String(row.ProjectStage || ''),
                        procoreId: row.ProcoreId ? String(row.ProcoreId) : null,
                        redTeamImport: row.RedTeamImport === 1,
                        hasDeleteInName: row.ProjectName?.toUpperCase().includes('DELETE') || false,
                        isMostRecent: true, // These are from the most recent archive date
                    };
                });

                // Format other records (from different archive dates)
                const otherRecords = allRows
                    .filter((row: any) => {
                        // Exclude records that are already in formattedResults (most recent date)
                        const rowDate = row.ArchiveDateOnly;
                        const mostRecentDateStr = mostRecentDate ? 
                            (mostRecentDate instanceof Date ? mostRecentDate.toISOString().split('T')[0] : String(mostRecentDate).split('T')[0]) : 
                            null;
                        return rowDate !== mostRecentDateStr;
                    })
                    .map((row: any, index: number) => {
                        let archiveDateOnlyStr = null;
                        if (row.ArchiveDateOnly) {
                            if (row.ArchiveDateOnly instanceof Date) {
                                archiveDateOnlyStr = row.ArchiveDateOnly.toISOString().split('T')[0];
                            } else if (typeof row.ArchiveDateOnly === 'string') {
                                archiveDateOnlyStr = row.ArchiveDateOnly.split('T')[0];
                            } else {
                                archiveDateOnlyStr = String(row.ArchiveDateOnly);
                            }
                        }

                        return {
                            index: index + 1,
                            projectName: String(row.ProjectName || ''),
                            projectNumber: String(row.ProjectNumber || ''),
                            projectManager: String(row.ProjectManager || ''),
                            archiveDate: row.ArchiveDate ? new Date(row.ArchiveDate).toISOString() : null,
                            archiveDateOnly: archiveDateOnlyStr,
                            contractAmount: parseFloat(row.ProjectRevisedContractAmount) || 0,
                            estCostAtCompletion: parseFloat(row.EstCostAtCompletion) || 0,
                            projectedProfit: parseFloat(row.ProjectedProfit) || 0,
                            contractStartDate: row.ContractStartDate ? new Date(row.ContractStartDate).toISOString().split('T')[0] : null,
                            contractEndDate: row.ContractEndDate ? new Date(row.ContractEndDate).toISOString().split('T')[0] : null,
                            isActive: row.Active === 1,
                            contractStatus: String(row.ContractStatus || ''),
                            projectStage: String(row.ProjectStage || ''),
                            procoreId: row.ProcoreId ? String(row.ProcoreId) : null,
                            redTeamImport: row.RedTeamImport === 1,
                            hasDeleteInName: row.ProjectName?.toUpperCase().includes('DELETE') || false,
                            isMostRecent: false, // These are from older archive dates
                        };
                    });

                await pool.close();
                console.log('✅ Database connection closed');

                return {
                    success: true,
                    projectNumber: projectNumber,
                    totalRecords: rows.length,
                    records: formattedResults,
                    otherRecords: otherRecords, // Records from other archive dates
                    mostRecentArchiveDate: mostRecentDate ? 
                        (mostRecentDate instanceof Date ? mostRecentDate.toISOString().split('T')[0] : String(mostRecentDate).split('T')[0]) : 
                        null,
                };

            } catch (queryError: any) {
                await pool.close();
                throw queryError;
            }

        } catch (error: any) {
            console.error('Error investigating project in Azure SQL Database:', error);
            throw new functions.https.HttpsError(
                'internal',
                `Failed to investigate project: ${error.message || 'Unknown error'}`
            );
        }
    });

// Delete specific project records from Azure SQL
// WARNING: This is a destructive operation - use with caution
export const azureSqlDeleteProject = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 540,
        memory: '512MB',
        secrets: ['AZURE_SQL_SERVER', 'AZURE_SQL_DATABASE', 'AZURE_SQL_USER', 'AZURE_SQL_PASSWORD'],
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const projectNumber = data?.projectNumber;
        const projectName = data?.projectName; // Optional: if provided, only delete records matching this exact name
        const archiveDate = data?.archiveDate; // Optional: if provided, only delete records with this archive date
        const confirmDelete = data?.confirmDelete; // Safety flag - must be true

        if (!projectNumber) {
            throw new functions.https.HttpsError('invalid-argument', 'Project number is required');
        }

        if (confirmDelete !== true) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'confirmDelete must be set to true to proceed with deletion'
            );
        }

        try {
            console.log(`⚠️ DELETING project records - Number: ${projectNumber}, Name filter: ${projectName || 'ALL'}, ArchiveDate filter: ${archiveDate || 'ALL'}`);
            console.log('Delete request data:', JSON.stringify({ projectNumber, projectName, archiveDate, confirmDelete }, null, 2));
            const azureSqlConfig = getAzureSqlConfig();
            const pool = await sql.connect(azureSqlConfig);
            console.log('✅ Connected to Azure SQL Database');

            try {
                // Build DELETE query with optional filters
                // When both projectName and archiveDate are provided, we should only delete ONE record
                const request = pool.request();
                request.input('projectNumber', sql.NVarChar, projectNumber.toString());

                let deleteQuery = '';
                
                // If we have both projectName and archiveDate, use date-only match to ensure we find the record
                // (The archiveDate from frontend might be an ISO string with time, but DB might have different time component)
                if (projectName && archiveDate) {
                    console.log(`  Received archiveDate: ${archiveDate} (type: ${typeof archiveDate})`);
                    // Parse archiveDate - it might be a string or Date object
                    let archiveDateObj: Date;
                    if (archiveDate instanceof Date) {
                        archiveDateObj = archiveDate;
                    } else if (typeof archiveDate === 'string') {
                        archiveDateObj = new Date(archiveDate);
                        if (isNaN(archiveDateObj.getTime())) {
                            throw new Error(`Invalid archiveDate format: ${archiveDate}`);
                        }
                    } else {
                        throw new Error(`Invalid archiveDate type: ${typeof archiveDate}`);
                    }
                    
                    const dateOnlyStr = archiveDateObj.toISOString().split('T')[0];
                    console.log(`  Parsed to date-only: ${dateOnlyStr}`);
                    
                    // Use date-only comparison to avoid time component mismatches
                    deleteQuery = `
                        DELETE TOP (1) FROM dbo.ProjectProfitabilityArchive
                        WHERE ProjectNumber = @projectNumber
                            AND ProjectName = @projectName
                            AND CAST(ArchiveDate AS DATE) = CAST(@archiveDate AS DATE)
                    `;
                    request.input('projectName', sql.NVarChar, projectName);
                    request.input('archiveDate', sql.Date, archiveDateObj);
                    console.log(`  Deleting record: ProjectName="${projectName}", ArchiveDate (date only)="${dateOnlyStr}"`);
                } else {
                    // Fallback: use TOP (1) to ensure only one record is deleted
                    deleteQuery = `
                        DELETE TOP (1) FROM dbo.ProjectProfitabilityArchive
                        WHERE ProjectNumber = @projectNumber
                    `;
                    
                    if (projectName) {
                        deleteQuery += ` AND ProjectName = @projectName`;
                        request.input('projectName', sql.NVarChar, projectName);
                        console.log(`  Filtering by exact project name: ${projectName}`);
                    }

                    if (archiveDate) {
                        // Parse archiveDate - it might be a string or Date object
                        let archiveDateObj: Date;
                        if (archiveDate instanceof Date) {
                            archiveDateObj = archiveDate;
                        } else if (typeof archiveDate === 'string') {
                            archiveDateObj = new Date(archiveDate);
                            if (isNaN(archiveDateObj.getTime())) {
                                throw new Error(`Invalid archiveDate format: ${archiveDate}`);
                            }
                        } else {
                            throw new Error(`Invalid archiveDate type: ${typeof archiveDate}`);
                        }
                        // Use date-only match if exact datetime not available
                        deleteQuery += ` AND CAST(ArchiveDate AS DATE) = CAST(@archiveDate AS DATE)`;
                        request.input('archiveDate', sql.DateTime2, archiveDateObj);
                        console.log(`  Filtering by archive date: ${archiveDateObj.toISOString()}`);
                    }
                }

                // First, get count of records that will be deleted
                // Build a separate count query with the same WHERE conditions
                let countQuery = 'SELECT COUNT(*) as RecordCount FROM dbo.ProjectProfitabilityArchive WHERE ProjectNumber = @projectNumber';
                const countRequest = pool.request();
                countRequest.input('projectNumber', sql.NVarChar, projectNumber.toString());
                
                if (projectName && archiveDate) {
                    // Parse archiveDate for count query
                    let archiveDateObj: Date;
                    if (archiveDate instanceof Date) {
                        archiveDateObj = archiveDate;
                    } else if (typeof archiveDate === 'string') {
                        archiveDateObj = new Date(archiveDate);
                        if (isNaN(archiveDateObj.getTime())) {
                            throw new Error(`Invalid archiveDate format: ${archiveDate}`);
                        }
                    } else {
                        throw new Error(`Invalid archiveDate type: ${typeof archiveDate}`);
                    }
                    // Use date-only comparison to match the delete query
                    countQuery += ' AND ProjectName = @projectName AND CAST(ArchiveDate AS DATE) = CAST(@archiveDate AS DATE)';
                    countRequest.input('projectName', sql.NVarChar, projectName);
                    countRequest.input('archiveDate', sql.Date, archiveDateObj);
                } else {
                    if (projectName) {
                        countQuery += ' AND ProjectName = @projectName';
                        countRequest.input('projectName', sql.NVarChar, projectName);
                    }
                    if (archiveDate) {
                        // Parse archiveDate - it might be a string or Date object
                        let archiveDateObj: Date;
                        if (archiveDate instanceof Date) {
                            archiveDateObj = archiveDate;
                        } else if (typeof archiveDate === 'string') {
                            archiveDateObj = new Date(archiveDate);
                            if (isNaN(archiveDateObj.getTime())) {
                                throw new Error(`Invalid archiveDate format: ${archiveDate}`);
                            }
                        } else {
                            throw new Error(`Invalid archiveDate type: ${typeof archiveDate}`);
                        }
                        countQuery += ' AND CAST(ArchiveDate AS DATE) = CAST(@archiveDate AS DATE)';
                        countRequest.input('archiveDate', sql.DateTime2, archiveDateObj);
                    }
                }
                
                const countResult = await countRequest.query(countQuery);
                const recordCount = countResult.recordset[0]?.RecordCount || 0;

                if (recordCount === 0) {
                    await pool.close();
                    return {
                        success: true,
                        deleted: 0,
                        message: 'No records found matching the criteria. Nothing was deleted.',
                    };
                }

                console.log(`⚠️ About to delete ${recordCount} record(s)`);

                // Execute the DELETE
                const deleteResult = await request.query(deleteQuery);
                const rowsAffected = deleteResult.rowsAffected?.[0] || 0;

                await pool.close();
                console.log(`✅ Deleted ${rowsAffected} record(s) from Azure SQL Database`);

                return {
                    success: true,
                    deleted: rowsAffected,
                    projectNumber: projectNumber,
                    projectNameFilter: projectName || null,
                    archiveDateFilter: archiveDate || null,
                    message: `Successfully deleted ${rowsAffected} record(s)`,
                };

            } catch (queryError: any) {
                await pool.close();
                throw queryError;
            }

        } catch (error: any) {
            console.error('Error deleting project from Azure SQL Database:', error);
            const errorMessage = error?.message || error?.toString() || 'Unknown error';
            const errorCode = error?.code || 'internal';
            console.error('Error details:', {
                message: errorMessage,
                code: errorCode,
                stack: error?.stack,
                response: error?.response?.data,
            });
            throw new functions.https.HttpsError(
                errorCode === 'unauthenticated' ? 'unauthenticated' : 
                errorCode === 'invalid-argument' ? 'invalid-argument' : 'internal',
                `Failed to delete project: ${errorMessage}`
            );
        }
    });

// Promote an older project record to the most recent archive date
// This copies a record from an older archive date to the most recent date
// Useful for fixing duplicate projects where the correct version is on an older date
export const azureSqlPromoteProject = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 540,
        memory: '512MB',
        secrets: ['AZURE_SQL_SERVER', 'AZURE_SQL_DATABASE', 'AZURE_SQL_USER', 'AZURE_SQL_PASSWORD'],
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const projectNumber = data?.projectNumber;
        const sourceArchiveDate = data?.sourceArchiveDate; // The archive date of the record we want to copy
        const sourceProjectName = data?.sourceProjectName; // Optional: specific project name to copy
        const confirmPromote = data?.confirmPromote; // Safety flag - must be true

        if (!projectNumber) {
            throw new functions.https.HttpsError('invalid-argument', 'Project number is required');
        }

        if (!sourceArchiveDate) {
            throw new functions.https.HttpsError('invalid-argument', 'Source archive date is required');
        }

        if (confirmPromote !== true) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'confirmPromote must be set to true to proceed'
            );
        }

        try {
            console.log(`🔄 PROMOTING project record - Number: ${projectNumber}, From Date: ${sourceArchiveDate}, Name: ${sourceProjectName || 'ALL'}`);
            console.log('Promote request data:', JSON.stringify({ projectNumber, sourceArchiveDate, sourceProjectName, confirmPromote }, null, 2));
            const azureSqlConfig = getAzureSqlConfig();
            const pool = await sql.connect(azureSqlConfig);
            console.log('✅ Connected to Azure SQL Database');

            try {
                // Get the most recent archive date
                const mostRecentDateQuery = `SELECT MAX(CAST(ArchiveDate AS DATE)) as LatestArchiveDateOnly FROM dbo.ProjectProfitabilityArchive`;
                const mostRecentDateRequest = pool.request();
                const mostRecentDateResult = await mostRecentDateRequest.query(mostRecentDateQuery);
                const mostRecentDate = mostRecentDateResult.recordset[0]?.LatestArchiveDateOnly;
                
                if (!mostRecentDate) {
                    await pool.close();
                    throw new functions.https.HttpsError('internal', 'Could not determine most recent archive date');
                }

                const mostRecentDateStr = mostRecentDate instanceof Date ? 
                    mostRecentDate.toISOString().split('T')[0] : 
                    String(mostRecentDate).split('T')[0];
                
                console.log(`Most recent archive date: ${mostRecentDateStr}`);

                // Find the source record(s) to copy
                let findSourceQuery = `
                    SELECT TOP 1 *
                    FROM dbo.ProjectProfitabilityArchive
                    WHERE ProjectNumber = @projectNumber
                        AND CAST(ArchiveDate AS DATE) = CAST(@sourceArchiveDate AS DATE)
                `;

                // Parse sourceArchiveDate - it might be a string or Date object
                let sourceArchiveDateObj: Date;
                if (sourceArchiveDate instanceof Date) {
                    sourceArchiveDateObj = sourceArchiveDate;
                } else if (typeof sourceArchiveDate === 'string') {
                    sourceArchiveDateObj = new Date(sourceArchiveDate);
                    if (isNaN(sourceArchiveDateObj.getTime())) {
                        throw new Error(`Invalid sourceArchiveDate format: ${sourceArchiveDate}`);
                    }
                } else {
                    throw new Error(`Invalid sourceArchiveDate type: ${typeof sourceArchiveDate}`);
                }
                
                const request = pool.request();
                request.input('projectNumber', sql.NVarChar, projectNumber.toString());
                request.input('sourceArchiveDate', sql.Date, sourceArchiveDateObj);

                if (sourceProjectName) {
                    findSourceQuery += ` AND ProjectName = @sourceProjectName`;
                    request.input('sourceProjectName', sql.NVarChar, sourceProjectName);
                }

                findSourceQuery += ` ORDER BY ArchiveDate DESC`;

                console.log(`Finding source record to copy...`);
                const sourceResult = await request.query(findSourceQuery);
                const sourceRows = sourceResult.recordset || [];

                if (sourceRows.length === 0) {
                    await pool.close();
                    throw new functions.https.HttpsError(
                        'not-found',
                        `No record found for project ${projectNumber} on archive date ${sourceArchiveDate}${sourceProjectName ? ` with name "${sourceProjectName}"` : ''}`
                    );
                }

                const sourceRow = sourceRows[0];
                console.log(`Found source record: ${sourceRow.ProjectName} (Archive Date: ${sourceRow.ArchiveDate})`);

                // Check if a record already exists for this project on the most recent date
                const checkExistingQuery = `
                    SELECT COUNT(*) as RecordCount
                    FROM dbo.ProjectProfitabilityArchive
                    WHERE ProjectNumber = @projectNumber
                        AND CAST(ArchiveDate AS DATE) = CAST(@mostRecentDate AS DATE)
                `;
                const checkRequest = pool.request();
                checkRequest.input('projectNumber', sql.NVarChar, projectNumber.toString());
                checkRequest.input('mostRecentDate', sql.Date, mostRecentDate);
                const existingResult = await checkRequest.query(checkExistingQuery);
                const existingCount = existingResult.recordset[0]?.RecordCount || 0;

                if (existingCount > 0) {
                    console.log(`⚠️ Warning: ${existingCount} record(s) already exist for this project on the most recent date. They will remain, and a new record will be added.`);
                }

                // Build INSERT query - copy all columns from source but use most recent archive date
                // We need to get all column names dynamically or list them explicitly
                // Based on the investigation query, here are the main columns:
                // Check how many records match the criteria before promoting
                let checkSourceQuery = `
                    SELECT COUNT(*) as RecordCount
                    FROM dbo.ProjectProfitabilityArchive
                    WHERE ProjectNumber = @projectNumber
                        AND CAST(ArchiveDate AS DATE) = CAST(@sourceArchiveDate AS DATE)
                `;
                const checkSourceRequest = pool.request();
                checkSourceRequest.input('projectNumber', sql.NVarChar, projectNumber.toString());
                checkSourceRequest.input('sourceArchiveDate', sql.Date, sourceArchiveDateObj);
                
                if (sourceProjectName) {
                    checkSourceQuery += ` AND ProjectName = @sourceProjectName`;
                    checkSourceRequest.input('sourceProjectName', sql.NVarChar, sourceProjectName);
                }
                
                const checkSourceResult = await checkSourceRequest.query(checkSourceQuery);
                const sourceRecordCount = checkSourceResult.recordset[0]?.RecordCount || 0;
                
                if (sourceRecordCount > 1) {
                    console.log(`⚠️ Warning: ${sourceRecordCount} record(s) match the criteria. Will promote only the most recent one.`);
                }

                // Build INSERT query - ensure we only insert ONE record
                let insertQuery = `
                    INSERT INTO dbo.ProjectProfitabilityArchive (
                        ProjectName, ProjectNumber, ProjectManager, ArchiveDate, ProjectRevisedContractAmount,
                        IsActive, ContractStatus, ProjectStage, ProcoreId, RedTeamImport,
                        EstCostAtCompletion, JobCostToDate, PercentCompleteBasedOnCost,
                        RemainingCost, ProjectedProfit, ProjectedProfitPercentage,
                        ContractStartDate, ContractEndDate, TotalInvoiced,
                        BalanceLeftOnContract, PercentCompleteBasedOnRevenue,
                        CustomerRetainage, VendorRetainage, ProfitCenterYear,
                        EstimatedProjectProfit
                    )
                    SELECT TOP 1
                        ProjectName, ProjectNumber, ProjectManager,
                        CAST(@mostRecentDate AS DATETIME) as ArchiveDate,
                        ProjectRevisedContractAmount, IsActive, ContractStatus, ProjectStage,
                        ProcoreId, RedTeamImport, EstCostAtCompletion, JobCostToDate,
                        PercentCompleteBasedOnCost, RemainingCost, ProjectedProfit,
                        ProjectedProfitPercentage, ContractStartDate, ContractEndDate,
                        TotalInvoiced, BalanceLeftOnContract, PercentCompleteBasedOnRevenue,
                        CustomerRetainage, VendorRetainage, ProfitCenterYear,
                        EstimatedProjectProfit
                    FROM dbo.ProjectProfitabilityArchive
                    WHERE ProjectNumber = @projectNumber
                        AND CAST(ArchiveDate AS DATE) = CAST(@sourceArchiveDate AS DATE)
                `;

                const insertRequest = pool.request();
                insertRequest.input('projectNumber', sql.NVarChar, projectNumber.toString());
                insertRequest.input('sourceArchiveDate', sql.Date, sourceArchiveDateObj);
                insertRequest.input('mostRecentDate', sql.Date, mostRecentDate);

                if (sourceProjectName) {
                    insertQuery += ` AND ProjectName = @sourceProjectName`;
                    insertRequest.input('sourceProjectName', sql.NVarChar, sourceProjectName);
                }

                // Always order by ArchiveDate DESC to get the most recent record if there are duplicates
                insertQuery += ` ORDER BY ArchiveDate DESC`;

                console.log(`Inserting promoted record with most recent archive date: ${mostRecentDateStr}...`);
                const insertResult = await insertRequest.query(insertQuery);
                const rowsAffected = insertResult.rowsAffected?.[0] || 0;

                await pool.close();
                console.log(`✅ Promoted ${rowsAffected} record(s) to most recent archive date`);

                return {
                    success: true,
                    promoted: rowsAffected,
                    projectNumber: projectNumber,
                    sourceArchiveDate: sourceArchiveDate,
                    sourceProjectName: sourceProjectName || null,
                    promotedToDate: mostRecentDateStr,
                    message: `Successfully promoted ${rowsAffected} record(s) to archive date ${mostRecentDateStr}`,
                };

            } catch (queryError: any) {
                await pool.close();
                throw queryError;
            }

        } catch (error: any) {
            console.error('Error promoting project in Azure SQL Database:', error);
            const errorMessage = error?.message || error?.toString() || 'Unknown error';
            const errorCode = error?.code || 'internal';
            console.error('Error details:', {
                message: errorMessage,
                code: errorCode,
                stack: error?.stack,
                response: error?.response?.data,
            });
            throw new functions.https.HttpsError(
                errorCode === 'unauthenticated' ? 'unauthenticated' : 
                errorCode === 'invalid-argument' ? 'invalid-argument' : 
                errorCode === 'not-found' ? 'not-found' : 'internal',
                `Failed to promote project: ${errorMessage}`
            );
        }
    });

// Get the current project number counter for a year (read-only, doesn't increment)
// This ensures sequential numbers never repeat even if projects are deleted
export const getProjectNumberCounter = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 30,
        memory: '256MB',
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        try {
            const year = data?.year;
            if (!year) {
                throw new functions.https.HttpsError('invalid-argument', 'Year is required');
            }

            const yearKey = `year${year}`; // e.g., "year25"
            const counterRef = admin.firestore().collection('system').doc('projectNumberCounter');
            const counterDoc = await counterRef.get();
            
            let currentValue = 0;
            if (counterDoc.exists) {
                const counterData = counterDoc.data();
                currentValue = counterData?.[yearKey] || 0;
            }
            
            return {
                success: true,
                counter: currentValue,
                year: year,
            };
        } catch (error: any) {
            console.error('Error getting project number counter:', error);
            
            if (error instanceof functions.https.HttpsError) {
                throw error;
            }
            
            throw new functions.https.HttpsError(
                'internal',
                `Failed to get project number counter: ${error.message || 'Unknown error'}`
            );
        }
    });

// Increment the project number counter when a project is created
// This ensures sequential numbers never repeat even if projects are deleted
export const incrementProjectNumberCounter = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 30,
        memory: '256MB',
    })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        try {
            const year = data?.year;
            const sequential = data?.sequential;
            
            if (!year || sequential === undefined) {
                throw new functions.https.HttpsError('invalid-argument', 'Year and sequential are required');
            }

            const yearKey = `year${year}`; // e.g., "year25"
            const counterRef = admin.firestore().collection('system').doc('projectNumberCounter');
            
            // Use Firestore transaction to atomically update the counter
            await admin.firestore().runTransaction(async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                
                const updateData: any = {
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                updateData[yearKey] = sequential; // Store the sequential number used
                
                if (counterDoc.exists) {
                    transaction.update(counterRef, updateData);
                } else {
                    transaction.set(counterRef, {
                        ...updateData,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
            });
            
            console.log(`Updated project number counter for year ${year} to ${sequential}`);
            
            return {
                success: true,
                year: year,
                counter: sequential,
            };
        } catch (error: any) {
            console.error('Error incrementing project number counter:', error);
            
            if (error instanceof functions.https.HttpsError) {
                throw error;
            }
            
            throw new functions.https.HttpsError(
                'internal',
                `Failed to increment project number counter: ${error.message || 'Unknown error'}`
            );
        }
    });

// Export DOCX to PDF converter
// Option 1: CloudConvert (paid but easy setup)
// export { convertDocxToPdf } from './docxToPdfConverter';

// Option 2: LibreOffice (FREE - recommended)
export { convertDocxToPdfLibreOffice as convertDocxToPdf } from './docxToPdfConverterLibreOffice';

