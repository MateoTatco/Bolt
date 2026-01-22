import React, { useEffect, useMemo, useState, useRef } from 'react'
import { Button, Dialog, Input, Select, Tag, Tooltip, Avatar, Alert, Dropdown } from '@/components/ui'
import { HiOutlineViewGrid, HiOutlineViewList, HiOutlineDotsHorizontal, HiOutlineFolder, HiOutlineDocument, HiOutlineUpload, HiOutlineTrash, HiOutlinePencil, HiOutlineDownload, HiOutlineChevronRight, HiOutlineChevronLeft } from 'react-icons/hi'
import { db, storage } from '@/configs/firebase.config'
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, onSnapshot, serverTimestamp, getDocs, getDoc } from 'firebase/firestore'
import { ref as storageRef, uploadBytesResumable, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import logActivity from '@/utils/activityLogger'
import { notifyAttachmentAdded, notifyAttachmentDeleted, notifyWarrantyAttachment, getCurrentUserId, getUsersToNotify } from '@/utils/notificationHelper'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

// Root placeholder for breadcrumb
const rootNode = { id: 'root', name: 'Root', depth: 0 }

const bytesToHuman = (bytes) => {
    if (bytes === 0 || !bytes) return '0 B'
    const k = 1024
    const sizes = ['B','KB','MB','GB','TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k,i)).toFixed(1)} ${sizes[i]}`
}

const MAX_DEPTH = 5
const MAX_FILE_MB = 50

const formatUpdatedAt = (ts) => {
    try {
        if (!ts) return ''
        let d
        if (typeof ts === 'string') d = new Date(ts)
        else if (ts?.toDate) d = ts.toDate()
        else if (typeof ts?.seconds === 'number') d = new Date(ts.seconds * 1000)
        else d = new Date(ts)
        if (isNaN(d.getTime())) return ''
        return `${d.toLocaleDateString('en-US')} ${d.toLocaleTimeString('en-US')}`
    } catch {
        return ''
    }
}

// Helper to get collection name (handles irregular plurals)
const getCollectionName = (entityType) => {
    if (entityType === 'warranty') return 'warranties'
    return `${entityType}s`
}

const AttachmentsManager = ({ entityType, entityId }) => {
    const [view, setView] = useState('grid') // 'grid' | 'list'
    const [uploadOpen, setUploadOpen] = useState(false)
    const [currentFolderId, setCurrentFolderId] = useState('root')
    const [breadcrumb, setBreadcrumb] = useState([rootNode])
    const [folders, setFolders] = useState([])
    const [files, setFiles] = useState([])
    const [error, setError] = useState(null)
    const [renameTarget, setRenameTarget] = useState(null)
    const [renameValue, setRenameValue] = useState('')
    const [confirmDelete, setConfirmDelete] = useState(null)
    const [pendingUploads, setPendingUploads] = useState([]) // File list
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState([]) // {name, percent, cancel}
    const [newFolderOpen, setNewFolderOpen] = useState(false)
    const [newFolderName, setNewFolderName] = useState('')
    const fileInputRef = useRef(null)

    const collectionName = getCollectionName(entityType)

    const inFolder = useMemo(() => ({
        folders: folders.filter(f => f.parentId === currentFolderId),
        files: files.filter(f => f.parentId === currentFolderId)
    }), [folders, files, currentFolderId])

    // Live Firestore listeners (folders/files)
    useEffect(() => {
        if (!entityId) return
        // folders
        const foldersCol = collection(db, collectionName, entityId, 'folders')
        const filesCol = collection(db, collectionName, entityId, 'files')
        const unsubFolders = onSnapshot(foldersCol, (snap) => {
            const fs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            setFolders(fs)
        }, () => {})
        const unsubFiles = onSnapshot(filesCol, (snap) => {
            const fl = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            setFiles(fl)
        }, () => {})
        return () => {
            unsubFolders()
            unsubFiles()
        }
    }, [entityType, entityId])

    const openFolder = (folder) => {
        setCurrentFolderId(folder.id)
        setBreadcrumb(prev => [...prev, { id: folder.id, name: folder.name, depth: folder.depth }])
    }

    const goBack = () => {
        if (breadcrumb.length <= 1) return
        const next = [...breadcrumb]
        next.pop()
        setBreadcrumb(next)
        setCurrentFolderId(next[next.length - 1].id)
    }

    const onChooseFiles = (fileList) => {
        const arr = Array.from(fileList || [])
        const filtered = arr.filter(f => f.size <= MAX_FILE_MB * 1024 * 1024)
        setPendingUploads(prev => [...prev, ...filtered])
    }

    const ensureSignedIn = async () => {
        const auth = getAuth()
        if (auth.currentUser) return auth.currentUser
        try {
            const enableAnon = import.meta.env.VITE_ENABLE_ANON_SIGNIN === 'true' || import.meta.env.DEV
            if (!enableAnon) return auth.currentUser
            await signInAnonymously(auth)
            return auth.currentUser
        } catch (e) {
            // If sign-in is in-flight, wait for it
            await new Promise((resolve) => {
                const unsub = onAuthStateChanged(auth, () => { unsub(); resolve() })
            })
            return auth.currentUser
        }
    }

    const commitUpload = async () => {
        if (pendingUploads.length === 0) return
        setUploading(true)
        setError(null)
        const currentDepth = (breadcrumb[breadcrumb.length - 1]?.depth ?? 0)
        const progressState = pendingUploads.map(f => ({ name: f.name, percent: 0, cancel: null }))
        setUploadProgress(progressState)
        try {
            // Ensure we have an auth user before hitting Storage
            await ensureSignedIn()
            for (let i = 0; i < pendingUploads.length; i++) {
                const file = pendingUploads[i]
                const path = `${collectionName}/${entityId}/${currentFolderId}/${file.name}`
                const sRef = storageRef(storage, path)
                try {
                    // Preferred: resumable upload with progress
                    await new Promise((resolve, reject) => {
                        const task = uploadBytesResumable(sRef, file)
                        progressState[i].cancel = () => task.cancel()
                        task.on('state_changed', (snap) => {
                            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
                            setUploadProgress(prev => prev.map((p, idx) => idx === i ? { ...p, percent: pct } : p))
                        }, (err) => {
                            reject(err)
                        }, resolve)
                    })
                } catch (resumableErr) {
                    // Fallback: simple upload (avoids some preflight quirks)
                    await uploadBytes(sRef, file)
                }
                const url = await getDownloadURL(sRef)
                const meta = {
                    name: file.name,
                    size: file.size,
                    type: (file.name.split('.').pop() || '').toLowerCase(),
                    parentId: currentFolderId,
                    storagePath: path,
                    downloadURL: url,
                    entityType,
                    entityId,
                    depth: currentDepth,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                }
                await addDoc(collection(db, collectionName, entityId, 'files'), meta)
                await logActivity(entityType, entityId, {
                    type: 'upload',
                    message: `uploaded file ${file.name}`,
                    metadata: { path }
                })
                
                // Notify users about new attachment
                const currentUserId = getCurrentUserId()
                if (currentUserId) {
                    try {
                        // Get entity name
                        const entityDoc = await getDoc(doc(db, collectionName, entityId))
                        const entityData = entityDoc.data()
                        const entityName = entityData?.companyName || entityData?.clientName || entityData?.projectName || entityData?.ProjectName || `${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`
                        
                        // Use warranty-specific notification for warranties, generic for others
                        if (entityType === 'warranty') {
                            await notifyWarrantyAttachment({
                                warrantyId: entityId,
                                warrantyName: entityName,
                                fileName: file.name,
                                uploadedBy: currentUserId
                            })
                        } else {
                            // Get users to notify
                            const userIds = await getUsersToNotify(entityType, entityId)
                            
                            if (userIds.length > 0) {
                                await notifyAttachmentAdded({
                                    userIds,
                                    entityType,
                                    entityId,
                                    entityName,
                                    fileName: file.name,
                                    uploadedBy: currentUserId
                                })
                            }
                        }
                    } catch (notifyError) {
                        console.error('Error notifying about attachment:', notifyError)
                        // Don't fail the upload if notification fails
                    }
                }
            }
        } catch (e) {
            console.error('Upload failed:', e)
            setError('Upload failed. Please check your storage rules and try again.')
        } finally {
            setUploading(false)
            setPendingUploads([])
            setUploadProgress([])
            setUploadOpen(false)
        }
    }

    const startRename = (item, kind) => {
        setRenameTarget({ kind, id: item.id })
        setRenameValue(item.name)
    }

    const applyRename = async () => {
        if (!renameTarget) return
        try {
            if (renameTarget.kind === 'folder') {
                await updateDoc(doc(db, collectionName, entityId, 'folders', renameTarget.id), {
                    name: renameValue,
                    updatedAt: serverTimestamp(),
                })
                await logActivity(entityType, entityId, {
                    type: 'rename',
                    message: `renamed folder to ${renameValue}`,
                    metadata: { id: renameTarget.id }
                })
            } else {
                await updateDoc(doc(db, collectionName, entityId, 'files', renameTarget.id), {
                    name: renameValue,
                    updatedAt: serverTimestamp(),
                })
                await logActivity(entityType, entityId, {
                    type: 'rename',
                    message: `renamed file to ${renameValue}`,
                    metadata: { id: renameTarget.id }
                })
            }
        } catch (e) {
            console.error('Rename failed:', e)
            setError('Rename failed. Please try again.')
        } finally {
            setRenameTarget(null)
            setRenameValue('')
        }
    }

    const onDelete = (item, kind) => {
        setConfirmDelete({ kind, id: item.id, name: item.name })
    }

    const deleteFolderRecursive = async (folderId) => {
        // delete child files
        const filesQ = query(collection(db, collectionName, entityId, 'files'), where('parentId', '==', folderId))
        const filesSnap = await getDocs(filesQ)
        for (const d of filesSnap.docs) {
            const data = d.data()
            if (data?.storagePath) {
                try { await deleteObject(storageRef(storage, data.storagePath)) } catch {}
            }
            await deleteDoc(d.ref)
        }
        // find child folders and recurse
        const foldersQ = query(collection(db, collectionName, entityId, 'folders'), where('parentId', '==', folderId))
        const foldersSnap = await getDocs(foldersQ)
        for (const fd of foldersSnap.docs) {
            await deleteFolderRecursive(fd.id)
        }
        // finally delete this folder
        await deleteDoc(doc(db, collectionName, entityId, 'folders', folderId))
    }

    const confirmDeleteAction = async () => {
        if (!confirmDelete) return
        try {
            if (confirmDelete.kind === 'folder') {
                await deleteFolderRecursive(confirmDelete.id)
                await logActivity(entityType, entityId, {
                    type: 'delete',
                    message: `deleted folder ${confirmDelete.name}`,
                })
            } else {
                const fileDoc = files.find(f => f.id === confirmDelete.id)
                if (fileDoc?.storagePath) {
                    try { await deleteObject(storageRef(storage, fileDoc.storagePath)) } catch {}
                }
                await deleteDoc(doc(db, collectionName, entityId, 'files', confirmDelete.id))
                await logActivity(entityType, entityId, {
                    type: 'delete',
                    message: `deleted file ${confirmDelete.name}`,
                })
                
                // Notify users about attachment deletion
                const currentUserId = getCurrentUserId()
                if (currentUserId) {
                    try {
                        // Get entity name
                        const entityDoc = await getDoc(doc(db, collectionName, entityId))
                        const entityData = entityDoc.data()
                        const entityName = entityData?.companyName || entityData?.clientName || entityData?.projectName || entityData?.ProjectName || `${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`
                        
                        // Get users to notify
                        const userIds = await getUsersToNotify(entityType, entityId)
                        
                        if (userIds.length > 0) {
                            await notifyAttachmentDeleted({
                                userIds,
                                entityType,
                                entityId,
                                entityName,
                                fileName: confirmDelete.name,
                                deletedBy: currentUserId
                            })
                        }
                    } catch (notifyError) {
                        console.error('Error notifying about attachment deletion:', notifyError)
                        // Don't fail the deletion if notification fails
                    }
                }
            }
        } catch (e) {
            console.error('Delete failed:', e)
            setError('Delete failed. Please try again.')
        } finally {
            setConfirmDelete(null)
        }
    }

    const handleDownloadFile = async (file) => {
        try {
            // Prefer explicit downloadURL if present
            let url = file?.downloadURL
            const pathRef = file?.storagePath || file?.path
            if (!url && pathRef) {
                const sRef = storageRef(storage, pathRef)
                url = await getDownloadURL(sRef)
            }
            if (!url) {
                setError('File is not downloadable (no storage path). Upload a new version to enable download.')
                return
            }
            const res = await fetch(url)
            const blob = await res.blob()
            saveAs(blob, file.name)
        } catch (e) {
            console.error('Download failed:', e)
            setError('Download failed. Please try again.')
        }
    }

    const collectDescendantFiles = (folderId) => {
        const result = []
        const stack = [folderId]
        while (stack.length) {
            const fid = stack.pop()
            const childrenFolders = folders.filter(f => f.parentId === fid)
            childrenFolders.forEach(cf => stack.push(cf.id))
            const childrenFiles = files.filter(fl => fl.parentId === fid)
            result.push(...childrenFiles)
        }
        return result
    }

    const handleDownloadFolder = async (folder) => {
        try {
            const zip = new JSZip()
            const allFiles = collectDescendantFiles(folder.id)
            for (let i = 0; i < allFiles.length; i++) {
                const f = allFiles[i]
                const pathRef = f?.storagePath || f?.path
                if (!pathRef) continue
                try {
                    const sRef = storageRef(storage, pathRef)
                    const url = await getDownloadURL(sRef)
                    const res = await fetch(url)
                    const blob = await res.blob()
                    zip.file(f.name, blob)
                } catch {}
            }
            const content = await zip.generateAsync({ type: 'blob' })
            saveAs(content, `${folder.name || 'folder'}.zip`)
        } catch (e) {
            console.error('Folder download failed:', e)
        }
    }

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return
        const currentDepth = (breadcrumb[breadcrumb.length - 1]?.depth ?? 0)
        if (currentDepth + 1 > MAX_DEPTH) {
            setError(`Maximum folder depth (${MAX_DEPTH}) reached.`)
            return
        }
        try {
            await addDoc(collection(db, collectionName, entityId, 'folders'), {
                name: newFolderName.trim(),
                parentId: currentFolderId,
                depth: currentDepth + 1,
                size: 0,
                entityType,
                entityId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            })
            await logActivity(entityType, entityId, {
                type: 'create',
                message: `created folder ${newFolderName.trim()}`,
            })
            setNewFolderOpen(false)
            setNewFolderName('')
        } catch (e) {
            console.error('Create folder failed:', e)
            setError('Could not create folder. Please try again.')
        }
    }

    const HeaderActions = (
        <div className="grid grid-cols-2 md:flex md:items-center gap-2 w-full md:w-auto">
            <Button size="sm" variant={view === 'grid' ? 'solid' : 'twoTone'} icon={<HiOutlineViewGrid />} onClick={()=>setView('grid')} className="text-xs md:text-sm px-2 md:px-3 py-1.5 md:py-2 w-full md:w-auto">Grid</Button>
            <Button size="sm" variant={view === 'list' ? 'solid' : 'twoTone'} icon={<HiOutlineViewList />} onClick={()=>setView('list')} className="text-xs md:text-sm px-2 md:px-3 py-1.5 md:py-2 w-full md:w-auto">List</Button>
            {entityType !== 'warranty' && (
                <Button size="sm" variant="twoTone" onClick={()=>setNewFolderOpen(true)} className="text-xs md:text-sm px-2 md:px-3 py-1.5 md:py-2 w-full md:w-auto">New Folder</Button>
            )}
            <Button variant="solid" icon={<HiOutlineUpload />} onClick={()=>setUploadOpen(true)} className="text-xs md:text-sm px-2 md:px-3 py-1.5 md:py-2 w-full md:w-auto">Upload</Button>
        </div>
    )

    const renderFolderRow = (folder) => (
        <div key={folder.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg border shadow-sm hover:shadow-md">
            <div className="flex items-center gap-3 min-w-0">
                <HiOutlineFolder className="text-amber-500" />
                <div className="min-w-0">
                    <div className="font-medium truncate">{folder.name}</div>
                    <div className="text-xs text-gray-500">{bytesToHuman(folder.size)} • Updated {formatUpdatedAt(folder.updatedAt)}</div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button size="sm" variant="twoTone" onClick={()=>openFolder(folder)}>Open</Button>
                <Button size="sm" variant="plain" icon={<HiOutlineDownload />} onClick={()=>handleDownloadFolder(folder)} />
                <Button size="sm" variant="plain" icon={<HiOutlinePencil />} onClick={()=>startRename(folder,'folder')} />
                <Button size="sm" variant="plain" icon={<HiOutlineTrash />} className="text-red-600" onClick={()=>onDelete(folder,'folder')} />
            </div>
        </div>
    )

    const renderFileRow = (file) => (
        <div key={file.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg border shadow-sm hover:shadow-md">
            <div className="flex items-center gap-3 min-w-0">
                <HiOutlineDocument className="text-emerald-500" />
                <div className="min-w-0">
                    <div className="font-medium truncate">{file.name}</div>
                    <div className="text-xs text-gray-500">{file.type?.toUpperCase()} • {bytesToHuman(file.size)} • Updated {formatUpdatedAt(file.updatedAt)}</div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button size="sm" variant="plain" icon={<HiOutlineDownload />} onClick={()=>handleDownloadFile(file)} />
                <Button size="sm" variant="plain" icon={<HiOutlinePencil />} onClick={()=>startRename(file,'file')} />
                <Button size="sm" variant="plain" icon={<HiOutlineTrash />} className="text-red-600" onClick={()=>onDelete(file,'file')} />
            </div>
        </div>
    )

    const renderFolderCard = (folder) => (
        <div key={folder.id} className="p-3 md:p-4 bg-white dark:bg-gray-700 rounded-xl border shadow-sm hover:shadow-md cursor-pointer" onDoubleClick={()=>openFolder(folder)}>
            <div className="flex items-start justify-between">
                <HiOutlineFolder className="text-amber-500 text-lg md:text-xl" />
                <Dropdown placement="bottom-end" renderTitle={<Button size="sm" variant="plain" icon={<HiOutlineDotsHorizontal />} />}>
                    <Dropdown.Item onClick={()=>openFolder(folder)}>Open</Dropdown.Item>
                    <Dropdown.Item onClick={()=>handleDownloadFolder(folder)}>Download</Dropdown.Item>
                    <Dropdown.Item onClick={()=>startRename(folder,'folder')}>Rename</Dropdown.Item>
                    <Dropdown.Item onClick={()=>onDelete(folder,'folder')}>Delete</Dropdown.Item>
                </Dropdown>
            </div>
            <div className="mt-2 md:mt-3 font-medium text-sm md:text-base truncate">{folder.name}</div>
            <div className="text-xs text-gray-500 mt-1">{bytesToHuman(folder.size)}</div>
            <div className="mt-2 md:mt-3">
                <Button size="sm" variant="twoTone" onClick={()=>openFolder(folder)} className="text-xs md:text-sm">Open</Button>
            </div>
        </div>
    )

    const renderFileCard = (file) => (
        <div key={file.id} className="p-3 md:p-4 bg-white dark:bg-gray-700 rounded-xl border shadow-sm hover:shadow-md">
            <div className="flex items-start justify-between">
                <HiOutlineDocument className="text-emerald-500 text-lg md:text-xl" />
                <Dropdown placement="bottom-end" renderTitle={<Button size="sm" variant="plain" icon={<HiOutlineDotsHorizontal />} />}>
                    <Dropdown.Item onClick={()=>handleDownloadFile(file)} disabled={!file.path && !file.downloadURL}>Download</Dropdown.Item>
                    <Dropdown.Item onClick={()=>startRename(file,'file')}>Rename</Dropdown.Item>
                    <Dropdown.Item onClick={()=>onDelete(file,'file')}>Delete</Dropdown.Item>
                </Dropdown>
            </div>
            <div className="mt-2 md:mt-3 font-medium text-sm md:text-base truncate">{file.name}</div>
            <div className="text-xs text-gray-500 mt-1">{file.type?.toUpperCase()} • {bytesToHuman(file.size)}</div>
            <div className="mt-2 md:mt-3 flex gap-1.5 md:gap-2">
                <Button size="sm" variant="plain" icon={<HiOutlineDownload />} onClick={()=>handleDownloadFile(file)} className="text-xs" />
                <Button size="sm" variant="plain" icon={<HiOutlinePencil />} onClick={()=>startRename(file,'file')} className="text-xs" />
                <Button size="sm" variant="plain" icon={<HiOutlineTrash />} className="text-red-600 text-xs" onClick={()=>onDelete(file,'file')} />
            </div>
        </div>
    )

    return (
        <div className="space-y-4 md:space-y-6 overflow-x-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-0">
                <div className="flex items-center space-x-2 md:space-x-3">
                    <div className="w-1 h-6 md:h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                    <h2 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Attachments</h2>
                </div>
                {HeaderActions}
            </div>

            {/* Breadcrumb / Navigation */}
            {breadcrumb.length > 1 && (
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 md:gap-0 bg-gray-50/60 dark:bg-gray-800/30 rounded-xl px-3 md:px-4 py-2 overflow-x-auto">
                    <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-gray-600 dark:text-gray-300 min-w-0">
                        {breadcrumb.map((b, idx) => (
                            <React.Fragment key={b.id}>
                                <button
                                    className={`font-medium truncate ${idx === breadcrumb.length-1 ? 'text-gray-900 dark:text-white' : 'hover:text-primary'}`}
                                    onClick={() => {
                                        const targetIndex = idx
                                        const next = breadcrumb.slice(0, targetIndex + 1)
                                        setBreadcrumb(next)
                                        setCurrentFolderId(next[next.length - 1].id)
                                    }}
                                >
                                    {b.name}
                                </button>
                                {idx < breadcrumb.length-1 && <HiOutlineChevronRight className="flex-shrink-0" />}
                            </React.Fragment>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <Button size="sm" variant="twoTone" icon={<HiOutlineChevronLeft />} onClick={goBack} className="text-xs md:text-sm">
                            Back
                        </Button>
                    </div>
                </div>
            )}

            {/* Sections */}
            {(inFolder.folders.length === 0 && inFolder.files.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-gray-50/60 dark:bg-gray-800/30 rounded-xl">
                    <div className="text-lg font-medium text-gray-700 dark:text-gray-200 mb-2">This folder is empty</div>
                    <div className="text-sm text-gray-500 mb-4">Upload your first file{entityType !== 'warranty' ? ' or create a folder' : ''} to get started.</div>
                    <div className="flex items-center gap-2">
                        {entityType !== 'warranty' && (
                            <Button size="sm" variant="twoTone" onClick={()=>setNewFolderOpen(true)}>New Folder</Button>
                        )}
                        <Button size="sm" variant="solid" icon={<HiOutlineUpload />} onClick={()=>setUploadOpen(true)}>Upload</Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-8">
                    {inFolder.folders.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3">Folders</h3>
                            {view === 'list' ? (
                                <div className="space-y-2">
                                    {inFolder.folders.map(renderFolderRow)}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                                    {inFolder.folders.map(renderFolderCard)}
                                </div>
                            )}
                        </div>
                    )}
                    {inFolder.files.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-3">Files</h3>
                            {view === 'list' ? (
                                <div className="space-y-2">
                                    {inFolder.files.map(renderFileRow)}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                                    {inFolder.files.map(renderFileCard)}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {error && (
                <Alert type="danger" className="mb-2" onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Upload Dialog */}
            <Dialog isOpen={uploadOpen} onClose={()=>setUploadOpen(false)} width={600}>
                <div className="p-4 md:p-6">
                    <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Upload Files</h3>
                    <div 
                        className="border-2 border-dashed rounded-xl p-4 md:p-8 text-center mb-3 md:mb-4 transition hover:border-primary hover:bg-primary/5 cursor-pointer"
                        onDragOver={(e)=>{e.preventDefault();}}
                        onDrop={(e)=>{e.preventDefault(); onChooseFiles(e.dataTransfer.files)}}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <p className="text-sm md:text-base text-gray-600 mb-2">Drop your files here, or <span className="text-primary">browse</span></p>
                        <input 
                            ref={fileInputRef}
                            type="file" 
                            multiple 
                            onChange={(e)=>onChooseFiles(e.target.files)} 
                            className="hidden" 
                        />
                        <div className="text-xs text-gray-500 mt-2">Max {MAX_FILE_MB}MB per file</div>
                    </div>
                    {pendingUploads.length > 0 && !uploading && (
                        <div className="mb-4 text-sm text-gray-600">{pendingUploads.length} file(s) ready</div>
                    )}
                    {uploading && (
                        <div className="space-y-2 mb-4">
                            {uploadProgress.map((p)=> (
                                <div key={p.name} className="flex items-center justify-between text-sm">
                                    <span className="truncate mr-3">{p.name}</span>
                                    <span>{p.percent}%</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex flex-col-reverse md:flex-row justify-end gap-2">
                        <Button variant="twoTone" onClick={()=>setUploadOpen(false)} disabled={uploading} className="w-full md:w-auto text-sm">Close</Button>
                        {!uploading && (
                            <Button variant="solid" onClick={commitUpload} disabled={pendingUploads.length===0} className="w-full md:w-auto text-sm">Upload</Button>
                        )}
                    </div>
                </div>
            </Dialog>

            {/* Removed folder modal: navigation is inline via breadcrumb */}

            {/* Rename Dialog */}
            <Dialog isOpen={Boolean(renameTarget)} onClose={()=>{setRenameTarget(null); setRenameValue('')}} width={420}>
                <div className="p-6 space-y-4">
                    <h3 className="text-lg font-semibold">Rename {renameTarget?.kind === 'folder' ? 'Folder' : 'File'}</h3>
                    <Input value={renameValue} onChange={(e)=>setRenameValue(e.target.value)} />
                    <div className="flex justify-end gap-2">
                        <Button variant="twoTone" onClick={()=>{setRenameTarget(null); setRenameValue('')}}>Cancel</Button>
                        <Button variant="solid" onClick={applyRename} disabled={!renameValue.trim()}>Save</Button>
                    </div>
                </div>
            </Dialog>

            {/* Delete Confirm */}
            <Dialog isOpen={Boolean(confirmDelete)} onClose={()=>setConfirmDelete(null)} width={420}>
                <div className="p-6 space-y-4">
                    <h3 className="text-lg font-semibold">Delete {confirmDelete?.kind === 'folder' ? 'Folder' : 'File'}</h3>
                    <p className="text-gray-600">Are you sure you want to delete "{confirmDelete?.name}"? This action cannot be undone.</p>
                    <div className="flex justify-end gap-2">
                        <Button variant="twoTone" onClick={()=>setConfirmDelete(null)}>Cancel</Button>
                        <Button variant="solid" className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmDeleteAction}>Delete</Button>
                    </div>
                </div>
            </Dialog>

            {/* New Folder Dialog */}
            <Dialog isOpen={newFolderOpen} onClose={()=>{setNewFolderOpen(false); setNewFolderName('')}} width={420}>
                <div className="p-6 space-y-4">
                    <h3 className="text-lg font-semibold">New Folder</h3>
                    <Input value={newFolderName} onChange={(e)=>setNewFolderName(e.target.value)} placeholder="Folder name" />
                    <div className="flex justify-end gap-2">
                        <Button variant="twoTone" onClick={()=>{setNewFolderOpen(false); setNewFolderName('')}}>Cancel</Button>
                        <Button variant="solid" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Create</Button>
                    </div>
                </div>
            </Dialog>
        </div>
    )
}

export default AttachmentsManager


