/**
 * Helper utility to identify and validate template placeholders
 * This can be used to extract all placeholders from your Word templates
 */

/**
 * Extract placeholders from a text string
 * Looks for patterns like {PLACEHOLDER NAME} or {PLACEHOLDER_NAME}
 * @param {string} text - Text to search for placeholders
 * @returns {Array<string>} Array of unique placeholder names
 */
export const extractPlaceholders = (text) => {
    const placeholderRegex = /\{([^}]+)\}/g
    const placeholders = []
    let match
    
    while ((match = placeholderRegex.exec(text)) !== null) {
        const placeholder = match[1].trim()
        if (placeholder && !placeholders.includes(placeholder)) {
            placeholders.push(placeholder)
        }
    }
    
    return placeholders.sort()
}

/**
 * Validate that all required placeholders are provided
 * @param {Array<string>} requiredPlaceholders - List of required placeholders
 * @param {Object} providedData - Data object with placeholder values
 * @returns {Object} Validation result with missing placeholders
 */
export const validatePlaceholders = (requiredPlaceholders, providedData) => {
    const missing = []
    const provided = []
    
    requiredPlaceholders.forEach(placeholder => {
        const cleanKey = placeholder.replace(/[{}]/g, '').trim()
        if (providedData[cleanKey] === undefined || providedData[cleanKey] === null || providedData[cleanKey] === '') {
            missing.push(placeholder)
        } else {
            provided.push(placeholder)
        }
    })
    
    return {
        valid: missing.length === 0,
        missing,
        provided,
        total: requiredPlaceholders.length
    }
}

/**
 * Common placeholder mappings for reference
 * Update this based on your actual template placeholders
 */
export const PLACEHOLDER_MAPPINGS = {
    PLAN: [
        'COMPANY NAME',
        'PLAN NAME',
        'START DATE',
        'EFFECTIVE START DATE',
        'DESCRIPTION',
        'SCHEDULE',
        'PAYMENT SCHEDULE DATES',
        'PAYMENT TERMS',
        'PROFIT DESCRIPTION',
        'TRIGGER AMOUNT',
        'TOTAL SHARES',
        'OUTSTANDING SHARES',
        'SIGNER NAME',
    ],
    AWARD: [
        'COMPANY NAME',
        'EMPLOYEE NAME',
        'AWARD DATE',
        'START DATE',
        'END DATE',
        'SHARES ISSUED',
        'NUMBER OF PROFIT SHARES ISSUED',
        'SCHEDULE',
        'PAYMENT DATES',
        'PAYMENT TERMS',
        'PROFIT DESCRIPTION',
        'PROFIT MEASUREMENT',
        'TRIGGER AMOUNT',
        'TOTAL SHARES',
        'OUTSTANDING SHARES',
    ]
}



