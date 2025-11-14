import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import axios from 'axios';

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
    // Production credentials (for production environment - read-only testing)
    clientId: process.env.PROCORE_CLIENT_ID || 'cnOtyAY1YcKSCGdzQp88vB5ETGOknRvao3VT7cY2HoM', // Production Client ID
    clientSecret: process.env.PROCORE_CLIENT_SECRET || '-HR68NdpKiELjbKOgz7sTAOFNXc1voHV2fq8Zosy55E', // Production Client Secret
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
async function getProcoreAccessToken(userId: string): Promise<string | null> {
    try {
        // Check if user has stored token in Firestore
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
                console.log('Token is still valid, returning existing token');
                console.log('Token expires at:', expiresAt);
                console.log('Current time:', now);
                return tokenData.accessToken;
            }
            
            // Token expired or about to expire, try to refresh
            console.log('Token expired or expiring soon, attempting refresh...');
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
                        console.log('Token refresh successful, storing new token');
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
        console.error('Error getting Procore access token:', error);
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
            
            // Store token in Firestore
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
        
        try {
            // Helper function to add delay
            const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
            
            // Helper function to retry on rate limit errors
            const retryOnRateLimit = async (fn: () => Promise<any>, maxRetries = 3, baseDelay = 2000) => {
                for (let i = 0; i < maxRetries; i++) {
                    try {
                        return await fn();
                    } catch (error: any) {
                        if (error.response?.status === 429 && i < maxRetries - 1) {
                            const retryAfter = error.response.headers['retry-after'] 
                                ? parseInt(error.response.headers['retry-after']) * 1000 
                                : baseDelay * Math.pow(2, i);
                            console.warn(`Rate limit hit in connection test, waiting ${retryAfter}ms before retry ${i + 1}/${maxRetries}`);
                            await delay(retryAfter);
                            continue;
                        }
                        throw error;
                    }
                }
            };
            
            // Make a simple API call to verify the token works
            // Using a minimal endpoint - just get company info
            const testUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}`;
            console.log('Testing connection with URL:', testUrl);
            console.log('Using access token (first 20 chars):', accessToken.substring(0, 20) + '...');
            
            let response = await retryOnRateLimit(() => axios.get(
                testUrl,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Procore-Company-Id': PROCORE_CONFIG.companyId,
                    },
                }
            ));
            
            // If we get 401, try refreshing the token and retry
            if (response.status === 401) {
                console.log('Got 401, token may be expired. Attempting refresh...');
                const refreshedToken = await getProcoreAccessToken(userId);
                if (refreshedToken && refreshedToken !== accessToken) {
                    console.log('Token refreshed, retrying connection test...');
                    response = await axios.get(
                        testUrl,
                        {
                            headers: {
                                'Authorization': `Bearer ${refreshedToken}`,
                                'Procore-Company-Id': PROCORE_CONFIG.companyId,
                            },
                        }
                    );
                }
            }
            
            console.log('Connection test successful! Status:', response.status);
            return {
                connected: true,
                message: 'Successfully connected to Procore',
                status: response.status,
            };
        } catch (error: any) {
            console.error('Connection test failed:', {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
            });
            
            // If 401, try to refresh and retry once
            if (error.response?.status === 401) {
                console.log('Got 401 error, attempting token refresh...');
                try {
                    const refreshedToken = await getProcoreAccessToken(userId);
                    if (refreshedToken && refreshedToken !== accessToken) {
                        console.log('Token refreshed, retrying connection test...');
                        const retryResponse = await axios.get(
                            `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}`,
                            {
                                headers: {
                                    'Authorization': `Bearer ${refreshedToken}`,
                                    'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                },
                            }
                        );
                        console.log('Retry successful! Status:', retryResponse.status);
                        return {
                            connected: true,
                            message: 'Successfully connected to Procore (after token refresh)',
                            status: retryResponse.status,
                        };
                    }
                } catch (retryError: any) {
                    console.error('Retry after refresh also failed:', retryError.response?.data || retryError.message);
                }
            }
            
            return {
                connected: false,
                message: error.response?.data?.error_description || error.response?.data?.message || error.message || 'Failed to connect to Procore',
                status: error.response?.status,
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

// Get project profitability data from Procore
// Note: This endpoint may vary based on Procore API version and available endpoints
export const procoreGetProjectProfitability = functions
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
        
        if (!projectId) {
            throw new functions.https.HttpsError('invalid-argument', 'Project ID is required');
        }
        
        const accessToken = await getProcoreAccessToken(userId);
        
        if (!accessToken) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'No valid Procore access token. Please authorize the application.'
            );
        }
        
        try {
            // Fetch project details
            const projectResponse = await axios.get(
                `${PROCORE_CONFIG.apiBaseUrl}/vapid/projects/${projectId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Procore-Company-Id': PROCORE_CONFIG.companyId,
                    },
                }
            );
            
            // Fetch project budget/financials (endpoint may need adjustment based on Procore API)
            // This is a placeholder - actual endpoint structure depends on Procore API documentation
            let budgetData = null;
            try {
                const budgetResponse = await axios.get(
                    `${PROCORE_CONFIG.apiBaseUrl}/vapid/projects/${projectId}/budget_view`,
                    {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Procore-Company-Id': PROCORE_CONFIG.companyId,
                        },
                    }
                );
                budgetData = budgetResponse.data;
            } catch (budgetError) {
                console.log('Budget endpoint not available or different structure:', budgetError);
            }
            
            return {
                success: true,
                data: {
                    project: projectResponse.data,
                    budget: budgetData,
                },
            };
        } catch (error: any) {
            console.error('Error fetching Procore project profitability:', error.response?.data || error.message);
            throw new functions.https.HttpsError(
                'internal',
                error.response?.data?.error_description || 'Failed to fetch project profitability data'
            );
        }
    });

