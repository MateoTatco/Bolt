import React, { useEffect, useMemo, useState } from 'react'
import { Timeline } from '@/components/ui'
import { db } from '@/configs/firebase.config'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'

const formatTime = (ts) => {
    try {
        const date = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null)
        if (!date) return ''
        return date.toLocaleString('en-US')
    } catch {
        return ''
    }
}

const getCollectionName = (entityType) => {
    if (entityType === 'warranty') return 'warranties'
    return `${entityType}s`
}

const IconForType = ({ type }) => {
    const base = 'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold'
    switch (type) {
        case 'upload':
            return <div className={`${base} bg-emerald-100 text-emerald-700`}>U</div>
        case 'delete':
            return <div className={`${base} bg-rose-100 text-rose-700`}>D</div>
        case 'rename':
        case 'update':
            return <div className={`${base} bg-amber-100 text-amber-700`}>E</div>
        case 'create':
            return <div className={`${base} bg-blue-100 text-blue-700`}>C</div>
        case 'reorder':
            return <div className={`${base} bg-purple-100 text-purple-700`}>R</div>
        default:
            return <div className={`${base} bg-gray-100 text-gray-700`}>I</div>
    }
}

const ActivityItem = ({ a }) => {
    return (
        <div className="flex gap-4">
            <div className="flex-1">
                <div className="bg-white dark:bg-gray-800 rounded-xl border p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                            <span className="font-semibold text-gray-900 dark:text-white">{a?.actor?.name || 'Someone'}</span> {a?.message}
                        </div>
                        <div className="text-xs text-gray-400">{formatTime(a?.createdAt)}</div>
                    </div>
                    {a?.metadata?.changes && (
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                            {(() => {
                                const entries = Object.entries(a.metadata.changes)
                                const maxItems = 3
                                const truncate = (v) => {
                                    const s = String(v ?? '—')
                                    return s.length > 120 ? s.slice(0, 117) + '…' : s
                                }
                                const visible = entries.slice(0, maxItems)
                                return (
                                    <>
                                        {visible.map(([field, [fromVal, toVal]]) => (
                                            <div key={field} className="flex items-center gap-2">
                                                <span className="font-medium text-gray-700 dark:text-gray-200">{field}:</span>
                                                <span className="line-through text-gray-400">{truncate(fromVal)}</span>
                                                <span className="text-gray-400">→</span>
                                                <span className="text-gray-700 dark:text-gray-200">{truncate(toVal)}</span>
                                            </div>
                                        ))}
                                        {entries.length > maxItems && (
                                            <div className="text-gray-400">+{entries.length - maxItems} more change(s)</div>
                                        )}
                                    </>
                                )
                            })()}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

const ActivitiesTimeline = ({ entityType, entityId }) => {
    const [activities, setActivities] = useState([])

    useEffect(() => {
        if (!entityId) return
        const collectionName = getCollectionName(entityType)
        const col = collection(db, collectionName, entityId, 'activities')
        const q = query(col, orderBy('createdAt', 'desc'))
        const unsub = onSnapshot(q, (snap) => {
            const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            setActivities(rows)
        })
        return () => unsub()
    }, [entityType, entityId])

    const grouped = useMemo(() => {
        const byDate = {}
        for (const a of activities) {
            const d = a?.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt ? new Date(a.createdAt) : new Date())
            const key = d.toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
            byDate[key] = byDate[key] || []
            byDate[key].push(a)
        }
        return byDate
    }, [activities])

    if (activities.length === 0) {
        return (
            <div className="text-center py-16 rounded-2xl bg-gray-50/50 dark:bg-gray-800/30">
                <p className="text-gray-500">No activity yet.</p>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {Object.entries(grouped).map(([dateLabel, items]) => (
                <div key={dateLabel} className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{dateLabel}</div>
                    <div className="space-y-4">
                        {items.map((a) => (
                            <ActivityItem key={a.id} a={a} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

export default ActivitiesTimeline


