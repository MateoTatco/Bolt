/**
 * Field mapping configuration for converting Bolt project data to Procore API format
 * Based on Procore API v1.0 documentation
 */

/**
 * Maps Bolt project fields to Procore API project fields
 * @param {Object} boltProject - Project data from Bolt application
 * @returns {Object} Project data formatted for Procore API
 */
export const mapBoltToProcore = (boltProject) => {
    const procoreProject = {
        name: boltProject.ProjectName || '',
    }

    // Project number/code
    if (boltProject.ProjectNumber) {
        procoreProject.project_number = String(boltProject.ProjectNumber)
    }

    // Address information
    if (boltProject.address || boltProject.city || boltProject.State || boltProject.zip) {
        procoreProject.address = {
            street: boltProject.address || '',
            city: boltProject.city || '',
            state_code: boltProject.State || null,
            zip: boltProject.zip || '',
            country_code: 'US' // Default to US
        }
    }

    // Dates
    if (boltProject.StartDate) {
        procoreProject.start_date = formatDateForProcore(boltProject.StartDate)
    }

    if (boltProject.CompletionDate) {
        procoreProject.completion_date = formatDateForProcore(boltProject.CompletionDate)
    }

    // Additional fields that might be supported
    // Note: These may need to be adjusted based on actual Procore API requirements
    if (boltProject.ProjectedFinishDate) {
        procoreProject.projected_finish_date = formatDateForProcore(boltProject.ProjectedFinishDate)
    }

    // Project status/stage mapping
    if (boltProject.ProjectStatus) {
        // Map Bolt status to Procore stage_name
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
export const validateProcoreProject = (procoreProject) => {
    const requiredFields = ['name']
    const missingFields = requiredFields.filter(field => !procoreProject[field])
    
    return {
        isValid: missingFields.length === 0,
        missingFields
    }
}





