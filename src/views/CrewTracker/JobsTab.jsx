import React from 'react'
import { Input } from '@/components/ui'
import DataTable from '@/components/shared/DataTable'

const JobsTab = ({ filters, setFilters, columns, data, loading }) => {
    return (
        <>
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                    <Input
                        placeholder="Search jobs..."
                        value={filters.search}
                        onChange={(e) => setFilters({ search: e.target.value })}
                    />
                </div>
            </div>

            {/* Jobs Table */}
            <div className="pt-4">
                <DataTable
                    columns={columns}
                    data={data}
                    loading={loading}
                />
            </div>
        </>
    )
}

export default JobsTab


