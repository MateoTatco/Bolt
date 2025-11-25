/**
 * Generates a random 6-digit project number between 100000 and 999999
 * @returns {number} Random project number
 */
export const generateProjectNumber = () => {
    // Generate random number between 100000 and 999999 (cannot start with 0)
    return Math.floor(Math.random() * 900000) + 100000
}

/**
 * Generates a unique project number by checking against existing projects
 * @param {Array} existingProjects - Array of existing project objects
 * @param {number} maxAttempts - Maximum number of attempts to generate unique number (default: 100)
 * @returns {number} Unique project number
 * @throws {Error} If unable to generate unique number after max attempts
 */
export const generateUniqueProjectNumber = (existingProjects = [], maxAttempts = 100) => {
    let number
    let attempts = 0
    
    do {
        number = generateProjectNumber()
        attempts++
        
        if (attempts > maxAttempts) {
            throw new Error('Unable to generate unique project number after multiple attempts. Please try again.')
        }
    } while (existingProjects.some(p => p.ProjectNumber === number || p.ProjectNumber === String(number)))
    
    return number
}

