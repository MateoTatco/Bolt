import React, { useState, useMemo } from 'react'
import { Input, Select } from '@/components/ui'
import DataTable from '@/components/shared/DataTable'

const EmployeesTab = ({ filters, setFilters, columns, data, loading, regions = [], skillSets = [] }) => {
    // Local search state - doesn't affect global employee list
    const [localSearch, setLocalSearch] = useState(filters.search || '')

    const getRegionName = (regionId) => (regions.find((r) => r.id === regionId) || {}).name || ''
    const getSkillSetNames = (skillSetIds) =>
        (Array.isArray(skillSetIds) ? skillSetIds : [])
            .map((id) => (skillSets.find((s) => s.id === id) || {}).name || '')
            .filter(Boolean)
            .join(' ')

    // Filter data locally for display only (search includes region and skill set names)
    const filteredData = useMemo(() => {
        if (!localSearch.trim()) return data
        const searchLower = localSearch.toLowerCase()
        return data.filter((emp) => {
            const regionName = getRegionName(emp.regionId)
            const skillNames = getSkillSetNames(emp.skillSetIds)
            return (
                (emp.firstName || '').toLowerCase().includes(searchLower) ||
                (emp.lastName || '').toLowerCase().includes(searchLower) ||
                (emp.name || '').toLowerCase().includes(searchLower) ||
                (emp.nickname || '').toLowerCase().includes(searchLower) ||
                (emp.phone || '').toLowerCase().includes(searchLower) ||
                (emp.email || '').toLowerCase().includes(searchLower) ||
                regionName.toLowerCase().includes(searchLower) ||
                skillNames.toLowerCase().includes(searchLower)
            )
        })
    }, [data, localSearch, regions, skillSets])

    return (
        <>
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                <div>
                    <Input
                        placeholder="Search crew members..."
                        value={localSearch}
                        onChange={(e) => setLocalSearch(e.target.value)}
                    />
                </div>
                <div>
                    <Select
                        placeholder="Filter by status"
                        options={[
                            { value: null, label: 'All crew members' },
                            { value: true, label: 'Active only' },
                            { value: false, label: 'Inactive only' },
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
                <div>
                    <Select
                        placeholder="Region"
                        options={[{ value: null, label: 'All regions' }, ...(regions || []).map((r) => ({ value: r.id, label: r.name || '' }))]}
                        value={filters.regionId != null ? { value: filters.regionId, label: (regions || []).find((r) => r.id === filters.regionId)?.name || filters.regionId } : { value: null, label: 'All regions' }}
                        onChange={(option) => setFilters({ regionId: option?.value ?? null })}
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                        styles={{ menuPortal: (provided) => ({ ...provided, zIndex: 9999 }) }}
                    />
                </div>
                <div>
                    <Select
                        placeholder="Skill set"
                        options={[{ value: null, label: 'All skill sets' }, ...(skillSets || []).map((s) => ({ value: s.id, label: s.name || '' }))]}
                        value={filters.skillSetId != null ? { value: filters.skillSetId, label: (skillSets || []).find((s) => s.id === filters.skillSetId)?.name || filters.skillSetId } : { value: null, label: 'All skill sets' }}
                        onChange={(option) => setFilters({ skillSetId: option?.value ?? null })}
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                        styles={{ menuPortal: (provided) => ({ ...provided, zIndex: 9999 }) }}
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


