import React, { useMemo, useRef, useEffect, useState } from 'react'
import { Button, DatePicker, Alert, Input, Select } from '@/components/ui'
import {
    HiOutlineClock,
    HiOutlineChatAlt2,
    HiOutlineDownload,
    HiOutlineRefresh,
    HiOutlineTrash,
} from 'react-icons/hi'

// Auto-grow textarea helper component
const AutoGrowTextarea = ({ value, onChange, placeholder, className, style, rowspan, maxRows = 10 }) => {
    const textareaRef = useRef(null)

    useEffect(() => {
        const textarea = textareaRef.current
        if (!textarea) return

        textarea.style.height = 'auto'

        const lineHeight = 20
        const minHeight = 32
        const maxHeight = maxRows * lineHeight

        let newHeight = Math.max(minHeight, textarea.scrollHeight)

        if (rowspan > 1) {
            const td = textarea.closest('td')
            if (td) {
                const cellHeight = td.offsetHeight - 8
                newHeight = Math.max(newHeight, cellHeight)
            }
        }

        newHeight = Math.min(newHeight, maxHeight)

        textarea.style.height = `${newHeight}px`
        textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
    }, [value, rowspan, maxRows])

    return (
        <textarea
            ref={textareaRef}
            value={value || ''}
            onChange={onChange}
            placeholder={placeholder}
            className={`input input-sm input-textarea ${className || ''}`}
            style={{
                ...style,
                overflow: 'hidden',
                resize: 'none',
                width: '100%',
            }}
        />
    )
}

