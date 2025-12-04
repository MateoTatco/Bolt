/**
 * Field mapping configuration for converting Bolt project data to Procore API format
 * and vice versa. Used for create + update syncs.
 */

/**
 * Maps US state names/abbreviations to ISO-3166 Alpha-2 state codes (required by Procore)
 * @param {string} state - State name or abbreviation
 * @returns {string|null} ISO-3166 Alpha-2 state code or null if invalid
 */
const mapStateToISO3166 = (state) => {
    if (!state || typeof state !== 'string') return null
    
    const normalized = state.trim().toUpperCase()
    
    // Skip known markets that are not states (OKC, ORL, DFW)
    const knownMarkets = ['OKC', 'ORL', 'DFW']
    if (knownMarkets.includes(normalized)) {
        return null // Don't try to map markets as states
    }
    
    // If already a valid 2-letter code, return it (but verify it's a real state)
    if (normalized.length === 2 && /^[A-Z]{2}$/.test(normalized)) {
        // Check if it's a valid US state code before returning
        const validStateCodes = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC']
        if (validStateCodes.includes(normalized)) {
            return normalized
        }
        // Not a valid state code, return null
        return null
    }
    
    // Map common state names and abbreviations to ISO-3166 Alpha-2
    const stateMap = {
        // Full names
        'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR',
        'CALIFORNIA': 'CA', 'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE',
        'FLORIDA': 'FL', 'GEORGIA': 'GA', 'HAWAII': 'HI', 'IDAHO': 'ID',
        'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA', 'KANSAS': 'KS',
        'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
        'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS',
        'MISSOURI': 'MO', 'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV',
        'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
        'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH', 'OKLAHOMA': 'OK',
        'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
        'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT',
        'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV',
        'WISCONSIN': 'WI', 'WYOMING': 'WY', 'DISTRICT OF COLUMBIA': 'DC',
        // Common abbreviations (already uppercase)
        'AL': 'AL', 'AK': 'AK', 'AZ': 'AZ', 'AR': 'AR', 'CA': 'CA', 'CO': 'CO',
        'CT': 'CT', 'DE': 'DE', 'FL': 'FL', 'GA': 'GA', 'HI': 'HI', 'ID': 'ID',
        'IL': 'IL', 'IN': 'IN', 'IA': 'IA', 'KS': 'KS', 'KY': 'KY', 'LA': 'LA',
        'ME': 'ME', 'MD': 'MD', 'MA': 'MA', 'MI': 'MI', 'MN': 'MN', 'MS': 'MS',
        'MO': 'MO', 'MT': 'MT', 'NE': 'NE', 'NV': 'NV', 'NH': 'NH', 'NJ': 'NJ',
        'NM': 'NM', 'NY': 'NY', 'NC': 'NC', 'ND': 'ND', 'OH': 'OH', 'OK': 'OK',
        'OR': 'OR', 'PA': 'PA', 'RI': 'RI', 'SC': 'SC', 'SD': 'SD', 'TN': 'TN',
        'TX': 'TX', 'UT': 'UT', 'VT': 'VT', 'VA': 'VA', 'WA': 'WA', 'WV': 'WV',
        'WI': 'WI', 'WY': 'WY', 'DC': 'DC',
    }
    
    return stateMap[normalized] || null
}

/**
 * Maps Bolt project fields to Procore API project fields
 * @param {Object} boltProject - Project data from Bolt application
 * @returns {Object} Project data formatted for Procore API
 */