// Get all projects with profitability data (batch endpoint)
export const procoreGetAllProjectsProfitability = functions
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
        const accessToken = await getProcoreAccessToken(userId);
        
        if (!accessToken) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'No valid Procore access token. Please authorize the application.'
            );
        }
        
        try {
            // Helper function to add delay between API calls to avoid rate limiting
            const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
            
            // Helper function to retry on rate limit errors
            const retryOnRateLimit = async (fn: () => Promise<any>, maxRetries = 3, baseDelay = 1000) => {
                for (let i = 0; i < maxRetries; i++) {
                    try {
                        return await fn();
                    } catch (error: any) {
                        if (error.response?.status === 429 && i < maxRetries - 1) {
                            const retryAfter = error.response.headers['retry-after'] 
                                ? parseInt(error.response.headers['retry-after']) * 1000 
                                : baseDelay * Math.pow(2, i);
                            console.warn(`Rate limit hit, waiting ${retryAfter}ms before retry ${i + 1}/${maxRetries}`);
                            await delay(retryAfter);
                            continue;
                        }
                        throw error;
                    }
                }
            };
            
            // Get all projects using the correct REST API endpoint
            const projectsResponse = await retryOnRateLimit(() => axios.get(
                `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/companies/${PROCORE_CONFIG.companyId}/projects`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Procore-Company-Id': PROCORE_CONFIG.companyId,
                    },
                }
            ));
            
            const projects = projectsResponse.data || [];
            
            // Log the raw Procore response to understand the data structure
            console.log('Raw Procore projects response (first project):', JSON.stringify(projects.slice(0, 1), null, 2)); // Log first project as sample
            console.log('Number of projects received:', projects.length);
            
            // Log ALL keys from the first project to see what fields are available
            if (projects.length > 0) {
                const firstProject = projects[0];
                console.log('Available fields in first project:', Object.keys(firstProject));
                console.log('First project full structure:', JSON.stringify(firstProject, null, 2));
            }
            
            // Process projects sequentially with delays to avoid rate limiting
            // Limit to first 20 projects initially to avoid hitting rate limits
            const projectsToProcess = projects.slice(0, 20);
            const projectsWithData: any[] = [];
            
            for (let i = 0; i < projectsToProcess.length; i++) {
                const project = projectsToProcess[i];
                console.log(`[${project.id}] ========== Processing project ${i + 1}/${projectsToProcess.length} ==========`);
                
                // Add delay between projects to avoid rate limiting (except for first project)
                if (i > 0) {
                    await delay(200); // 200ms delay between projects
                }
                
                try {
                    console.log(`[${project.id}] ========== Starting project processing ==========`);
                    try {
                        // Fetch detailed project info to get total_value and other fields
                        let projectDetail: any = null;
                        try {
                            const detailResponse = await retryOnRateLimit(() => axios.get(
                                `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/projects/${project.id}`,
                                {
                                    headers: {
                                        'Authorization': `Bearer ${accessToken}`,
                                        'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                    },
                                    params: {
                                        company_id: PROCORE_CONFIG.companyId,
                                    },
                                }
                            ));
                            projectDetail = detailResponse.data;
                            console.log(`Project ${project.id} detail fields:`, Object.keys(projectDetail || {}));
                            await delay(100); // Small delay after each API call
                        } catch (detailError: any) {
                            console.warn(`Could not fetch details for project ${project.id}:`, detailError.response?.status || detailError.message);
                            // Continue with basic project data if detail fetch fails
                        }
                        
                        // Initialize variables for Prime Contracts data (will be populated below)
                        let primeContractsData: any = null;
                        let totalContractValueFromPrime = 0; // ProjectRevisedContractAmount or revised_contract_amount
                        
                        // Fetch Prime Contracts for financial data (based on Power BI mapping)
                        // Fields: ProjectRevisedContractAmount, OwnerInvoiceAmount, RevisedContractAmount, Start/End dates, Status
                        let totalInvoiced = 0; // OwnerInvoiceAmount or owner_invoice_amount
                        let balanceLeftOnContract = 0; // RevisedContractAmount - OwnerInvoiceAmount
                        let contractStartDate: string | null = null;
                        let contractEndDate: string | null = null;
                        let contractStatus: string = 'Active';
                        
                        console.log(`[${project.id}] Starting Prime Contracts fetch...`);
                        try {
                            // Use 'extended' view to get more fields including custom fields
                            const primeContractsUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${project.id}/prime_contracts`;
                            console.log(`[${project.id}] Fetching Prime Contracts from: ${primeContractsUrl}`);
                            const primeContractsResponse = await retryOnRateLimit(() => axios.get(
                                primeContractsUrl,
                                {
                                    headers: {
                                        'Authorization': `Bearer ${accessToken}`,
                                        'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                    },
                                    params: {
                                        view: 'extended', // Get extended view with more fields
                                    },
                                }
                            ));
                            await delay(100);
                            
                            // Prime Contracts response is wrapped in { data: [...] }
                            const primeContracts = primeContractsResponse.data?.data || primeContractsResponse.data || [];
                            
                            if (Array.isArray(primeContracts) && primeContracts.length > 0) {
                                primeContractsData = primeContracts;
                                console.log(`[${project.id}] Found ${primeContracts.length} prime contract(s)`);
                                
                                // Log the full structure of the first contract for debugging
                                console.log(`[${project.id}] Full Prime Contract structure:`, JSON.stringify(primeContracts[0], null, 2));
                                
                                // Use the first/primary prime contract (or sum if multiple)
                                const primaryContract = primeContracts[0];
                                
                                // Log all available fields
                                console.log(`[${project.id}] Prime Contract available fields:`, Object.keys(primaryContract));
                                
                                // Map fields based on Power BI Formula Reference Chart
                                // Total Contract Value: ProjectRevisedContractAmount from /prime_contract
                                totalContractValueFromPrime = parseFloat(
                                    primaryContract.revised_contract_amount || 
                                    primaryContract.project_revised_contract_amount ||
                                    primaryContract.pending_revised_contract_amount ||
                                    primaryContract.total_amount || 
                                    primaryContract.contract_amount ||
                                    '0'
                                ) || 0;
                                
                                // Total Invoiced: Owner Invoices Amount from /prime_contract
                                totalInvoiced = parseFloat(
                                    primaryContract.owner_invoices_amount ||
                                    primaryContract.owner_invoice_amount || 
                                    primaryContract.invoiced_amount || 
                                    primaryContract.total_invoiced ||
                                    primaryContract.total_owner_invoices_amount ||
                                    '0'
                                ) || 0;
                                
                                // RevisedContractAmount for balance calculation
                                const revisedContractAmount = parseFloat(
                                    primaryContract.revised_contract_amount || 
                                    primaryContract.project_revised_contract_amount ||
                                    primaryContract.total_amount || 
                                    '0'
                                ) || 0;
                                
                                // Balance Left on Contract = RevisedContractAmount - OwnerInvoiceAmount
                                balanceLeftOnContract = revisedContractAmount - totalInvoiced;
                                
                                // Contract dates and status (from Formula Reference Chart)
                                contractStartDate = primaryContract.start_date || primaryContract.contract_start_date || primaryContract.contract_start || null;
                                contractEndDate = primaryContract.end_date || primaryContract.contract_end_date || primaryContract.completion_date || primaryContract.contract_end || null;
                                contractStatus = primaryContract.status || primaryContract.contract_status || primaryContract.status_name || 'Active';
                                
                                console.log(`[${project.id}] Prime Contracts - Revised Amount: ${revisedContractAmount}, Invoiced: ${totalInvoiced}, Balance: ${balanceLeftOnContract}`);
                                console.log(`[${project.id}] Contract Dates - Start: ${contractStartDate}, End: ${contractEndDate}, Status: ${contractStatus}`);
                            } else {
                                console.log(`[${project.id}] Prime Contracts: Empty array returned (no contracts)`);
                            }
                        } catch (primeContractsError: any) {
                            // 403 or 404 errors are expected if user doesn't have access or project has no contracts
                            const status = primeContractsError.response?.status;
                            if (status === 403) {
                                console.warn(`[${project.id}] Prime Contracts: 403 Forbidden (no access)`);
                            } else if (status === 404) {
                                console.warn(`[${project.id}] Prime Contracts: 404 Not Found`);
                            } else {
                                console.warn(`[${project.id}] Prime Contracts: Error ${status || 'unknown'}:`, primeContractsError.message);
                            }
                            // Continue without prime contracts data
                        }
                        
                        // Extract financial data from project detail
                        // Use Prime Contract value if available, otherwise use project total_value
                        const totalValue = totalContractValueFromPrime > 0 
                            ? totalContractValueFromPrime 
                            : (projectDetail?.total_value ? parseFloat(projectDetail.total_value) : 0);
                        
                        // Fetch Budget Views for Est Cost Of Completion (based on Power BI mapping)
                        // Sum of Est Cost of Completion Amounts From Procore Budget Views
                        let estCostAtCompletion = 0;
                        let jobToDateCost = 0; // For calculating remaining costs
                        console.log(`[${project.id}] Starting Budget Views fetch...`);
                        try {
                            // First, get available budget views
                            const budgetViewsUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${project.id}/project_status_snapshots/budget_views`;
                            console.log(`[${project.id}] Fetching Budget Views from: ${budgetViewsUrl}`);
                            const budgetViewsResponse = await retryOnRateLimit(() => axios.get(
                                budgetViewsUrl,
                                {
                                    headers: {
                                        'Authorization': `Bearer ${accessToken}`,
                                        'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                    },
                                }
                            ));
                            await delay(100);
                            
                            const budgetViews = budgetViewsResponse.data?.data || budgetViewsResponse.data || [];
                            
                            if (Array.isArray(budgetViews) && budgetViews.length > 0) {
                                // Get the latest project status snapshot for the first budget view
                                const budgetViewId = budgetViews[0].id;
                                const snapshotsResponse = await retryOnRateLimit(() => axios.get(
                                    `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${project.id}/budget_view/${budgetViewId}/project_status_snapshots`,
                                    {
                                        headers: {
                                            'Authorization': `Bearer ${accessToken}`,
                                            'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                        },
                                        params: {
                                            per_page: 1,
                                            sort: '-created_at', // Most recent first
                                        },
                                    }
                                ));
                                await delay(100);
                                
                                const snapshots = snapshotsResponse.data?.data || snapshotsResponse.data || [];
                                if (Array.isArray(snapshots) && snapshots.length > 0) {
                                    const latestSnapshot = snapshots[0];
                                    // Extract Est Cost Of Completion and Job To Date Cost
                                    estCostAtCompletion = parseFloat(latestSnapshot.est_cost_of_completion || latestSnapshot.estimated_cost_at_completion || '0') || 0;
                                    jobToDateCost = parseFloat(latestSnapshot.job_to_date_cost || latestSnapshot.project_budget_job_to_date_costs || '0') || 0;
                                    console.log(`[${project.id}] Budget Views: Success - Est Cost: ${estCostAtCompletion}, Job To Date: ${jobToDateCost}`);
                                } else {
                                    console.log(`[${project.id}] Budget Views: No snapshots found`);
                                }
                            } else {
                                console.log(`[${project.id}] Budget Views: No budget views available`);
                            }
                        } catch (budgetError: any) {
                            // Budget views may not be available (403/404)
                            const status = budgetError.response?.status;
                            if (status === 403) {
                                console.warn(`[${project.id}] Budget Views: 403 Forbidden (no access)`);
                            } else if (status === 404) {
                                console.warn(`[${project.id}] Budget Views: 404 Not Found`);
                            } else {
                                console.warn(`[${project.id}] Budget Views: Error ${status || 'unknown'}:`, budgetError.message);
                            }
                        }
                        
                        // Fetch Owner Invoices for Percent Complete (Revenue) and Customer Retainage (based on Power BI mapping)
                        // Most recent invoice: % complete and Total Retainage
                        // Note: Owner Invoices might be under Prime Contracts or a separate endpoint
                        let percentCompleteRevenue = 0;
                        let customerRetainage = 0;
                        console.log(`[${project.id}] Starting Owner Invoices fetch...`);
                        try {
                            // Try to get owner invoices from Prime Contract first (if available in the contract object)
                            if (primeContractsData && primeContractsData.length > 0) {
                                const primaryContract = primeContractsData[0];
                                // Check if invoice data is nested in the contract
                                if (primaryContract.owner_invoices && Array.isArray(primaryContract.owner_invoices) && primaryContract.owner_invoices.length > 0) {
                                    const latestInvoice = primaryContract.owner_invoices[0];
                                    percentCompleteRevenue = parseFloat(latestInvoice.percent_complete || latestInvoice.percentage_complete || '0') || 0;
                                    customerRetainage = parseFloat(latestInvoice.total_retainage || latestInvoice.retainage_amount || '0') || 0;
                                    console.log(`Project ${project.id} Owner Invoice (from Prime Contract) - % Complete: ${percentCompleteRevenue}, Retainage: ${customerRetainage}`);
                                }
                            }
                            
                            // If not found in Prime Contract, try /invoices endpoint (per Formula Reference Chart)
                            // Customer Retainage: Total Retainage from most recent invoice from /invoices
                            if (percentCompleteRevenue === 0 && customerRetainage === 0) {
                                try {
                                    // According to Formula Reference Chart: /invoices (not /owner_invoices)
                                    const invoicesResponse = await retryOnRateLimit(() => axios.get(
                                        `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/invoices`,
                                        {
                                            headers: {
                                                'Authorization': `Bearer ${accessToken}`,
                                                'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                            },
                                            params: {
                                                project_id: project.id, // Required query parameter
                                                per_page: 1,
                                                sort: '-created_at', // Most recent first
                                            },
                                        }
                                    ));
                                    await delay(100);
                                    
                                    const invoices = invoicesResponse.data?.data || invoicesResponse.data || [];
                                    if (Array.isArray(invoices) && invoices.length > 0) {
                                        const latestInvoice = invoices[0];
                                        console.log(`[${project.id}] Invoice structure:`, JSON.stringify(latestInvoice, null, 2));
                                        console.log(`[${project.id}] Invoice available fields:`, Object.keys(latestInvoice));
                                        
                                        percentCompleteRevenue = parseFloat(latestInvoice.percent_complete || latestInvoice.percentage_complete || latestInvoice.percent_complete_revenue || '0') || 0;
                                        customerRetainage = parseFloat(latestInvoice.total_retainage || latestInvoice.retainage_amount || latestInvoice.retainage || '0') || 0;
                                        console.log(`[${project.id}] Invoice (from /invoices endpoint) - % Complete: ${percentCompleteRevenue}, Retainage: ${customerRetainage}`);
                                    } else {
                                        console.log(`[${project.id}] No invoices found`);
                                    }
                                } catch (invoiceEndpointError: any) {
                                    // Endpoint might not exist or user doesn't have access
                                    const status = invoiceEndpointError.response?.status;
                                    if (status === 403) {
                                        console.warn(`[${project.id}] Invoices: 403 Forbidden (no access)`);
                                    } else if (status === 404) {
                                        console.warn(`[${project.id}] Invoices: 404 Not Found`);
                                    } else if (status) {
                                        console.warn(`[${project.id}] Invoices: Error ${status}:`, invoiceEndpointError.message);
                                    } else {
                                        console.warn(`[${project.id}] Invoices: Error:`, invoiceEndpointError.message);
                                    }
                                }
                            } else {
                                console.log(`[${project.id}] Owner Invoices: No Prime Contracts data, skipping endpoint check`);
                            }
                        } catch (invoiceError: any) {
                            // Invoices may not be available
                            const status = invoiceError.response?.status;
                            if (status === 403) {
                                console.warn(`[${project.id}] Owner Invoices: 403 Forbidden (no access)`);
                            } else if (status === 404) {
                                console.warn(`[${project.id}] Owner Invoices: 404 Not Found`);
                            } else if (status) {
                                console.warn(`[${project.id}] Owner Invoices: Error ${status}:`, invoiceError.message);
                            }
                        }
                        
                        // Fetch Requisitions for Vendor Retainage (based on Power BI mapping)
                        // Sum of Completed Work Retainage Amount From Requisitions
                        let vendorRetainage = 0;
                        console.log(`[${project.id}] Starting Requisitions fetch...`);
                        try {
                            // Correct endpoint: /rest/v1.0/requisitions with project_id as query parameter
                            const requisitionsUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/requisitions`;
                            console.log(`[${project.id}] Fetching Requisitions from: ${requisitionsUrl}`);
                            const requisitionsResponse = await retryOnRateLimit(() => axios.get(
                                requisitionsUrl,
                                {
                                    headers: {
                                        'Authorization': `Bearer ${accessToken}`,
                                        'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                    },
                                    params: {
                                        project_id: project.id, // Required query parameter
                                        per_page: 100, // Get more to sum retainage
                                    },
                                }
                            ));
                            await delay(100);
                            
                            const requisitions = requisitionsResponse.data?.data || requisitionsResponse.data || [];
                            if (Array.isArray(requisitions) && requisitions.length > 0) {
                                requisitions.forEach((req: any) => {
                                    // Sum Completed Work Retainage Amount
                                    const retainage = parseFloat(req.completed_work_retainage_amount || req.retainage_amount || '0') || 0;
                                    vendorRetainage += retainage;
                                });
                                console.log(`[${project.id}] Requisitions: Success - Found ${requisitions.length} requisitions, Vendor Retainage: ${vendorRetainage}`);
                            } else {
                                console.log(`[${project.id}] Requisitions: Empty array returned (no requisitions)`);
                            }
                        } catch (requisitionError: any) {
                            // Requisitions may not be available
                            const status = requisitionError.response?.status;
                            if (status === 403) {
                                console.warn(`[${project.id}] Requisitions: 403 Forbidden (no access)`);
                            } else if (status === 404) {
                                console.warn(`[${project.id}] Requisitions: 404 Not Found`);
                            } else {
                                console.warn(`[${project.id}] Requisitions: Error ${status || 'unknown'}:`, requisitionError.message);
                            }
                        }
                        
                        // Fetch Project Roles for Project Manager (based on Power BI mapping)
                        let projectManager = project.project_manager?.name || project.manager_name || project.created_by?.email || '';
                        console.log(`[${project.id}] Starting Project Roles fetch...`);
                        try {
                            // Correct endpoint: /rest/v1.0/project_roles with project_id as query parameter
                            const projectRolesUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/project_roles`;
                            console.log(`[${project.id}] Fetching Project Roles from: ${projectRolesUrl}`);
                            const projectRolesResponse = await retryOnRateLimit(() => axios.get(
                                projectRolesUrl,
                                {
                                    headers: {
                                        'Authorization': `Bearer ${accessToken}`,
                                        'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                    },
                                    params: {
                                        project_id: project.id, // Required query parameter
                                    },
                                }
                            ));
                            await delay(100);
                            
                            const projectRoles = projectRolesResponse.data?.data || projectRolesResponse.data || [];
                            if (Array.isArray(projectRoles) && projectRoles.length > 0) {
                                // Find Project Manager role
                                const pmRole = projectRoles.find((role: any) => 
                                    role.role_name?.toLowerCase().includes('manager') || 
                                    role.role?.toLowerCase().includes('manager') ||
                                    role.name?.toLowerCase().includes('manager')
                                );
                                if (pmRole && pmRole.user?.name) {
                                    projectManager = pmRole.user.name;
                                    console.log(`[${project.id}] Project Roles: Success - Found PM: ${projectManager}`);
                                } else {
                                    console.log(`[${project.id}] Project Roles: Success - Found ${projectRoles.length} roles, but no PM role found`);
                                }
                            } else {
                                console.log(`[${project.id}] Project Roles: Empty array returned (no roles)`);
                            }
                        } catch (rolesError: any) {
                            const status = rolesError.response?.status;
                            if (status === 403) {
                                console.warn(`[${project.id}] Project Roles: 403 Forbidden (no access)`);
                            } else if (status === 404) {
                                console.warn(`[${project.id}] Project Roles: 404 Not Found`);
                            } else {
                                console.warn(`[${project.id}] Project Roles: Error ${status || 'unknown'}:`, rolesError.message);
                            }
                            // Project roles may not be available, use fallback
                        }
                        
                        // Check for projected_profit in custom fields
                        // Custom fields are nested under projectDetail.custom_fields as custom_field_{id}
                        let projectedProfit = 0;
                        if (projectDetail && projectDetail.custom_fields) {
                            const customFields = projectDetail.custom_fields;
                            const customFieldKeys = Object.keys(customFields);
                            
                            // Log all custom fields for debugging
                            if (customFieldKeys.length > 0) {
                                console.log(`Project ${project.id} has ${customFieldKeys.length} custom fields:`, customFieldKeys);
                                customFieldKeys.forEach(key => {
                                    const customField = customFields[key];
                                    console.log(`  ${key}:`, {
                                        data_type: customField?.data_type,
                                        value: customField?.value,
                                        label: customField?.label,
                                        full: customField
                                    });
                                });
                            }
                            
                            // First, try to find a field with "profit" or "projected" in the label/name
                            for (const key of customFieldKeys) {
                                const customField = customFields[key];
                                
                                // Handle both string and number values
                                let fieldValue: string | number | null = null;
                                if (customField?.value !== null && customField?.value !== undefined) {
                                    if (typeof customField.value === 'string' || typeof customField.value === 'number') {
                                        fieldValue = customField.value;
                                    } else if (typeof customField.value === 'object' && customField.value !== null) {
                                        // Some custom fields have nested value objects
                                        fieldValue = (customField.value as any).value || (customField.value as any).id || null;
                                    }
                                }
                                
                                if (fieldValue !== null) {
                                    // Check if field name/label contains "profit" or "projected" (case insensitive)
                                    const fieldLabel = customField?.label || key;
                                    const labelLower = fieldLabel.toLowerCase();
                                    
                                    const numericValue = typeof fieldValue === 'number' ? fieldValue : parseFloat(String(fieldValue));
                                    
                                    if ((labelLower.includes('profit') || labelLower.includes('projected')) && !isNaN(numericValue)) {
                                        projectedProfit = numericValue;
                                        console.log(`✅ Found projected profit in custom field ${key} (${fieldLabel}): ${projectedProfit}`);
                                        break;
                                    }
                                }
                            }
                            
                            // If we didn't find it by label, check if there's a decimal field that might be projected profit
                            // Based on the console data, custom_field_598134325649528 has value 44829.84 and is decimal type
                            // This appears to be the "Projected Profit" field based on the Admin page
                            if (projectedProfit === 0) {
                                for (const key of customFieldKeys) {
                                    const customField = customFields[key];
                                    const isDecimalField = customField?.data_type === 'decimal';
                                    
                                    if (isDecimalField && customField?.value !== null && customField?.value !== undefined) {
                                        const numericValue = typeof customField.value === 'number' 
                                            ? customField.value 
                                            : parseFloat(String(customField.value));
                                        
                                        if (!isNaN(numericValue) && numericValue > 0) {
                                            // Use the first non-zero decimal field as projected profit
                                            // This is a fallback - ideally we'd have the field label/name
                                            projectedProfit = numericValue;
                                            console.log(`⚠️ Using decimal custom field ${key} as projected profit (fallback): ${projectedProfit}`);
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                        
                        // Map Procore project data to our format
                        const projectData = {
                            id: project.id?.toString() || `procore-${project.id}`,
                            projectName: project.name || projectDetail?.name || 'Unknown Project',
                            projectNumber: project.number || project.project_number || projectDetail?.project_number || '',
                            projectManager: projectManager || project.project_manager?.name || project.manager_name || project.created_by?.email || '', // From Project Roles or fallback
                            projectSystem: 'Procore', // Default since coming from Procore
                            projectStatus: project.status_name || project.status || projectDetail?.active === false ? 'Inactive' : 'Active',
                            profitCenterYear: project.profit_center_year || project.year || null,
                            // Financial fields - prioritize Prime Contract data, then project detail, then calculated
                            totalContractValue: totalValue || 0, // From Prime Contract (ProjectRevisedContractAmount) or project total_value
                            estCostAtCompletion: estCostAtCompletion || 0, // From Budget Views
                            initialEstimatedProfit: totalValue > 0 && estCostAtCompletion > 0 ? totalValue - estCostAtCompletion : 0, // Calculated: Contract Value - Est Cost
                            currentProjectedProfit: projectedProfit || (totalValue > 0 && estCostAtCompletion > 0 ? totalValue - estCostAtCompletion : 0), // From custom field or calculated
                            estimatedDifference: 0, // Calculate if needed
                            percentProjectedProfit: totalValue > 0 && estCostAtCompletion > 0 
                                ? ((totalValue - estCostAtCompletion) / totalValue) * 100 
                                : (totalValue > 0 ? (projectedProfit / totalValue) * 100 : 0), // Formula: (Total Contract Value - Est Cost) / Total Contract Value * 100
                            balanceLeftOnContract: balanceLeftOnContract || 0, // From Prime Contract: RevisedContractAmount - OwnerInvoiceAmount
                            percentCompleteRevenue: percentCompleteRevenue || (totalValue > 0 && totalInvoiced > 0 ? (totalInvoiced / totalValue) * 100 : 0), // From invoice or calculated
                            percentCompleteCost: estCostAtCompletion > 0 ? (jobToDateCost / estCostAtCompletion) * 100 : 0, // Formula: JobToDateCost / EstCostOfCompletion
                            customerRetainage: customerRetainage || 0, // From most recent invoice
                            remainingCost: estCostAtCompletion > 0 ? estCostAtCompletion - jobToDateCost : 0, // Formula: Est Cost Of Completion - Job To Date Costs
                            vendorRetainage: vendorRetainage || 0, // Sum from Requisitions
                            totalInvoiced: totalInvoiced || 0, // From Prime Contract: OwnerInvoiceAmount
                            contractStatus: contractStatus || project.status_name || (projectDetail?.active === false ? 'Inactive' : 'Active'), // From Prime Contract or project
                            contractStartDate: contractStartDate || projectDetail?.start_date || projectDetail?.actual_start_date || null, // From Prime Contract or project
                            contractEndDate: contractEndDate || projectDetail?.completion_date || projectDetail?.projected_finish_date || null, // From Prime Contract or project
                            isActive: project.status_name !== 'Archived' && project.status_name !== 'Closed' && projectDetail?.active !== false,
                            archiveDate: null,
                            // Store raw Procore data for reference
                            _procoreData: project,
                            _procoreDetail: projectDetail, // Store detail for debugging
                            _primeContracts: primeContractsData, // Store prime contracts for debugging
                        };
                        
                        projectsWithData.push(projectData);
                    } catch (error: any) {
                        console.error(`Error processing project ${project.id}:`, error);
                        // Continue to next project even if this one fails
                    }
                } catch (outerError: any) {
                    console.error(`Outer error processing project ${project.id}:`, outerError);
                }
            }
            
            return {
                success: true,
                data: projectsWithData.filter(p => p !== null),
            };
        } catch (error: any) {
            console.error('Error fetching all Procore projects:', error.response?.data || error.message);
            throw new functions.https.HttpsError(
                'internal',
                error.response?.data?.error_description || 'Failed to fetch projects'
            );
        }
    });

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

