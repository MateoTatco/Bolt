import { create } from 'zustand'
import React from 'react'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { toast } from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'

export const useProjectsStore = create((set, get) => ({
    projects: [],
    filters: {
        search: '',
        market: null,
        projectStatus: null,
        projectProbability: null,
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
    addProject: async (projectData) => {
        set({ loading: true, error: null })
        try {
            const response = await FirebaseDbService.projects.create(projectData)
            if (response.success) {
                const newProject = response.data
                
                set((state) => ({
                    projects: [...state.projects, newProject],
                    loading: false
                }))
                
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'success', duration: 2000, title: 'Success' },
                        'Project created successfully!',
                    ),
                )
                return newProject
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
    updateProject: async (id, projectData) => {
        set({ loading: true, error: null })
        try {
            const response = await FirebaseDbService.projects.update(id, projectData)
            if (response.success) {
                set((state) => ({
                    projects: state.projects.map((p) =>
                        p.id === id ? { ...p, ...projectData } : p
                    ),
                    loading: false
                }))
                
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'success', duration: 2000, title: 'Success' },
                        'Project updated successfully!',
                    ),
                )
                return response.data
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
            const response = await FirebaseDbService.projects.delete(id)
            if (response.success) {
                set((state) => ({
                    projects: state.projects.filter((p) => p.id !== id),
                    loading: false
                }))
                
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
            await get().updateProject(id, { favorite: newFavoriteState })
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
    importData: async (data, options = {}) => {
        set({ loading: true, error: null })
        try {
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
}))

