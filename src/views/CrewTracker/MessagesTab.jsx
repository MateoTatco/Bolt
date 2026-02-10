import React, { useMemo, useState } from 'react'
import { Alert, Button, Input } from '@/components/ui'
import {
    HiOutlineChatAlt2,
    HiOutlineClock,
    HiOutlineExclamationCircle,
} from 'react-icons/hi'

const MessagesTab = ({
    messageHistory,
    messageHistoryLoading,
    messageHistoryError,
    formatDateOnly,
}) => {
    // Build per-employee threads from message history
    const threads = useMemo(() => {
        if (!Array.isArray(messageHistory)) return []

        const map = new Map()

        messageHistory.forEach((msg) => {
            const employeeId = msg.employeeId
            if (!employeeId) return // skip batch summary docs

            const key = employeeId
            const existing = map.get(key)

            const sentAtTs = msg.sentAt || msg.date
            let sentAtDate = null
            if (sentAtTs?.toDate) {
                sentAtDate = sentAtTs.toDate()
            } else if (sentAtTs instanceof Date) {
                sentAtDate = sentAtTs
            } else if (typeof sentAtTs === 'string') {
                const d = new Date(sentAtTs)
                sentAtDate = Number.isNaN(d.getTime()) ? null : d
            }

            const candidateTime = sentAtDate || new Date(0)
            const lastText =
                msg.body ||
                msg.tasks ||
                msg.notes ||
                msg.jobName ||
                ''

            if (!existing || candidateTime > existing.lastMessageAt) {
                map.set(key, {
                    employeeId,
                    employeeName: msg.employeeName || 'Unknown employee',
                    phone: msg.phone || '',
                    lastMessageText: lastText,
                    lastMessageAt: candidateTime,
                })
            }
        })

        return Array.from(map.values()).sort(
            (a, b) => b.lastMessageAt - a.lastMessageAt,
        )
    }, [messageHistory])

    const [selectedEmployeeId, setSelectedEmployeeId] = useState(
        () => (threads[0] && threads[0].employeeId) || null,
    )

    // Keep selection in sync if threads change
    React.useEffect(() => {
        if (!threads.length) {
            setSelectedEmployeeId(null)
            return
        }
        const exists = threads.some(
            (t) => t.employeeId === selectedEmployeeId,
        )
        if (!exists) {
            setSelectedEmployeeId(threads[0].employeeId)
        }
    }, [threads, selectedEmployeeId])

    const activeThread = useMemo(
        () => threads.find((t) => t.employeeId === selectedEmployeeId) || null,
        [threads, selectedEmployeeId],
    )

    const threadMessages = useMemo(() => {
        if (!selectedEmployeeId) return []
        const msgs = (messageHistory || []).filter(
            (msg) => msg.employeeId === selectedEmployeeId,
        )

        return msgs.sort((a, b) => {
            const aTs = a.sentAt || a.date
            const bTs = b.sentAt || b.date

            const aTime = aTs?.toDate
                ? aTs.toDate().getTime()
                : aTs instanceof Date
                ? aTs.getTime()
                : 0
            const bTime = bTs?.toDate
                ? bTs.toDate().getTime()
                : bTs instanceof Date
                ? bTs.getTime()
                : 0

            return aTime - bTime
        })
    }, [messageHistory, selectedEmployeeId])

    const formatTime = (ts) => {
        if (!ts) return ''
        let d
        if (ts.toDate) d = ts.toDate()
        else if (ts instanceof Date) d = ts
        else if (typeof ts === 'string') {
            const parsed = new Date(ts)
            d = Number.isNaN(parsed.getTime()) ? null : parsed
        }
        if (!d) return ''
        return d.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
        })
    }

    const [replyText, setReplyText] = useState('')
    const [sending, setSending] = useState(false)
    const [sendError, setSendError] = useState('')
    const [sendSuccess, setSendSuccess] = useState('')

    const handleSendReply = async () => {
        if (!activeThread || !replyText.trim()) {
            return
        }
        setSending(true)
        setSendError('')
        setSendSuccess('')
        try {
            const { getFunctions, httpsCallable } = await import('firebase/functions')
            const functions = getFunctions()
            const sendDirect = httpsCallable(functions, 'sendCrewDirectMessage')
            await sendDirect({
                employeeId: activeThread.employeeId,
                body: replyText.trim(),
            })
            setReplyText('')
            setSendSuccess('Message sent')
        } catch (error) {
            console.error('Failed to send direct crew message:', error)
            const msg = error?.message || error?.code || 'Failed to send message'
            setSendError(msg)
        } finally {
            setSending(false)
        }
    }

    return (
        <div className="pt-4 h-[calc(100vh-200px)] flex flex-col">
            <div className="flex items-start gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <HiOutlineChatAlt2 className="text-xl" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Crew messages
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        View conversations with your crew. New threads are created automatically
                        whenever you send SMS from the schedule or messaging tools.
                    </p>
                </div>
            </div>

            {(messageHistoryError || sendError || sendSuccess) && (
                <div className="mb-3">
                    {messageHistoryError && (
                        <Alert type="danger" showIcon>
                            {messageHistoryError}
                        </Alert>
                    )}
                    {sendError && (
                        <Alert type="danger" showIcon>
                            {sendError}
                        </Alert>
                    )}
                    {sendSuccess && (
                        <Alert type="success" showIcon>
                            {sendSuccess}
                        </Alert>
                    )}
                </div>
            )}

            <div className="flex flex-1 min-h-0 border border-primary/20 dark:border-primary/40 rounded-lg overflow-hidden bg-white dark:bg-gray-900/60 shadow-sm">
                {/* Chat panel */}
                <div className="flex-1 flex flex-col min-w-0">
                    {(!threads.length && !messageHistoryLoading) && (
                        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center bg-gradient-to-b from-primary/5 to-transparent dark:from-primary/15">
                            <HiOutlineExclamationCircle className="mb-2 text-3xl text-primary/60 dark:text-primary/70" />
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                No crew messages yet
                            </p>
                            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300 max-w-sm">
                                Once you start sending job assignments, individual conversations
                                with each employee will appear here.
                            </p>
                        </div>
                    )}

                    {threads.length > 0 && activeThread && (
                        <>
                            {/* Chat header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-primary/15 dark:border-primary/40 bg-primary/5 dark:bg-primary/20">
                                <div>
                                    <div className="font-medium text-sm text-gray-900 dark:text-white">
                                        {activeThread.employeeName}
                                    </div>
                                    {activeThread.phone && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {activeThread.phone}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-200">
                                    <HiOutlineClock className="text-sm" />
                                    <span>
                                        Last message:{' '}
                                        {formatDateOnly(activeThread.lastMessageAt) || ''}{' '}
                                        {formatTime(activeThread.lastMessageAt) || ''}
                                    </span>
                                </div>
                            </div>

                            {/* Messages list */}
                            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2 bg-gradient-to-b from-primary/5 via-gray-50/80 to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
                                {threadMessages.map((msg) => {
                                    const isOutbound = msg.direction === 'outbound'
                                    const sentAt = msg.sentAt || msg.date

                                    const primaryText =
                                        msg.body ||
                                        msg.tasks ||
                                        msg.notes ||
                                        msg.jobName ||
                                        ''

                                    const secondaryParts = []
                                    if (msg.jobName && !primaryText.includes(msg.jobName)) {
                                        secondaryParts.push(`Job: ${msg.jobName}`)
                                    }
                                    if (msg.jobAddress) {
                                        secondaryParts.push(msg.jobAddress)
                                    }

                                    return (
                                        <div
                                            key={msg.id}
                                            className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs shadow-sm ${
                                                    isOutbound
                                                        ? 'bg-primary text-white rounded-br-sm'
                                                        : 'bg-white/95 dark:bg-gray-900/90 text-gray-900 dark:text-gray-100 rounded-bl-sm border border-primary/10 dark:border-primary/25'
                                                }`}
                                            >
                                                {primaryText && (
                                                    <div className="whitespace-pre-line leading-relaxed">
                                                        {primaryText}
                                                    </div>
                                                )}
                                                {secondaryParts.length > 0 && (
                                                    <div className="mt-1 text-[10px] text-primary-100/90 dark:text-primary-100/90">
                                                        {secondaryParts.join(' · ')}
                                                    </div>
                                                )}
                                                <div
                                                    className={`mt-1 text-[10px] flex justify-end ${
                                                        isOutbound
                                                            ? 'text-white/85'
                                                            : 'text-gray-500 dark:text-gray-300'
                                                    }`}
                                                >
                                                    <span>
                                                        {formatTime(sentAt)}{' '}
                                                        {formatDateOnly(sentAt)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Reply input */}
                            <div className="border-t border-gray-200 dark:border-gray-800 px-3 py-2 bg-white/90 dark:bg-gray-900/80">
                                <div className="flex items-end gap-2">
                                    <div className="flex-1">
                                        <Input
                                            textArea
                                            rows={2}
                                            placeholder={`Message ${activeThread.employeeName}...`}
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                        />
                                    </div>
                                    <Button
                                        variant="solid"
                                        size="sm"
                                        disabled={!replyText.trim() || sending}
                                        loading={sending}
                                        onClick={handleSendReply}
                                    >
                                        Send
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Thread list (right sidebar) */}
                <div className="w-72 border-l border-gray-200 dark:border-gray-800 bg-gradient-to-b from-primary/10 via-white to-white dark:from-primary/20 dark:via-gray-900 dark:to-gray-900 flex flex-col">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-primary/20 dark:border-primary/40 bg-primary/10 dark:bg-primary/25">
                        <div className="flex items-center gap-2 text-xs font-semibold text-primary-700 dark:text-primary-100">
                            <HiOutlineChatAlt2 className="text-sm" />
                            <span>Conversations</span>
                        </div>
                        {messageHistoryLoading && (
                            <span className="text-[10px] text-primary-800/80 dark:text-primary-100/80">
                                Loading...
                            </span>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {threads.map((thread) => {
                            const isActive = thread.employeeId === selectedEmployeeId
                            return (
                                <button
                                    key={thread.employeeId}
                                    type="button"
                                    onClick={() => setSelectedEmployeeId(thread.employeeId)}
                                    className={`w-full text-left px-3 py-2 border-b border-gray-100/80 dark:border-gray-800 hover:bg-primary/5 dark:hover:bg-primary/20 focus:outline-none transition-colors ${
                                        isActive ? 'bg-primary/15 dark:bg-primary/30' : ''
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="text-xs font-medium text-gray-900 dark:text-white truncate">
                                                {thread.employeeName}
                                            </div>
                                            {thread.lastMessageText && (
                                                <div className="text-[11px] text-gray-600 dark:text-gray-300 truncate">
                                                    {thread.lastMessageText}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-[10px] text-gray-500 dark:text-gray-300">
                                                {formatTime(thread.lastMessageAt)}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MessagesTab