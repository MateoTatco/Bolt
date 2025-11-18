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
        timeoutSeconds: 540, // Maximum timeout (9 minutes) for Gen 1 Functions
        // Note: For 100+ projects, this may timeout. Options:
        // 1. Upgrade to Gen 2 Functions (supports up to 60 minutes)
        // 2. Implement batch processing (process in chunks of 20-30 projects)
        // 3. Use Cloud Tasks for background processing
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
        
        // Declare progress tracking variables outside try block for catch block access
        let progressRef: admin.firestore.DocumentReference | null = null;
        let progressRefCreated = false;
        let progressDocId: string | null = null;
        
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
                // Log archive-related fields from project list
                console.log('Archive-related fields in project list:', {
                    archived_at: firstProject.archived_at,
                    archive_date: firstProject.archive_date,
                    archived: firstProject.archived,
                    status: firstProject.status,
                    status_name: firstProject.status_name,
                    active: firstProject.active,
                    updated_at: firstProject.updated_at,
                    closed_at: firstProject.closed_at,
                    closed_date: firstProject.closed_date
                });
            }
            
            // Process projects sequentially with delays to avoid rate limiting
            // Allow configurable limit via data parameter, default to all projects (no limit)
            // For production: process all projects (100+), user can wait for completion
            const maxProjects = data?.maxProjects || projects.length; // Default to all projects
            const projectsToProcess = projects.slice(0, maxProjects);
            console.log(`Processing ${projectsToProcess.length} of ${projects.length} total projects (limit: ${maxProjects === projects.length ? 'none (all projects)' : maxProjects})`);
            
            // Create progress tracking document in Firestore
            progressDocId = `procore_sync_${userId}_${Date.now()}`;
            progressRef = admin.firestore().collection('procoreSyncProgress').doc(progressDocId);
            
            try {
                await progressRef.set({
                    userId,
                    totalProjects: projectsToProcess.length,
                    processedProjects: 0,
                    status: 'processing',
                    startedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                progressRefCreated = true;
            } catch (progressError) {
                console.warn('Could not create progress document, continuing without progress tracking:', progressError);
            }
            
            const projectsWithData: any[] = [];
            
            for (let i = 0; i < projectsToProcess.length; i++) {
                const project = projectsToProcess[i];
                console.log(`[${project.id}] ========== Processing project ${i + 1}/${projectsToProcess.length} ==========`);
                
                // Add delay between projects to avoid rate limiting (except for first project)
                if (i > 0) {
                    await delay(50); // Reduced delay: 50ms between projects
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
                            // Log archive-related fields for debugging
                            if (projectDetail) {
                                console.log(`Project ${project.id} archive-related fields:`, {
                                    archived_at: projectDetail.archived_at,
                                    archive_date: projectDetail.archive_date,
                                    archived: projectDetail.archived,
                                    status: projectDetail.status,
                                    status_name: projectDetail.status_name,
                                    active: projectDetail.active,
                                    updated_at: projectDetail.updated_at
                                });
                            }
                            await delay(50); // Reduced delay: 50ms after each API call
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
                            await delay(50);
                            
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
                                
                                // Map fields - Prime Contracts has 'grand_total' field for contract value
                                // Total Contract Value: Use grand_total from Prime Contract
                                totalContractValueFromPrime = parseFloat(
                                    primaryContract.grand_total ||
                                    primaryContract.revised_contract_amount || 
                                    primaryContract.project_revised_contract_amount ||
                                    primaryContract.pending_revised_contract_amount ||
                                    primaryContract.total_amount || 
                                    primaryContract.contract_amount ||
                                    '0'
                                ) || 0;
                                
                                // Total Invoiced: Owner Invoices Amount from /prime_contract
                                // Note: Prime Contracts may not have invoiced amount directly
                                // We'll get this from Payment Applications g702.contract_sum_to_date
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
                                    primaryContract.grand_total ||
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
                        // Note: This will be updated after Payment Applications is fetched if g702 has contract value
                        let totalValue = totalContractValueFromPrime > 0 
                            ? totalContractValueFromPrime 
                            : (projectDetail?.total_value ? parseFloat(projectDetail.total_value) : 0);
                        
                        // Fetch Est Cost At Completion and Job To Date Cost from Budget
                        // Based on Procore Budget tool, we need to get:
                        // - Estimated Cost at Completion: $285,841.43 (Grand Totals row)
                        // - Job to Date Costs: $276,699.53 (Grand Totals row)
                        // According to API docs: https://developers.procore.com/reference/rest/budget-views
                        // We need to: 1) Get Budget Views, 2) Use summary_rows link to get totals
                        let estCostAtCompletion = 0;
                        let jobToDateCost = 0; // For calculating remaining costs
                        
                        console.log(`[${project.id}] Starting Budget fetch using Budget Views API...`);
                        let budgetDataFound = false;
                        
                        // Step 1: Get Budget Views list
                        try {
                            const budgetViewsUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/budget_views`;
                            console.log(`[${project.id}] Fetching Budget Views from: ${budgetViewsUrl}`);
                            const budgetViewsResponse = await retryOnRateLimit(() => axios.get(
                                budgetViewsUrl,
                                {
                                    headers: {
                                        'Authorization': `Bearer ${accessToken}`,
                                        'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                    },
                                    params: {
                                        project_id: project.id,
                                        per_page: 100, // Get all budget views
                                    },
                                }
                            ));
                            await delay(50);
                            
                            const budgetViews = budgetViewsResponse.data?.data || budgetViewsResponse.data || [];
                            
                            if (Array.isArray(budgetViews) && budgetViews.length > 0) {
                                console.log(`[${project.id}] Budget Views: Found ${budgetViews.length} view(s)`);
                                
                                // Find the "Procore Standard View" or use the first one
                                const budgetView = budgetViews.find((view: any) => 
                                    view.name?.toLowerCase().includes('standard') || 
                                    view.name?.toLowerCase().includes('procore')
                                ) || budgetViews[0];
                                
                                console.log(`[${project.id}] Using Budget View: ${budgetView.name} (ID: ${budgetView.id})`);
                                console.log(`[${project.id}] Budget View structure:`, JSON.stringify(budgetView, null, 2));
                                
                                // Step 2: Get Summary Rows (contains Grand Totals)
                                if (budgetView.links?.summary_rows) {
                                    // Extract project_id from the link URL or use the one we have
                                    const summaryRowsUrl = budgetView.links.summary_rows;
                                    console.log(`[${project.id}] Fetching Budget View Summary Rows from: ${summaryRowsUrl}`);
                                    
                                    const summaryRowsResponse = await retryOnRateLimit(() => axios.get(
                                        summaryRowsUrl,
                                        {
                                            headers: {
                                                'Authorization': `Bearer ${accessToken}`,
                                                'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                            },
                                        }
                                    ));
                                    await delay(50);
                                    
                                    const summaryRows = summaryRowsResponse.data?.data || summaryRowsResponse.data || [];
                                    console.log(`[${project.id}] Budget View Summary Rows structure:`, JSON.stringify(summaryRows, null, 2));
                                    
                                    if (Array.isArray(summaryRows) && summaryRows.length > 0) {
                                        // Find the Grand Totals row (usually the last one or has a specific identifier)
                                        const grandTotalsRow = summaryRows.find((row: any) => 
                                            row.description?.toLowerCase().includes('grand total') ||
                                            row.description?.toLowerCase().includes('total') ||
                                            row.is_total === true ||
                                            row.is_grand_total === true
                                        ) || summaryRows[summaryRows.length - 1]; // Fallback to last row
                                        
                                        if (grandTotalsRow) {
                                            console.log(`[${project.id}] Grand Totals Row structure:`, JSON.stringify(grandTotalsRow, null, 2));
                                            console.log(`[${project.id}] Grand Totals Row available fields:`, Object.keys(grandTotalsRow));
                                            
                                            // Extract Estimated Cost at Completion and Job to Date Costs
                                            // Based on Procore Budget tool columns - field names match exactly!
                                            estCostAtCompletion = parseFloat(
                                                grandTotalsRow['Estimated Cost at Completion'] ||
                                                grandTotalsRow.estimated_cost_at_completion ||
                                                grandTotalsRow.est_cost_at_completion ||
                                                '0'
                                            ) || 0;
                                            
                                            jobToDateCost = parseFloat(
                                                grandTotalsRow['Job to Date Costs'] ||
                                                grandTotalsRow.job_to_date_costs ||
                                                grandTotalsRow.job_to_date_cost ||
                                                '0'
                                            ) || 0;
                                            
                                            if (estCostAtCompletion > 0 || jobToDateCost > 0) {
                                                budgetDataFound = true;
                                                console.log(`[${project.id}] Budget View Summary Rows: Success - Est Cost: ${estCostAtCompletion}, Job To Date: ${jobToDateCost}`);
                                            }
                                        }
                                    }
                                } else {
                                    console.warn(`[${project.id}] Budget View does not have summary_rows link`);
                                }
                            } else {
                                console.log(`[${project.id}] Budget Views: Empty array returned`);
                            }
                        } catch (budgetViewsError: any) {
                            const status = budgetViewsError.response?.status;
                            if (status === 403) {
                                console.warn(`[${project.id}] Budget Views: 403 Forbidden (no access)`);
                            } else if (status === 404) {
                                console.warn(`[${project.id}] Budget Views: 404 Not Found`);
                            } else {
                                console.warn(`[${project.id}] Budget Views: Error ${status || 'unknown'}:`, budgetViewsError.message);
                            }
                        }
                        
                        // Fallback: Try Budget Line Items and sum them if Budget Views didn't work
                        if (!budgetDataFound) {
                            try {
                                // Try Budget Line Items endpoint: /rest/v2.0/companies/{company_id}/projects/{project_id}/budget_line_items
                                const budgetLineItemsUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v2.0/companies/${PROCORE_CONFIG.companyId}/projects/${project.id}/budget_line_items`;
                                console.log(`[${project.id}] Trying Budget Line Items v2.0: ${budgetLineItemsUrl}`);
                                const budgetLineItemsResponse = await retryOnRateLimit(() => axios.get(
                                    budgetLineItemsUrl,
                                    {
                                        headers: {
                                            'Authorization': `Bearer ${accessToken}`,
                                            'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                        },
                                        params: {
                                            per_page: 1000, // Get all line items to sum
                                        },
                                    }
                                ));
                                await delay(50);
                                
                                const budgetLineItems = budgetLineItemsResponse.data?.data || budgetLineItemsResponse.data || [];
                                
                                if (Array.isArray(budgetLineItems) && budgetLineItems.length > 0) {
                                    console.log(`[${project.id}] Budget Line Items: Found ${budgetLineItems.length} items`);
                                    
                                    // Log first item structure to see all available fields
                                    if (budgetLineItems.length > 0) {
                                        console.log(`[${project.id}] Budget Line Item structure (first item):`, JSON.stringify(budgetLineItems[0], null, 2));
                                        console.log(`[${project.id}] Budget Line Item available fields:`, Object.keys(budgetLineItems[0]));
                                    }
                                    
                                    // Sum up cost data from line items
                                    // Based on Procore Budget tool screenshot:
                                    // - "Estimated Cost at Completion" column = Projected Costs + Forecast To Complete
                                    // - "Job to Date Costs" column = Committed Costs + Direct Costs
                                    budgetLineItems.forEach((item: any) => {
                                        // Estimated Cost at Completion = Projected Costs + Forecast To Complete
                                        const projectedCosts = parseFloat(item.projected_costs || '0') || 0;
                                        const forecastToComplete = parseFloat(item.forecast_to_complete || '0') || 0;
                                        const estCost = projectedCosts + forecastToComplete;
                                        
                                        // If that doesn't work, try direct fields
                                        if (estCost === 0) {
                                            const altEstCost = parseFloat(
                                                item.estimated_cost_at_completion || 
                                                item.est_cost_at_completion || 
                                                item.forecast_at_completion ||
                                                item.total_cost || 
                                                item.cost_at_completion ||
                                                '0'
                                            ) || 0;
                                            estCostAtCompletion += altEstCost;
                                        } else {
                                            estCostAtCompletion += estCost;
                                        }
                                        
                                        // Job to Date Costs = Committed Costs + Direct Costs
                                        const committedCosts = parseFloat(item.committed_costs || '0') || 0;
                                        const directCosts = parseFloat(item.direct_costs || '0') || 0;
                                        const jtdCost = committedCosts + directCosts;
                                        
                                        // If that doesn't work, try direct fields
                                        if (jtdCost === 0) {
                                            const altJtdCost = parseFloat(
                                                item.job_to_date_costs ||
                                                item.job_to_date_cost || 
                                                item.jtd_cost || 
                                                item.cost_to_date ||
                                                item.total_cost_to_date ||
                                                '0'
                                            ) || 0;
                                            jobToDateCost += altJtdCost;
                                        } else {
                                            jobToDateCost += jtdCost;
                                        }
                                    });
                                    
                                    if (estCostAtCompletion > 0 || jobToDateCost > 0) {
                                        budgetDataFound = true;
                                        console.log(`[${project.id}] Budget Line Items: Success - Est Cost: ${estCostAtCompletion}, Job To Date: ${jobToDateCost}`);
                                    }
                                } else {
                                    console.log(`[${project.id}] Budget Line Items: Empty array returned`);
                                }
                            } catch (budgetError: any) {
                                // Budget Line Items may not be available (403/404)
                                const status = budgetError.response?.status;
                                if (status === 403) {
                                    console.warn(`[${project.id}] Budget Line Items: 403 Forbidden (no access)`);
                                } else if (status === 404) {
                                    console.warn(`[${project.id}] Budget Line Items: 404 Not Found`);
                                } else {
                                    console.warn(`[${project.id}] Budget Line Items: Error ${status || 'unknown'}:`, budgetError.message);
                                }
                            }
                        }
                        
                        // Fetch Payment Applications for Percent Complete (Revenue) and Customer Retainage
                        // Payment Applications v1.0 is a working endpoint (from test results)
                        // This may contain invoice-like data with percent complete and retainage
                        let percentCompleteRevenue = 0;
                        let customerRetainage = 0;
                        console.log(`[${project.id}] Starting Payment Applications fetch...`);
                        try {
                            // Use Payment Applications v1.0 endpoint: /rest/v1.0/payment_applications
                            // Fetch multiple to find the one with the latest billing_date (not just created_at)
                            const paymentApplicationsUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/payment_applications`;
                            console.log(`[${project.id}] Fetching Payment Applications from: ${paymentApplicationsUrl}`);
                            const paymentApplicationsResponse = await retryOnRateLimit(() => axios.get(
                                paymentApplicationsUrl,
                                {
                                    headers: {
                                        'Authorization': `Bearer ${accessToken}`,
                                        'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                    },
                                    params: {
                                        project_id: project.id, // Required query parameter
                                        per_page: 10, // Get enough to find latest by billing_date (optimized for performance)
                                        sort: '-billing_date', // Sort by billing_date directly if API supports it, otherwise by created_at
                                    },
                                }
                            ));
                            await delay(50);
                            
                            const paymentApplications = paymentApplicationsResponse.data?.data || paymentApplicationsResponse.data || [];
                            
                            if (Array.isArray(paymentApplications) && paymentApplications.length > 0) {
                                // Sort by billing_date to get the most recent payment application by billing date
                                // This is more accurate than sorting by created_at
                                const sortedByBillingDate = [...paymentApplications].sort((a: any, b: any) => {
                                    const dateA = a.billing_date ? new Date(a.billing_date).getTime() : 0;
                                    const dateB = b.billing_date ? new Date(b.billing_date).getTime() : 0;
                                    return dateB - dateA; // Most recent first
                                });
                                
                                const latestPaymentApp = sortedByBillingDate[0];
                                console.log(`[${project.id}] Using Payment Application with billing_date: ${latestPaymentApp.billing_date || 'N/A'}`);
                                // Reduced logging for performance - only log structure in debug mode
                                // console.log(`[${project.id}] Payment Application structure:`, JSON.stringify(latestPaymentApp, null, 2));
                                // console.log(`[${project.id}] Payment Application available fields:`, Object.keys(latestPaymentApp));
                                
                                // Extract percent complete and retainage from payment application
                                // percent_complete is at root level
                                percentCompleteRevenue = parseFloat(
                                    latestPaymentApp.percent_complete || 
                                    latestPaymentApp.percentage_complete || 
                                    latestPaymentApp.percent_complete_revenue ||
                                    latestPaymentApp.completion_percentage ||
                                    '0'
                                ) || 0;
                                
                                // Customer retainage is nested in g702 object
                                // Power BI shows 9142, but we're getting 35462.19 from completed_work_retainage_amount
                                // Power BI might be showing the remaining/unreleased retainage, not the total retainage
                                // Try balance_to_finish_including_retainage or calculate from total_retainage - released_retainage
                                if (latestPaymentApp.g702) {
                                    // Log specific g702 fields for debugging - need to find correct retainage field (Power BI shows 9142, we're getting 35462.19)
                                    console.log(`[${project.id}] Payment Application g702 fields:`, Object.keys(latestPaymentApp.g702));
                                    console.log(`[${project.id}] Payment Application g702 retainage-related values:`, {
                                        retainage_amount: latestPaymentApp.g702.retainage_amount,
                                        retainage: latestPaymentApp.g702.retainage,
                                        customer_retainage: latestPaymentApp.g702.customer_retainage,
                                        completed_work_retainage_amount: latestPaymentApp.g702.completed_work_retainage_amount,
                                        total_retainage: latestPaymentApp.g702.total_retainage,
                                        balance_to_finish_including_retainage: latestPaymentApp.g702.balance_to_finish_including_retainage,
                                        stored_materials_retainage_amount: latestPaymentApp.g702.stored_materials_retainage_amount,
                                        completed_work_retainage_percent: latestPaymentApp.g702.completed_work_retainage_percent
                                    });
                                    
                                    // Try balance_to_finish_including_retainage first (remaining balance including retainage)
                                    // If Power BI shows $9,142, it might be the remaining retainage, not the total
                                    const balanceToFinish = parseFloat(latestPaymentApp.g702.balance_to_finish_including_retainage || '0') || 0;
                                    const totalRetainage = parseFloat(latestPaymentApp.g702.total_retainage || '0') || 0;
                                    
                                    // If balance_to_finish_including_retainage is close to Power BI value (9142), use it
                                    // Otherwise, try other fields
                                    if (balanceToFinish > 0 && balanceToFinish < totalRetainage) {
                                        customerRetainage = balanceToFinish;
                                        console.log(`[${project.id}] Using balance_to_finish_including_retainage for Customer Retainage: ${customerRetainage}`);
                                    } else {
                                        // Fallback to other fields
                                        customerRetainage = parseFloat(
                                            latestPaymentApp.g702.retainage_amount ||
                                            latestPaymentApp.g702.retainage ||
                                            latestPaymentApp.g702.customer_retainage ||
                                            latestPaymentApp.g702.completed_work_retainage_amount ||
                                            latestPaymentApp.g702.total_retainage ||
                                            '0'
                                        ) || 0;
                                    }
                                }
                                
                                // Fallback to root level fields if g702 doesn't have it
                                if (customerRetainage === 0) {
                                    customerRetainage = parseFloat(
                                        latestPaymentApp.total_retainage || 
                                        latestPaymentApp.retainage_amount || 
                                        latestPaymentApp.retainage ||
                                        latestPaymentApp.customer_retainage ||
                                        '0'
                                    ) || 0;
                                }
                                
                                // Use Payment Applications g702 data for contract value, invoiced amounts, and Job To Date Cost
                                // Based on Power BI data: totalInvoiced (354620.88) matches expected contract value (354621)
                                // So contract_sum_to_date appears to be the actual contract value, not original_contract_sum
                                // Payment Applications are project-wide, so g702.total_completed_and_stored_to_date should be used for Job To Date Cost
                                if (latestPaymentApp.g702) {
                                    // Use contract_sum_to_date as contract value (matches Power BI - this is the actual contract amount)
                                    // Power BI shows contract value as 354621, and our totalInvoiced (from contract_sum_to_date) is 354620.88
                                    if (latestPaymentApp.g702.contract_sum_to_date) {
                                        const contractSumToDate = parseFloat(latestPaymentApp.g702.contract_sum_to_date) || 0;
                                        if (contractSumToDate > 0) {
                                            // Use contract_sum_to_date as the contract value (it's the revised/current contract amount)
                                            totalContractValueFromPrime = contractSumToDate;
                                            totalValue = contractSumToDate;
                                            totalInvoiced = contractSumToDate; // Also use as total invoiced
                                            console.log(`[${project.id}] Using Payment Applications g702.contract_sum_to_date for Contract Value: ${totalContractValueFromPrime} (matches Power BI)`);
                                        }
                                    }
                                    
                                    // NOTE: Payment Application g702's total_completed_and_stored_to_date is the contract value (revenue), NOT the cost
                                    // Job To Date Cost should come from Requisitions (sum of all requisitions' total_completed_and_stored_to_date)
                                    // We'll calculate Job To Date Cost from Requisitions below, not from Payment Applications
                                    
                                    // Log all g702 numeric values to help identify correct fields
                                    const g702NumericFields: any = {};
                                    Object.keys(latestPaymentApp.g702).forEach(key => {
                                        const value = latestPaymentApp.g702[key];
                                        if (typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)))) {
                                            g702NumericFields[key] = value;
                                        }
                                    });
                                    console.log(`[${project.id}] Payment Application g702 ALL numeric values:`, g702NumericFields);
                                    
                                    // Fallback: use original_contract_sum if contract_sum_to_date is not available
                                    if (totalContractValueFromPrime === 0 && latestPaymentApp.g702.original_contract_sum) {
                                        const paymentAppContractValue = parseFloat(latestPaymentApp.g702.original_contract_sum) || 0;
                                        if (paymentAppContractValue > 0) {
                                            totalContractValueFromPrime = paymentAppContractValue;
                                            totalValue = paymentAppContractValue;
                                            console.log(`[${project.id}] Using Payment Applications g702.original_contract_sum for Contract Value (fallback): ${totalContractValueFromPrime}`);
                                        }
                                    }
                                    
                                    // Recalculate balance if we have new data
                                    if (totalContractValueFromPrime > 0 && totalInvoiced > 0) {
                                        balanceLeftOnContract = totalContractValueFromPrime - totalInvoiced;
                                        console.log(`[${project.id}] Recalculated Balance from Payment Applications - Contract: ${totalContractValueFromPrime}, Invoiced: ${totalInvoiced}, Balance: ${balanceLeftOnContract}`);
                                    }
                                }
                                
                                // Fallback: use total_amount_paid as total invoiced if g702 doesn't have it
                                if (totalInvoiced === 0 && latestPaymentApp.total_amount_paid) {
                                    totalInvoiced = parseFloat(latestPaymentApp.total_amount_paid) || 0;
                                }
                                
                                // Final balance recalculation after all Payment Applications data
                                if (totalContractValueFromPrime > 0 && totalInvoiced > 0) {
                                    balanceLeftOnContract = totalContractValueFromPrime - totalInvoiced;
                                }
                                
                                console.log(`[${project.id}] Payment Application - % Complete: ${percentCompleteRevenue}, Retainage: ${customerRetainage}`);
                            } else {
                                console.log(`[${project.id}] No payment applications found`);
                            }
                            
                            // Also try to get data from Prime Contract if available
                            if (primeContractsData && primeContractsData.length > 0 && (percentCompleteRevenue === 0 || customerRetainage === 0)) {
                                const primaryContract = primeContractsData[0];
                                // Check if invoice data is nested in the contract
                                if (primaryContract.owner_invoices && Array.isArray(primaryContract.owner_invoices) && primaryContract.owner_invoices.length > 0) {
                                    const latestInvoice = primaryContract.owner_invoices[0];
                                    if (percentCompleteRevenue === 0) {
                                        percentCompleteRevenue = parseFloat(latestInvoice.percent_complete || latestInvoice.percentage_complete || '0') || 0;
                                    }
                                    if (customerRetainage === 0) {
                                        customerRetainage = parseFloat(latestInvoice.total_retainage || latestInvoice.retainage_amount || '0') || 0;
                                    }
                                    console.log(`[${project.id}] Owner Invoice (from Prime Contract) - % Complete: ${percentCompleteRevenue}, Retainage: ${customerRetainage}`);
                                }
                            }
                        } catch (paymentAppError: any) {
                            // Payment Applications may not be available
                            const status = paymentAppError.response?.status;
                            if (status === 403) {
                                console.warn(`[${project.id}] Payment Applications: 403 Forbidden (no access)`);
                            } else if (status === 404) {
                                console.warn(`[${project.id}] Payment Applications: 404 Not Found`);
                            } else {
                                console.warn(`[${project.id}] Payment Applications: Error ${status || 'unknown'}:`, paymentAppError.message);
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
                                        per_page: 30, // Reduced from 100 for performance - get enough for retainage and job to date cost
                                    },
                                }
                            ));
                            await delay(50);
                            
                            const requisitions = requisitionsResponse.data?.data || requisitionsResponse.data || [];
                            if (Array.isArray(requisitions) && requisitions.length > 0) {
                                // Log first requisition structure to see what fields are available
                                if (requisitions.length > 0) {
                                    console.log(`[${project.id}] First Requisition structure:`, JSON.stringify(requisitions[0], null, 2));
                                    console.log(`[${project.id}] First Requisition available fields:`, Object.keys(requisitions[0]));
                                }
                                
                                // Sort requisitions by billing_date (most recent first) to get latest cumulative total
                                const sortedRequisitions = [...requisitions].sort((a: any, b: any) => {
                                    const dateA = a.billing_date ? new Date(a.billing_date).getTime() : 0;
                                    const dateB = b.billing_date ? new Date(b.billing_date).getTime() : 0;
                                    return dateB - dateA; // Most recent first
                                });
                                
                                requisitions.forEach((req: any) => {
                                    // Check summary object first (retainage might be nested there)
                                    let retainage = 0;
                                    
                                    if (req.summary) {
                                        // Extract vendor retainage
                                        retainage = parseFloat(
                                            req.summary.completed_work_retainage_amount ||
                                            req.summary.retainage_amount ||
                                            req.summary.total_retainage ||
                                            '0'
                                        ) || 0;
                                    }
                                    
                                    // Fallback to root level fields
                                    if (retainage === 0) {
                                        retainage = parseFloat(
                                            req.completed_work_retainage_amount || 
                                            req.retainage_amount || 
                                            req.total_retainage ||
                                            '0'
                                        ) || 0;
                                    }
                                    
                                    vendorRetainage += retainage;
                                });
                                
                                // For Job To Date Cost, use Budget data if available (more accurate)
                                // Otherwise, sum ALL requisitions' total_completed_and_stored_to_date (not just latest)
                                // Requisitions are per-commitment, so we need to sum them all to get total project cost
                                // Power BI shows ~276,305 for Job To Date Cost, which is 97% of Est Cost ($284,851)
                                // Payment Applications are for revenue, Requisitions are for costs
                                // NOTE: Only use Requisitions if Budget didn't provide Job To Date Cost
                                if (jobToDateCost === 0 && sortedRequisitions.length > 0) {
                                    // Sum all requisitions' total_completed_and_stored_to_date to get total project cost
                                    let totalRequisitionCost = 0;
                                    sortedRequisitions.forEach((req: any) => {
                                        if (req.summary && req.summary.total_completed_and_stored_to_date) {
                                            const reqCost = parseFloat(req.summary.total_completed_and_stored_to_date) || 0;
                                            totalRequisitionCost += reqCost;
                                        }
                                    });
                                    
                                    if (totalRequisitionCost > 0) {
                                        jobToDateCost = totalRequisitionCost;
                                        console.log(`[${project.id}] Using sum of all requisitions' total_completed_and_stored_to_date for Job To Date Cost: ${jobToDateCost} (from ${sortedRequisitions.length} requisitions)`);
                                    } else {
                                        // Fallback: use latest requisition's total_completed_and_stored_to_date
                                        if (sortedRequisitions[0].summary) {
                                            const latestSummary = sortedRequisitions[0].summary;
                                            const latestTotal = parseFloat(
                                                latestSummary.total_cost_to_date ||
                                                latestSummary.cost_to_date ||
                                                latestSummary.job_to_date_cost ||
                                                latestSummary.total_completed_and_stored_to_date ||
                                                '0'
                                            ) || 0;
                                            
                                            if (latestTotal > 0) {
                                                jobToDateCost = latestTotal;
                                                console.log(`[${project.id}] Using latest requisition's Job To Date Cost (fallback): ${latestTotal}`);
                                            }
                                        }
                                    }
                                    
                                    // Log all summary fields for debugging
                                    if (sortedRequisitions[0].summary) {
                                        const latestSummary = sortedRequisitions[0].summary;
                                        console.log(`[${project.id}] Latest Requisition Summary fields:`, Object.keys(latestSummary));
                                        const numericFields: any = {};
                                        Object.keys(latestSummary).forEach(key => {
                                            const value = latestSummary[key];
                                            if (typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)))) {
                                                numericFields[key] = value;
                                            }
                                        });
                                        console.log(`[${project.id}] Latest Requisition Summary ALL numeric values:`, numericFields);
                                    }
                                }
                                
                                console.log(`[${project.id}] Requisitions: Success - Found ${requisitions.length} requisitions, Vendor Retainage: ${vendorRetainage}, Job To Date Cost: ${jobToDateCost}`);
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
                        
                        // Contract Payments endpoint returns 404, so we're using Requisitions for Job To Date Cost instead
                        
                        // Fetch Commitments for Est Cost At Completion (ONLY if Budget Line Items didn't provide data)
                        // NOTE: This is a fallback approach since Budget Views endpoint (per reference chart) is not available.
                        // We sum total_amount from individual commitment details to get Est Cost At Completion.
                        // PERFORMANCE: Skip if Budget Line Items already provided estCostAtCompletion
                        if (estCostAtCompletion === 0) {
                            console.log(`[${project.id}] Starting Commitments fetch (fallback for Est Cost At Completion - Budget Line Items had no data)...`);
                            try {
                                const commitmentsUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/commitments`;
                                console.log(`[${project.id}] Fetching Commitments from: ${commitmentsUrl}`);
                                const commitmentsResponse = await retryOnRateLimit(() => axios.get(
                                    commitmentsUrl,
                                    {
                                        headers: {
                                            'Authorization': `Bearer ${accessToken}`,
                                            'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                        },
                                        params: {
                                            project_id: project.id,
                                            per_page: 50, // Reduced from 1000 for performance - limit to 50 commitments max
                                        },
                                    }
                                ));
                                await delay(50);
                                
                                const commitments = commitmentsResponse.data?.data || commitmentsResponse.data || [];
                                if (Array.isArray(commitments) && commitments.length > 0) {
                                    console.log(`[${project.id}] Commitments: Found ${commitments.length} commitment(s) (limited to 50 for performance)`);
                                    
                                    // PERFORMANCE: Only fetch details for first 20 commitments to avoid timeout
                                    // This is a trade-off: we may miss some commitments, but it prevents timeouts
                                    const commitmentsToFetch = commitments.slice(0, 20);
                                    console.log(`[${project.id}] Fetching details for ${commitmentsToFetch.length} of ${commitments.length} commitments (limited for performance)...`);
                                    
                                    for (const commitment of commitmentsToFetch) {
                                        try {
                                            const commitmentDetailUrl = `${PROCORE_CONFIG.apiBaseUrl}/rest/v1.0/commitments/${commitment.id}`;
                                            const commitmentDetailResponse = await retryOnRateLimit(() => axios.get(
                                                commitmentDetailUrl,
                                                {
                                                    headers: {
                                                        'Authorization': `Bearer ${accessToken}`,
                                                        'Procore-Company-Id': PROCORE_CONFIG.companyId,
                                                    },
                                                    params: {
                                                        project_id: project.id,
                                                    },
                                                }
                                            ));
                                            await delay(30); // Reduced delay from 50ms to 30ms
                                            
                                            const commitmentDetail = commitmentDetailResponse.data;
                                            
                                            // Check for amount fields in detail - use total_amount or grand_total
                                            const commitmentAmount = parseFloat(
                                                commitmentDetail.total_amount ||
                                                commitmentDetail.grand_total ||
                                                commitmentDetail.amount ||
                                                commitmentDetail.committed_amount ||
                                                commitmentDetail.estimated_cost ||
                                                '0'
                                            ) || 0;
                                            
                                            if (commitmentAmount > 0) {
                                                estCostAtCompletion += commitmentAmount;
                                            }
                                        } catch (detailError: any) {
                                            // If detail fetch fails, log but continue
                                            const status = detailError.response?.status;
                                            if (status === 403) {
                                                console.warn(`[${project.id}] Commitment ${commitment.id} detail: 403 Forbidden`);
                                            } else if (status === 404) {
                                                console.warn(`[${project.id}] Commitment ${commitment.id} detail: 404 Not Found`);
                                            }
                                            // Skip other errors silently to avoid log spam
                                        }
                                    }
                                    
                                    console.log(`[${project.id}] Commitments: Est Cost At Completion from commitments: ${estCostAtCompletion} (from ${commitmentsToFetch.length} commitments)`);
                                } else {
                                    console.log(`[${project.id}] Commitments: Empty array returned`);
                                }
                            } catch (commitmentsError: any) {
                                const status = commitmentsError.response?.status;
                                if (status === 403) {
                                    console.warn(`[${project.id}] Commitments: 403 Forbidden (no access)`);
                                } else if (status === 404) {
                                    console.warn(`[${project.id}] Commitments: 404 Not Found`);
                                } else {
                                    console.warn(`[${project.id}] Commitments: Error ${status || 'unknown'}:`, commitmentsError.message);
                                }
                            }
                        } else {
                            console.log(`[${project.id}] Skipping Commitments fetch - Budget Line Items already provided estCostAtCompletion: ${estCostAtCompletion}`);
                        }
                        
                        // Final balance recalculation after all data is fetched
                        // Use totalValue (which may have been updated from Payment Applications) or totalContractValueFromPrime
                        const finalContractValue = totalContractValueFromPrime > 0 ? totalContractValueFromPrime : totalValue;
                        if (finalContractValue > 0 && totalInvoiced > 0) {
                            balanceLeftOnContract = finalContractValue - totalInvoiced;
                            console.log(`[${project.id}] Final Balance Calculation - Contract: ${finalContractValue}, Invoiced: ${totalInvoiced}, Balance: ${balanceLeftOnContract}`);
                        } else {
                            console.log(`[${project.id}] Cannot calculate balance - Contract: ${finalContractValue}, Invoiced: ${totalInvoiced}`);
                        }
                        
                        // If contract value equals total invoiced (from Payment Applications), balance should be 0
                        // Power BI shows balance as 0 when contract is fully invoiced
                        if (Math.abs(finalContractValue - totalInvoiced) < 1) {
                            balanceLeftOnContract = 0;
                            console.log(`[${project.id}] Contract value equals total invoiced, setting balance to 0`);
                        }
                        
                        // Fetch Project Roles for Project Manager (based on Power BI mapping)
                        // Initialize with empty string - will be populated from Project Roles endpoint
                        let projectManager = '';
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
                            await delay(50);
                            
                            const projectRoles = projectRolesResponse.data?.data || projectRolesResponse.data || [];
                            if (Array.isArray(projectRoles) && projectRoles.length > 0) {
                                // Find Project Manager role - try multiple variations
                                const pmRole = projectRoles.find((role: any) => {
                                    const roleName = (role.role_name || role.role || '').toLowerCase();
                                    return roleName.includes('project manager') || 
                                           roleName === 'project manager' ||
                                           roleName.includes('manager');
                                });
                                
                                if (pmRole) {
                                    // Based on test results: Project Roles v1.0 returns name directly on the role object
                                    // Structure: { id, name: 'Simon Cox (Tatco Construction)', role: 'Project Manager', ... }
                                    projectManager = pmRole.name || 
                                                   pmRole.user?.name || 
                                                   pmRole.user?.full_name || 
                                                   pmRole.user?.display_name ||
                                                   '';
                                    console.log(`[${project.id}] Project Roles: Success - Found PM role: ${pmRole.role}, Name: ${projectManager}`);
                                } else {
                                    console.log(`[${project.id}] Project Roles: Success - Found ${projectRoles.length} roles, but no PM role found. Available roles:`, projectRoles.map((r: any) => r.role || r.role_name || 'unknown'));
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
                        
                        // Check for projected_profit and initial_estimated_profit in custom fields
                        // Custom fields are nested under projectDetail.custom_fields as custom_field_{id}
                        let projectedProfit = 0;
                        let initialEstimatedProfitFromCustomField = 0;
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
                            
                            // First, try to find fields with "profit", "projected", or "initial" in the label/name
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
                                    // Check if field name/label contains relevant keywords (case insensitive)
                                    const fieldLabel = customField?.label || key;
                                    const labelLower = fieldLabel.toLowerCase();
                                    
                                    const numericValue = typeof fieldValue === 'number' ? fieldValue : parseFloat(String(fieldValue));
                                    
                                    if (!isNaN(numericValue)) {
                                        // Check for "current projected profit" or "projected profit" (current)
                                        if ((labelLower.includes('current') && labelLower.includes('projected')) ||
                                            (labelLower.includes('projected') && !labelLower.includes('initial'))) {
                                            if (projectedProfit === 0) {
                                                projectedProfit = numericValue;
                                                console.log(`✅ Found Current Projected Profit in custom field ${key} (${fieldLabel}): ${projectedProfit}`);
                                            }
                                        }
                                        // Check for "initial estimated profit" or "initial profit"
                                        else if ((labelLower.includes('initial') && (labelLower.includes('estimated') || labelLower.includes('profit'))) ||
                                                 (labelLower.includes('original') && labelLower.includes('profit'))) {
                                            if (initialEstimatedProfitFromCustomField === 0) {
                                                initialEstimatedProfitFromCustomField = numericValue;
                                                console.log(`✅ Found Initial Estimated Profit in custom field ${key} (${fieldLabel}): ${initialEstimatedProfitFromCustomField}`);
                                            }
                                        }
                                        // Generic "profit" field (use as current projected if not found yet)
                                        else if (labelLower.includes('profit') && projectedProfit === 0 && !labelLower.includes('initial') && !labelLower.includes('original')) {
                                            projectedProfit = numericValue;
                                            console.log(`✅ Found profit field (using as Current Projected Profit) ${key} (${fieldLabel}): ${projectedProfit}`);
                                        }
                                    }
                                }
                            }
                            
                            // If we didn't find it by label, check if there's a decimal field that might be projected profit
                            // Based on the console data, custom_field_598134325649528 has value 44829.84 and is decimal type
                            // This might be Initial Estimated Profit, not Current Projected Profit
                            if (projectedProfit === 0 || initialEstimatedProfitFromCustomField === 0) {
                                for (const key of customFieldKeys) {
                                    const customField = customFields[key];
                                    const isDecimalField = customField?.data_type === 'decimal';
                                    
                                    if (isDecimalField && customField?.value !== null && customField?.value !== undefined) {
                                        const numericValue = typeof customField.value === 'number' 
                                            ? customField.value 
                                            : parseFloat(String(customField.value));
                                        
                                        if (!isNaN(numericValue) && numericValue > 0) {
                                            // If we found a value around 44,830, it might be Initial Estimated Profit
                                            // If we found a value around 69,770, it might be Current Projected Profit
                                            // Use the larger value as Current Projected Profit, smaller as Initial
                                            if (projectedProfit === 0 && initialEstimatedProfitFromCustomField === 0) {
                                                // First decimal field found - try to determine which it is
                                                if (numericValue > 50000) {
                                                    projectedProfit = numericValue;
                                                    console.log(`⚠️ Using larger decimal custom field ${key} as Current Projected Profit (fallback): ${projectedProfit}`);
                                                } else {
                                                    initialEstimatedProfitFromCustomField = numericValue;
                                                    console.log(`⚠️ Using smaller decimal custom field ${key} as Initial Estimated Profit (fallback): ${initialEstimatedProfitFromCustomField}`);
                                                }
                                            } else if (projectedProfit === 0 && numericValue > initialEstimatedProfitFromCustomField) {
                                                projectedProfit = numericValue;
                                                console.log(`⚠️ Using decimal custom field ${key} as Current Projected Profit (fallback): ${projectedProfit}`);
                                            } else if (initialEstimatedProfitFromCustomField === 0 && numericValue < projectedProfit) {
                                                initialEstimatedProfitFromCustomField = numericValue;
                                                console.log(`⚠️ Using decimal custom field ${key} as Initial Estimated Profit (fallback): ${initialEstimatedProfitFromCustomField}`);
                                            }
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
                            projectManager: projectManager || project.project_manager?.name || project.manager_name || '', // From Project Roles (name is directly on role object, not nested under user)
                            projectSystem: 'Procore', // Default since coming from Procore
                            projectStatus: project.stage_name || projectDetail?.project_stage?.name || project.status_name || project.status || (projectDetail?.active === false ? 'Inactive' : 'Active'), // Use stage_name for values like "Course of Construction", "Complete", etc.
                            // Financial fields - prioritize Prime Contract data, then project detail, then calculated
                            totalContractValue: totalValue || 0, // From Payment Applications g702.original_contract_sum (prioritized) or Prime Contract
                            estCostAtCompletion: estCostAtCompletion || 0, // From Budget Line Items + Commitments (Budget Views endpoint not available)
                            // Initial Estimated Profit: Use custom field if available, otherwise calculate as Contract Value - Est Cost
                            // Note: Power BI shows Initial Estimated Profit as a stored value (e.g., $44,830), not calculated
                            initialEstimatedProfit: initialEstimatedProfitFromCustomField > 0 
                                ? initialEstimatedProfitFromCustomField 
                                : (totalValue > 0 && estCostAtCompletion > 0 ? totalValue - estCostAtCompletion : 0),
                            // Current Projected Profit: Use custom field if available, otherwise calculate as Contract Value - Est Cost
                            // Power BI shows this as $69,770 which matches Contract Value ($354,621) - Est Cost ($284,851) = $69,770
                            currentProjectedProfit: projectedProfit > 0 
                                ? projectedProfit 
                                : (totalValue > 0 && estCostAtCompletion > 0 ? totalValue - estCostAtCompletion : 0),
                            estimatedDifference: (() => {
                                // Use custom field values if available, otherwise calculate
                                const initial = initialEstimatedProfitFromCustomField > 0 
                                    ? initialEstimatedProfitFromCustomField 
                                    : (totalValue > 0 && estCostAtCompletion > 0 ? totalValue - estCostAtCompletion : 0);
                                const current = projectedProfit > 0 
                                    ? projectedProfit 
                                    : (totalValue > 0 && estCostAtCompletion > 0 ? totalValue - estCostAtCompletion : 0);
                                return current - initial; // Difference between current and initial projected profit
                            })(),
                            jobToDateCost: jobToDateCost || 0, // From Requisitions or Budget Line Items
                            percentProjectedProfit: totalValue > 0 && estCostAtCompletion > 0 
                                ? ((totalValue - estCostAtCompletion) / totalValue) * 100 
                                : (totalValue > 0 ? (projectedProfit / totalValue) * 100 : 0), // Formula: (Total Contract Value - Est Cost) / Total Contract Value * 100
                            balanceLeftOnContract: balanceLeftOnContract || 0, // From Prime Contract: RevisedContractAmount - OwnerInvoiceAmount
                            // Percent Complete (Revenue): Only use value from Payment Applications, don't calculate
                            // Power BI shows this as blank/empty, so we should only populate if explicitly available from API
                            percentCompleteRevenue: percentCompleteRevenue > 0 ? percentCompleteRevenue : 0, // Only from Payment Applications, don't calculate
                            percentCompleteCost: estCostAtCompletion > 0 ? (jobToDateCost / estCostAtCompletion) * 100 : 0, // Formula: JobToDateCost / EstCostOfCompletion
                            customerRetainage: customerRetainage || 0, // From most recent invoice
                            remainingCost: estCostAtCompletion > 0 ? estCostAtCompletion - jobToDateCost : 0, // Formula: Est Cost Of Completion - Job To Date Costs
                            vendorRetainage: vendorRetainage || 0, // Sum from Requisitions
                            totalInvoiced: totalInvoiced || 0, // From Prime Contract: OwnerInvoiceAmount
                            contractStatus: contractStatus || project.status_name || (projectDetail?.active === false ? 'Inactive' : 'Active'), // From Prime Contract or project
                            contractStartDate: contractStartDate || projectDetail?.start_date || projectDetail?.actual_start_date || null, // From Prime Contract or project
                            contractEndDate: contractEndDate || projectDetail?.completion_date || projectDetail?.projected_finish_date || null, // From Prime Contract or project
                            isActive: project.status_name !== 'Archived' && project.status_name !== 'Closed' && projectDetail?.active !== false,
                            // Archive Date: Check multiple sources, including updated_at if project is archived
                            archiveDate: (() => {
                                // First check explicit archive/close dates from project list
                                if (project.archived_at) return project.archived_at;
                                if (project.archive_date) return project.archive_date;
                                if (project.closed_at) return project.closed_at;
                                if (project.closed_date) return project.closed_date;
                                
                                // Then check project detail
                                if (projectDetail?.archived_at) return projectDetail.archived_at;
                                if (projectDetail?.archive_date) return projectDetail.archive_date;
                                if (projectDetail?.closed_at) return projectDetail.closed_at;
                                if (projectDetail?.closed_date) return projectDetail.closed_date;
                                
                                // If project is archived/closed, use updated_at as fallback
                                if (project.status_name === 'Archived' || project.status_name === 'Closed' || projectDetail?.active === false) {
                                    return project.updated_at || projectDetail?.updated_at || null;
                                }
                                
                                return null;
                            })(),
                            // Store raw Procore data for reference
                            _procoreData: project,
                            _procoreDetail: projectDetail, // Store detail for debugging
                            _primeContracts: primeContractsData, // Store prime contracts for debugging
                        };
                        
                        projectsWithData.push(projectData);
                        
                        // Update progress after each project
                        if (progressRefCreated) {
                            try {
                                await progressRef.update({
                                    processedProjects: i + 1,
                                    currentProject: project.name || project.id,
                                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                                });
                            } catch (progressError) {
                                console.warn('Could not update progress:', progressError);
                            }
                        }
                    } catch (error: any) {
                        console.error(`Error processing project ${project.id}:`, error);
                        // Continue to next project even if this one fails
                        // Still update progress
                        if (progressRefCreated) {
                            try {
                                await progressRef.update({
                                    processedProjects: i + 1,
                                    errors: admin.firestore.FieldValue.arrayUnion({
                                        projectId: project.id,
                                        projectName: project.name,
                                        error: error.message,
                                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                                    }),
                                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                                });
                            } catch (progressError) {
                                console.warn('Could not update progress on error:', progressError);
                            }
                        }
                    }
                } catch (outerError: any) {
                    console.error(`Outer error processing project ${project.id}:`, outerError);
                }
            }
            
            // Mark progress as completed
            if (progressRefCreated) {
                try {
                    await progressRef.update({
                        status: 'completed',
                        completedAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                } catch (progressError) {
                    console.warn('Could not mark progress as completed:', progressError);
                }
            }
            
            return {
                success: true,
                data: projectsWithData.filter(p => p !== null),
                progressDocId, // Return progress document ID for frontend tracking
                totalProcessed: projectsWithData.length,
                totalProjects: projectsToProcess.length,
            };
        } catch (error: any) {
            console.error('Error fetching all Procore projects:', error.response?.data || error.message);
            
            // Mark progress as failed if it exists
            if (progressRefCreated && progressRef) {
                try {
                    await progressRef.update({
                        status: 'failed',
                        error: error.message || 'Unknown error',
                        failedAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                } catch (progressError) {
                    console.error('Error updating progress on failure:', progressError);
                }
            }
            
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

