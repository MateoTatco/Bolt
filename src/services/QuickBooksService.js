import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions'

let functionsInstance = null

const getFunctionsInstance = () => {
    if (functionsInstance) return functionsInstance
    
    const fns = getFunctions()
    // When running locally, route callable functions to the emulator instead of production
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        try {
            connectFunctionsEmulator(fns, 'localhost', 5001)
        } catch (e) {
            // If emulator is not available, fall back to default (production)
            // This ensures production still works even if connect fails locally
            // eslint-disable-next-line no-console
            console.warn('Could not connect Functions SDK to emulator, falling back to default endpoint.', e)
        }
    }
    
    functionsInstance = fns
    return functionsInstance
}

/**
 * QuickBooks Online (Intuit) OAuth 2.0 and API service for Tatco Cost Reconciliation.
 * Credentials and redirect URI are configured in Firebase Functions (env / secrets).
 */
export const QuickBooksService = {
    /**
     * Get the QuickBooks OAuth 2.0 authorization URL. Redirect the user to this URL to start the flow.
     * @returns {Promise<{ authUrl: string }>}
     */
    async getAuthUrl() {
        const fn = httpsCallable(getFunctionsInstance(), 'quickbooksGetAuthUrl')
        const result = await fn()
        return { authUrl: result.data.authUrl }
    },

    /**
     * Exchange the authorization code (and optional realmId from redirect) for tokens. Stores tokens in backend.
     * @param {Object} params
     * @param {string} params.code - Authorization code from redirect query
     * @param {string} [params.realmId] - Company/realm ID from redirect query (recommended to pass from URL)
     * @returns {Promise<{ success: boolean, message: string, realmId?: string }>}
     */
    async exchangeToken({ code, realmId }) {
        const fn = httpsCallable(getFunctionsInstance(), 'quickbooksExchangeToken')
        const result = await fn({ code, realmId: realmId || undefined })
        return result.data
    },

    /**
     * Check if the current user has a QuickBooks token (and optional realmId).
     * @returns {Promise<{ hasToken: boolean, realmId: string | null }>}
     */
    async checkToken() {
        const fn = httpsCallable(getFunctionsInstance(), 'quickbooksCheckToken')
        const result = await fn()
        return result.data
    },

    /**
     * Fetch a small sample of QuickBooks transactions for reconciliation prototype.
     * @returns {Promise<{ success: boolean, count: number, transactions: Array }>}
     */
    async getSampleTransactions() {
        const fn = httpsCallable(getFunctionsInstance(), 'quickbooksGetSampleTransactions')
        const result = await fn()
        return result.data
    },

    /**
     * Fetch QuickBooks invoice summary for a given Tatco project number.
     * The backend matches customers whose DisplayName starts with this project number
     * and then sums invoices for those customers.
     * @param {string} projectNumber
     * @returns {Promise<{
     *   success: boolean,
     *   projectNumber: string,
     *   hasCustomers: boolean,
     *   quickbooksCustomers: Array,
     *   invoiceCount: number,
     *   totalRevenue: number,
     *   invoices: Array
     * }>}
     */
    async getProjectInvoicesSummary(projectNumber) {
        const fn = httpsCallable(getFunctionsInstance(), 'quickbooksGetProjectInvoicesSummary')
        const result = await fn({ projectNumber })
        return result.data
    },

    /**
     * Start the OAuth flow by redirecting the browser to Intuit's authorization page.
     */
    async initiateOAuth() {
        const { authUrl } = await this.getAuthUrl()
        sessionStorage.setItem('quickbooksOAuthReturnUrl', window.location.href)
        window.location.href = authUrl
    },

    /**
     * Handle the OAuth callback: exchange code (and realmId from URL) for tokens, then redirect or show result.
     * Call this from the /quickbooks-oauth-callback page with URL query params.
     * @param {URLSearchParams} searchParams - e.g. new URLSearchParams(window.location.search)
     * @returns {Promise<{ success: boolean, realmId?: string, error?: string }>}
     */
    async handleOAuthCallback(searchParams) {
        const code = searchParams.get('code')
        const realmId = searchParams.get('realmId') || undefined
        const error = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        if (error) {
            return {
                success: false,
                error: errorDescription || error,
            }
        }
        if (!code) {
            return { success: false, error: 'No authorization code in URL.' }
        }

        const data = await this.exchangeToken({ code, realmId })
        return {
            success: true,
            realmId: data.realmId,
            message: data.message,
        }
    },
}

export default QuickBooksService
