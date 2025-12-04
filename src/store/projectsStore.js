import { create } from 'zustand'
import React from 'react'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { toast } from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { notifyEntityDeleted, notifyEntityUpdated, notifyStatusChanged, notifyEntityCreated, getCurrentUserId, getUsersToNotify } from '@/utils/notificationHelper'
import { getAllUserIds, getUserIdsByEmails } from '@/utils/userHelper'

export const useProjectsStore = create((set, get) => ({
    projects: [],
    filters: {
        search: '',
        market: null,
        projectStatus: null,
        projectProbability: null,
        projectManager: null,
        superintendent: null,
        favorite: null,
        dateFrom: null,
        dateTo: null,
    },
    view: 'list', // 'list' | 'board'
    selectedProjectId: null,
    loading: false,
    error: null,
    realtimeListener: null,

    setView: (view) => set({ view }),
    setSelectedProjectId: (id) => set({ selectedProjectId: id }),

    setFilters: (partial) => set((state) => ({
        filters: { ...state.filters, ...partial },
    })),

    // Load projects from Firebase
    loadProjects: async () => {
        set({ loading: true, error: null })
        try {
            const response = await FirebaseDbService.projects.getAll()
            if (response.success) {
                const normalized = response.data.map((p) => ({
                    ...p,
                    favorite: p.favorite || false,
                }))
                set({ projects: normalized, loading: false })
            } else {
                throw new Error(response.error)
            }
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    'Failed to load projects',
                ),
            )
        }
    },

    // Setup real-time listener
    setupRealtimeListener: () => {
        const currentListener = get().realtimeListener
        if (currentListener) {
            currentListener() // Unsubscribe existing
        }

        const unsubscribe = FirebaseDbService.projects.subscribe((projects) => {
            const normalized = projects.map((p) => ({
                ...p,
                favorite: p.favorite || false,
            }))
            set({ projects: normalized })
        })

        set({ realtimeListener: unsubscribe })
        return unsubscribe
    },

    // Cleanup real-time listener
    cleanupRealtimeListener: () => {
        const listener = get().realtimeListener
        if (listener) {
            listener()
            set({ realtimeListener: null })
        }
    },

    // Create new project
    addProject: async (projectData, options = {}) => {
        const { skipProcoreSync = false, onProcoreError = null } = options
        set({ loading: true, error: null })
        let procoreError = null
        
        try {
            // Get current user ID (project creator)
            const currentUserId = getCurrentUserId()
            
            // Always include admin-01@tatco.construction and brett@tatco.construction
            const requiredEmails = ['admin-01@tatco.construction', 'brett@tatco.construction']
            const requiredUserIds = await getUserIdsByEmails(requiredEmails)
            
            // Combine current user with required admins (avoid duplicates)
            const members = [currentUserId, ...requiredUserIds].filter(
                (id, index, self) => id && self.indexOf(id) === index // Remove null/undefined and duplicates
            )
            
            const projectDataWithMembers = {
                ...projectData,
                members: members // Set creator + required admins as members
            }
            
            // Save to Firebase first
            const response = await FirebaseDbService.projects.create(projectDataWithMembers)
            if (response.success) {
                const newProject = response.data
                
                // Try to sync with Procore (only for new projects with ProjectNumber)
                if (!skipProcoreSync && projectData.ProjectNumber) {
                    try {
                        const { ProcoreService } = await import('@/services/ProcoreService')
                        const { mapBoltToProcore, validateProcoreProject } = await import('@/configs/procoreFieldMapping')
                        
                        // Map Bolt fields to Procore format
                        const procoreProjectData = mapBoltToProcore(projectData)
                        
                        // Validate required fields
                        const validation = validateProcoreProject(procoreProjectData)
                        if (!validation.isValid) {
                            throw new Error(`Missing required fields for Procore: ${validation.missingFields.join(', ')}`)
                        }
                        
                        // Create project in Procore
                        const procoreResult = await ProcoreService.createProject(procoreProjectData)
                        
                        // Update Firebase project with Procore ID
                        if (procoreResult.success && procoreResult.procoreProjectId) {
                            await FirebaseDbService.projects.update(newProject.id, {
                                procoreProjectId: procoreResult.procoreProjectId,
                                procoreSyncStatus: 'synced',
                                procoreSyncedAt: new Date().toISOString()
                            })
                            
                            // Update local state
                            newProject.procoreProjectId = procoreResult.procoreProjectId
                            newProject.procoreSyncStatus = 'synced'
                        }
                    } catch (procoreSyncError) {
                        console.error('Error syncing project to Procore:', procoreSyncError)
                        
                        // Extract error message from Firebase error
                        let errorMessage = 'Unknown error'
                        if (procoreSyncError?.message) {
                            errorMessage = procoreSyncError.message
                        } else if (procoreSyncError?.details) {
                            errorMessage = procoreSyncError.details
                        } else if (typeof procoreSyncError === 'string') {
                            errorMessage = procoreSyncError
                        } else if (procoreSyncError?.code) {
                            errorMessage = `Error ${procoreSyncError.code}: ${procoreSyncError.message || 'Unknown error'}`
                        }
                        
                        procoreError = new Error(errorMessage)
                        procoreError.originalError = procoreSyncError
                        
                        // Update Firebase project with sync failure status
                        await FirebaseDbService.projects.update(newProject.id, {
                            procoreSyncStatus: 'failed',
                            procoreSyncError: errorMessage,
                            procoreSyncAttemptedAt: new Date().toISOString()
                        })
                        
                        // Update local state
                        newProject.procoreSyncStatus = 'failed'
                        newProject.procoreSyncError = errorMessage
                        
                        // Call error callback if provided
                        if (onProcoreError) {
                            onProcoreError(procoreError, newProject)
                        }
                    }
                }
                
                set((state) => ({
                    projects: [...state.projects, newProject],
                    loading: false
                }))
                
                // Notify all users about new project creation
                const allUserIds = await getAllUserIds()
                if (currentUserId && allUserIds.length > 0) {
                    await notifyEntityCreated({
                        userIds: allUserIds,
                        entityType: 'project',
                        entityId: newProject.id,
                        entityName: projectData.ProjectName || projectData.projectName || 'Project',
                        createdBy: currentUserId
                    })
                }
                
                // Show success message
                const successMessage = procoreError 
                    ? `Project created in Bolt. Procore sync failed: ${procoreError.message || 'Unknown error'}.`
                    : 'Project created successfully and synced with Procore!'
                
                toast.push(
                    React.createElement(
                        Notification,
                        { type: procoreError ? 'warning' : 'success', duration: 3000, title: 'Success' },
                        successMessage,
                    ),
                )
                
                return { project: newProject, procoreError }
            } else {
                throw new Error(response.error)
            }
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    'Failed to create project',
                ),
            )
            throw error
        }
    },

    // Update project
    updateProject: async (id, projectData, options = {}) => {
        const { silent = false, skipProcoreSync = false } = options
        set({ loading: true, error: null })
        try {
            // Get original project for comparison
            const originalProject = get().projects.find(p => p.id === id)
            const oldStatus = originalProject?.ProjectStatus
            const newStatus = projectData?.ProjectStatus
            const statusChanged = oldStatus && newStatus && oldStatus !== newStatus
            
            const response = await FirebaseDbService.projects.update(id, projectData)
            if (response.success) {
                const updatedProject = response.data
                const currentUserId = getCurrentUserId()
                const projectName = updatedProject?.projectName || updatedProject?.ProjectName || 'Project'
                
                set((state) => ({
                    projects: state.projects.map((p) =>
                        p.id === id ? { ...p, ...projectData } : p
                    ),
                    loading: false
                }))
                
                // Get users to notify
                const userIds = await getUsersToNotify('project', id)
                
                // Notify on status change
                if (statusChanged && currentUserId && userIds.length > 0) {
                    await notifyStatusChanged({
                        userIds,
                        entityType: 'project',
                        entityId: id,
                        entityName: projectName,
                        oldStatus: oldStatus || 'N/A',
                        newStatus: newStatus || 'N/A',
                        changedBy: currentUserId
                    })
                }
                
                // Notify on entity update (if there are changes and users to notify)
                if (currentUserId && userIds.length > 0) {
                    // Calculate changes
                    const changes = {}
                    if (originalProject) {
                        Object.keys(projectData).forEach(key => {
                            if (String(originalProject[key]) !== String(projectData[key])) {
                                changes[key] = [originalProject[key], projectData[key]]
                            }
                        })
                    }
                    
                    if (Object.keys(changes).length > 0) {
                        await notifyEntityUpdated({
                            userIds,
                            entityType: 'project',
                            entityId: id,
                            entityName: projectName,
                            updatedBy: currentUserId,
                            changes
                        })
                    }
                }
                
                if (!silent) {
                    toast.push(
                        React.createElement(
                            Notification,
                            { type: 'success', duration: 2000, title: 'Success' },
                            'Project updated successfully!',
                        ),
                    )
                }

                // Sync updates to Procore (Bolt -> Procore) when applicable
                // NOTE: Bulk import uses FirebaseDbService directly and never calls updateProject,
                // so bulk imports will NOT create or update projects in Procore.
                if (!skipProcoreSync) {
                    try {
                        // Only attempt sync if this project is linked to Procore or has a ProjectNumber
                        const effectiveOriginal = originalProject || {}
                        const effectiveUpdated = { ...effectiveOriginal, ...projectData }

                        const { buildProcoreSyncUpdate } = await import('@/configs/procoreFieldMapping')
                        const { ProcoreService } = await import('@/services/ProcoreService')

                        const syncUpdate = buildProcoreSyncUpdate(effectiveOriginal, effectiveUpdated)

                        if (syncUpdate) {
                            // Use direct PATCH endpoint if we have procoreProjectId (more reliable)
                            // Otherwise fall back to Sync endpoint with origin_id
                            if (effectiveUpdated.procoreProjectId) {
                                // Extract project data (without id/origin_id) for PATCH endpoint
                                const { id, origin_id, ...projectData } = syncUpdate
                                
                                // Fire-and-forget style; we don't want to block the UI on Procore sync
                                ProcoreService.updateProject(effectiveUpdated.procoreProjectId, projectData)
                                    .then((result) => {
                                        console.log('Procore update successful for project:', {
                                            projectId: id,
                                            procoreProjectId: effectiveUpdated.procoreProjectId,
                                            procoreResult: result,
                                        })
                                    })
                                    .catch((syncError) => {
                                        console.error('Error updating project in Procore:', syncError)
                                    })
                            } else {
                                // Fallback to Sync endpoint for projects without procoreProjectId
                                ProcoreService.syncProjects([syncUpdate])
                                    .then((result) => {
                                        console.log('Procore sync successful for project update:', {
                                            projectId: id,
                                            procoreResult: result,
                                        })
                                    })
                                    .catch((syncError) => {
                                        console.error('Error syncing updated project to Procore:', syncError)
                                    })
                            }
                        }
                    } catch (syncSetupError) {
                        console.error('Error preparing Procore sync payload for project update:', syncSetupError)
                    }
                }

                return updatedProject
            } else {
                throw new Error(response.error)
            }
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    'Failed to update project',
                ),
            )
            throw error
        }
    },

    // Delete project
    deleteProject: async (id) => {
        set({ loading: true, error: null })
        try {
            // Get the project before deletion for notification
            const originalProject = get().projects.find(p => p.id === id)
            const projectName = originalProject?.projectName || originalProject?.ProjectName || 'Project'
            
            // Get users to notify before deletion
            const userIds = await getUsersToNotify('project', id)
            const currentUserId = getCurrentUserId()
            
            const response = await FirebaseDbService.projects.delete(id)
            if (response.success) {
                set((state) => ({
                    projects: state.projects.filter((p) => p.id !== id),
                    loading: false
                }))
                
                // Notify users about project deletion
                if (userIds.length > 0 && currentUserId) {
                    await notifyEntityDeleted({
                        userIds,
                        entityType: 'project',
                        entityId: id,
                        entityName: projectName,
                        deletedBy: currentUserId
                    })
                }
                
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'success', duration: 2000, title: 'Success' },
                        'Project deleted successfully!',
                    ),
                )
            } else {
                throw new Error(response.error)
            }
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    'Failed to delete project',
                ),
            )
            throw error
        }
    },

    // Toggle favorite
    toggleFavorite: async (id) => {
        const project = get().projects.find((p) => p.id === id)
        if (!project) return

        const newFavoriteState = !project.favorite
        try {
            // Update silently without showing notification
            await get().updateProject(id, { favorite: newFavoriteState }, { silent: true })
        } catch (error) {
            console.error('Failed to toggle favorite:', error)
        }
    },

    // Bulk delete
    bulkDeleteProjects: async (ids) => {
        set({ loading: true, error: null })
        try {
            const response = await FirebaseDbService.projects.batchDelete(ids)
            if (response.success) {
                set((state) => ({
                    projects: state.projects.filter((p) => !ids.includes(p.id)),
                    loading: false
                }))
                
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'success', duration: 2000, title: 'Success' },
                        `${ids.length} project(s) deleted successfully!`,
                    ),
                )
            } else {
                throw new Error(response.error)
            }
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    'Failed to delete projects',
                ),
            )
            throw error
        }
    },

    // Export data
    exportData: async (format = 'json', options = {}) => {
        set({ loading: true, error: null })
        try {
            const response = await FirebaseDbService.projects.exportData(format)
            if (response.success) {
                // Download the file
                const blob = new Blob([response.data], { type: response.mimeType })
                const url = URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.download = response.filename
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                URL.revokeObjectURL(url)
                
                set({ loading: false })
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'success', duration: 2000, title: 'Success' },
                        'Projects exported successfully!',
                    ),
                )
                return response
            } else {
                throw new Error(response.error)
            }
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    'Failed to export projects',
                ),
            )
            throw error
        }
    },

    // Import data
    // NOTE: Bulk import does NOT create projects in Procore - only individual project creation (addProject) syncs to Procore
    // This is intentional to prevent bulk imports from creating hundreds of projects in Procore
    importData: async (data, options = {}) => {
        set({ loading: true, error: null })
        try {
            // Bulk import only saves to Firebase - NO Procore sync
            const response = await FirebaseDbService.projects.importData(data, options)
            if (response.success) {
                // Reload projects after import
                await get().loadProjects()
                
                set({ loading: false })
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'success', duration: 2000, title: 'Success' },
                        `Successfully imported ${response.importedCount} project(s)!`,
                    ),
                )
                return response
            } else {
                throw new Error(response.error)
            }
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    'Failed to import projects',
                ),
            )
            throw error
        }
    },

    // Bulk delete all
    bulkDelete: async (ids) => {
        return get().bulkDeleteProjects(ids)
    },

    // Sync all projects from Procore to Bolt
    syncAllFromProcore: async () => {
        set({ loading: true, error: null })
        try {
            const { ProcoreService } = await import('@/services/ProcoreService')
            const result = await ProcoreService.syncAllProjectsToBolt()
            
            // Reload projects after sync
            await get().loadProjects()
            
            set({ loading: false })
            const errorMessage = result.errorDetails 
                ? ` ${result.errorCount} error(s): ${result.errorDetails}`
                : result.errorCount > 0 
                    ? ` ${result.errorCount} error(s). Check console for details.`
                    : ''
            
            toast.push(
                React.createElement(
                    Notification,
                    { 
                        type: result.errorCount > 0 ? 'warning' : 'success', 
                        duration: result.errorCount > 0 ? 5000 : 3000, 
                        title: 'Sync Complete' 
                    },
                    `Synced ${result.syncedCount || 0} project(s) from Procore.${errorMessage}`,
                ),
            )
            
            // Log errors to console for debugging
            if (result.errorCount > 0 && result.errors) {
                console.error('Sync errors:', result.errors)
            }
            return result
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    `Failed to sync projects from Procore: ${error.message || 'Unknown error'}`,
                ),
            )
            throw error
        }
    },
}))

