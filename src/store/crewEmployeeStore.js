import { create } from 'zustand'
import React from 'react'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { toast } from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'

export const useCrewEmployeeStore = create((set, get) => ({
    employees: [],
    filters: {
        search: '',
        active: true, // true | false | null (all)
    },
    selectedEmployeeId: null,
    loading: false,
    error: null,
    realtimeListener: null,

    setSelectedEmployeeId: (id) => set({ selectedEmployeeId: id }),

    setFilters: (partial) => set((state) => ({
        filters: { ...state.filters, ...partial },
    })),

    // Load employees from Firebase
    loadEmployees: async () => {
        set({ loading: true, error: null })
        try {
            const filters = get().filters
            
            const queryFilters = {}
            
            // Add active filter if not null
            if (filters.active !== null && filters.active !== undefined) {
                queryFilters.active = filters.active
            }
            
            const response = await FirebaseDbService.crewEmployees.getAll(queryFilters)
            if (response.success) {
                // Apply client-side search filter if provided
                let filteredEmployees = response.data || []
                
                if (filters.search) {
                    const searchLower = filters.search.toLowerCase()
                    filteredEmployees = filteredEmployees.filter(emp => 
                        emp.name?.toLowerCase().includes(searchLower) ||
                        emp.phone?.toLowerCase().includes(searchLower) ||
                        emp.email?.toLowerCase().includes(searchLower)
                    )
                }
                
                set({ 
                    employees: filteredEmployees, 
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
                    'Failed to load employees',
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

        const filters = get().filters
        
        const queryFilters = {}
        if (filters.active !== null && filters.active !== undefined) {
            queryFilters.active = filters.active
        }

        const unsubscribe = FirebaseDbService.crewEmployees.subscribe((employees) => {
            // Apply client-side search filter if provided
            let filteredEmployees = employees
            
            if (filters.search) {
                const searchLower = filters.search.toLowerCase()
                filteredEmployees = employees.filter(emp => 
                    emp.name?.toLowerCase().includes(searchLower) ||
                    emp.phone?.toLowerCase().includes(searchLower) ||
                    emp.email?.toLowerCase().includes(searchLower)
                )
            }
            
            set({ employees: filteredEmployees })
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

    // Create employee
    createEmployee: async (employeeData) => {
        set({ loading: true, error: null })
        try {
            const response = await FirebaseDbService.crewEmployees.create(employeeData)
            if (response.success) {
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'success', duration: 2500, title: 'Success' },
                        'Employee created successfully',
                    ),
                )
                // Reload employees
                await get().loadEmployees()
                return { success: true, data: response.data }
            } else {
                throw new Error(response.error)
            }
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    `Failed to create employee: ${error.message}`,
                ),
            )
            return { success: false, error: error.message }
        }
    },

    // Update employee
    updateEmployee: async (id, employeeData) => {
        set({ loading: true, error: null })
        try {
            const response = await FirebaseDbService.crewEmployees.update(id, employeeData)
            if (response.success) {
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'success', duration: 2500, title: 'Success' },
                        'Employee updated successfully',
                    ),
                )
                // Reload employees
                await get().loadEmployees()
                return { success: true, data: response.data }
            } else {
                throw new Error(response.error)
            }
        } catch (error) {
            set({ error: error.message, loading: false })
            toast.push(
                React.createElement(
                    Notification,
                    { type: 'danger', duration: 2500, title: 'Error' },
                    `Failed to update employee: ${error.message}`,
                ),
            )
            return { success: false, error: error.message }
        }
    },

    // Delete employee
    deleteEmployee: async (id) => {
        set({ loading: true, error: null })
        try {
            const response = await FirebaseDbService.crewEmployees.delete(id)
            if (response.success) {
                toast.push(
                    React.createElement(
                        Notification,
                        { type: 'success', duration: 2500, title: 'Success' },
                        'Employee deleted successfully',
                    ),
                )
                // Reload employees
                await get().loadEmployees()
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
                    `Failed to delete employee: ${error.message}`,
                ),
            )
            return { success: false, error: error.message }
        }
    },
}))