const ScheduleTab = ({
    scheduleError,
    scheduleSendSuccess,
    scheduleDate,
    setScheduleDate,
    getDayOfWeek,
    scheduleLoading,
    handleAddScheduleRow,
    handleSaveSchedule,
    scheduleSaving,
    handleSendScheduleMessages,
    sendingMessages,
    handleExportScheduleToExcel,
    scheduleAssignments,
    employeeOptionsForSchedule,
    jobOptionsForSchedule,
    updateScheduleRow,
    handleRemoveScheduleRow,
    jobs,
}) => {
    const [columnWidths, setColumnWidths] = useState({
        employee: 200,
        costCode: 120,
        w2Hours: 100,
        job: 220,
        address: 300,
        scheduledTasks: 350,
        addedTasks: 300,
        notes: 350,
        tasksNotCompleted: 380,
        materialsNeeded: 320,
        actions: 100,
    })
    const [resizingColumn, setResizingColumn] = useState(null)

    // Helper: Group rows by jobId and calculate rowspans for merged cells
    const groupedRows = useMemo(() => {
        const groups = []
        const processed = new Set()

        scheduleAssignments.forEach((row, index) => {
            if (processed.has(index) || !row.jobId) {
                return
            }

            const group = [index]
            for (let i = index + 1; i < scheduleAssignments.length; i++) {
                if (scheduleAssignments[i].jobId === row.jobId) {
                    group.push(i)
                    processed.add(i)
                }
            }

            if (group.length > 0) {
                processed.add(index)
                groups.push({
                    indices: group,
                    jobId: row.jobId,
                    rowspan: group.length,
                    mergedData: {
                        jobAddress: scheduleAssignments[group[0]].jobAddress || '',
                        scheduledTasks: scheduleAssignments[group[0]].scheduledTasks || '',
                        addedTasks: scheduleAssignments[group[0]].addedTasks || '',
                        notes: scheduleAssignments[group[0]].notes || '',
                        tasksNotCompleted: scheduleAssignments[group[0]].tasksNotCompleted || '',
                        materialsNeeded: scheduleAssignments[group[0]].materialsNeeded || '',
                    },
                })
            }
        })

        scheduleAssignments.forEach((row, index) => {
            if (!processed.has(index)) {
                groups.push({
                    indices: [index],
                    jobId: row.jobId || null,
                    rowspan: 1,
                    mergedData: {
                        jobAddress: row.jobAddress || '',
                        scheduledTasks: row.scheduledTasks || '',
                        addedTasks: row.addedTasks || '',
                        notes: row.notes || '',
                        tasksNotCompleted: row.tasksNotCompleted || '',
                        materialsNeeded: row.materialsNeeded || '',
                    },
                })
            }
        })

        return groups.sort((a, b) => a.indices[0] - b.indices[0])
    }, [scheduleAssignments])

    // Column resizing handlers
    const handleResizeStart = (columnKey, e) => {
        e.preventDefault()
        setResizingColumn(columnKey)
        const startX = e.clientX
        const startWidth = columnWidths[columnKey]

        let rafId = null
        const handleMouseMove = (moveEvent) => {
            if (rafId) {
                cancelAnimationFrame(rafId)
            }

            rafId = requestAnimationFrame(() => {
                const diff = moveEvent.clientX - startX
                const newWidth = Math.max(80, startWidth + diff)
                setColumnWidths((prev) => ({
                    ...prev,
                    [columnKey]: newWidth,
                }))
            })
        }

        const handleMouseUp = () => {
            if (rafId) {
                cancelAnimationFrame(rafId)
            }
            setResizingColumn(null)
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }

    return (
        <div className="pt-4 space-y-4">
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <HiOutlineClock className="text-xl" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Daily crew schedule
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Plan where each crew member goes tomorrow, then send a single
                        SMS with job, address, tasks, and notes.
                    </p>
                </div>
            </div>

            {scheduleError && (
                <Alert type="danger" showIcon>
                    {scheduleError}
                </Alert>
            )}
            {scheduleSendSuccess && (
                <Alert type="success" showIcon>
                    {scheduleSendSuccess}
                </Alert>
            )}

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Date
                        </label>
                        <DatePicker
                            inputtable
                            inputtableBlurClose={false}
                            inputFormat="MM/DD/YYYY"
                            value={scheduleDate}
                            onChange={(date) => setScheduleDate(date)}
                        />
                    </div>
                    <div className="mt-6 text-sm text-gray-600 dark:text-gray-400">
                        {getDayOfWeek(scheduleDate)}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="twoTone"
                        icon={<HiOutlineRefresh />}
                        loading={scheduleLoading}
                        onClick={() => {
                            setScheduleDate(new Date(scheduleDate))
                        }}
                    >
                        Reload
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleAddScheduleRow}
                    >
                        Add row
                    </Button>
                    <Button
                        variant="twoTone"
                        loading={scheduleSaving}
                        onClick={handleSaveSchedule}
                    >
                        Save schedule
                    </Button>
                    <Button
                        variant="solid"
                        icon={<HiOutlineChatAlt2 />}
                        loading={sendingMessages}
                        disabled={sendingMessages}
                        onClick={handleSendScheduleMessages}
                    >
                        Send SMS for this date
                    </Button>
                    <Button
                        variant="outline"
                        icon={<HiOutlineDownload />}
                        onClick={handleExportScheduleToExcel}
                    >
                        Export to Excel
                    </Button>
                </div>
            </div>

            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                {scheduleLoading ? (
                    <div className="p-4 space-y-2 animate-pulse min-w-[960px]">
                        {[...Array(6)].map((_, idx) => (
                            <div
                                key={idx}
                                className="grid grid-cols-11 gap-2"
                            >
                                {Array.from({ length: 11 }).map((__, i) => (
                                    <div key={i} className="h-5 bg-gray-200 dark:bg-gray-700 rounded" />
                                ))}
                            </div>
                        ))}
                    </div>
                ) : (
                    <table
                        className="text-xs"
                        style={{
                            tableLayout: 'fixed',
                            width: '100%',
                            minWidth: Object.values(columnWidths).reduce((sum, w) => sum + w, 0) + 'px',
                        }}
                    >
                        <thead className="bg-gray-50 dark:bg-gray-800/60">
                            <tr>
                                <th
                                    className="px-3 py-3 text-left font-semibold text-gray-900 dark:text-white relative text-xs sm:text-sm"
                                    style={{ width: columnWidths.employee }}
                                >
                                    Employee
                                    <div
                                        className={`absolute right-0 top-[10%] h-[80%] w-1 cursor-col-resize z-10 border-r border-gray-300 dark:border-gray-600 ${
                                            resizingColumn === 'employee'
                                                ? 'bg-primary'
                                                : 'bg-gray-200 dark:bg-gray-700 hover:bg-primary/50'
                                        }`}
                                        onMouseDown={(e) => handleResizeStart('employee', e)}
                                    />
                                </th>
                                <th
                                    className="px-3 py-3 text-left font-semibold text-gray-900 dark:text-white relative text-xs sm:text-sm"
                                    style={{ width: columnWidths.costCode }}
                                >
                                    Cost Code
                                    <div
                                        className={`absolute right-0 top-[10%] h-[80%] w-1 cursor-col-resize z-10 border-r border-gray-300 dark:border-gray-600 ${
                                            resizingColumn === 'costCode'
                                                ? 'bg-primary'
                                                : 'bg-gray-200 dark:bg-gray-700 hover:bg-primary/50'
                                        }`}
                                        onMouseDown={(e) => handleResizeStart('costCode', e)}
                                    />
                                </th>
                                <th
                                    className="px-3 py-3 text-left font-semibold text-gray-900 dark:text-white relative text-xs sm:text-sm"
                                    style={{ width: columnWidths.w2Hours }}
                                >
                                    W2 Hours
                                    <div
                                        className={`absolute right-0 top-[10%] h-[80%] w-1 cursor-col-resize z-10 border-r border-gray-300 dark:border-gray-600 ${
                                            resizingColumn === 'w2Hours'
                                                ? 'bg-primary'
                                                : 'bg-gray-200 dark:bg-gray-700 hover:bg-primary/50'
                                        }`}
                                        onMouseDown={(e) => handleResizeStart('w2Hours', e)}
                                    />
                                </th>
                                <th
                                    className="px-3 py-3 text-left font-semibold text-gray-900 dark:text-white relative text-xs sm:text-sm"
                                    style={{ width: columnWidths.job }}
                                >
                                    Job
                                    <div
                                        className={`absolute right-0 top-[10%] h-[80%] w-1 cursor-col-resize z-10 border-r border-gray-300 dark:border-gray-600 ${
                                            resizingColumn === 'job'
                                                ? 'bg-primary'
                                                : 'bg-gray-200 dark:bg-gray-700 hover:bg-primary/50'
                                        }`}
                                        onMouseDown={(e) => handleResizeStart('job', e)}
                                    />
                                </th>
                                <th
                                    className="px-3 py-3 text-left font-semibold text-gray-900 dark:text-white relative text-xs sm:text-sm"
                                    style={{ width: columnWidths.address }}
                                >
                                    Address
                                    <div
                                        className={`absolute right-0 top-[10%] h-[80%] w-1 cursor-col-resize z-10 border-r border-gray-300 dark:border-gray-600 ${
                                            resizingColumn === 'address'
                                                ? 'bg-primary'
                                                : 'bg-gray-200 dark:bg-gray-700 hover:bg-primary/50'
                                        }`}
                                        onMouseDown={(e) => handleResizeStart('address', e)}
                                    />
                                </th>
                                <th
                                    className="px-3 py-3 text-left font-semibold text-gray-900 dark:text-white relative text-xs sm:text-sm"
                                    style={{ width: columnWidths.scheduledTasks }}
                                >
                                    Scheduled Tasks
                                    <div
                                        className={`absolute right-0 top-[10%] h-[80%] w-1 cursor-col-resize z-10 border-r border-gray-300 dark:border-gray-600 ${
                                            resizingColumn === 'scheduledTasks'
                                                ? 'bg-primary'
                                                : 'bg-gray-200 dark:bg-gray-700 hover:bg-primary/50'
                                        }`}
                                        onMouseDown={(e) => handleResizeStart('scheduledTasks', e)}
                                    />
                                </th>
                                <th
                                    className="px-3 py-3 text-left font-semibold text-gray-900 dark:text-white relative text-xs sm:text-sm"
                                    style={{ width: columnWidths.addedTasks }}
                                >
                                    Added Tasks
                                    <div
                                        className={`absolute right-0 top-[10%] h-[80%] w-1 cursor-col-resize z-10 border-r border-gray-300 dark:border-gray-600 ${
                                            resizingColumn === 'addedTasks'
                                                ? 'bg-primary'
                                                : 'bg-gray-200 dark:bg-gray-700 hover:bg-primary/50'
                                        }`}
                                        onMouseDown={(e) => handleResizeStart('addedTasks', e)}
                                    />
                                </th>
                                <th
                                    className="px-3 py-3 text-left font-semibold text-gray-900 dark:text-white relative text-xs sm:text-sm"
                                    style={{ width: columnWidths.notes }}
                                >
                                    Notes
                                    <div
                                        className={`absolute right-0 top-[10%] h-[80%] w-1 cursor-col-resize z-10 border-r border-gray-300 dark:border-gray-600 ${
                                            resizingColumn === 'notes'
                                                ? 'bg-primary'
                                                : 'bg-gray-200 dark:bg-gray-700 hover:bg-primary/50'
                                        }`}
                                        onMouseDown={(e) => handleResizeStart('notes', e)}
                                    />
                                </th>
                                <th
                                    className="px-3 py-3 text-left font-semibold text-gray-900 dark:text-white relative text-xs sm:text-sm"
                                    style={{ width: columnWidths.tasksNotCompleted }}
                                >
                                    Tasks Not Completed / Need More Time
                                    <div
                                        className={`absolute right-0 top-[10%] h-[80%] w-1 cursor-col-resize z-10 border-r border-gray-300 dark:border-gray-600 ${
                                            resizingColumn === 'tasksNotCompleted'
                                                ? 'bg-primary'
                                                : 'bg-gray-200 dark:bg-gray-700 hover:bg-primary/50'
                                        }`}
                                        onMouseDown={(e) => handleResizeStart('tasksNotCompleted', e)}
                                    />
                                </th>
                                <th
                                    className="px-3 py-3 text-left font-semibold text-gray-900 dark:text-white relative text-xs sm:text-sm"
                                    style={{ width: columnWidths.materialsNeeded }}
                                >
                                    Materials Needed
                                    <div
                                        className={`absolute right-0 top-[10%] h-[80%] w-1 cursor-col-resize z-10 border-r border-gray-300 dark:border-gray-600 ${
                                            resizingColumn === 'materialsNeeded'
                                                ? 'bg-primary'
                                                : 'bg-gray-200 dark:bg-gray-700 hover:bg-primary/50'
                                        }`}
                                        onMouseDown={(e) => handleResizeStart('materialsNeeded', e)}
                                    />
                                </th>
                                <th
                                    className="px-2 py-2 text-center font-semibold text-gray-700 dark:text-gray-200 relative text-xs sm:text-sm"
                                    style={{ width: columnWidths.actions }}
                                >
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {scheduleAssignments.length === 0 && !scheduleLoading && (
                                <tr>
                                    <td
                                        colSpan={11}
                                        className="px-2 py-3 text-center text-xs text-gray-500 dark:text-gray-400"
                                    >
                                        No rows yet for this date. Click &quot;Add row&quot; to start
                                        planning the crew.
                                    </td>
                                </tr>
                            )}
                            {groupedRows.map((group) => {
                                return group.indices.map((rowIndex, idxInGroup) => {
                                    const row = scheduleAssignments[rowIndex]
                                    const job = jobs.find((j) => j.id === row.jobId)
                                    const jobAddress = job?.address || group.mergedData.jobAddress || ''
                                    const mapsUrl =
                                        jobAddress &&
                                        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                            jobAddress,
                                        )}`

                                    const isFirstInGroup = idxInGroup === 0
                                    const rowspan = isFirstInGroup ? group.rowspan : 0

                                    return (
                                        <tr key={row.id || rowIndex} className="align-top">
                                            <td className="px-1 py-1" style={{ width: columnWidths.employee }}>
                                                <Select
                                                    placeholder="Employee"
                                                    options={employeeOptionsForSchedule}
                                                    value={
                                                        employeeOptionsForSchedule.find(
                                                            (opt) => opt.value === row.employeeId,
                                                        ) || null
                                                    }
                                                    onChange={(option) =>
                                                        updateScheduleRow(rowIndex, {
                                                            employeeId: option ? option.value : '',
                                                        })
                                                    }
                                                    menuPortalTarget={document.body}
                                                    menuPosition="fixed"
                                                    styles={{
                                                        menuPortal: (provided) => ({
                                                            ...provided,
                                                            zIndex: 10000,
                                                        }),
                                                    }}
                                                />
                                            </td>
                                            <td className="px-1 py-1" style={{ width: columnWidths.costCode }}>
                                                <Input
                                                    value={row.costCode}
                                                    onChange={(e) =>
                                                        updateScheduleRow(rowIndex, {
                                                            costCode: e.target.value,
                                                        })
                                                    }
                                                    placeholder="Cost code"
                                                    className="text-xs"
                                                />
                                            </td>
                                            <td className="px-1 py-1" style={{ width: columnWidths.w2Hours }}>
                                                <Input
                                                    type="number"
                                                    value={row.w2Hours}
                                                    onChange={(e) =>
                                                        updateScheduleRow(rowIndex, {
                                                            w2Hours: e.target.value,
                                                        })
                                                    }
                                                    placeholder="Hours"
                                                    className="text-xs"
                                                />
                                            </td>
                                            <td className="px-1 py-1" style={{ width: columnWidths.job }}>
                                                <Select
                                                    placeholder="Job"
                                                    options={jobOptionsForSchedule}
                                                    value={
                                                        jobOptionsForSchedule.find(
                                                            (opt) => opt.value === row.jobId,
                                                        ) || null
                                                    }
                                                    onChange={(option) =>
                                                        updateScheduleRow(rowIndex, {
                                                            jobId: option ? option.value : '',
                                                        })
                                                    }
                                                    menuPortalTarget={document.body}
                                                    menuPosition="fixed"
                                                    styles={{
                                                        menuPortal: (provided) => ({
                                                            ...provided,
                                                            zIndex: 10000,
                                                        }),
                                                    }}
                                                />
                                            </td>
                                            {/* Merged cells for Address */}
                                            {isFirstInGroup ? (
                                                <td
                                                    className="px-1 py-1 text-xs align-middle text-center"
                                                    rowSpan={rowspan}
                                                    style={{ width: columnWidths.address }}
                                                >
                                                    {jobAddress ? (
                                                        <a
                                                            href={mapsUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-primary hover:underline break-words inline-block"
                                                        >
                                                            {jobAddress}
                                                        </a>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                            ) : null}
                                            {/* Merged cells for Scheduled Tasks */}
                                            {isFirstInGroup ? (
                                                <td
                                                    className="px-1 py-1 align-top"
                                                    rowSpan={rowspan}
                                                    style={{ width: columnWidths.scheduledTasks }}
                                                >
                                                    <AutoGrowTextarea
                                                        value={group.mergedData.scheduledTasks}
                                                        onChange={(e) => {
                                                            group.indices.forEach((idx) => {
                                                                updateScheduleRow(idx, {
                                                                    scheduledTasks: e.target.value,
                                                                })
                                                            })
                                                        }}
                                                        placeholder="What they should do on site"
                                                        className="text-xs w-full"
                                                        style={{ minHeight: '32px' }}
                                                        rowspan={rowspan}
                                                        maxRows={10}
                                                    />
                                                </td>
                                            ) : null}
                                            {/* Merged cells for Added Tasks */}
                                            {isFirstInGroup ? (
                                                <td
                                                    className="px-1 py-1 align-top"
                                                    rowSpan={rowspan}
                                                    style={{ width: columnWidths.addedTasks }}
                                                >
                                                    <AutoGrowTextarea
                                                        value={group.mergedData.addedTasks}
                                                        onChange={(e) => {
                                                            group.indices.forEach((idx) => {
                                                                updateScheduleRow(idx, {
                                                                    addedTasks: e.target.value,
                                                                })
                                                            })
                                                        }}
                                                        placeholder="Tasks added during the day"
                                                        className="text-xs w-full"
                                                        style={{ minHeight: '32px' }}
                                                        rowspan={rowspan}
                                                        maxRows={10}
                                                    />
                                                </td>
                                            ) : null}
                                            {/* Merged cells for Notes */}
                                            {isFirstInGroup ? (
                                                <td
                                                    className="px-1 py-1 align-top"
                                                    rowSpan={rowspan}
                                                    style={{ width: columnWidths.notes }}
                                                >
                                                    <AutoGrowTextarea
                                                        value={group.mergedData.notes}
                                                        onChange={(e) => {
                                                            group.indices.forEach((idx) => {
                                                                updateScheduleRow(idx, {
                                                                    notes: e.target.value,
                                                                })
                                                            })
                                                        }}
                                                        placeholder="Notes / gate codes / extra instructions"
                                                        className="text-xs w-full"
                                                        style={{ minHeight: '32px' }}
                                                        rowspan={rowspan}
                                                        maxRows={10}
                                                    />
                                                </td>
                                            ) : null}
                                            {/* Merged cells for Tasks Not Completed */}
                                            {isFirstInGroup ? (
                                                <td
                                                    className="px-1 py-1 align-top"
                                                    rowSpan={rowspan}
                                                    style={{ width: columnWidths.tasksNotCompleted }}
                                                >
                                                    <AutoGrowTextarea
                                                        value={group.mergedData.tasksNotCompleted}
                                                        onChange={(e) => {
                                                            group.indices.forEach((idx) => {
                                                                updateScheduleRow(idx, {
                                                                    tasksNotCompleted: e.target.value,
                                                                })
                                                            })
                                                        }}
                                                        placeholder="What could not be completed"
                                                        className="text-xs w-full"
                                                        style={{ minHeight: '32px' }}
                                                        rowspan={rowspan}
                                                        maxRows={10}
                                                    />
                                                </td>
                                            ) : null}
                                            {/* Merged cells for Materials Needed */}
                                            {isFirstInGroup ? (
                                                <td
                                                    className="px-1 py-1 align-top"
                                                    rowSpan={rowspan}
                                                    style={{ width: columnWidths.materialsNeeded }}
                                                >
                                                    <AutoGrowTextarea
                                                        value={group.mergedData.materialsNeeded}
                                                        onChange={(e) => {
                                                            group.indices.forEach((idx) => {
                                                                updateScheduleRow(idx, {
                                                                    materialsNeeded: e.target.value,
                                                                })
                                                            })
                                                        }}
                                                        placeholder="Materials to pick up from shop"
                                                        className="text-xs w-full"
                                                        style={{ minHeight: '32px' }}
                                                        rowspan={rowspan}
                                                        maxRows={10}
                                                    />
                                                </td>
                                            ) : null}
                                            <td className="px-1 py-1 text-center align-middle" style={{ width: columnWidths.actions }}>
                                                <Button
                                                    size="sm"
                                                    variant="plain"
                                                    icon={<HiOutlineTrash />}
                                                    className="text-red-500 hover:text-red-600"
                                                    onClick={() => handleRemoveScheduleRow(rowIndex)}
                                                />
                                            </td>
                                        </tr>
                                    )
                                })
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}

export default ScheduleTab