export const mapBoltToProcore = (boltProject = {}) => {
    const procoreProject = {
        name: boltProject.ProjectName || '',
    }

    // Project template ID - use Standard Project Template
    // This will be applied when creating the project in Procore
    procoreProject.project_template_id = 598134325661413

    // Project number/code
    if (boltProject.ProjectNumber) {
        procoreProject.project_number = String(boltProject.ProjectNumber)
        // Note: origin_id is only used in Sync endpoint, not in Create endpoint
        // We'll set it when using Sync, but not for initial creation
    }

    // Address information (top-level fields for Sync endpoint)
    if (boltProject.address) {
        procoreProject.address = boltProject.address
    }
    if (boltProject.city) {
        procoreProject.city = boltProject.city
    }
    // Only process state if it's a non-empty string
    if (boltProject.State && typeof boltProject.State === 'string' && boltProject.State.trim()) {
        // Convert state to ISO-3166 Alpha-2 format (required by Procore)
        const stateCode = mapStateToISO3166(boltProject.State)
        if (stateCode) {
            procoreProject.state_code = stateCode
        }
        // If state cannot be mapped (e.g., markets like OKC, ORL, DFW, or invalid values),
        // silently skip it - don't log warnings for known non-state values
    }
    // If State is empty, null, or invalid, we simply don't include state_code in the payload
    if (boltProject.zip) {
        procoreProject.zip = boltProject.zip
    }
    // Country - default to US if we have any address data
    if (boltProject.address || boltProject.city || boltProject.State || boltProject.zip) {
        procoreProject.country_code = 'US'
    }

    // Dates
    if (boltProject.StartDate) {
        procoreProject.start_date = formatDateForProcore(boltProject.StartDate)
    }

    if (boltProject.CompletionDate) {
        procoreProject.completion_date = formatDateForProcore(boltProject.CompletionDate)
    }

    if (boltProject.ProjectedFinishDate) {
        // There is no direct projected_finish_date field in the Sync schema,
        // but some accounts use warranty dates to track extended completion.
        // For now we do not map this field via Sync to avoid confusion.
    }

    // Project financials
    if (boltProject.EstimatedValue) {
        // Sync uses total_value as replacement for estimated_value
        const value = Number(boltProject.EstimatedValue)
        if (!Number.isNaN(value)) {
            procoreProject.total_value = value
        }
    }

    if (boltProject.SquareFeet) {
        const sf = Number(boltProject.SquareFeet)
        if (!Number.isNaN(sf)) {
            procoreProject.square_feet = sf
        }
    }

    // Project status/stage mapping (Bolt status -> Procore stage_name / project_stage_id)
    if (boltProject.ProjectStatus) {
        // For create we used stage_name / type_name.
        // Sync prefers project_stage_id, but stage_name is still accepted
        // by the core projects API, so we keep the same mapping here.
        procoreProject.stage_name = mapProjectStatus(boltProject.ProjectStatus)
    }

    // Project type
    if (boltProject.ProjectStyle) {
        procoreProject.type_name = mapProjectStyle(boltProject.ProjectStyle)
    }

    return procoreProject
}

/**
 * Formats date for Procore API (YYYY-MM-DD format)
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
const formatDateForProcore = (date) => {
    if (!date) return null
    
    try {
        const dateObj = date instanceof Date ? date : new Date(date)
        if (isNaN(dateObj.getTime())) return null
        
        const year = dateObj.getFullYear()
        const month = String(dateObj.getMonth() + 1).padStart(2, '0')
        const day = String(dateObj.getDate()).padStart(2, '0')
        
        return `${year}-${month}-${day}`
    } catch (error) {
        console.error('Error formatting date for Procore:', error)
        return null
    }
}

/**
 * Maps Bolt project status to Procore stage_name
 * @param {string} boltStatus - Bolt project status
 * @returns {string} Procore stage name
 */
const mapProjectStatus = (boltStatus) => {
    const statusMap = {
        'Pre-Construction': 'Pre-Construction',
        'Course of Construction': 'Construction',
        'Complete': 'Complete',
        'Warranty': 'Warranty',
        'Post Construction': 'Post Construction',
        'Bidding': 'Pre-Construction',
        'Pending': 'Pre-Construction',
        'Not Awarded': 'Pre-Construction',
        'Hold': 'Pre-Construction'
    }
    
    return statusMap[boltStatus] || 'Pre-Construction'
}

/**
 * Maps Bolt project style to Procore type_name
 * @param {string} boltStyle - Bolt project style
 * @returns {string} Procore type name
 */
const mapProjectStyle = (boltStyle) => {
    const styleMap = {
        'Ground Up': 'Commercial',
        'TI': 'Commercial',
        'Renovation': 'Commercial'
    }
    
    return styleMap[boltStyle] || 'Commercial'
}

/**
 * Validates that required fields are present for Procore project creation
 * @param {Object} procoreProject - Project data formatted for Procore
 * @returns {Object} Validation result with isValid flag and missing fields array
 */
export const validateProcoreProject = (procoreProject = {}) => {
    const requiredFields = ['name']
    const missingFields = requiredFields.filter(field => !procoreProject[field])
    
    return {
        isValid: missingFields.length === 0,
        missingFields
    }
}

/**
 * Maps Procore project fields back to Bolt project fields
 * Used when pulling updates from Procore into Bolt
 * @param {Object} procoreProject - Raw project object from Procore
 * @returns {Object} Partial Bolt project object with mapped fields
 */
