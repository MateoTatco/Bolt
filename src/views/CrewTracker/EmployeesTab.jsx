import React, { useState, useMemo } from 'react'
import { Input, Select } from '@/components/ui'
import DataTable from '@/components/shared/DataTable'

const EmployeesTab = ({ filters, setFilters, columns, data, loading }) => {
    // Local search state - doesn't affect global employee list
    const [localSearch, setLocalSearch] = useState(filters.search || '')
    
    // Filter data locally for display only
    const filteredData = useMemo(() => {
        if (!localSearch.trim()) return data
        const searchLower = localSearch.toLowerCase()
        return data.filter(emp => 
            (emp.firstName || '').toLowerCase().includes(searchLower) ||
            (emp.lastName || '').toLowerCase().includes(searchLower) ||
            (emp.name || '').toLowerCase().includes(searchLower) ||
            (emp.nickname || '').toLowerCase().includes(searchLower) ||
            (emp.phone || '').toLowerCase().includes(searchLower) ||
            (emp.email || '').toLowerCase().includes(searchLower)
        )
    }, [data, localSearch])

    return (
        <>
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                    <Input
                        placeholder="Search employees..."
                        value={localSearch}
                        onChange={(e) => setLocalSearch(e.target.value)}
                    />
                </div>
                <div>
                    <Select
                        placeholder="Filter by status"
                        options={[
                            { value: null, label: 'All Employees' },
                            { value: true, label: 'Active Only' },
                            { value: false, label: 'Inactive Only' },
                        ]}
                        value={filters.active}
                        onChange={(option) => setFilters({ active: option.value })}
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                        styles={{
                            menuPortal: (provided) => ({ ...provided, zIndex: 9999 }),
                            menu: (provided) => ({ ...provided, zIndex: 9999 }),
                        }}
                    />
                </div>
            </div>

            {/* Employees Table */}
            <div className="pt-4">
                <DataTable
                    columns={columns}
                    data={filteredData}
                    loading={loading}
                    skeletonAvatarColumns={[0]}
                    skeletonAvatarProps={{ size: 32 }}
                />
            </div>
        </>
    )
}

export default EmployeesTab


