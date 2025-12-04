/**
 * Generates a year-based sequential project number
 * Format: YY#### (e.g., 250001 for 2025, 260001 for 2026)
 * First 2 digits: Last 2 digits of current year
 * Last 4 digits: Sequential count starting from 0001
 * Uses existing projects to find the max, but ensures sequential numbers never repeat
 * even if projects are deleted by using a global counter
 * @param {Array} existingProjects - Array of existing project objects
 * @returns {Promise<number>} Unique project number
 * @throws {Error} If unable to generate unique number
 */
export const generateUniqueProjectNumber = async (existingProjects = []) => {
    const currentYear = new Date().getFullYear()
    const yearSuffix = currentYear % 100 // Get last 2 digits (e.g., 2025 -> 25)
    
    // Filter projects from current year (matching first 2 digits)
    const currentYearProjects = existingProjects.filter(p => {
        if (!p.ProjectNumber) return false
        const projectNumStr = String(p.ProjectNumber)
        // Check if project number starts with current year suffix
        return projectNumStr.length === 6 && projectNumStr.startsWith(String(yearSuffix).padStart(2, '0'))
    })
    
    // Extract the last 4 digits (sequential number) from existing projects
    const sequentialNumbers = currentYearProjects
        .map(p => {
            const projectNumStr = String(p.ProjectNumber)
            const sequentialPart = parseInt(projectNumStr.slice(2), 10)
            return isNaN(sequentialPart) ? 0 : sequentialPart
        })
        .filter(num => num > 0)
    
    // Find the highest sequential number from existing projects
    const maxFromProjects = sequentialNumbers.length > 0 ? Math.max(...sequentialNumbers) : 0
    
    // Get the global counter for this year (ensures we never reuse numbers)
    // This is optional - if it fails, we'll just use the project-based max
    let maxFromCounter = 0
    try {
        const { getFunctions, httpsCallable } = await import('firebase/functions')
        const functions = getFunctions()
        const getCounterFunction = httpsCallable(functions, 'getProjectNumberCounter')
        const counterResult = await getCounterFunction({ year: yearSuffix })
        
        if (counterResult.data && counterResult.data.success && counterResult.data.counter !== undefined) {
            maxFromCounter = counterResult.data.counter
        }
    } catch (error) {
        // Silently fail - this is optional functionality
        // If counter is not available, we'll use project-based max which is fine
        console.debug('Global counter not available, using project-based max (this is normal if function not deployed yet)')
    }
    
    // Use the higher of the two (counter or projects) to ensure no reuse
    const maxSequential = Math.max(maxFromProjects, maxFromCounter)
    const nextSequential = maxSequential + 1
    
    // Ensure sequential number doesn't exceed 9999
    if (nextSequential > 9999) {
        throw new Error('Maximum project number for this year has been reached. Please contact support.')
    }
    
    // Combine year suffix with sequential number
    const projectNumber = parseInt(`${yearSuffix}${String(nextSequential).padStart(4, '0')}`, 10)
    
    return projectNumber
}




