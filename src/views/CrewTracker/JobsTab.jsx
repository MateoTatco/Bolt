import React from 'react'
import { Input } from '@/components/ui'
import DataTable from '@/components/shared/DataTable'

const JobsTab = ({
    filters,
    setFilters,
    columns,
    data,
    loading,
    selectable = false,
    defaultPageSize = 10,
    onCheckBoxChange,
    onIndeterminateCheckBoxChange,
    checkboxChecked,
}) => {
    return (
        <>
            {/* Jobs Table */}
            <div className="pt-4">
                <DataTable
                    columns={columns}
                    data={data}
                    loading={loading}
                    selectable={selectable}
                    defaultPageSize={defaultPageSize}
                    onCheckBoxChange={onCheckBoxChange}
                    onIndeterminateCheckBoxChange={onIndeterminateCheckBoxChange}
                    checkboxChecked={checkboxChecked}
                />
            </div>
        </>
    )
}

export default JobsTab


