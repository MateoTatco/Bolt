/**
 * Utility to extract placeholders from Word document templates
 * This can be used to identify all placeholders in uploaded templates
 */

import PizZip from 'pizzip'
import { storage } from '@/configs/firebase.config'
import { ref as storageRef, getBytes } from 'firebase/storage'

/**
 * Extract placeholders from a Word document's XML content
 * @param {ArrayBuffer} docxBuffer - Word document as ArrayBuffer
 * @returns {Array<string>} Array of unique placeholder names (without curly braces)
 */
export const extractPlaceholdersFromDocx = (docxBuffer) => {
    try {
        const zip = new PizZip(docxBuffer)
        const docContent = zip.files['word/document.xml'].asText()
        
        // Extract all placeholders using regex
        const placeholderRegex = /\{([^}]+)\}/g
        const placeholders = new Set()
        let match
        
        while ((match = placeholderRegex.exec(docContent)) !== null) {
            const placeholder = match[1].trim()
            if (placeholder) {
                placeholders.add(placeholder)
            }
        }
        
        return Array.from(placeholders).sort()
    } catch (error) {
        console.error('Error extracting placeholders from DOCX:', error)
        return []
    }
}

/**
 * Extract placeholders from a template in Firebase Storage
 * @param {string} templatePath - Path to template in Firebase Storage (e.g., 'profitSharing/templates/Profit Award Agreement Template.docx')
 * @returns {Promise<Array<string>>} Array of unique placeholder names
 */
export const extractPlaceholdersFromStorage = async (templatePath) => {
    try {
        const templateRef = storageRef(storage, templatePath)
        const templateBytes = await getBytes(templateRef)
        return extractPlaceholdersFromDocx(templateBytes)
    } catch (error) {
        console.error(`Error loading template from storage (${templatePath}):`, error)
        throw new Error(`Failed to extract placeholders: ${error.message}`)
    }
}

/**
 * Extract placeholders from both award and plan templates
 * @returns {Promise<{award: Array<string>, plan: Array<string>}>} Object with placeholders for each template
 */
export const extractAllTemplatePlaceholders = async () => {
    try {
        const [awardPlaceholders, planPlaceholders] = await Promise.all([
            extractPlaceholdersFromStorage('profitSharing/templates/Profit Award Agreement Template.docx'),
            extractPlaceholdersFromStorage('profitSharing/templates/Profit Sharing Plan Template.docx')
        ])
        
        return {
            award: awardPlaceholders,
            plan: planPlaceholders
        }
    } catch (error) {
        console.error('Error extracting all placeholders:', error)
        throw error
    }
}

