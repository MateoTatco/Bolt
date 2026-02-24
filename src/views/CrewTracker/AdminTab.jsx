import React, { useState, useEffect } from 'react'
import { Card, Button, Input } from '@/components/ui'
import { FirebaseDbService } from '@/services/FirebaseDbService'
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineSave } from 'react-icons/hi'
import { toast } from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'

const DEFAULT_NO_WORK_MSG = 'No scheduled work today. Check back tomorrow. Questions? Contact your supervisor.'

const AdminTab = () => {
    const [regions, setRegions] = useState([])
    const [costCodes, setCostCodes] = useState([])
    const [skillSets, setSkillSets] = useState([])
    const [config, setConfig] = useState({ noWorkTodayMessage: DEFAULT_NO_WORK_MSG, scheduleSmsTemplate: '' })
    const [loading, setLoading] = useState(true)
    const [savingConfig, setSavingConfig] = useState(false)

    // Inline add state
    const [newRegionName, setNewRegionName] = useState('')
    const [newCostCode, setNewCostCode] = useState('')
    const [newCostCodeDesc, setNewCostCodeDesc] = useState('')
    const [newSkillName, setNewSkillName] = useState('')
    const [editingRegionId, setEditingRegionId] = useState(null)
    const [editingRegionName, setEditingRegionName] = useState('')
    const [editingCostCodeId, setEditingCostCodeId] = useState(null)
    const [editingCostCode, setEditingCostCode] = useState('')
    const [editingCostCodeDesc, setEditingCostCodeDesc] = useState('')
    const [editingSkillId, setEditingSkillId] = useState(null)
    const [editingSkillName, setEditingSkillName] = useState('')

    const loadAll = async () => {
        setLoading(true)
        try {
            const [rRes, cRes, sRes, cfgRes] = await Promise.all([
                FirebaseDbService.crewRegions.getAll(),
                FirebaseDbService.crewCostCodes.getAll(),
                FirebaseDbService.crewSkillSets.getAll(),
                FirebaseDbService.crewConfig.get(),
            ])
            if (rRes.success) setRegions(rRes.data || [])
            if (cRes.success) setCostCodes(cRes.data || [])
            if (sRes.success) setSkillSets(sRes.data || [])
            if (cfgRes.success) setConfig(cfgRes.data || { noWorkTodayMessage: DEFAULT_NO_WORK_MSG, scheduleSmsTemplate: '' })
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadAll()
    }, [])

    const handleAddRegion = async () => {
        const name = (newRegionName || '').trim()
        if (!name) return
        const res = await FirebaseDbService.crewRegions.create({ name })
        if (res.success) {
            setRegions((prev) => [...prev, { id: res.data.id, name }].sort((a, b) => a.name.localeCompare(b.name)))
            setNewRegionName('')
            toast.push(React.createElement(Notification, { type: 'success', duration: 2500, title: 'Added' }, 'Region added.'))
        } else {
            toast.push(React.createElement(Notification, { type: 'danger', duration: 3000, title: 'Error' }, res.error))
        }
    }

    const handleUpdateRegion = async () => {
        if (!editingRegionId) return
        const name = (editingRegionName || '').trim()
        if (!name) return
        const res = await FirebaseDbService.crewRegions.update(editingRegionId, { name })
        if (res.success) {
            setRegions((prev) => prev.map((r) => (r.id === editingRegionId ? { ...r, name } : r)).sort((a, b) => a.name.localeCompare(b.name)))
            setEditingRegionId(null)
            toast.push(React.createElement(Notification, { type: 'success', duration: 2500, title: 'Updated' }, 'Region updated.'))
        } else {
            toast.push(React.createElement(Notification, { type: 'danger', duration: 3000, title: 'Error' }, res.error))
        }
    }

    const handleDeleteRegion = async (id) => {
        if (!window.confirm('Remove this region? Crew members using it will keep the value until edited.')) return
        const res = await FirebaseDbService.crewRegions.delete(id)
        if (res.success) {
            setRegions((prev) => prev.filter((r) => r.id !== id))
            if (editingRegionId === id) setEditingRegionId(null)
            toast.push(React.createElement(Notification, { type: 'success', duration: 2500, title: 'Removed' }, 'Region removed.'))
        } else {
            toast.push(React.createElement(Notification, { type: 'danger', duration: 3000, title: 'Error' }, res.error))
        }
    }

    const handleAddCostCode = async () => {
        const code = (newCostCode || '').trim()
        if (!code) return
        const res = await FirebaseDbService.crewCostCodes.create({ code, description: (newCostCodeDesc || '').trim() })
        if (res.success) {
            setCostCodes((prev) => [...prev, { id: res.data.id, code, description: (newCostCodeDesc || '').trim() }].sort((a, b) => a.code.localeCompare(b.code)))
            setNewCostCode('')
            setNewCostCodeDesc('')
            toast.push(React.createElement(Notification, { type: 'success', duration: 2500, title: 'Added' }, 'Cost code added.'))
        } else {
            toast.push(React.createElement(Notification, { type: 'danger', duration: 3000, title: 'Error' }, res.error))
        }
    }

    const handleUpdateCostCode = async () => {
        if (!editingCostCodeId) return
        const code = (editingCostCode || '').trim()
        if (!code) return
        const res = await FirebaseDbService.crewCostCodes.update(editingCostCodeId, { code, description: (editingCostCodeDesc || '').trim() })
        if (res.success) {
            setCostCodes((prev) =>
                prev.map((c) => (c.id === editingCostCodeId ? { ...c, code, description: (editingCostCodeDesc || '').trim() } : c)).sort((a, b) => a.code.localeCompare(b.code))
            )
            setEditingCostCodeId(null)
            toast.push(React.createElement(Notification, { type: 'success', duration: 2500, title: 'Updated' }, 'Cost code updated.'))
        } else {
            toast.push(React.createElement(Notification, { type: 'danger', duration: 3000, title: 'Error' }, res.error))
        }
    }

    const handleDeleteCostCode = async (id) => {
        if (!window.confirm('Remove this cost code?')) return
        const res = await FirebaseDbService.crewCostCodes.delete(id)
        if (res.success) {
            setCostCodes((prev) => prev.filter((c) => c.id !== id))
            if (editingCostCodeId === id) setEditingCostCodeId(null)
            toast.push(React.createElement(Notification, { type: 'success', duration: 2500, title: 'Removed' }, 'Cost code removed.'))
        } else {
            toast.push(React.createElement(Notification, { type: 'danger', duration: 3000, title: 'Error' }, res.error))
        }
    }

    const handleAddSkillSet = async () => {
        const name = (newSkillName || '').trim()
        if (!name) return
        const res = await FirebaseDbService.crewSkillSets.create({ name })
        if (res.success) {
            setSkillSets((prev) => [...prev, { id: res.data.id, name }].sort((a, b) => a.name.localeCompare(b.name)))
            setNewSkillName('')
            toast.push(React.createElement(Notification, { type: 'success', duration: 2500, title: 'Added' }, 'Skill set added.'))
        } else {
            toast.push(React.createElement(Notification, { type: 'danger', duration: 3000, title: 'Error' }, res.error))
        }
    }

    const handleUpdateSkillSet = async () => {
        if (!editingSkillId) return
        const name = (editingSkillName || '').trim()
        if (!name) return
        const res = await FirebaseDbService.crewSkillSets.update(editingSkillId, { name })
        if (res.success) {
            setSkillSets((prev) => prev.map((s) => (s.id === editingSkillId ? { ...s, name } : s)).sort((a, b) => a.name.localeCompare(b.name)))
            setEditingSkillId(null)
            toast.push(React.createElement(Notification, { type: 'success', duration: 2500, title: 'Updated' }, 'Skill set updated.'))
        } else {
            toast.push(React.createElement(Notification, { type: 'danger', duration: 3000, title: 'Error' }, res.error))
        }
    }

    const handleDeleteSkillSet = async (id) => {
        if (!window.confirm('Remove this skill set? Crew members using it will keep the value until edited.')) return
        const res = await FirebaseDbService.crewSkillSets.delete(id)
        if (res.success) {
            setSkillSets((prev) => prev.filter((s) => s.id !== id))
            if (editingSkillId === id) setEditingSkillId(null)
            toast.push(React.createElement(Notification, { type: 'success', duration: 2500, title: 'Removed' }, 'Skill set removed.'))
        } else {
            toast.push(React.createElement(Notification, { type: 'danger', duration: 3000, title: 'Error' }, res.error))
        }
    }

    const handleSaveConfig = async () => {
        setSavingConfig(true)
        try {
            const res = await FirebaseDbService.crewConfig.set({
                noWorkTodayMessage: config.noWorkTodayMessage || DEFAULT_NO_WORK_MSG,
                scheduleSmsTemplate: config.scheduleSmsTemplate || '',
            })
            if (res.success) {
                toast.push(React.createElement(Notification, { type: 'success', duration: 2500, title: 'Saved' }, 'Message templates saved.'))
            } else {
                toast.push(React.createElement(Notification, { type: 'danger', duration: 3000, title: 'Error' }, res.error))
            }
        } finally {
            setSavingConfig(false)
        }
    }

    if (loading) {
        return (
            <div className="p-4">
                <p className="text-gray-500 dark:text-gray-400">Loading admin settings…</p>
            </div>
        )
    }

    return (
        <div className="p-4 space-y-6">
            <Card className="p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Regions (location)</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Used as the crew member location/region dropdown.</p>
                <div className="flex flex-wrap gap-2 mb-3">
                    <Input
                        placeholder="Region name"
                        value={newRegionName}
                        onChange={(e) => setNewRegionName(e.target.value)}
                        className="max-w-xs"
                    />
                    <Button size="sm" icon={<HiOutlinePlus />} onClick={handleAddRegion}>
                        Add
                    </Button>
                </div>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-2 font-medium text-gray-700 dark:text-gray-300">Name</th>
                            <th className="w-24" />
                        </tr>
                    </thead>
                    <tbody>
                        {regions.map((r) => (
                            <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800">
                                <td className="py-2">
                                    {editingRegionId === r.id ? (
                                        <Input
                                            value={editingRegionName}
                                            onChange={(e) => setEditingRegionName(e.target.value)}
                                            className="max-w-xs"
                                            size="sm"
                                        />
                                    ) : (
                                        <span className="text-gray-900 dark:text-white">{r.name}</span>
                                    )}
                                </td>
                                <td className="py-2">
                                    {editingRegionId === r.id ? (
                                        <>
                                            <Button size="xs" className="mr-1" onClick={handleUpdateRegion}>Save</Button>
                                            <Button size="xs" variant="plain" onClick={() => setEditingRegionId(null)}>Cancel</Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button size="xs" variant="plain" icon={<HiOutlinePencil />} onClick={() => { setEditingRegionId(r.id); setEditingRegionName(r.name || '') }} />
                                            <Button size="xs" variant="plain" icon={<HiOutlineTrash />} className="text-red-600" onClick={() => handleDeleteRegion(r.id)} />
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>

            <Card className="p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Cost codes</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Used in the schedule cost code column.</p>
                <div className="flex flex-wrap gap-2 mb-3">
                    <Input placeholder="Code" value={newCostCode} onChange={(e) => setNewCostCode(e.target.value)} className="max-w-[120px]" />
                    <Input placeholder="Description (optional)" value={newCostCodeDesc} onChange={(e) => setNewCostCodeDesc(e.target.value)} className="max-w-xs" />
                    <Button size="sm" icon={<HiOutlinePlus />} onClick={handleAddCostCode}>Add</Button>
                </div>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-2 font-medium text-gray-700 dark:text-gray-300">Code</th>
                            <th className="text-left py-2 font-medium text-gray-700 dark:text-gray-300">Description</th>
                            <th className="w-24" />
                        </tr>
                    </thead>
                    <tbody>
                        {costCodes.map((c) => (
                            <tr key={c.id} className="border-b border-gray-100 dark:border-gray-800">
                                <td className="py-2">
                                    {editingCostCodeId === c.id ? (
                                        <Input value={editingCostCode} onChange={(e) => setEditingCostCode(e.target.value)} className="max-w-[120px]" size="sm" />
                                    ) : (
                                        <span className="text-gray-900 dark:text-white">{c.code}</span>
                                    )}
                                </td>
                                <td className="py-2">
                                    {editingCostCodeId === c.id ? (
                                        <Input value={editingCostCodeDesc} onChange={(e) => setEditingCostCodeDesc(e.target.value)} className="max-w-xs" size="sm" />
                                    ) : (
                                        <span className="text-gray-600 dark:text-gray-400">{c.description || '—'}</span>
                                    )}
                                </td>
                                <td className="py-2">
                                    {editingCostCodeId === c.id ? (
                                        <>
                                            <Button size="xs" className="mr-1" onClick={handleUpdateCostCode}>Save</Button>
                                            <Button size="xs" variant="plain" onClick={() => setEditingCostCodeId(null)}>Cancel</Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button size="xs" variant="plain" icon={<HiOutlinePencil />} onClick={() => { setEditingCostCodeId(c.id); setEditingCostCode(c.code || ''); setEditingCostCodeDesc(c.description || '') }} />
                                            <Button size="xs" variant="plain" icon={<HiOutlineTrash />} className="text-red-600" onClick={() => handleDeleteCostCode(c.id)} />
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>

            <Card className="p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Skill sets</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Crew member skill set options; used in search and filters.</p>
                <div className="flex flex-wrap gap-2 mb-3">
                    <Input placeholder="Skill set name" value={newSkillName} onChange={(e) => setNewSkillName(e.target.value)} className="max-w-xs" />
                    <Button size="sm" icon={<HiOutlinePlus />} onClick={handleAddSkillSet}>Add</Button>
                </div>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-2 font-medium text-gray-700 dark:text-gray-300">Name</th>
                            <th className="w-24" />
                        </tr>
                    </thead>
                    <tbody>
                        {skillSets.map((s) => (
                            <tr key={s.id} className="border-b border-gray-100 dark:border-gray-800">
                                <td className="py-2">
                                    {editingSkillId === s.id ? (
                                        <Input value={editingSkillName} onChange={(e) => setEditingSkillName(e.target.value)} className="max-w-xs" size="sm" />
                                    ) : (
                                        <span className="text-gray-900 dark:text-white">{s.name}</span>
                                    )}
                                </td>
                                <td className="py-2">
                                    {editingSkillId === s.id ? (
                                        <>
                                            <Button size="xs" className="mr-1" onClick={handleUpdateSkillSet}>Save</Button>
                                            <Button size="xs" variant="plain" onClick={() => setEditingSkillId(null)}>Cancel</Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button size="xs" variant="plain" icon={<HiOutlinePencil />} onClick={() => { setEditingSkillId(s.id); setEditingSkillName(s.name || '') }} />
                                            <Button size="xs" variant="plain" icon={<HiOutlineTrash />} className="text-red-600" onClick={() => handleDeleteSkillSet(s.id)} />
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>

            <Card className="p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Message templates</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Used when sending &quot;no work today&quot; and optionally for schedule SMS.</p>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">No work today message</label>
                        <textarea
                            className="w-full min-h-[80px] input input-textarea text-sm"
                            value={config.noWorkTodayMessage || ''}
                            onChange={(e) => setConfig((prev) => ({ ...prev, noWorkTodayMessage: e.target.value }))}
                            placeholder={DEFAULT_NO_WORK_MSG}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Schedule SMS template (optional)</label>
                        <textarea
                            className="w-full min-h-[60px] input input-textarea text-sm"
                            value={config.scheduleSmsTemplate || ''}
                            onChange={(e) => setConfig((prev) => ({ ...prev, scheduleSmsTemplate: e.target.value }))}
                            placeholder="Leave blank to use default schedule message content."
                        />
                    </div>
                    <Button size="sm" icon={<HiOutlineSave />} onClick={handleSaveConfig} loading={savingConfig}>
                        Save message templates
                    </Button>
                </div>
            </Card>
        </div>
    )
}

export default AdminTab
