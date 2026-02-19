import React, { useMemo, useRef, useEffect, useState } from 'react'
import { Button, DatePicker, Alert, Input, Select, Tag, Tooltip, Dialog, Card } from '@/components/ui'
import Chart from '@/components/shared/Chart'
import {
    HiOutlineClock,
    HiOutlineChatAlt2,
    HiOutlineDownload,
    HiOutlineRefresh,
    HiOutlineTrash,
    HiOutlineSearch,
    HiOutlineX,
    HiOutlineDuplicate,
    HiOutlinePlus,
    HiOutlineUserGroup,
    HiOutlineBriefcase,
    HiOutlineSave,
} from 'react-icons/hi'

// Auto-grow textarea helper component
const AutoGrowTextarea = ({
    value,
    onChange,
    placeholder,
    className,
    style,
    rowspan = 1,
    maxRows = 10,
    onFocus,
    ...rest
}) => {
    const textareaRef = useRef(null)

    useEffect(() => {
        const textarea = textareaRef.current
        if (!textarea) return

        textarea.style.height = 'auto'

        // Approximate base height of a single schedule row so merged cells
        // visually fill the total height of all merged rows.
        const baseRowHeight = 40
        const lineHeight = 20
        const baseMinHeight = baseRowHeight
        const effectiveRowspan = rowspan || 1
        const minHeight = baseMinHeight * effectiveRowspan
        const maxHeight = maxRows * lineHeight * effectiveRowspan

        let newHeight = Math.max(minHeight, textarea.scrollHeight)

        newHeight = Math.min(newHeight, maxHeight)

        textarea.style.height = `${newHeight}px`
        textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
    }, [value, rowspan, maxRows])

    return (
        <textarea
            ref={textareaRef}
            value={value || ''}
            onChange={onChange}
            onFocus={onFocus}
            placeholder={placeholder}
            className={`input input-sm input-textarea ${className || ''}`}
            style={{
                ...style,
                overflow: 'hidden',
                resize: 'none',
                width: '100%',
            }}
            {...rest}
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
    employees,
    jobOptionsForSchedule,
    updateScheduleRow,
    handleRemoveScheduleRow,
    handleInsertScheduleSeparatorBelow,
    jobs,
    showDuplicateDayModal,
    setShowDuplicateDayModal,
    duplicateTargetDate,
    setDuplicateTargetDate,
    handleDuplicateDay,
    duplicatingDay,
    formatDateOnly,
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
    const [activeView, setActiveView] = useState('schedule') // 'schedule' | 'exceptions' | 'summary'
    const [highlightedRowIds, setHighlightedRowIds] = useState([])
    const [exceptionAttentionSet, setExceptionAttentionSet] = useState(new Set()) // 'rowKey-fieldName' until user focuses
    const [visibleColumns, setVisibleColumns] = useState({
        employee: true,
        costCode: true,
        w2Hours: true,
        job: true,
        address: true,
        scheduledTasks: true,
        addedTasks: true,
        notes: true,
        tasksNotCompleted: true,
        materialsNeeded: true,
        actions: true,
    })
    const [scheduleSearchText, setScheduleSearchText] = useState('')
    const [separatorControl, setSeparatorControl] = useState({
        rowIndex: null,
        value: '3',
    })
    const [selectedSmsRowIds, setSelectedSmsRowIds] = useState([])

    // Base employee options with rich display name
    const allEmployeeOptions = useMemo(
        () =>
            (employees || []).map((emp) => {
                const first = (emp.firstName || '').trim()
                const last = (emp.lastName || '').trim()
                const nickname = (emp.nickname || '').trim()
                const base =
                    (first || last)
                        ? `${first} ${last}`.trim()
                        : (emp.name || nickname || 'Unnamed')

                const isOffToday = (() => {
                    const ranges = emp.timeOffRanges || []
                    if (!ranges.length) return false
                    let jsDate
                    if (scheduleDate?.toDate) jsDate = scheduleDate.toDate()
                    else if (scheduleDate instanceof Date) jsDate = scheduleDate
                    else jsDate = new Date(scheduleDate)
                    jsDate.setHours(0, 0, 0, 0)
                    return ranges.some((r) => {
                        if (!r || (!r.start && !r.end)) return false
                        let start = r.start
                        let end = r.end
                        if (start?.toDate) start = start.toDate()
                        else if (typeof start === 'string') start = new Date(start)
                        if (end?.toDate) end = end.toDate()
                        else if (typeof end === 'string') end = new Date(end)
                        const startMs = start ? new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime() : null
                        const endMs = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() : null
                        const dMs = jsDate.getTime()
                        if (startMs !== null && dMs < startMs) return false
                        if (endMs !== null && dMs > endMs) return false
                        return true
                    })
                })()

                const labelBase = nickname && (first || last)
                    ? `${base} (${nickname})`
                    : base

                return {
                    value: emp.id,
                    label: isOffToday ? `${labelBase} — ⏸️ Time off` : labelBase,
                    isOffToday,
                    disabled: false, // Still allow selection but show visual indicator
                }
            }),
        [employees, scheduleDate],
    )

    // Employees already scheduled for this date (for uniqueness)
    const usedEmployeeIds = useMemo(
        () =>
            new Set(
                (scheduleAssignments || [])
                    .map((row) => row.employeeId)
                    .filter(Boolean),
            ),
        [scheduleAssignments],
    )

    // Filter schedule assignments based on search text
    const filteredScheduleAssignments = useMemo(() => {
        if (!scheduleSearchText.trim()) {
            return scheduleAssignments
        }
        
        const searchLower = scheduleSearchText.toLowerCase().trim()
        return scheduleAssignments.filter(row => {
            const employeeName = (row.employeeName || '').toLowerCase()
            const jobName = (row.jobName || '').toLowerCase()
            const jobAddress = (row.jobAddress || '').toLowerCase()
            const scheduledTasks = (row.scheduledTasks || '').toLowerCase()
            const addedTasks = (row.addedTasks || '').toLowerCase()
            const notes = (row.notes || '').toLowerCase()
            const tasksNotCompleted = (row.tasksNotCompleted || '').toLowerCase()
            const materialsNeeded = (row.materialsNeeded || '').toLowerCase()
            const costCode = (row.costCode || '').toLowerCase()
            
            return employeeName.includes(searchLower) ||
                   jobName.includes(searchLower) ||
                   jobAddress.includes(searchLower) ||
                   scheduledTasks.includes(searchLower) ||
                   addedTasks.includes(searchLower) ||
                   notes.includes(searchLower) ||
                   tasksNotCompleted.includes(searchLower) ||
                   materialsNeeded.includes(searchLower) ||
                   costCode.includes(searchLower)
        })
    }, [scheduleAssignments, scheduleSearchText])

    // Helper: Group rows by jobId and calculate rowspans for merged cells
    const groupedRows = useMemo(() => {
        const groups = []
        const processed = new Set()

        filteredScheduleAssignments.forEach((row, index) => {
            // Skip rows with no job or explicitly unmerged
            if (processed.has(index) || !row.jobId || row.unmergedFromJob) {
                return
            }

            const group = [index]
            for (let i = index + 1; i < filteredScheduleAssignments.length; i++) {
                if (
                    filteredScheduleAssignments[i].jobId === row.jobId &&
                    !filteredScheduleAssignments[i].unmergedFromJob
                ) {
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
                        jobAddress: filteredScheduleAssignments[group[0]].jobAddress || '',
                        scheduledTasks: filteredScheduleAssignments[group[0]].scheduledTasks || '',
                        addedTasks: filteredScheduleAssignments[group[0]].addedTasks || '',
                        notes: filteredScheduleAssignments[group[0]].notes || '',
                        tasksNotCompleted: filteredScheduleAssignments[group[0]].tasksNotCompleted || '',
                        materialsNeeded: filteredScheduleAssignments[group[0]].materialsNeeded || '',
                    },
                })
            }
        })

        filteredScheduleAssignments.forEach((row, index) => {
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
    }, [filteredScheduleAssignments])

    // Exceptions list: any group with deviations that haven't been acknowledged
    const exceptions = useMemo(() => {
        return groupedRows
            .map((group) => {
                const firstIndex = group.indices[0]
                const row = filteredScheduleAssignments[firstIndex]
                const hasDeviation =
                    (group.mergedData.addedTasks && group.mergedData.addedTasks.trim() !== '') ||
                    (group.mergedData.notes && group.mergedData.notes.trim() !== '') ||
                    (group.mergedData.tasksNotCompleted &&
                        group.mergedData.tasksNotCompleted.trim() !== '')

                const allAcknowledged = group.indices.every(
                    (idx) => filteredScheduleAssignments[idx]?.exceptionAcknowledged,
                )

                return {
                    group,
                    row,
                    hasDeviation,
                    allAcknowledged,
                }
            })
            .filter((item) => item.hasDeviation && !item.allAcknowledged)
    }, [groupedRows, filteredScheduleAssignments])

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

    const toggleColumn = (key) => {
        setVisibleColumns((prev) => ({
            ...prev,
            [key]: !prev[key],
        }))
    }

    const visibleMinWidth = useMemo(() => {
        return Object.entries(columnWidths).reduce((sum, [key, width]) => {
            if (visibleColumns[key] === false) return sum
            return sum + width
        }, 0)
    }, [columnWidths, visibleColumns])

    const handleAcknowledgeException = (group) => {
        group.indices.forEach((idx) => {
            updateScheduleRow(idx, { exceptionAcknowledged: true })
        })
    }

    const handleClearException = (group) => {
        group.indices.forEach((idx) => {
            updateScheduleRow(idx, {
                addedTasks: '',
                notes: '',
                tasksNotCompleted: '',
            })
        })
    }

    const scrollToGroup = (group) => {
        const rowIds = group.indices
            .map((idx) => {
                const r = filteredScheduleAssignments[idx]
                return r ? r.id || String(idx) : null
            })
            .filter(Boolean)

        const firstIndex = group.indices[0]
        const firstRow = filteredScheduleAssignments[firstIndex]
        const rowKey = firstRow?.id || String(firstIndex)

        // Switch back to schedule view and scroll the first row into view
        setActiveView('schedule')

        // Give React a tick to render the schedule table
        setTimeout(() => {
            const el = document.querySelector(`[data-row-id="${rowKey}"]`)
            if (el && el.scrollIntoView) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
        }, 50)

        // Highlight row backgrounds (longer duration); exception fields get persistent border+dot until focus
        if (rowIds.length > 0) {
            setHighlightedRowIds(rowIds)
            setTimeout(() => {
                setHighlightedRowIds([])
            }, 7000)
        }
        const firstRowKey = firstRow?.id || String(firstIndex)
        const fieldsWithContent = ['addedTasks', 'notes', 'tasksNotCompleted'].filter(
            (f) => group.mergedData[f] && String(group.mergedData[f]).trim() !== '',
        )
        if (fieldsWithContent.length > 0) {
            setExceptionAttentionSet((prev) => {
                const next = new Set(prev)
                fieldsWithContent.forEach((f) => next.add(`${firstRowKey}-${f}`))
                return next
            })
        }
    }

    const clearExceptionAttention = (firstRowKey, field) => {
        setExceptionAttentionSet((prev) => {
            const next = new Set(prev)
            next.delete(`${firstRowKey}-${field}`)
            return next
        })
    }

    const handleUnmergeRow = (rowIndex) => {
        updateScheduleRow(rowIndex, { unmergedFromJob: true })
    }

    // When date changes, default back to Schedule view so exceptions never look "stuck"
    useEffect(() => {
        setActiveView('schedule')
    }, [scheduleDate])

    // Persist column visibility per browser/user
    useEffect(() => {
        try {
            const stored = localStorage.getItem('crewScheduleVisibleColumns')
            if (stored) {
                const parsed = JSON.parse(stored)
                setVisibleColumns((prev) => ({ ...prev, ...parsed }))
            }
        } catch {
            // ignore
        }
        // run once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        try {
            localStorage.setItem('crewScheduleVisibleColumns', JSON.stringify(visibleColumns))
        } catch {
            // ignore
        }
    }, [visibleColumns])

    // Ensure there is always at least one completely empty row for adding new assignments
    useEffect(() => {
        const hasEmptyRow = scheduleAssignments.some((row) => {
            return (
                !row.employeeId &&
                !row.jobId &&
                !row.costCode &&
                !row.w2Hours &&
                !row.scheduledTasks &&
                !row.addedTasks &&
                !row.notes &&
                !row.tasksNotCompleted &&
                !row.materialsNeeded
            )
        })

        if (!hasEmptyRow) {
            handleAddScheduleRow()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scheduleAssignments])

    // Simple counts for header KPI
    const totalActiveEmployees = useMemo(
        () => (employees || []).filter((e) => e.active !== false).length,
        [employees],
    )
    const scheduledCount = useMemo(
        () => (scheduleAssignments || []).filter((row) => row.employeeId).length,
        [scheduleAssignments],
    )

    // Simple per-job summary for KPI view
    const jobSummaries = useMemo(() => {
        const map = new Map()
        ;(scheduleAssignments || []).forEach((row) => {
            if (!row.jobId) return
            const key = row.jobId
            if (!map.has(key)) {
                const job = jobs.find((j) => j.id === row.jobId)
                map.set(key, {
                    jobId: row.jobId,
                    jobName: job?.name || row.jobName || 'Job',
                    jobAddress: job?.address || row.jobAddress || '',
                    employeeCount: 0,
                })
            }
            const entry = map.get(key)
            if (row.employeeId) {
                entry.employeeCount += 1
            }
        })
        return Array.from(map.values()).sort((a, b) =>
            a.jobName.localeCompare(b.jobName),
        )
    }, [scheduleAssignments, jobs])

    return (
        <div className="pt-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <HiOutlineClock className="text-xl" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Daily crew schedule
                        </h2>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                            {scheduledCount} scheduled / {totalActiveEmployees} active employees
                        </p>
                    </div>
                </div>
                <div className="flex-1 max-w-md flex justify-end">
                    <Input
                        placeholder="Search schedule by employee, job, address, tasks, notes..."
                        value={scheduleSearchText}
                        onChange={(e) => setScheduleSearchText(e.target.value)}
                        prefix={<HiOutlineSearch className="text-gray-400" />}
                        className="max-w-md"
                    />
                    {scheduleSearchText && (
                        <Button
                            variant="plain"
                            size="sm"
                            icon={<HiOutlineX />}
                            onClick={() => setScheduleSearchText('')}
                            className="ml-2"
                        >
                            Clear
                        </Button>
                    )}
                </div>
            </div>
            {scheduleSearchText && (
                <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
                    Showing {filteredScheduleAssignments.length} of {scheduleAssignments.length} rows
                </p>
            )}

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
                        size="sm"
                        variant="twoTone"
                        icon={<HiOutlineRefresh />}
                        loading={scheduleLoading}
                        onClick={() => {
                            setScheduleDate(new Date(scheduleDate))
                        }}
                    >
                        <span className="hidden sm:inline">Reload</span>
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        icon={<HiOutlineDuplicate />}
                        onClick={() => setShowDuplicateDayModal(true)}
                    >
                        <span className="hidden sm:inline">Duplicate Day</span>
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        icon={<HiOutlineDownload />}
                        onClick={handleExportScheduleToExcel}
                    >
                        <span className="hidden sm:inline">Export</span>
                    </Button>
                    <Button
                        size="sm"
                        variant="solid"
                        icon={<HiOutlineChatAlt2 />}
                        loading={sendingMessages}
                        disabled={sendingMessages}
                        onClick={() => handleSendScheduleMessages(selectedSmsRowIds)}
                    >
                        <span className="hidden sm:inline">Send SMS</span>
                    </Button>
                </div>
            </div>

            {/* View & column controls */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-50 dark:bg-gray-800/60">
                    <button
                        type="button"
                        onClick={() => setActiveView('schedule')}
                        className={`px-3 py-1 text-xs sm:text-sm rounded-md ${
                            activeView === 'schedule'
                                ? 'bg-white dark:bg-gray-900 text-primary shadow-sm'
                                : 'text-gray-600 dark:text-gray-300'
                        }`}
                    >
                        Schedule
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveView('exceptions')}
                        className={`px-3 py-1 text-xs sm:text-sm rounded-md inline-flex items-center gap-1 ${
                            activeView === 'exceptions'
                                ? 'bg-white dark:bg-gray-900 text-primary shadow-sm'
                                : 'text-gray-600 dark:text-gray-300'
                        }`}
                    >
                        Exceptions
                        <Tag className="text-[10px] sm:text-xs bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700">
                            {exceptions.length}
                        </Tag>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveView('summary')}
                        className={`px-3 py-1 text-xs sm:text-sm rounded-md ${
                            activeView === 'summary'
                                ? 'bg-white dark:bg-gray-900 text-primary shadow-sm'
                                : 'text-gray-600 dark:text-gray-300'
                        }`}
                    >
                        Summary
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Columns:</span>
                    {['costCode', 'w2Hours', 'address', 'scheduledTasks', 'addedTasks', 'notes', 'tasksNotCompleted', 'materialsNeeded'].map(
                        (key) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => toggleColumn(key)}
                                className={`px-2 py-1 rounded-full border text-xs ${
                                    visibleColumns[key]
                                        ? 'bg-primary/10 text-primary border-primary/30'
                                        : 'bg-transparent text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600'
                                }`}
                            >
                                {key === 'costCode' && 'Cost Code'}
                                {key === 'w2Hours' && 'W2 Hours'}
                                {key === 'address' && 'Address'}
                                {key === 'scheduledTasks' && 'Scheduled Tasks'}
                                {key === 'addedTasks' && 'Added Tasks'}
                                {key === 'notes' && 'Notes'}
                                {key === 'tasksNotCompleted' && 'Tasks Not Completed'}
                                {key === 'materialsNeeded' && 'Materials Needed'}
                            </button>
                        ),
                    )}
                </div>
            </div>

            {activeView === 'exceptions' && (
                <div className="border border-indigo-200 dark:border-indigo-800 rounded-lg bg-indigo-50/70 dark:bg-indigo-900/20 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                                Exceptions needing review
                            </h3>
                            <p className="text-xs text-indigo-800/80 dark:text-indigo-200/80">
                                Added Tasks, Notes, or Tasks Not Completed that were entered in the
                                schedule but haven&apos;t been acknowledged yet.
                            </p>
                        </div>
                    </div>

                    {exceptions.length === 0 ? (
                        <p className="text-xs text-indigo-800/70 dark:text-indigo-200/80">
                            No pending exceptions for this date.
                        </p>
                    ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                            {exceptions.map(({ group, row }, idx) => {
                                const job = jobs.find((j) => j.id === row.jobId)
                                const jobLabel = job?.name || row.jobName || 'Job'
                                const address = job?.address || group.mergedData.jobAddress || ''
                                return (
                                    <div
                                        key={`${row.id || row.jobId || 'group'}-${idx}`}
                                        className="flex items-start justify-between gap-4 rounded-md bg-white dark:bg-gray-900/70 border border-indigo-100 dark:border-indigo-800 px-3 py-2 cursor-pointer hover:bg-indigo-50/80 dark:hover:bg-indigo-900/40"
                                        onClick={() => scrollToGroup(group)}
                                    >
                                        <div className="space-y-1 text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-gray-900 dark:text-gray-50">
                                                    {jobLabel}
                                                </span>
                                                <Tag className="text-[10px] bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700">
                                                    {group.indices.length} row
                                                    {group.indices.length > 1 ? 's' : ''}
                                                </Tag>
                                            </div>
                                            {address && (
                                                <div className="text-[11px] text-gray-600 dark:text-gray-300">
                                                    {address}
                                                </div>
                                            )}
                                            {group.mergedData.addedTasks && (
                                                <div className="mt-1">
                                                    <span className="font-semibold text-indigo-900 dark:text-indigo-100">
                                                        Added Tasks:{' '}
                                                    </span>
                                                    <span className="text-gray-800 dark:text-gray-100">
                                                        {group.mergedData.addedTasks}
                                                    </span>
                                                </div>
                                            )}
                                            {group.mergedData.notes && (
                                                <div>
                                                    <span className="font-semibold text-indigo-900 dark:text-indigo-100">
                                                        Notes:{' '}
                                                    </span>
                                                    <span className="text-gray-800 dark:text-gray-100">
                                                        {group.mergedData.notes}
                                                    </span>
                                                </div>
                                            )}
                                            {group.mergedData.tasksNotCompleted && (
                                                <div>
                                                    <span className="font-semibold text-indigo-900 dark:text-indigo-100">
                                                        Tasks Not Completed:{' '}
                                                    </span>
                                                    <span className="text-gray-800 dark:text-gray-100">
                                                        {group.mergedData.tasksNotCompleted}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end justify-between gap-2">
                                            <div className="flex gap-2 mt-1">
                                                <Button
                                                    size="xs"
                                                    variant="twoTone"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleAcknowledgeException(group)
                                                    }}
                                                >
                                                    Mark reviewed
                                                </Button>
                                                <Button
                                                    size="xs"
                                                    variant="plain"
                                                    className="text-red-500 hover:text-red-600"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleClearException(group)
                                                    }}
                                                >
                                                    Clear note
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {activeView === 'summary' && (
                <div className="space-y-4">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Card className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Scheduled</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                        {scheduledCount}
                                    </p>
                                </div>
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                    <HiOutlineUserGroup className="text-2xl text-primary" />
                                </div>
                            </div>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Active Employees</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                        {totalActiveEmployees}
                                    </p>
                                </div>
                                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                    <HiOutlineUserGroup className="text-2xl text-green-600 dark:text-green-400" />
                                </div>
                            </div>
                        </Card>
                        <Card className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Active Jobs</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                        {jobSummaries.length}
                                    </p>
                                </div>
                                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                    <HiOutlineBriefcase className="text-2xl text-blue-600 dark:text-blue-400" />
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Charts */}
                    {jobSummaries.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <Card className="p-4">
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                                    Employees per Job
                                </h3>
                                <Chart
                                    type="bar"
                                    series={[
                                        {
                                            name: 'Employees',
                                            data: jobSummaries.map((job) => job.employeeCount),
                                        },
                                    ]}
                                    xAxis={jobSummaries.map((job) => job.jobName)}
                                    height={300}
                                    customOptions={{
                                        chart: {
                                            toolbar: { show: false },
                                        },
                                        colors: ['#3b82f6'],
                                        dataLabels: {
                                            enabled: true,
                                        },
                                    }}
                                />
                            </Card>
                            <Card className="p-4">
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                                    Job Distribution
                                </h3>
                                <Chart
                                    type="donut"
                                    series={jobSummaries.map((job) => job.employeeCount)}
                                    height={300}
                                    customOptions={{
                                        labels: jobSummaries.map((job) => job.jobName),
                                        legend: {
                                            position: 'bottom',
                                        },
                                    }}
                                />
                            </Card>
                        </div>
                    )}

                    {/* Job Details Table */}
                    <Card className="p-4">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                            Job Details
                        </h3>
                        {jobSummaries.length === 0 ? (
                            <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-8">
                                No scheduled assignments yet. Add rows in the schedule view to see per-job counts.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-700">
                                            <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">
                                                Job Name
                                            </th>
                                            <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">
                                                Address
                                            </th>
                                            <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">
                                                Employees
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {jobSummaries.map((job) => (
                                            <tr
                                                key={job.jobId}
                                                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                            >
                                                <td className="py-3 px-3 text-gray-900 dark:text-white font-medium">
                                                    {job.jobName}
                                                </td>
                                                <td className="py-3 px-3 text-gray-600 dark:text-gray-400">
                                                    {job.jobAddress || '-'}
                                                </td>
                                                <td className="py-3 px-3 text-right">
                                                    <Tag className="bg-primary/10 text-primary border-primary/20">
                                                        {job.employeeCount}
                                                    </Tag>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {activeView === 'schedule' && (
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
                            minWidth: `${visibleMinWidth}px`,
                        }}
                    >
                        <thead className="bg-gray-50 dark:bg-gray-800/60">
                            <tr>
                                {visibleColumns.employee && (
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
                                )}
                                {visibleColumns.costCode && (
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
                                )}
                                {visibleColumns.w2Hours && (
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
                                )}
                                {visibleColumns.job && (
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
                                )}
                                {visibleColumns.address && (
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
                                )}
                                {visibleColumns.scheduledTasks && (
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
                                )}
                                {visibleColumns.addedTasks && (
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
                                )}
                                {visibleColumns.notes && (
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
                                )}
                                {visibleColumns.tasksNotCompleted && (
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
                                )}
                                {visibleColumns.materialsNeeded && (
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
                                )}
                                {visibleColumns.actions && (
                                    <th
                                    className="px-2 py-2 text-center font-semibold text-gray-700 dark:text-gray-200 relative text-xs sm:text-sm"
                                    style={{ width: columnWidths.actions }}
                                >
                                    Actions
                                </th>
                                )}
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
                                    const row = filteredScheduleAssignments[rowIndex]
                                    const job = jobs.find((j) => j.id === row.jobId)
                                    const jobAddress = job?.address || group.mergedData.jobAddress || ''
                                    const mapsUrl =
                                        jobAddress &&
                                        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                            jobAddress,
                                        )}`

                                    const isFirstInGroup = idxInGroup === 0
                                    const rowspan = isFirstInGroup ? group.rowspan : 0
                                    const rowKey = row.id || String(rowIndex)
                                    const isHighlighted = highlightedRowIds.includes(rowKey)
                                    const firstRowKey = filteredScheduleAssignments[group.indices[0]]?.id || String(group.indices[0])

                                    return (
                                        <tr
                                            key={rowKey}
                                            data-row-id={rowKey}
                                            data-row-index={rowIndex}
                                            className={`align-top ${isHighlighted ? 'schedule-row-highlight' : ''}`}
                                        >
                                            {visibleColumns.employee && (
                                                <td className="px-1 py-1" style={{ width: columnWidths.employee }}>
                                                    <Select
                                                        placeholder="Employee"
                                                        options={allEmployeeOptions.filter((opt) =>
                                                            opt.value === row.employeeId ||
                                                            !usedEmployeeIds.has(opt.value),
                                                        )}
                                                        value={
                                                            allEmployeeOptions.find(
                                                                (opt) => opt.value === row.employeeId,
                                                            ) || null
                                                        }
                                                        onChange={(option) =>
                                                            updateScheduleRow(rowIndex, {
                                                                employeeId: option ? option.value : '',
                                                            })
                                                        }
                                                        formatOptionLabel={(option) => (
                                                            <span className={option.isOffToday ? 'text-orange-600 dark:text-orange-400 font-medium' : ''}>
                                                                {option.label}
                                                            </span>
                                                        )}
                                                        menuPortalTarget={document.body}
                                                        menuPosition="fixed"
                                                        menuPlacement="auto"
                                                        styles={{
                                                            menuPortal: (provided) => ({
                                                                ...provided,
                                                                zIndex: 10000,
                                                            }),
                                                            menu: (provided, state) => {
                                                                // Detect if near bottom of viewport
                                                                const selectElement = state.selectProps.menuPortalTarget?.querySelector(`[id*="react-select"]`)
                                                                if (selectElement) {
                                                                    const rect = selectElement.getBoundingClientRect()
                                                                    const viewportHeight = window.innerHeight
                                                                    const spaceBelow = viewportHeight - rect.bottom
                                                                    const spaceAbove = rect.top
                                                                    // If less than 300px below and more space above, open upward
                                                                    if (spaceBelow < 300 && spaceAbove > spaceBelow) {
                                                                        return {
                                                                            ...provided,
                                                                            bottom: `${viewportHeight - rect.top}px`,
                                                                            top: 'auto',
                                                                        }
                                                                    }
                                                                }
                                                                return provided
                                                            },
                                                            option: (provided, state) => ({
                                                                ...provided,
                                                                backgroundColor: state.data?.isOffToday && state.isFocused
                                                                    ? 'rgba(251, 146, 60, 0.1)'
                                                                    : state.isSelected
                                                                    ? provided.backgroundColor
                                                                    : provided.backgroundColor,
                                                                color: state.data?.isOffToday
                                                                    ? 'rgb(234, 88, 12)'
                                                                    : provided.color,
                                                            }),
                                                            singleValue: (provided, state) => ({
                                                                ...provided,
                                                                color: state.data?.isOffToday
                                                                    ? 'rgb(234, 88, 12)'
                                                                    : provided.color,
                                                            }),
                                                        }}
                                                    />
                                                </td>
                                            )}
                                            {visibleColumns.costCode && (
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
                                            )}
                                            {visibleColumns.w2Hours && (
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
                                            )}
                                            {visibleColumns.job && (
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
                                            )}
                                            {/* Merged cells for Address */}
                                            {isFirstInGroup && visibleColumns.address ? (
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
                                            {isFirstInGroup && visibleColumns.scheduledTasks ? (
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
                                            {isFirstInGroup && visibleColumns.addedTasks ? (
                                                <td
                                                    className="px-1 py-1 align-top"
                                                    rowSpan={rowspan}
                                                    style={{ width: columnWidths.addedTasks }}
                                                >
                                                    <div className="relative">
                                                        {exceptionAttentionSet.has(`${firstRowKey}-addedTasks`) && (
                                                            <span
                                                                className="absolute top-1.5 right-1.5 z-10 w-2 h-2 rounded-full schedule-exception-field-dot"
                                                                aria-hidden
                                                            />
                                                        )}
                                                        <AutoGrowTextarea
                                                            value={group.mergedData.addedTasks}
                                                            onChange={(e) => {
                                                                group.indices.forEach((idx) => {
                                                                    updateScheduleRow(idx, {
                                                                        addedTasks: e.target.value,
                                                                    })
                                                                })
                                                            }}
                                                            onFocus={() => clearExceptionAttention(firstRowKey, 'addedTasks')}
                                                            placeholder="Tasks added during the day"
                                                            className={`text-xs w-full ${exceptionAttentionSet.has(`${firstRowKey}-addedTasks`) ? 'schedule-exception-field' : ''}`}
                                                            style={{ minHeight: '32px' }}
                                                            rowspan={rowspan}
                                                            maxRows={10}
                                                        />
                                                    </div>
                                                </td>
                                            ) : null}
                                            {/* Merged cells for Notes */}
                                            {isFirstInGroup && visibleColumns.notes ? (
                                                <td
                                                    className="px-1 py-1 align-top"
                                                    rowSpan={rowspan}
                                                    style={{ width: columnWidths.notes }}
                                                >
                                                    <div className="relative">
                                                        {exceptionAttentionSet.has(`${firstRowKey}-notes`) && (
                                                            <span
                                                                className="absolute top-1.5 right-1.5 z-10 w-2 h-2 rounded-full schedule-exception-field-dot"
                                                                aria-hidden
                                                            />
                                                        )}
                                                        <AutoGrowTextarea
                                                            value={group.mergedData.notes}
                                                            onChange={(e) => {
                                                                group.indices.forEach((idx) => {
                                                                    updateScheduleRow(idx, {
                                                                        notes: e.target.value,
                                                                    })
                                                                })
                                                            }}
                                                            onFocus={() => clearExceptionAttention(firstRowKey, 'notes')}
                                                            placeholder="Notes / gate codes / extra instructions"
                                                            className={`text-xs w-full ${exceptionAttentionSet.has(`${firstRowKey}-notes`) ? 'schedule-exception-field' : ''}`}
                                                            style={{ minHeight: '32px' }}
                                                            rowspan={rowspan}
                                                            maxRows={10}
                                                        />
                                                    </div>
                                                </td>
                                            ) : null}
                                            {/* Merged cells for Tasks Not Completed */}
                                            {isFirstInGroup && visibleColumns.tasksNotCompleted ? (
                                                <td
                                                    className="px-1 py-1 align-top"
                                                    rowSpan={rowspan}
                                                    style={{ width: columnWidths.tasksNotCompleted }}
                                                >
                                                    <div className="relative">
                                                        {exceptionAttentionSet.has(`${firstRowKey}-tasksNotCompleted`) && (
                                                            <span
                                                                className="absolute top-1.5 right-1.5 z-10 w-2 h-2 rounded-full schedule-exception-field-dot"
                                                                aria-hidden
                                                            />
                                                        )}
                                                        <AutoGrowTextarea
                                                            value={group.mergedData.tasksNotCompleted}
                                                            onChange={(e) => {
                                                                group.indices.forEach((idx) => {
                                                                    updateScheduleRow(idx, {
                                                                        tasksNotCompleted: e.target.value,
                                                                    })
                                                                })
                                                            }}
                                                            onFocus={() => clearExceptionAttention(firstRowKey, 'tasksNotCompleted')}
                                                            placeholder="What could not be completed"
                                                            className={`text-xs w-full ${exceptionAttentionSet.has(`${firstRowKey}-tasksNotCompleted`) ? 'schedule-exception-field' : ''}`}
                                                            style={{ minHeight: '32px' }}
                                                            rowspan={rowspan}
                                                            maxRows={10}
                                                        />
                                                    </div>
                                                </td>
                                            ) : null}
                                            {/* Merged cells for Materials Needed */}
                                            {isFirstInGroup && visibleColumns.materialsNeeded ? (
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
                                            {visibleColumns.actions && (
                                                <td
                                                    className="px-1 py-1 text-center align-middle"
                                                    style={{ width: columnWidths.actions }}
                                                >
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Tooltip title="Include this row when sending SMS from the schedule">
                                                            <input
                                                                type="checkbox"
                                                                className="h-3 w-3 cursor-pointer"
                                                                checked={selectedSmsRowIds.includes(row.id)}
                                                                onChange={(e) => {
                                                                    const checked = e.target.checked
                                                                    setSelectedSmsRowIds((prev) => {
                                                                        if (checked) {
                                                                            if (!prev.includes(row.id)) {
                                                                                return [...prev, row.id]
                                                                            }
                                                                            return prev
                                                                        }
                                                                        return prev.filter((id) => id !== row.id)
                                                                    })
                                                                }}
                                                            />
                                                        </Tooltip>
                                                        {group.rowspan > 1 && !row.unmergedFromJob && (
                                                            <Tooltip title="Unmerge this job group for this row">
                                                                <Button
                                                                    size="xs"
                                                                    variant="plain"
                                                                    className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
                                                                    onClick={() => handleUnmergeRow(rowIndex)}
                                                                >
                                                                    ⇢
                                                                </Button>
                                                            </Tooltip>
                                                        )}
                                                        {separatorControl.rowIndex === rowIndex ? (
                                                            <div className="flex items-center gap-1">
                                                                <Input
                                                                    type="number"
                                                                    min={1}
                                                                    className="w-14 text-xs px-1 py-0.5"
                                                                    value={separatorControl.value}
                                                                    autoFocus
                                                                    onChange={(e) => {
                                                                        const val = e.target.value.replace(/[^0-9]/g, '')
                                                                        setSeparatorControl((prev) => ({
                                                                            ...prev,
                                                                            value: val,
                                                                        }))
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            const count = parseInt(separatorControl.value, 10)
                                                                            if (!isNaN(count) && count > 0) {
                                                                                handleInsertScheduleSeparatorBelow(rowIndex, count)
                                                                                // Show a brief visual feedback
                                                                                setTimeout(() => {
                                                                                    const rowEl = document.querySelector(
                                                                                        `[data-row-index="${rowIndex}"]`,
                                                                                    )
                                                                                    if (rowEl) {
                                                                                        rowEl.classList.add(
                                                                                            'bg-blue-50',
                                                                                            'dark:bg-blue-900/20',
                                                                                        )
                                                                                        setTimeout(() => {
                                                                                            rowEl.classList.remove(
                                                                                                'bg-blue-50',
                                                                                                'dark:bg-blue-900/20',
                                                                                            )
                                                                                        }, 1000)
                                                                                    }
                                                                                }, 100)
                                                                            }
                                                                            setSeparatorControl({ rowIndex: null, value: '3' })
                                                                        }
                                                                        if (e.key === 'Escape') {
                                                                            setSeparatorControl({ rowIndex: null, value: '3' })
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <Tooltip title="Insert blank separator rows below this row (click to choose how many)">
                                                                <Button
                                                                    size="xs"
                                                                    variant="plain"
                                                                    icon={<HiOutlinePlus />}
                                                                    className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                                                    onClick={() => {
                                                                        setSeparatorControl({
                                                                            rowIndex,
                                                                            value: '3',
                                                                        })
                                                                    }}
                                                                />
                                                            </Tooltip>
                                                        )}
                                                        <Button
                                                            size="xs"
                                                            variant="plain"
                                                            icon={<HiOutlineTrash />}
                                                            className="text-red-500 hover:text-red-600"
                                                            onClick={() => handleRemoveScheduleRow(rowIndex)}
                                                        />
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    )
                                })
                            })}
                        </tbody>
                    </table>
                )}
            </div>
            )}

            {/* Duplicate Day Modal */}
            <Dialog
                isOpen={showDuplicateDayModal}
                onClose={() => {
                    setShowDuplicateDayModal(false)
                    setDuplicateTargetDate(null)
                }}
            >
                <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Duplicate Day</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Copy assignments from <strong>{formatDateOnly(scheduleDate)}</strong> to another date. This will copy Employee, Cost Code, Job, Address, and Scheduled Tasks (but not W2 Hours or Materials Needed).
                    </p>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Target Date (copy to)
                        </label>
                        <DatePicker
                            inputtable
                            inputtableBlurClose={false}
                            inputFormat="MM/DD/YYYY"
                            value={duplicateTargetDate}
                            onChange={(date) => setDuplicateTargetDate(date)}
                            minDate={new Date(new Date(scheduleDate).setDate(new Date(scheduleDate).getDate() + 1))}
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Select a date after {formatDateOnly(scheduleDate)} to copy assignments to.
                        </p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="plain"
                            onClick={() => {
                                setShowDuplicateDayModal(false)
                                setDuplicateTargetDate(null)
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="solid"
                            loading={duplicatingDay}
                            disabled={!duplicateTargetDate || duplicatingDay}
                            onClick={handleDuplicateDay}
                        >
                            Duplicate
                        </Button>
                    </div>
                </div>
            </Dialog>
        </div>
    )
}

export default ScheduleTab


