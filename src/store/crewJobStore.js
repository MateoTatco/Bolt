import { create } from 'zustand'
import React from 'react'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { toast } from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'

export const useCrewJobStore = create((set, get) => ({
    jobs: [],
    filters: {
        search: '',
        active: true, // true | false | null (all)
    },
    selectedJobId: null,
    loading: false,
    error: null,
    realtimeListener: null,

    setSelectedJobId: (id) => set({ selectedJobId: id }),

    setFilters: (partial) => set((state) => ({
        filters: { ...state.filters, ...partial },
    })),

    // Load jobs from Firebase
    loadJobs: async () => {
        set({ loading: true, error: null })
        try {
            const filters = get().filters
            
            const queryFilters = {}
            
            // Add active filter if not null
            if (filters.active !== null && filters.active !== undefined) {
                queryFilters.active = filters.active
            }
            
            const response = await FirebaseDbService.crewJobs.getAll(queryFilters)
            if (response.success) {
                // Apply client-side search filter if provided
                let filteredJobs = response.data || []
                
                if (filters.search) {
                    const searchLower = filters.search.toLowerCase()
                    filteredJobs = filteredJobs.filter(job => 
                        job.name?.toLowerCase().includes(searchLower) ||
                        job.address?.toLowerCase().includes(searchLower) ||
                        job.tasks?.toLowerCase().includes(searchLower)
                    )
                }
                
                set({ 
                    jobs: filteredJobs, 
                    loading: false 
                })
            } else {
                throw new Error(response.error)
            }
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    'Failed to load jobs',
                ),
            )
        }
    },

    // Setup real-time listener - load all jobs, filter client-side
    setupRealtimeListener: () => {
        const currentListener = get().realtimeListener
        if (currentListener) {
            currentListener() // Unsubscribe existing
        }

        const filters = get().filters
        
        // Don't filter by active in the query - load all jobs
        const queryFilters = {}

        const unsubscribe = FirebaseDbService.crewJobs.subscribe((jobs) => {
            // Apply client-side search filter if provided
            let filteredJobs = jobs
            
            if (filters.search) {
                const searchLower = filters.search.toLowerCase()
                filteredJobs = jobs.filter(job => 
                    job.name?.toLowerCase().includes(searchLower) ||
                    job.address?.toLowerCase().includes(searchLower) ||
                    job.tasks?.toLowerCase().includes(searchLower)
                )
            }
            
            set({ jobs: filteredJobs })
        }, queryFilters)

        set({ realtimeListener: unsubscribe })
    },

    // Cleanup real-time listener
    cleanupRealtimeListener: () => {
        const listener = get().realtimeListener
        if (listener) {
            listener()
            set({ realtimeListener: null })
        }
    },

    // Create job
    createJob: async (jobData, options = {}) => {
        const { silent = false } = options
        set({ loading: true, error: null })
        try {
            const response = await FirebaseDbService.crewJobs.create(jobData)
            if (response.success) {
                if (!silent) {
                    toast.push(
                        React.createElement(
                            Notification,
                            { type: 'success', duration: 2500, title: 'Success' },
                            'Job created successfully',
                        ),
                    )
                }
                // Reload jobs
                await get().loadJobs()
                return { success: true, data: response.data }
            } else {
                throw new Error(response.error)
            }
        } catch (error) {
            set({ error: error.message, loading: false })
            if (!silent) {
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'danger', duration: 2500, title: 'Error' },
                        `Failed to create job: ${error.message}`,
                    ),
                )
            }
            return { success: false, error: error.message }
        }
    },

    // Update job
    updateJob: async (id, jobData, options = {}) => {
        const { silent = false } = options
        set({ loading: true, error: null })
        try {
            const response = await FirebaseDbService.crewJobs.update(id, jobData)
            if (response.success) {
                if (!silent) {
                    toast.push(
                        React.createElement(
                            Notification,
                            { type: 'success', duration: 2500, title: 'Success' },
                            'Job updated successfully',
                        ),
                    )
                }
                // Reload jobs
                await get().loadJobs()
                return { success: true, data: response.data }
            } else {
                throw new Error(response.error)
            }
        } catch (error) {
            set({ error: error.message, loading: false })
            if (!silent) {
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'danger', duration: 2500, title: 'Error' },
                        `Failed to update job: ${error.message}`,
                    ),
                )
            }
            return { success: false, error: error.message }
        }
    },

    // Delete job
    deleteJob: async (id, options = {}) => {
        const { silent = false } = options
        set({ loading: true, error: null })
        try {
            const response = await FirebaseDbService.crewJobs.delete(id)
            if (response.success) {
                if (!silent) {
                    toast.push(
                        React.createElement(
                            Notification,
                            { type: 'success', duration: 2500, title: 'Success' },
                            'Job deleted successfully',
                        ),
                    )
                }
                // Reload jobs
                await get().loadJobs()
                return { success: true }
            } else {
                throw new Error(response.error)
            }
        } catch (error) {
            set({ error: error.message, loading: false })
            if (!silent) {
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'danger', duration: 2500, title: 'Error' },
                        `Failed to delete job: ${error.message}`,
                    ),
                )
            }
            return { success: false, error: error.message }
        }
    },
}))

