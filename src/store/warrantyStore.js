import { create } from 'zustand'
import React from 'react'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { toast } from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { getCurrentUserId } from '@/utils/notificationHelper'
import { ROLE_TO_COMPANY } from '@/constants/roles.constant'
import { useSessionUser } from '@/store/authStore'
import { Timestamp } from 'firebase/firestore'

export const useWarrantyStore = create((set, get) => ({
    warranties: [],
    filters: {
        search: '',
        status: 'open', // 'open' | 'completed' | null (all)
        assignedTo: null,
        projectName: null,
    },
    selectedWarrantyId: null,
    loading: false,
    error: null,
    realtimeListener: null,

    setSelectedWarrantyId: (id) => set({ selectedWarrantyId: id }),

    setFilters: (partial) => set((state) => ({
        filters: { ...state.filters, ...partial },
    })),

    // Get company ID for current user (defaults to 'Tatco' for Tatco roles)
    getCompanyId: () => {
        const user = useSessionUser.getState().user
        if (!user) return 'Tatco'
        
        const userRole = user.role
        if (!userRole) return 'Tatco'
        
        const roles = Array.isArray(userRole) ? userRole : [userRole]
        
        // Admin can see all, but default to Tatco
        if (roles.includes('admin')) {
            return 'Tatco'
        }
        
        // Get company from role
        for (const role of roles) {
            if (ROLE_TO_COMPANY[role]) {
                return ROLE_TO_COMPANY[role]
            }
        }
        
        return 'Tatco' // Default fallback
    },

    // Load warranties from Firebase
    loadWarranties: async () => {
        set({ loading: true, error: null })
        try {
            const companyId = get().getCompanyId()
            const filters = get().filters
            
            const queryFilters = {
                companyId: companyId,
            }
            
            // Add status filter if not null
            if (filters.status) {
                queryFilters.status = filters.status
            }
            
            // Add assignedTo filter if provided
            if (filters.assignedTo) {
                queryFilters.assignedTo = filters.assignedTo
            }
            
            const response = await FirebaseDbService.warranties.getAll(queryFilters)
            if (response.success) {
                // Apply client-side search filter if provided
                let filteredWarranties = response.data
                
                if (filters.search) {
                    const searchLower = filters.search.toLowerCase()
                    filteredWarranties = filteredWarranties.filter(w => 
                        w.projectName?.toLowerCase().includes(searchLower) ||
                        w.description?.toLowerCase().includes(searchLower) ||
                        w.requestedBy?.toLowerCase().includes(searchLower)
                    )
                }
                
                if (filters.projectName) {
                    filteredWarranties = filteredWarranties.filter(w => 
                        w.projectName === filters.projectName
                    )
                }
                
                set({ warranties: filteredWarranties, loading: false })
            } else {
                throw new Error(response.error)
            }
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    'Failed to load warranties',
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

        const companyId = get().getCompanyId()
        const filters = get().filters
        
        const queryFilters = {
            companyId: companyId,
        }
        
        if (filters.status) {
            queryFilters.status = filters.status
        }

        const unsubscribe = FirebaseDbService.warranties.subscribe((warranties) => {
            // Apply client-side filters
            let filteredWarranties = warranties
            
            const currentFilters = get().filters
            if (currentFilters.search) {
                const searchLower = currentFilters.search.toLowerCase()
                filteredWarranties = filteredWarranties.filter(w => 
                    w.projectName?.toLowerCase().includes(searchLower) ||
                    w.description?.toLowerCase().includes(searchLower) ||
                    w.requestedBy?.toLowerCase().includes(searchLower)
                )
            }
            
            if (currentFilters.projectName) {
                filteredWarranties = filteredWarranties.filter(w => 
                    w.projectName === currentFilters.projectName
                )
            }
            
            set({ warranties: filteredWarranties })
        }, queryFilters)

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

    // Create new warranty
    addWarranty: async (warrantyData) => {
        set({ loading: true, error: null })
        try {
            const currentUserId = getCurrentUserId()
            if (!currentUserId) {
                throw new Error('User not authenticated')
            }

            const companyId = get().getCompanyId()
            
            // Calculate next reminder date based on frequency
            let nextReminderDate = null
            const reminderFrequency = warrantyData.reminderFrequency || '5days'
            if (reminderFrequency !== 'none') {
                const now = new Date()
                const days = reminderFrequency === '3days' ? 3 : 
                            reminderFrequency === '5days' ? 5 : 
                            reminderFrequency === 'weekly' ? 7 : 5
                nextReminderDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000))
            }

            const newWarranty = {
                projectId: warrantyData.projectId || null,
                projectName: warrantyData.projectName || '',
                description: warrantyData.description || '',
                requestedBy: warrantyData.requestedBy || '',
                requestedByEmail: warrantyData.requestedByEmail || null,
                assignedTo: warrantyData.assignedTo || [],
                status: 'open',
                reminderFrequency: reminderFrequency,
                lastReminderSent: null,
                nextReminderDate: nextReminderDate ? Timestamp.fromDate(new Date(nextReminderDate)) : null,
                startDate: warrantyData.startDate ? (warrantyData.startDate instanceof Date ? Timestamp.fromDate(warrantyData.startDate) : warrantyData.startDate) : null,
                completedDate: null,
                companyId: companyId,
                createdBy: currentUserId,
            }

            const response = await FirebaseDbService.warranties.create(newWarranty)
            if (response.success) {
                set((state) => ({
                    warranties: [response.data, ...state.warranties],
                    loading: false
                }))
                
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'success', duration: 3000, title: 'Success' },
                        'Warranty created successfully',
                    ),
                )
                
                return { warranty: response.data }
            } else {
                throw new Error(response.error)
            }
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    'Failed to create warranty',
                ),
            )
            throw error
        }
    },

    // Update warranty
    updateWarranty: async (warrantyId, updates) => {
        set({ loading: true, error: null })
        try {
            const response = await FirebaseDbService.warranties.update(warrantyId, updates)
            if (response.success) {
                set((state) => ({
                    warranties: state.warranties.map(w => 
                        w.id === warrantyId ? { ...w, ...updates } : w
                    ),
                    loading: false
                }))
                
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'success', duration: 2000, title: 'Success' },
                        'Warranty updated successfully',
                    ),
                )
                
                return { warranty: response.data }
            } else {
                throw new Error(response.error)
            }
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    'Failed to update warranty',
                ),
            )
            throw error
        }
    },

    // Complete warranty
    completeWarranty: async (warrantyId) => {
        set({ loading: true, error: null })
        try {
            const updates = {
                status: 'completed',
                completedDate: Timestamp.fromDate(new Date()),
            }
            
            const response = await FirebaseDbService.warranties.update(warrantyId, updates)
            if (response.success) {
                set((state) => ({
                    warranties: state.warranties.map(w => 
                        w.id === warrantyId ? { ...w, ...updates } : w
                    ),
                    loading: false
                }))
                
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'success', duration: 2000, title: 'Success' },
                        'Warranty marked as completed',
                    ),
                )
                
                return { warranty: response.data }
            } else {
                throw new Error(response.error)
            }
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    'Failed to complete warranty',
                ),
            )
            throw error
        }
    },

    // Delete warranty
    deleteWarranty: async (warrantyId) => {
        set({ loading: true, error: null })
        try {
            const response = await FirebaseDbService.warranties.delete(warrantyId)
            if (response.success) {
                set((state) => ({
                    warranties: state.warranties.filter(w => w.id !== warrantyId),
                    loading: false
                }))
                
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'success', duration: 2000, title: 'Success' },
                        'Warranty deleted successfully',
                    ),
                )
                
                return { success: true }
            } else {
                throw new Error(response.error)
            }
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    'Failed to delete warranty',
                ),
            )
            throw error
        }
    },
}))