export const mapProcoreToBolt = (procoreProject = {}) => {
    const bolt = {}

    if (procoreProject.name !== undefined) {
        bolt.ProjectName = procoreProject.name || ''
    }

    if (procoreProject.project_number !== undefined) {
        bolt.ProjectNumber = procoreProject.project_number || ''
    }

    if (procoreProject.address !== undefined) {
        bolt.address = procoreProject.address || ''
    }

    if (procoreProject.city !== undefined) {
        bolt.city = procoreProject.city || ''
    }

    if (procoreProject.state_code !== undefined) {
        bolt.State = procoreProject.state_code || ''
    }

    if (procoreProject.zip !== undefined) {
        bolt.zip = procoreProject.zip || ''
    }

    if (procoreProject.start_date !== undefined) {
        bolt.StartDate = procoreProject.start_date || null
    }

    if (procoreProject.completion_date !== undefined) {
        bolt.CompletionDate = procoreProject.completion_date || null
    }

    if (procoreProject.total_value !== undefined) {
        bolt.EstimatedValue = procoreProject.total_value
    }

    if (procoreProject.square_feet !== undefined) {
        bolt.SquareFeet = procoreProject.square_feet
    }

    // Stage / status mapping back (best effort)
    if (procoreProject.project_stage && procoreProject.project_stage.name) {
        bolt.ProjectStatus = reverseMapProjectStatus(procoreProject.project_stage.name)
    } else if (procoreProject.stage_name) {
        bolt.ProjectStatus = reverseMapProjectStatus(procoreProject.stage_name)
    }

    // We currently do not map ProjectConceptionYear or some of the more
    // internal-only fields from Procore, as there is no direct equivalent.

    return bolt
}

/**
 * Build a minimal Procore Sync update payload containing only changed fields
 * between the original and updated Bolt projects.
 * Returns null if there are no Procore-relevant changes.
 * 
 * @param {Object} originalBolt - Original Bolt project (before changes)
 * @param {Object} updatedBolt - Updated Bolt project (after changes)
 * @returns {Object|null} Procore Sync update object (id/origin_id + changed fields)
 */
export const buildProcoreSyncUpdate = (originalBolt = {}, updatedBolt = {}) => {
    // Map both states to Procore format
    const originalProcore = mapBoltToProcore(originalBolt)
    const updatedProcore = mapBoltToProcore(updatedBolt)

    // Find changed keys
    const changed = {}
    const allKeys = new Set([
        ...Object.keys(originalProcore),
        ...Object.keys(updatedProcore),
    ])

    allKeys.forEach((key) => {
        const before = originalProcore[key]
        const after = updatedProcore[key]
        const beforeStr = before === undefined || before === null ? '' : String(before)
        const afterStr = after === undefined || after === null ? '' : String(after)
        if (beforeStr !== afterStr) {
            changed[key] = after
        }
    })

    // Nothing changed that Procore cares about
    if (Object.keys(changed).length === 0) {
        return null
    }

    // Ensure we send stable identifiers for Sync
    const syncPayload = { ...changed }

    // Prefer Procore project id if we have it, otherwise rely on origin_id
    // Procore Sync API requires either 'id' OR 'origin_id', not both
    if (updatedBolt.procoreProjectId) {
        syncPayload.id = Number(updatedBolt.procoreProjectId)
        // Don't send origin_id if we have id
        delete syncPayload.origin_id
    } else {
        // Only set origin_id if we don't have id
        if (!syncPayload.id) {
            if (updatedBolt.ProjectNumber) {
                syncPayload.origin_id = String(updatedBolt.ProjectNumber)
            } else if (updatedBolt.id) {
                syncPayload.origin_id = String(updatedBolt.id)
            }
        }
    }

    // Ensure we have at least one identifier
    if (!syncPayload.id && !syncPayload.origin_id) {
        console.warn('Cannot sync project to Procore: missing both procoreProjectId and ProjectNumber/id')
        return null
    }

    return syncPayload
}

/**
 * Reverse mapping from Procore stage name back to Bolt ProjectStatus
 * (best-effort, not perfect 1:1)
 */
const reverseMapProjectStatus = (procoreStageName) => {
    if (!procoreStageName) return ''
    const map = {
        'Pre-Construction': 'Pre-Construction',
        'Construction': 'Course of Construction',
        'Complete': 'Complete',
        'Warranty': 'Warranty',
        'Post Construction': 'Post Construction',
    }
    return map[procoreStageName] || procoreStageName
}

