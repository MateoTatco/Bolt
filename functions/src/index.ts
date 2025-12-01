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
        const accessToken = await getProcoreAccessToken(userId);
        
        if (!accessToken) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'No valid Procore access token. Please authorize the application.'
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
            
            // Return error details for frontend handling
            throw new functions.https.HttpsError(
                'internal',
                errorData?.errors || errorData?.error_description || errorData?.message || error.message || 'Failed to create project in Procore'
            );
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

