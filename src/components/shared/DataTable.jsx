import {
    useMemo,
    useRef,
    useEffect,
    useState,
    useImperativeHandle,
} from 'react'
import classNames from 'classnames'
import Table from '@/components/ui/Table'
import Pagination from '@/components/ui/Pagination'
import Select from '@/components/ui/Select'
import Checkbox from '@/components/ui/Checkbox'
import TableRowSkeleton from './loaders/TableRowSkeleton'
import Loading from './Loading'
import FileNotFound from '@/assets/svg/FileNotFound'
import {
    useReactTable,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    flexRender,
} from '@tanstack/react-table'

const { Tr, Th, Td, THead, TBody, Sorter } = Table

const IndeterminateCheckbox = (props) => {
    const {
        indeterminate,
        onChange,
        onCheckBoxChange,
        onIndeterminateCheckBoxChange,
        ...rest
    } = props

    const ref = useRef(null)

    useEffect(() => {
        if (typeof indeterminate === 'boolean' && ref.current) {
            ref.current.indeterminate = !rest.checked && indeterminate
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ref, indeterminate])

    const handleChange = (e) => {
        onChange(e)
        onCheckBoxChange?.(e)
        onIndeterminateCheckBoxChange?.(e)
    }

    return (
        <Checkbox
            ref={ref}
            className="mb-0"
            onChange={(_, e) => handleChange(e)}
            {...rest}
        />
    )
}

function DataTable(props) {
    const {
        skeletonAvatarColumns,
        columns: columnsProp = [],
        data = [],
        customNoDataIcon,
        loading,
        noData,
        onCheckBoxChange,
        onIndeterminateCheckBoxChange,
        onPaginationChange,
        onSelectChange,
        onSort,
        pageSizes = [10, 25, 50, 100],
        defaultPageSize = 10,
        selectable = false,
        skeletonAvatarProps,
        pagingData, // when provided, parent controls pagination (total, pageIndex, pageSize)
        sort: sortProp, // optional { key, order } from parent for controlled sort (e.g. restored from storage)
        checkboxChecked,
        indeterminateCheckboxChecked,
        instanceId = 'data-table',
        rowClassName,
        ref,
        ...rest
    } = props

    // When pagingData is provided, parent controls pagination
    const isControlledPagination = Boolean(
        pagingData &&
        typeof pagingData.total === 'number' &&
        typeof pagingData.pageIndex === 'number' &&
        typeof pagingData.pageSize === 'number'
    )

    // Sorting: sync from parent when prop has key (restored), update local state when user clicks and notify parent
    const [sorting, setSorting] = useState(() =>
        sortProp?.key && sortProp?.order
            ? [{ id: sortProp.key, desc: sortProp.order === 'desc' }]
            : null,
    )
    useEffect(() => {
        if (sortProp?.key && sortProp?.order) {
            setSorting([{ id: sortProp.key, desc: sortProp.order === 'desc' }])
        }
    }, [sortProp?.key, sortProp?.order])

    const pageSizeOption = useMemo(
        () =>
            pageSizes.map((number) => ({
                value: number,
                label: `${number} / page`,
            })),
        [pageSizes],
    )

    const handleIndeterminateCheckBoxChange = (checked, rows) => {
        if (!loading) {
            onIndeterminateCheckBoxChange?.(checked, rows)
        }
    }

    const handleCheckBoxChange = (checked, row) => {
        if (!loading) {
            onCheckBoxChange?.(checked, row)
        }
    }

    const finalColumns = useMemo(() => {
        const columns = columnsProp

        if (selectable) {
            return [
                {
                    id: 'select',
                    maxSize: 50,
                    header: ({ table }) => (
                        <IndeterminateCheckbox
                            checked={
                                indeterminateCheckboxChecked
                                    ? indeterminateCheckboxChecked(
                                          table.getRowModel().rows,
                                      )
                                    : table.getIsAllRowsSelected()
                            }
                            indeterminate={table.getIsSomeRowsSelected()}
                            onChange={table.getToggleAllRowsSelectedHandler()}
                            onIndeterminateCheckBoxChange={(e) => {
                                handleIndeterminateCheckBoxChange(
                                    e.target.checked,
                                    table.getRowModel().rows,
                                )
                            }}
                        />
                    ),
                    cell: ({ row }) => (
                        <IndeterminateCheckbox
                            checked={
                                checkboxChecked
                                    ? checkboxChecked(row.original)
                                    : row.getIsSelected()
                            }
                            disabled={!row.getCanSelect()}
                            indeterminate={row.getIsSomeSelected()}
                            onChange={row.getToggleSelectedHandler()}
                            onCheckBoxChange={(e) =>
                                handleCheckBoxChange(
                                    e.target.checked,
                                    row.original,
                                )
                            }
                        />
                    ),
                },
                ...columns,
            ]
        }
        return columns
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [columnsProp, selectable, loading, checkboxChecked])

    const table = useReactTable({
        data,
        columns: finalColumns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        state: {
            sorting,
            ...(isControlledPagination && pagingData && {
                pagination: {
                    pageIndex: 0,
                    pageSize: pagingData.pageSize,
                },
            }),
        },
        onSortingChange: (sorter) => {
            setSorting(sorter)
            const order = Array.isArray(sorter) && sorter.length > 0 ? (sorter[0].desc ? 'desc' : 'asc') : ''
            const key = Array.isArray(sorter) && sorter.length > 0 ? sorter[0].id : ''
            onSort?.({ order, key })
        },
        ...(isControlledPagination && {
            manualPagination: true,
            pageCount: Math.ceil((pagingData?.total ?? 0) / (pagingData?.pageSize ?? 1)),
            onPaginationChange: (updater) => {
                if (!pagingData) return
                const prev = { pageIndex: pagingData.pageIndex - 1, pageSize: pagingData.pageSize }
                const next = updater(prev)
                if (next.pageIndex !== prev.pageIndex) onPaginationChange?.(next.pageIndex + 1)
                if (next.pageSize !== prev.pageSize) onSelectChange?.(next.pageSize)
            },
        }),
    })
    const total = isControlledPagination ? pagingData.total : data.length
    const pageIndex = isControlledPagination ? pagingData.pageIndex : table.getState().pagination.pageIndex
    const pageSize = isControlledPagination ? pagingData.pageSize : table.getState().pagination.pageSize

    // Ensure initial page size respects defaultPageSize (only when not controlled)
    useEffect(() => {
        if (isControlledPagination) return
        const current = table.getState().pagination.pageSize
        if (current !== defaultPageSize) {
            table.setPageSize(defaultPageSize)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [defaultPageSize, isControlledPagination])

    const resetSorting = () => {
        table.resetSorting()
    }

    const resetSelected = () => {
        table.resetRowSelection(true)
    }

    useImperativeHandle(ref, () => ({
        resetSorting,
        resetSelected,
    }))

    const handlePaginationChange = (page) => {
        if (!loading) {
            resetSelected()
            if (!isControlledPagination) table.setPageIndex(page - 1)
            onPaginationChange?.(page)
        }
    }

    const handleSelectChange = (value) => {
        if (!loading) {
            const size = Number(value)
            if (!isControlledPagination) table.setPageSize(size)
            onSelectChange?.(size)
        }
    }

    return (
        <Loading loading={Boolean(loading && data.length !== 0)} type="cover">
            <Table {...rest}>
                <THead className="sticky top-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <Tr key={headerGroup.id}>
                            {headerGroup.headers.map((header, headerIndex) => {
                                const isActionsColumn = header.column.id === 'actions'
                                return (
                                    <Th
                                        key={header.id}
                                        colSpan={header.colSpan}
                                        className={classNames(
                                            'whitespace-nowrap text-xs md:text-sm bg-white dark:bg-gray-800', // Smaller text on mobile, ensure background
                                            // Action column: sticky on desktop only
                                            isActionsColumn && 'md:sticky md:right-0 md:z-40 border-l border-gray-200 dark:border-gray-700'
                                        )}
                                        style={{ width: header.column.getSize?.() }}
                                    >
                                        {header.isPlaceholder ? null : (
                                            <div
                                                className={classNames(
                                                    header.column.getCanSort() &&
                                                        'cursor-pointer select-none point',
                                                    loading &&
                                                        'pointer-events-none',
                                                )}
                                                onClick={header.column.getToggleSortingHandler()}
                                            >
                                                {flexRender(
                                                    header.column.columnDef
                                                        .header,
                                                    header.getContext(),
                                                )}
                                                {header.column.getCanSort() && (
                                                    <Sorter
                                                        sort={header.column.getIsSorted()}
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </Th>
                                )
                            })}
                        </Tr>
                    ))}
                </THead>
                {loading && data.length === 0 ? (
                    <TableRowSkeleton
                        columns={finalColumns.length}
                        rows={pageSize}
                        avatarInColumns={skeletonAvatarColumns}
                        avatarProps={skeletonAvatarProps}
                    />
                ) : (
                    <TBody>
                        {noData ? (
                            <Tr>
                                <Td
                                    className="hover:bg-transparent"
                                    colSpan={finalColumns.length}
                                >
                                    <div className="flex flex-col items-center gap-4">
                                        {customNoDataIcon ? (
                                            customNoDataIcon
                                        ) : (
                                            <>
                                                <FileNotFound />
                                                <span className="font-semibold">
                                                    No data found!
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </Td>
                            </Tr>
                        ) : (
                            table
                                .getRowModel()
                                .rows
                                .map((row) => {
                                    const rowClass = rowClassName ? rowClassName(row.original) : ''
                                    return (
                                        <Tr key={row.id} className={rowClass}>
                                            {row
                                                .getVisibleCells()
                                                .map((cell, cellIndex) => {
                                                    const isActionsColumn = cell.column.id === 'actions'
                                                    // Get row background class if any
                                                    const rowBgClass = rowClass || ''
                                                    // Determine background color based on row state
                                                    const stickyBg = rowBgClass.includes('bg-blue') 
                                                        ? 'bg-blue-50 dark:bg-blue-900/20' 
                                                        : 'bg-white dark:bg-gray-800'
                                                    return (
                                                        <Td
                                                            key={cell.id}
                                                            className={classNames(
                                                                'text-xs md:text-sm', // Smaller text on mobile
                                                                // Action column: sticky on desktop only
                                                                isActionsColumn && `md:sticky md:right-0 md:z-10 ${stickyBg} hover:bg-gray-50 dark:hover:bg-gray-700 border-l border-gray-200 dark:border-gray-700`
                                                            )}
                                                            style={{
                                                                width: cell.column.getSize(),
                                                            }}
                                                        >
                                                            {flexRender(
                                                                cell.column
                                                                    .columnDef
                                                                    .cell,
                                                                cell.getContext(),
                                                            )}
                                                        </Td>
                                                    )
                                                })}
                                        </Tr>
                                    )
                                })
                        )}
                    </TBody>
                )}
            </Table>
            {/* Show pagination controls when there are items - always show page size selector */}
            {total > 0 && (
                <div className="flex items-center justify-between mt-4">
                    <Pagination
                        pageSize={pageSize}
                        currentPage={isControlledPagination ? pageIndex : pageIndex + 1}
                        total={total}
                        onChange={handlePaginationChange}
                    />
                    <div style={{ minWidth: 130 }}>
                        <Select
                            instanceId={instanceId}
                            size="sm"
                            menuPlacement="top"
                            isSearchable={false}
                            value={pageSizeOption.filter(
                                (option) => option.value === pageSize,
                            )}
                            options={pageSizeOption}
                            onChange={(option) => handleSelectChange(option?.value)}
                        />
                    </div>
                </div>
            )}
        </Loading>
    )
}

export default DataTable
