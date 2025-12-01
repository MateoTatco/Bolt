import { getFunctions, httpsCallable } from 'firebase/functions'
import { getAuth } from 'firebase/auth'

// Initialize Firebase Functions
const functions = getFunctions()

// Procore Service
export const ProcoreService = {
    /**
     * Get Procore authorization URL
     * @returns {Promise<string>} Authorization URL
     */
    async getAuthUrl() {
        try {
            const getAuthUrlFunction = httpsCallable(functions, 'procoreGetAuthUrl')
            const result = await getAuthUrlFunction()
            const authUrl = result.data.authUrl
            console.log('Procore OAuth URL:', authUrl)
            return authUrl
        } catch (error) {
            console.error('Error getting Procore auth URL:', error)
            throw error
        }
    },

    /**
     * Clear Procore tokens (for reset/debugging)
     * @returns {Promise<Object>} Result object
     */
    async clearTokens() {
        try {
            const clearTokensFunction = httpsCallable(functions, 'procoreClearTokens')
            const result = await clearTokensFunction()
            console.log('Tokens cleared:', result.data)
            return result.data
        } catch (error) {
            console.error('Error clearing Procore tokens:', error)
            throw error
        }
    },

    /**
     * Exchange authorization code for access token
     * @param {string} code - Authorization code from OAuth callback
     * @returns {Promise<Object>} Result object
     */
    async exchangeToken(code) {
        try {
            console.log('ProcoreService.exchangeToken called with code:', code ? 'present' : 'missing')
            const exchangeTokenFunction = httpsCallable(functions, 'procoreExchangeToken')
            console.log('Calling Firebase Function procoreExchangeToken...')
            const result = await exchangeTokenFunction({ code })
            console.log('Token exchange result:', result.data)
            return result.data
        } catch (error) {
            console.error('Error exchanging Procore token:', {
                message: error.message,
                code: error.code,
                details: error.details,
            })
            throw error
        }
    },

    /**
     * Test Procore connection (simple API call to verify token works)
     * @returns {Promise<Object>} Connection status object
     */
    async testConnection() {
        try {
            const testConnectionFunction = httpsCallable(functions, 'procoreTestConnection')
            const result = await testConnectionFunction()
            console.log('Connection test result:', result.data)
            return result.data
        } catch (error) {
            console.error('Error testing Procore connection:', error)
            throw error
        }
    },

    /**
     * Check if user has a Procore token (simple check, no API calls)
     * @returns {Promise<Object>} Token status object
     */
    async checkToken() {
        try {
            const checkTokenFunction = httpsCallable(functions, 'procoreCheckToken')
            const result = await checkTokenFunction()
            return result.data
        } catch (error) {
            console.error('Error checking Procore token:', error)
            throw error
        }
    },

    /**
     * Check if user has valid Procore token (legacy - makes API call)
     * @returns {Promise<boolean>} True if user has valid token
     */
    async hasValidToken() {
        try {
            // Try to get projects - if it fails with unauthenticated error, no valid token
            await this.getProjects()
            return true
        } catch (error) {
            if (error.code === 'unauthenticated' || error.message?.includes('No valid Procore access token')) {
                return false
            }
            // Other errors might mean token is valid but API call failed for other reasons
            throw error
        }
    },

    /**
     * Get all projects from Procore
     * @returns {Promise<Array>} Array of projects
     */
    async getProjects() {
        try {
            const getProjectsFunction = httpsCallable(functions, 'procoreGetProjects')
            const result = await getProjectsFunction()
            return result.data.data || []
        } catch (error) {
            console.error('Error fetching Procore projects:', error)
            throw error
        }
    },

    /**
     * Get all projects with profitability data
     * This is the main function for the Project Profitability page
     * 
     * Uses Azure SQL Database - faster, no rate limits, matches Power BI exactly
     * 
     * @param {Object} options - Optional parameters
     * @param {boolean} options.includeInactive - Include inactive projects (default: true)
     * @returns {Promise<Array>} Array of projects with profitability data
     */
    async getAllProjectsProfitability(options = {}) {
        try {
            // Use Azure SQL Database - faster, more reliable, matches Power BI exactly
            console.log('📊 Using Azure SQL Database for project profitability data');
            const azureSqlFunction = httpsCallable(functions, 'azureSqlGetAllProjectsProfitability')
            const result = await azureSqlFunction({
                ...options,
            })
            return result.data.data || []
        } catch (error) {
            console.error('Error fetching all projects profitability:', error)
            throw error
        }
    },

    /**
     * TEST FUNCTION: Test Prime Contracts endpoint to see what financial data is available
     * This is a temporary function for research purposes
     * @param {string} projectId - Optional project ID (defaults to 306371)
     * @returns {Promise<Object>} Prime Contracts data
     */
    async testPrimeContracts(projectId = null) {
        try {
            const testFunction = httpsCallable(functions, 'procoreTestPrimeContracts')
            const result = await testFunction({ projectId })
            console.log('Prime Contracts test result:', result.data)
            return result.data
        } catch (error) {
            console.error('Error testing Prime Contracts:', error)
            throw error
        }
    },

    /**
     * TEST FUNCTION: Test Project Status Snapshots endpoint to see what financial data is available
     * This is a temporary function for research purposes
     * @param {string} projectId - Optional project ID (uses first project if not provided)
     * @returns {Promise<Object>} Project Status Snapshots data
     */
    async testAllVariations(projectId = null) {
        try {
            const testAllVariations = httpsCallable(functions, 'procoreTestAllVariations')
            const result = await testAllVariations({ projectId })
            return result.data
        } catch (error) {
            console.error('Error testing all variations:', error)
            throw error
        }
    },

    /**
     * TEST FUNCTION: Test ALL cost-related endpoints (Job To Date Cost, Est Cost At Completion)
     * @param {string} projectId - Optional project ID (uses first project if not provided)
     * @returns {Promise<Object>} Cost endpoints test results
     */
    async testCostEndpoints(projectId = null) {
        try {
            const testCostEndpoints = httpsCallable(functions, 'procoreTestCostEndpoints')
            const result = await testCostEndpoints({ projectId })
            return result.data
        } catch (error) {
            console.error('Error testing cost endpoints:', error)
            throw error
        }
    },

    /**
     * TEST FUNCTION: Test ALL archive date endpoints
     * @param {string} projectId - Optional project ID (uses first project if not provided)
     * @returns {Promise<Object>} Archive date endpoints test results
     */
    async testArchiveDateEndpoints(projectId = null) {
        try {
            const testArchiveDateEndpoints = httpsCallable(functions, 'procoreTestArchiveDateEndpoints')
            const result = await testArchiveDateEndpoints({ projectId })
            return result.data
        } catch (error) {
            console.error('Error testing archive date endpoints:', error)
            throw error
        }
    },

    /**
     * TEST FUNCTION: Test ALL Budget Views endpoints for Est Cost At Completion
     * @param {string} projectId - Optional project ID (uses first project if not provided)
     * @returns {Promise<Object>} Budget Views endpoints test results
     */
    async testBudgetViewsEndpoints(projectId = null) {
        try {
            const testBudgetViewsEndpoints = httpsCallable(functions, 'procoreTestBudgetViewsEndpoints')
            const result = await testBudgetViewsEndpoints({ projectId })
            return result.data
        } catch (error) {
            console.error('Error testing Budget Views endpoints:', error)
            throw error
        }
    },

    /**
     * TEST FUNCTION: Test ALL Project Manager endpoints
     * @param {string} projectId - Optional project ID (uses first project if not provided)
     * @returns {Promise<Object>} Project Manager endpoints test results
     */
    async testProjectManagerEndpoints(projectId = null) {
        try {
            const testProjectManagerEndpoints = httpsCallable(functions, 'procoreTestProjectManagerEndpoints')
            const result = await testProjectManagerEndpoints({ projectId })
            return result.data
        } catch (error) {
            console.error('Error testing Project Manager endpoints:', error)
            throw error
        }
    },

    async testAllFinancialEndpoints(projectId = null) {
        try {
            const testFunction = httpsCallable(functions, 'procoreTestAllFinancialEndpoints')
            const result = await testFunction({ projectId })
            console.log('All Financial Endpoints test result:', result.data)
            return result.data
        } catch (error) {
            console.error('Error testing All Financial Endpoints:', error)
            throw error
        }
    },

    async testProjectStatusSnapshots(projectId = null) {
        try {
            const testFunction = httpsCallable(functions, 'procoreTestProjectStatusSnapshots')
            const result = await testFunction({ projectId })
            console.log('Project Status Snapshots test result:', result.data)
            return result.data
        } catch (error) {
            console.error('Error testing Project Status Snapshots:', error)
            throw error
        }
    },

    /**
     * Initiate OAuth flow
     * For localhost, we'll use redirect flow since popup has cross-origin issues
     * @param {boolean} usePopup - Whether to use popup (default: false for localhost)
     * @returns {Promise<void>}
     */
    async initiateOAuth(usePopup = false) {
        try {
            const authUrl = await this.getAuthUrl()
            
            // For localhost, always use redirect since popup has cross-origin issues
            // Store the current URL so we can redirect back after OAuth
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                sessionStorage.setItem('procoreOAuthReturnUrl', window.location.href)
                window.location.href = authUrl
                return
            }
            
            if (usePopup) {
                // Use popup window (for production with proper redirect URI)
                return new Promise((resolve, reject) => {
                    const width = 600
                    const height = 700
                    const left = (window.screen.width - width) / 2
                    const top = (window.screen.height - height) / 2
                    
                    const popup = window.open(
                        authUrl,
                        'Procore Authorization',
                        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
                    )
                    
                    if (!popup) {
                        reject(new Error('Popup blocked. Please allow popups for this site.'))
                        return
                    }
                    
                    // Listen for OAuth callback via postMessage
                    const messageHandler = (event) => {
                        // Verify origin for security
                        if (event.origin !== window.location.origin) {
                            return
                        }
                        
                        if (event.data.type === 'procoreOAuthCallback') {
                            window.removeEventListener('message', messageHandler)
                            clearInterval(checkPopup)
                            
                            if (event.data.code) {
                                this.exchangeToken(event.data.code)
                                    .then(() => {
                                        popup.close()
                                        resolve()
                                    })
                                    .catch((error) => {
                                        popup.close()
                                        reject(error)
                                    })
                            } else if (event.data.error) {
                                popup.close()
                                reject(new Error(event.data.error))
                            }
                        }
                    }
                    
                    window.addEventListener('message', messageHandler)
                    
                    // Fallback: Check if popup has redirected (may not work due to CORS)
                    const checkPopup = setInterval(() => {
                        try {
                            if (popup.closed) {
                                clearInterval(checkPopup)
                                window.removeEventListener('message', messageHandler)
                                reject(new Error('Authorization window was closed'))
                                return
                            }
                            
                            // Try to check popup URL (will fail on cross-origin)
                            const popupUrl = popup.location.href
                            if (popupUrl.includes('code=')) {
                                clearInterval(checkPopup)
                                window.removeEventListener('message', messageHandler)
                                popup.close()
                                
                                const urlParams = new URLSearchParams(popupUrl.split('?')[1])
                                const code = urlParams.get('code')
                                
                                if (code) {
                                    this.exchangeToken(code)
                                        .then(resolve)
                                        .catch(reject)
                                } else {
                                    reject(new Error('No authorization code received'))
                                }
                            }
                        } catch (e) {
                            // Cross-origin error - popup hasn't redirected yet or is on different domain
                            // This is normal, continue checking
                        }
                    }, 500)
                    
                    // Timeout after 5 minutes
                    setTimeout(() => {
                        clearInterval(checkPopup)
                        window.removeEventListener('message', messageHandler)
                        if (!popup.closed) {
                            popup.close()
                        }
                        reject(new Error('Authorization timeout'))
                    }, 5 * 60 * 1000)
                })
            } else {
                // Redirect to Procore
                sessionStorage.setItem('procoreOAuthReturnUrl', window.location.href)
                window.location.href = authUrl
            }
        } catch (error) {
            console.error('Error initiating OAuth:', error)
            throw error
        }
    },

    /**
     * Handle OAuth callback (when redirecting back from Procore)
     * Call this on the callback page or in the main app after redirect
     * @returns {Promise<void>}
     */
    async handleOAuthCallback() {
        try {
            const urlParams = new URLSearchParams(window.location.search)
            const code = urlParams.get('code')
            const error = urlParams.get('error')
            const errorDescription = urlParams.get('error_description')
            
            if (error) {
                throw new Error(`OAuth error: ${error}${errorDescription ? ' - ' + errorDescription : ''}`)
            }
            
            if (!code) {
                // No code in URL - might be first load, check if we're coming from OAuth
                const hash = window.location.hash
                if (hash) {
                    const hashParams = new URLSearchParams(hash.substring(1))
                    const hashCode = hashParams.get('code')
                    if (hashCode) {
                        await this.exchangeToken(hashCode)
                        const returnUrl = sessionStorage.getItem('procoreOAuthReturnUrl') || '/project-profitability'
                        sessionStorage.removeItem('procoreOAuthReturnUrl')
                        window.location.href = returnUrl
                        return
                    }
                }
                // No error, but no code either - might not be a callback
                return
            }
            
            await this.exchangeToken(code)
            
            // Redirect back to where we came from, or to Project Profitability page
            const returnUrl = sessionStorage.getItem('procoreOAuthReturnUrl') || '/project-profitability'
            sessionStorage.removeItem('procoreOAuthReturnUrl')
            
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname)
            
            window.location.href = returnUrl
        } catch (error) {
            console.error('Error handling OAuth callback:', error)
            // Redirect to Project Profitability page even on error
            const returnUrl = sessionStorage.getItem('procoreOAuthReturnUrl') || '/project-profitability'
            sessionStorage.removeItem('procoreOAuthReturnUrl')
            window.location.href = returnUrl + '?oauth_error=' + encodeURIComponent(error.message)
            throw error
        }
    },

    /**
     * Create a project in Procore
     * @param {Object} projectData - Project data formatted for Procore API
     * @returns {Promise<Object>} Created project data from Procore
     */
    async createProject(projectData) {
        try {
            const createProjectFunction = httpsCallable(functions, 'procoreCreateProject')
            const result = await createProjectFunction({ projectData })
            return result.data
        } catch (error) {
            console.error('Error creating project in Procore:', error)
            
            // Extract error message from Firebase error
            let errorMessage = 'Unknown error'
            if (error?.details) {
                errorMessage = error.details
            } else if (error?.message) {
                errorMessage = error.message
            } else if (typeof error === 'string') {
                errorMessage = error
            } else if (error?.code) {
                errorMessage = `Error ${error.code}: ${error.message || 'Unknown error'}`
            }
            
            // Create a new error with the extracted message
            const enhancedError = new Error(errorMessage)
            enhancedError.code = error?.code
            enhancedError.originalError = error
            throw enhancedError
        }
    },

    /**
     * Sync all linked projects from Procore to Bolt
     * @returns {Promise<Object>} Sync result with counts and errors
     */
    async syncAllProjectsToBolt() {
        try {
            const syncAllFunction = httpsCallable(functions, 'procoreSyncAllProjectsToBolt')
            const result = await syncAllFunction()
            return result.data
        } catch (error) {
            console.error('Error syncing all projects from Procore:', error)
            throw error
        }
    },

    /**
     * Update a single project in Procore using PATCH /rest/v1.0/projects/{id}
     * This is the preferred method when we have a procoreProjectId
     * @param {number|string} projectId - Procore project ID
     * @param {Object} projectData - Project data to update (in Procore format)
     * @returns {Promise<Object>} Result from Procore update endpoint
     */
    async updateProject(projectId, projectData) {
        try {
            const updateFunction = httpsCallable(functions, 'procoreUpdateProject')
            const result = await updateFunction({ projectId, projectData })
            return result.data
        } catch (error) {
            console.error('Error updating project in Procore:', error)
            throw error
        }
    },

    /**
     * Sync (create/update) projects in Procore using the /projects/sync endpoint
     * Used as fallback for projects without procoreProjectId (using origin_id)
     * @param {Array<Object>} updates - Array of project sync payloads (id/origin_id + changed fields)
     * @returns {Promise<Object>} Result from Procore sync endpoint
     */
    async syncProjects(updates) {
        try {
            const syncFunction = httpsCallable(functions, 'procoreSyncProjects')
            const result = await syncFunction({ updates })
            return result.data
        } catch (error) {
            console.error('Error syncing projects in Procore:', error)
            throw error
        }
    },

    /**
     * Get a single project from Procore by its Procore project ID
     * @param {number|string} procoreProjectId - Procore project ID
     * @returns {Promise<Object>} Project data from Procore
     */
    async getProject(procoreProjectId) {
        try {
            const getProjectFunction = httpsCallable(functions, 'procoreGetProject')
            const result = await getProjectFunction({ procoreProjectId })
            return result.data
        } catch (error) {
            console.error('Error getting project from Procore:', error)
            throw error
        }
    },
}

export default ProcoreService

