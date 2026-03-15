import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import axios from 'axios';

// QuickBooks Online (Intuit) OAuth 2.0 Configuration
// For local/emulator: use functions/.env (QUICKBOOKS_*).
// For production: set these as environment variables on the Cloud Function itself.
const useSandbox = process.env.QUICKBOOKS_USE_SANDBOX === 'true';

const QUICKBOOKS_CONFIG = {
    clientId: process.env.QUICKBOOKS_CLIENT_ID || '',
    clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || '',
    redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || 'http://localhost:5173/quickbooks-oauth-callback',
    authBaseUrl: 'https://appcenter.intuit.com/connect/oauth2',
    tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    scope: 'com.intuit.quickbooks.accounting',
    // Use sandbox API when using development keys + sandbox company (set QUICKBOOKS_USE_SANDBOX=true)
    useSandbox,
    apiBase: useSandbox
        ? 'https://sandbox-quickbooks.api.intuit.com'
        : 'https://quickbooks.api.intuit.com',
};

interface QuickBooksTokenData {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: admin.firestore.Timestamp | Date | string | null;
    realmId?: string;
    createdAt?: admin.firestore.Timestamp | Date | string | null;
    updatedAt?: admin.firestore.Timestamp | Date | string | null;
}

async function refreshQuickBooksToken(refreshToken: string) {
    if (!QUICKBOOKS_CONFIG.clientId || !QUICKBOOKS_CONFIG.clientSecret) {
        throw new Error('QuickBooks app is not configured for token refresh.');
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);

    const basicAuth = Buffer.from(
        `${QUICKBOOKS_CONFIG.clientId}:${QUICKBOOKS_CONFIG.clientSecret}`,
        'utf8'
    ).toString('base64');

    const response = await axios.post(
        QUICKBOOKS_CONFIG.tokenUrl,
        params.toString(),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${basicAuth}`,
            },
        }
    );

    return response.data as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        realmId?: string;
    };
}

// ----- QuickBooks Online (Intuit) OAuth 2.0 -----
// Get QuickBooks authorization URL to start OAuth flow
export const quickbooksGetAuthUrl = functions
    .region('us-central1')
    .runWith({ timeoutSeconds: 60, memory: '256MB' })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        if (!QUICKBOOKS_CONFIG.clientId) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'QuickBooks app is not configured. Set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET (and QUICKBOOKS_REDIRECT_URI) for the function.'
            );
        }
        const state = context.auth.uid;
        const authUrl =
            `${QUICKBOOKS_CONFIG.authBaseUrl}?` +
            `client_id=${encodeURIComponent(QUICKBOOKS_CONFIG.clientId)}&` +
            `response_type=code&` +
            `scope=${encodeURIComponent(QUICKBOOKS_CONFIG.scope)}&` +
            `redirect_uri=${encodeURIComponent(QUICKBOOKS_CONFIG.redirectUri)}&` +
            `state=${encodeURIComponent(state)}`;
        return { authUrl };
    });

// Exchange QuickBooks authorization code for tokens; store tokens and realmId (from redirect URL)
export const quickbooksExchangeToken = functions
    .region('us-central1')
    .runWith({ timeoutSeconds: 60, memory: '256MB' })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        const { code, realmId } = data || {};
        if (!code) {
            throw new functions.https.HttpsError('invalid-argument', 'Authorization code is required');
        }
        if (!QUICKBOOKS_CONFIG.clientId || !QUICKBOOKS_CONFIG.clientSecret) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'QuickBooks app is not configured. Set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET.'
            );
        }
        const userId = context.auth.uid;

        const codeKey = `qb_code_${code.substring(0, 24)}`;
        const codeRef = admin.firestore().collection('quickbooksCodes').doc(codeKey);
        const codeDoc = await codeRef.get();
        if (codeDoc.exists) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'This authorization code has already been used. Please start a new authorization flow.'
            );
        }

        try {
            // Intuit QuickBooks token endpoint expects URL-encoded form data
            const params = new URLSearchParams();
            params.append('grant_type', 'authorization_code');
            params.append('code', code);
            params.append('redirect_uri', QUICKBOOKS_CONFIG.redirectUri);

            const basicAuth = Buffer.from(
                `${QUICKBOOKS_CONFIG.clientId}:${QUICKBOOKS_CONFIG.clientSecret}`,
                'utf8'
            ).toString('base64');
            const response = await axios.post(
                QUICKBOOKS_CONFIG.tokenUrl,
                params.toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': `Basic ${basicAuth}`,
                    },
                }
            );
            const tokenData = response.data;
            const expiresIn = tokenData.expires_in || 3600;
            const expiresAt = new Date(Date.now() + expiresIn * 1000);

            await codeRef.set({
                used: true,
                userId,
                // Use plain Date; Firestore will store as a Timestamp
                usedAt: new Date(),
            });

            const realmIdToStore = realmId || tokenData.realmId || '';
            await admin.firestore()
                .collection('quickbooksTokens')
                .doc(userId)
                .set({
                    accessToken: tokenData.access_token,
                    refreshToken: tokenData.refresh_token,
                    // Store as plain Date; Firestore will convert to Timestamp automatically
                    expiresAt: expiresAt,
                    realmId: realmIdToStore,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });

            return {
                success: true,
                message: 'QuickBooks connected successfully.',
                realmId: realmIdToStore,
            };
        } catch (error: any) {
            const errData = error.response?.data;
            const msg = errData?.error_description || errData?.message || error.message || 'Failed to exchange token';
            throw new functions.https.HttpsError('internal', msg);
        }
    });

// Simple test - check if QuickBooks token exists for current user
export const quickbooksCheckToken = functions
    .region('us-central1')
    .runWith({ timeoutSeconds: 30, memory: '256MB' })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }
        const doc = await admin.firestore()
            .collection('quickbooksTokens')
            .doc(context.auth.uid)
            .get();
        const d = doc.data();
        return {
            hasToken: !!d?.accessToken,
            realmId: d?.realmId || null,
        };
    });

// Fetch a sample of QuickBooks transactions (for reconciliation prototype)
export const quickbooksGetSampleTransactions = functions
    .region('us-central1')
    .runWith({ timeoutSeconds: 60, memory: '512MB' })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const userId = context.auth.uid;
        const tokenDoc = await admin.firestore()
            .collection('quickbooksTokens')
            .doc(userId)
            .get();

        if (!tokenDoc.exists) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'QuickBooks is not connected. Please connect QuickBooks first.'
            );
        }

        const tokenData = tokenDoc.data() as QuickBooksTokenData | undefined;
        let accessToken = tokenData?.accessToken;
        let refreshToken = tokenData?.refreshToken;
        const realmId = tokenData?.realmId;

        // Normalize expiresAt to a Date for comparison
        let expiresAt: Date | null = null;
        const rawExpires = tokenData?.expiresAt as any;
        if (rawExpires) {
            // Firestore Timestamp-like object (has toDate function)
            if (typeof rawExpires.toDate === 'function') {
                expiresAt = rawExpires.toDate();
            } else if (rawExpires instanceof Date) {
                expiresAt = rawExpires;
            } else if (typeof rawExpires === 'string') {
                const parsed = new Date(rawExpires);
                if (!isNaN(parsed.getTime())) {
                    expiresAt = parsed;
                }
            }
        }

        const now = new Date();
        const isExpired = !expiresAt || expiresAt <= now;

        // If token is expired and we have a refresh token, attempt to refresh it
        if (isExpired && refreshToken) {
            try {
                console.log('QuickBooks access token expired, attempting refresh...');
                const refreshed = await refreshQuickBooksToken(refreshToken);
                const newAccessToken = refreshed.access_token;
                const newRefreshToken = refreshed.refresh_token || refreshToken;
                const newExpiresAt = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000);

                await tokenDoc.ref.set({
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken,
                    expiresAt: newExpiresAt,
                    realmId: realmId || refreshed.realmId || null,
                    updatedAt: new Date(),
                }, { merge: true });

                accessToken = newAccessToken;
                refreshToken = newRefreshToken;

                console.log('QuickBooks token refresh successful.');
            } catch (refreshError: any) {
                console.error('Error refreshing QuickBooks token:', {
                    message: refreshError.message,
                    status: refreshError.response?.status,
                    data: refreshError.response?.data,
                });
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'QuickBooks authorization has expired. Please reconnect QuickBooks from the Connect QuickBooks page.'
                );
            }
        }

        if (!accessToken || !realmId) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'QuickBooks token or realmId is missing. Please reconnect QuickBooks.'
            );
        }

        try {
            // Use sandbox API base when QUICKBOOKS_USE_SANDBOX=true (dev keys + sandbox company)
            const apiBase = QUICKBOOKS_CONFIG.apiBase;
            const url = `${apiBase}/v3/company/${realmId}/query?minorversion=65`;
            console.log('QuickBooks query: apiBase=', apiBase, 'realmId=', realmId, 'useSandbox=', QUICKBOOKS_CONFIG.useSandbox);

            // QuickBooks has no generic "Transaction" entity; use Invoice (supported entity)
            const query = 'select * from Invoice STARTPOSITION 1 MAXRESULTS 50';

            const response = await axios.post(
                url,
                query,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        Accept: 'application/json',
                        'Content-Type': 'application/text',
                    },
                }
            );

            const raw = response.data;
            const invoices = raw?.QueryResponse?.Invoice || [];

            // Map to a lightweight summary for the UI (matches QueryResponse.Invoice shape from API Explorer)
            const mapped = invoices.map((t: any) => ({
                id: t.Id,
                docNumber: t.DocNumber ?? null,
                txnType: 'Invoice',
                txnDate: t.TxnDate,
                customerName: t.CustomerRef?.name || null,
                customerId: t.CustomerRef?.value || null,
                totalAmt: t.TotalAmt ?? null,
                balance: t.Balance ?? null,
            }));

            return {
                success: true,
                count: mapped.length,
                transactions: mapped,
            };
        } catch (error: any) {
            const data = error.response?.data;
            const fault = data?.Fault || data?.fault;
            const errList = fault?.Error ?? fault?.error;
            const firstErr = Array.isArray(errList) ? errList[0] : errList;
            const msg =
                firstErr?.Message ?? firstErr?.message ?? firstErr?.Detail ?? firstErr?.detail ?? error.message ?? 'Failed to fetch QuickBooks transactions';
            console.error('QuickBooks query error:', {
                status: error.response?.status,
                apiBase: QUICKBOOKS_CONFIG.apiBase,
                fault: fault,
                firstError: firstErr,
                msg,
            });
            throw new functions.https.HttpsError('internal', msg);
        }
    });

// Fetch QuickBooks invoices for a specific project/customer prefix and return a summary
export const quickbooksGetProjectInvoicesSummary = functions
    .region('us-central1')
    .runWith({ timeoutSeconds: 60, memory: '512MB' })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const projectNumber = (data?.projectNumber || '').toString().trim();
        if (!projectNumber) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'projectNumber is required.'
            );
        }

        const userId = context.auth.uid;
        const tokenDoc = await admin.firestore()
            .collection('quickbooksTokens')
            .doc(userId)
            .get();

        if (!tokenDoc.exists) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'QuickBooks is not connected. Please connect QuickBooks first.'
            );
        }

        const tokenData = tokenDoc.data() as QuickBooksTokenData | undefined;
        let accessToken = tokenData?.accessToken;
        let refreshToken = tokenData?.refreshToken;
        const realmId = tokenData?.realmId;

        // Normalize expiresAt to a Date for comparison
        let expiresAt: Date | null = null;
        const rawExpires = tokenData?.expiresAt as any;
        if (rawExpires) {
            if (typeof rawExpires.toDate === 'function') {
                expiresAt = rawExpires.toDate();
            } else if (rawExpires instanceof Date) {
                expiresAt = rawExpires;
            } else if (typeof rawExpires === 'string') {
                const parsed = new Date(rawExpires);
                if (!isNaN(parsed.getTime())) {
                    expiresAt = parsed;
                }
            }
        }

        const now = new Date();
        const isExpired = !expiresAt || expiresAt <= now;

        // If token is expired and we have a refresh token, attempt to refresh it
        if (isExpired && refreshToken) {
            try {
                console.log('QuickBooks access token expired (project summary), attempting refresh...');
                const refreshed = await refreshQuickBooksToken(refreshToken);
                const newAccessToken = refreshed.access_token;
                const newRefreshToken = refreshed.refresh_token || refreshToken;
                const newExpiresAt = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000);

                await tokenDoc.ref.set({
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken,
                    expiresAt: newExpiresAt,
                    realmId: realmId || refreshed.realmId || null,
                    updatedAt: new Date(),
                }, { merge: true });

                accessToken = newAccessToken;
                refreshToken = newRefreshToken;
            } catch (refreshError: any) {
                console.error('Error refreshing QuickBooks token (project summary):', {
                    message: refreshError.message,
                    status: refreshError.response?.status,
                    data: refreshError.response?.data,
                });
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'QuickBooks authorization has expired. Please reconnect QuickBooks from the Connect QuickBooks page.'
                );
            }
        }

        if (!accessToken || !realmId) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'QuickBooks token or realmId is missing. Please reconnect QuickBooks.'
            );
        }

        try {
            const apiBase = QUICKBOOKS_CONFIG.apiBase;
            const url = `${apiBase}/v3/company/${realmId}/query?minorversion=65`;

            // Escape single quotes for SQL-like query
            const escapedProjectNumber = projectNumber.replace(/'/g, "''");

            // 1) Find customers whose DisplayName starts with the project number (Tatco: "1130003 - OKC Vet Collective").
            // We use only DisplayName; FullyQualifiedName is not always filterable in the Query API.
            const customerQuery =
                `select Id, DisplayName, FullyQualifiedName from Customer where DisplayName like '${escapedProjectNumber}%' STARTPOSITION 1 MAXRESULTS 100`;

            const customerResponse = await axios.post<{ QueryResponse?: { Customer?: any[] } }>(
                url,
                customerQuery,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        Accept: 'application/json',
                        'Content-Type': 'application/text',
                    },
                }
            );

            const customers = customerResponse.data?.QueryResponse?.Customer || [];

            if (!customers.length) {
                return {
                    success: true,
                    projectNumber,
                    hasCustomers: false,
                    quickbooksCustomers: [],
                    invoiceCount: 0,
                    totalRevenue: 0,
                    invoices: [],
                    message: `No QuickBooks customers found with DisplayName starting with "${projectNumber}".`,
                };
            }

            const customerIds = customers
                .map((c: any) => c.Id)
                .filter((id: any) => typeof id === 'string' && id.length > 0);

            if (!customerIds.length) {
                return {
                    success: true,
                    projectNumber,
                    hasCustomers: false,
                    quickbooksCustomers: [],
                    invoiceCount: 0,
                    totalRevenue: 0,
                    invoices: [],
                    message: `Customers matched by name, but none have valid Ids.`,
                };
            }

            // 2) Fetch invoices per customer (CustomerRef in (...) can cause "Error parsing query"; use CustomerRef = 'id' per customer).
            const allInvoices: any[] = [];
            for (const cid of customerIds) {
                const escapedId = String(cid).replace(/'/g, "''");
                const invoiceQuery =
                    `select Id, DocNumber, TxnDate, TotalAmt, CustomerRef from Invoice where CustomerRef = '${escapedId}' STARTPOSITION 1 MAXRESULTS 1000`;
                const invRes = await axios.post<{ QueryResponse?: { Invoice?: any[] } }>(
                    url,
                    invoiceQuery,
                    {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            Accept: 'application/json',
                            'Content-Type': 'application/text',
                        },
                    }
                );
                const list = invRes.data?.QueryResponse?.Invoice || [];
                allInvoices.push(...list);
            }

            const invoices = allInvoices;

            const mappedInvoices = invoices.map((t: any) => ({
                id: t.Id,
                docNumber: t.DocNumber ?? null,
                txnDate: t.TxnDate,
                customerId: t.CustomerRef?.value || null,
                customerName: t.CustomerRef?.name || null,
                totalAmt: typeof t.TotalAmt === 'number' ? t.TotalAmt : null,
            }));

            const totalRevenue = mappedInvoices.reduce(
                (sum: number, inv: any) => sum + (typeof inv.totalAmt === 'number' ? inv.totalAmt : 0),
                0
            );

            return {
                success: true,
                projectNumber,
                hasCustomers: true,
                quickbooksCustomers: customers.map((c: any) => ({
                    id: c.Id,
                    displayName: c.DisplayName,
                    fullyQualifiedName: c.FullyQualifiedName,
                })),
                invoiceCount: mappedInvoices.length,
                totalRevenue,
                invoices: mappedInvoices,
            };
        } catch (error: any) {
            const data = error.response?.data;
            const fault = data?.Fault || data?.fault;
            const errList = fault?.Error ?? fault?.error;
            const firstErr = Array.isArray(errList) ? errList[0] : errList;
            const msg =
                firstErr?.Message ?? firstErr?.message ?? firstErr?.Detail ?? firstErr?.detail ?? error.message ?? 'Failed to fetch QuickBooks project invoices';
            console.error('QuickBooks project invoices query error:', {
                status: error.response?.status,
                apiBase: QUICKBOOKS_CONFIG.apiBase,
                fault,
                firstError: firstErr,
                msg,
            });
            throw new functions.https.HttpsError('internal', msg);
        }
    });

// Fetch QuickBooks cost-by-vendor summary for a specific project/customer prefix
export const quickbooksGetProjectVendorCostsSummary = functions
    .region('us-central1')
    .runWith({ timeoutSeconds: 60, memory: '512MB' })
    .https
    .onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const projectNumber = (data?.projectNumber || '').toString().trim();
        if (!projectNumber) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'projectNumber is required.'
            );
        }

        const userId = context.auth.uid;
        const tokenDoc = await admin.firestore()
            .collection('quickbooksTokens')
            .doc(userId)
            .get();

        if (!tokenDoc.exists) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'QuickBooks is not connected. Please connect QuickBooks first.'
            );
        }

        const tokenData = tokenDoc.data() as QuickBooksTokenData | undefined;
        let accessToken = tokenData?.accessToken;
        let refreshToken = tokenData?.refreshToken;
        const realmId = tokenData?.realmId;

        // Normalize expiresAt to a Date for comparison
        let expiresAt: Date | null = null;
        const rawExpires = tokenData?.expiresAt as any;
        if (rawExpires) {
            if (typeof rawExpires.toDate === 'function') {
                expiresAt = rawExpires.toDate();
            } else if (rawExpires instanceof Date) {
                expiresAt = rawExpires;
            } else if (typeof rawExpires === 'string') {
                const parsed = new Date(rawExpires);
                if (!isNaN(parsed.getTime())) {
                    expiresAt = parsed;
                }
            }
        }

        const now = new Date();
        const isExpired = !expiresAt || expiresAt <= now;

        // If token is expired and we have a refresh token, attempt to refresh it
        if (isExpired && refreshToken) {
            try {
                console.log('QuickBooks access token expired (vendor costs), attempting refresh...');
                const refreshed = await refreshQuickBooksToken(refreshToken);
                const newAccessToken = refreshed.access_token;
                const newRefreshToken = refreshed.refresh_token || refreshToken;
                const newExpiresAt = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000);

                await tokenDoc.ref.set({
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken,
                    expiresAt: newExpiresAt,
                    realmId: realmId || refreshed.realmId || null,
                    updatedAt: new Date(),
                }, { merge: true });

                accessToken = newAccessToken;
                refreshToken = newRefreshToken;
            } catch (refreshError: any) {
                console.error('Error refreshing QuickBooks token (vendor costs):', {
                    message: refreshError.message,
                    status: refreshError.response?.status,
                    data: refreshError.response?.data,
                });
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'QuickBooks authorization has expired. Please reconnect QuickBooks from the Connect QuickBooks page.'
                );
            }
        }

        if (!accessToken || !realmId) {
            throw new functions.https.HttpsError(
                'failed-precondition',
                'QuickBooks token or realmId is missing. Please reconnect QuickBooks.'
            );
        }

        try {
            const apiBase = QUICKBOOKS_CONFIG.apiBase;
            const url = `${apiBase}/v3/company/${realmId}/query?minorversion=65`;

            // Escape single quotes for SQL-like query
            const escapedProjectNumber = projectNumber.replace(/'/g, "''");

            // 1) Find customers whose DisplayName starts with the project number.
            const customerQuery =
                `select Id, DisplayName, FullyQualifiedName from Customer where DisplayName like '${escapedProjectNumber}%' STARTPOSITION 1 MAXRESULTS 100`;

            const customerResponse = await axios.post<{ QueryResponse?: { Customer?: any[] } }>(
                url,
                customerQuery,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        Accept: 'application/json',
                        'Content-Type': 'application/text',
                    },
                }
            );

            const customers = customerResponse.data?.QueryResponse?.Customer || [];

            if (!customers.length) {
                return {
                    success: true,
                    projectNumber,
                    hasCustomers: false,
                    quickbooksCustomers: [],
                    vendors: [],
                    totalCost: 0,
                };
            }

            const customerIds = customers
                .map((c: any) => c.Id)
                .filter((id: any) => typeof id === 'string' && id.length > 0);

            if (!customerIds.length) {
                return {
                    success: true,
                    projectNumber,
                    hasCustomers: false,
                    quickbooksCustomers: [],
                    vendors: [],
                    totalCost: 0,
                };
            }

            // 2) Fetch cost transactions (Purchase + Bill) and then filter by CustomerRef
            // at the line level, since CustomerRef is not a top-level property on these entities.
            const allCosts: any[] = [];

            // Helper to decide whether a line belongs to one of the matched customers
            const customerIdSet = new Set<string>(customerIds);
            const isLineForProjectCustomer = (line: any): boolean => {
                const direct = line?.CustomerRef?.value;
                const acctDetail = line?.AccountBasedExpenseLineDetail?.CustomerRef?.value;
                const itemDetail = line?.ItemBasedExpenseLineDetail?.CustomerRef?.value;
                const candidate = direct || acctDetail || itemDetail;
                return typeof candidate === 'string' && customerIdSet.has(candidate);
            };

            // Purchases (expenses, checks, CC charges) with VendorRef; filter by line-level CustomerRef
            try {
                const purchaseQuery =
                    'select Id, TxnDate, TotalAmt, VendorRef, Line from Purchase STARTPOSITION 1 MAXRESULTS 1000';
                const purchaseRes = await axios.post<{ QueryResponse?: { Purchase?: any[] } }>(
                    url,
                    purchaseQuery,
                    {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            Accept: 'application/json',
                            'Content-Type': 'application/text',
                        },
                    }
                );
                const list = purchaseRes.data?.QueryResponse?.Purchase || [];
                for (const p of list) {
                    const vendorId = p.VendorRef?.value || null;
                    const vendorName = p.VendorRef?.name || null;
                    const lines: any[] = Array.isArray(p.Line) ? p.Line : [];
                    for (const line of lines) {
                        if (!isLineForProjectCustomer(line)) continue;
                        const amt = typeof line.Amount === 'number' ? line.Amount : 0;
                        if (amt === 0) continue;
                        allCosts.push({
                            vendorId,
                            vendorName,
                            amount: amt,
                            txnType: 'Purchase',
                        });
                    }
                }
            } catch (purchaseError: any) {
                console.warn('QuickBooks Purchase query error (vendor costs):', {
                    message: purchaseError.message,
                    status: purchaseError.response?.status,
                    data: purchaseError.response?.data,
                });
            }

            // Bills (vendor bills with VendorRef; filter by line-level CustomerRef)
            try {
                const billQuery =
                    'select Id, DocNumber, TxnDate, TotalAmt, VendorRef, Line from Bill STARTPOSITION 1 MAXRESULTS 1000';
                const billRes = await axios.post<{ QueryResponse?: { Bill?: any[] } }>(
                    url,
                    billQuery,
                    {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            Accept: 'application/json',
                            'Content-Type': 'application/text',
                        },
                    }
                );
                const list = billRes.data?.QueryResponse?.Bill || [];
                for (const b of list) {
                    const vendorId = b.VendorRef?.value || null;
                    const vendorName = b.VendorRef?.name || null;
                    const lines: any[] = Array.isArray(b.Line) ? b.Line : [];
                    for (const line of lines) {
                        if (!isLineForProjectCustomer(line)) continue;
                        const amt = typeof line.Amount === 'number' ? line.Amount : 0;
                        if (amt === 0) continue;
                        allCosts.push({
                            vendorId,
                            vendorName,
                            amount: amt,
                            txnType: 'Bill',
                        });
                    }
                }
            } catch (billError: any) {
                console.warn('QuickBooks Bill query error (vendor costs):', {
                    message: billError.message,
                    status: billError.response?.status,
                    data: billError.response?.data,
                });
            }

            // Group by VendorRef
            interface VendorAgg {
                vendorId: string | null;
                vendorName: string | null;
                totalCost: number;
                transactionCount: number;
            }

            const vendorMap = new Map<string, VendorAgg>();
            let grandTotal = 0;

            for (const entry of allCosts) {
                const vendorId = entry.vendorId || null;
                const vendorName = entry.vendorName || null;
                const key = vendorId || vendorName || 'unknown';
                const amt = typeof entry.amount === 'number' ? entry.amount : 0;

                if (!vendorMap.has(key)) {
                    vendorMap.set(key, {
                        vendorId,
                        vendorName,
                        totalCost: 0,
                        transactionCount: 0,
                    });
                }
                const agg = vendorMap.get(key)!;
                agg.totalCost += amt;
                agg.transactionCount += 1;
                grandTotal += amt;
            }

            const vendors = Array.from(vendorMap.values())
                .sort((a, b) => b.totalCost - a.totalCost);

            return {
                success: true,
                projectNumber,
                hasCustomers: true,
                quickbooksCustomers: customers.map((c: any) => ({
                    id: c.Id,
                    displayName: c.DisplayName,
                    fullyQualifiedName: c.FullyQualifiedName,
                })),
                totalCost: grandTotal,
                vendors,
            };
        } catch (error: any) {
            const data = error.response?.data;
            const fault = data?.Fault || data?.fault;
            const errList = fault?.Error ?? fault?.error;
            const firstErr = Array.isArray(errList) ? errList[0] : errList;
            const msg =
                firstErr?.Message ?? firstErr?.message ?? firstErr?.Detail ?? firstErr?.detail ?? error.message ?? 'Failed to fetch QuickBooks vendor costs';
            console.error('QuickBooks vendor costs query error:', {
                status: error.response?.status,
                apiBase: QUICKBOOKS_CONFIG.apiBase,
                fault,
                firstError: firstErr,
                msg,
            });
            throw new functions.https.HttpsError('internal', msg);
        }
    });


