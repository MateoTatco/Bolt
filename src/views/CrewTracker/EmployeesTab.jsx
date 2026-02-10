import React from 'react'
import { Input, Select } from '@/components/ui'
import DataTable from '@/components/shared/DataTable'

const EmployeesTab = ({ filters, setFilters, columns, data, loading }) => {
    return (
        <>
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                    <Input
                        placeholder="Search employees..."
                        value={filters.search}
                        onChange={(e) => setFilters({ search: e.target.value })}
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
                    data={data}
                    loading={loading}
                    skeletonAvatarColumns={[0]}
                    skeletonAvatarProps={{ size: 32 }}
                />
            </div>
        </>
    )
}

export default EmployeesTab


