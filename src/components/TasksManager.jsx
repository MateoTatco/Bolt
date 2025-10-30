import React, { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { 
    Button, 
    Card, 
    Input, 
    Select, 
    DatePicker, 
    Tag, 
    Tooltip, 
    Dialog, 
    Avatar,
    Checkbox,
    Alert
} from '@/components/ui'
import { StrictModeDroppable, UsersAvatarGroup } from '@/components/shared'
import { 
    HiOutlinePlus, 
    HiOutlineUserAdd, 
    HiOutlineMenu,
    HiOutlineTrash,
    HiOutlinePencil,
    HiOutlineSearch
} from 'react-icons/hi'
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, getDocs, where } from 'firebase/firestore'
import { db } from '@/configs/firebase.config'
import logActivity from '@/utils/activityLogger'

const TasksManager = ({ entityType, entityId }) => {
    const [sections, setSections] = useState([])
    const [tasks, setTasks] = useState([])
    const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false)
    const [isAddMembersOpen, setIsAddMembersOpen] = useState(false)
    const [isCreateSectionOpen, setIsCreateSectionOpen] = useState(false)
    const [isEditTaskOpen, setIsEditTaskOpen] = useState(false)
    const [isDeleteSectionOpen, setIsDeleteSectionOpen] = useState(false)
    const [selectedSection, setSelectedSection] = useState(null)
    const [selectedTask, setSelectedTask] = useState(null)
    const [sectionToDelete, setSectionToDelete] = useState(null)
    const [members, setMembers] = useState([])
    const [searchTerm, setSearchTerm] = useState('')
    const [newSectionName, setNewSectionName] = useState('')
    
    // Task form state
    const [taskForm, setTaskForm] = useState({
        name: '',
        status: 'pending',
        priority: 'medium',
        dueDate: null,
        assignee: null
    })

    // Mock users for now - will be replaced with actual user management
    const availableUsers = [
        { id: 'admin', name: 'Admin', email: 'admin@tatco.com' },
        { id: 'brett', name: 'Brett', email: 'brett@tatco.com' },
        { id: 'simon', name: 'Simon', email: 'simon@tatco.com' },
        { id: 'robb', name: 'Robb', email: 'robb@tatco.com' }
    ]

    const statusOptions = [
        { value: 'pending', label: 'Pending' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' }
    ]

    const priorityOptions = [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' }
    ]

    const assigneeOptions = availableUsers.map(user => ({
        value: user.id,
        label: user.name
    }))

    // Load sections and tasks from Firebase
    useEffect(() => {
        if (!entityId) return

        // Load sections
        const sectionsRef = collection(db, `${entityType}s`, entityId, 'sections')
        const sectionsQuery = query(sectionsRef, orderBy('order'))
        
        const unsubscribeSections = onSnapshot(sectionsQuery, (snapshot) => {
            const sectionsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            setSections(sectionsData)
        })

        // Load tasks
        const tasksRef = collection(db, `${entityType}s`, entityId, 'tasks')
        const tasksQuery = query(tasksRef, orderBy('order'))
        
        const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
            const tasksData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            setTasks(tasksData)
        })

        return () => {
            unsubscribeSections()
            unsubscribeTasks()
        }
    }, [entityType, entityId])

    // Handle drag and drop
    const handleDragEnd = async (result) => {
        const { destination, source, type } = result

        if (!destination) return

        if (type === 'section') {
            // Reorder sections
            const newSections = Array.from(sections)
            const [reorderedSection] = newSections.splice(source.index, 1)
            newSections.splice(destination.index, 0, reorderedSection)

            // Update order in Firebase
            const updatePromises = newSections.map((section, index) => {
                if (section.order !== index) {
                    return updateDoc(doc(db, `${entityType}s`, entityId, 'sections', section.id), {
                        order: index
                    })
                }
                return Promise.resolve()
            })
            
            await Promise.all(updatePromises)
            await logActivity(entityType, entityId, { type: 'reorder', message: 'reordered sections' })
        }
    }

    // Open delete section confirmation dialog
    const handleDeleteSection = (sectionId) => {
        const section = sections.find(s => s.id === sectionId)
        setSectionToDelete(section)
        setIsDeleteSectionOpen(true)
    }

    // Confirm and delete section (and all tasks within it)
    const confirmDeleteSection = async () => {
        if (!sectionToDelete) return

        try {
            // Delete all tasks assigned to this section
            const tasksRef = collection(db, `${entityType}s`, entityId, 'tasks')
            const tasksInSectionQuery = query(tasksRef, where('sectionId', '==', sectionToDelete.id))
            const snapshot = await getDocs(tasksInSectionQuery)
            const deleteTasksPromises = snapshot.docs.map((d) => deleteDoc(doc(db, `${entityType}s`, entityId, 'tasks', d.id)))
            await Promise.all(deleteTasksPromises)

            // Delete the section document
            await deleteDoc(doc(db, `${entityType}s`, entityId, 'sections', sectionToDelete.id))
            
            // Close dialog and reset
            setIsDeleteSectionOpen(false)
            setSectionToDelete(null)
            await logActivity(entityType, entityId, { type: 'delete', message: `deleted section ${sectionToDelete.name}` })
        } catch (error) {
            console.error('Error deleting section:', error)
        }
    }

    // Create new section
    const handleCreateSection = async () => {
        if (!newSectionName.trim()) return

        try {
            await addDoc(collection(db, `${entityType}s`, entityId, 'sections'), {
                name: newSectionName,
                order: sections.length,
                members: [],
                createdAt: new Date(),
                updatedAt: new Date()
            })
            setNewSectionName('')
            setIsCreateSectionOpen(false)
            await logActivity(entityType, entityId, { type: 'create', message: `created section ${newSectionName}` })
        } catch (error) {
            console.error('Error creating section:', error)
        }
    }

    // Create new task
    const handleCreateTask = async () => {
        if (!taskForm.name.trim() || !selectedSection) return

        try {
            const sectionTasks = tasks.filter(t => t.sectionId === selectedSection.id)
            const newOrder = sectionTasks.length

            await addDoc(collection(db, `${entityType}s`, entityId, 'tasks'), {
                name: taskForm.name,
                status: taskForm.status,
                priority: taskForm.priority,
                dueDate: taskForm.dueDate ? taskForm.dueDate.toISOString() : null,
                assignee: taskForm.assignee,
                sectionId: selectedSection.id,
                order: newOrder,
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: 'current-user' // TODO: Get from auth context
            })
            
            setTaskForm({
                name: '',
                status: 'pending',
                priority: 'medium',
                dueDate: null,
                assignee: null
            })
            setIsCreateTaskOpen(false)
            await logActivity(entityType, entityId, { type: 'create', message: `created task ${taskForm.name} in ${selectedSection.name}` })
        } catch (error) {
            console.error('Error creating task:', error)
        }
    }

    // Toggle task completion
    const handleToggleTask = async (taskId, currentStatus) => {
        const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'
        
        try {
            await updateDoc(doc(db, `${entityType}s`, entityId, 'tasks', taskId), {
                status: newStatus,
                updatedAt: new Date()
            })
            await logActivity(entityType, entityId, { type: 'update', message: `marked task as ${newStatus}` })
        } catch (error) {
            console.error('Error updating task:', error)
        }
    }

    // Edit task
    const handleEditTask = async () => {
        if (!taskForm.name.trim() || !selectedTask) return

        try {
            await updateDoc(doc(db, `${entityType}s`, entityId, 'tasks', selectedTask.id), {
                name: taskForm.name,
                status: taskForm.status,
                priority: taskForm.priority,
                dueDate: taskForm.dueDate ? taskForm.dueDate.toISOString() : null,
                assignee: taskForm.assignee,
                updatedAt: new Date()
            })
            
            setTaskForm({
                name: '',
                status: 'pending',
                priority: 'medium',
                dueDate: null,
                assignee: null
            })
            setSelectedTask(null)
            setIsEditTaskOpen(false)
            await logActivity(entityType, entityId, { type: 'update', message: `updated task ${selectedTask.name}` })
        } catch (error) {
            console.error('Error updating task:', error)
        }
    }

    // Open edit task dialog
    const openEditTask = (task) => {
        setSelectedTask(task)
        setTaskForm({
            name: task.name,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate ? new Date(task.dueDate) : null,
            assignee: task.assignee
        })
        setIsEditTaskOpen(true)
    }

    // Delete task
    const handleDeleteTask = async (taskId) => {
        try {
            await deleteDoc(doc(db, `${entityType}s`, entityId, 'tasks', taskId))
            await logActivity(entityType, entityId, { type: 'delete', message: 'deleted a task' })
        } catch (error) {
            console.error('Error deleting task:', error)
        }
    }

    // Get status color
    const getStatusColor = (status) => {
        switch (status) {
            case 'completed':
                return 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-100'
            case 'in_progress':
                return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-100'
            case 'pending':
                return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-100'
            default:
                return 'bg-gray-100 text-gray-700'
        }
    }

    // Get priority color
    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'high':
                return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-100'
            case 'medium':
                return 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-100'
            case 'low':
                return 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-100'
            default:
                return 'bg-gray-100 text-gray-700'
        }
    }

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return '-'
        const date = new Date(dateString)
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        })
    }

    // Get user by ID
    const getUserById = (userId) => {
        return availableUsers.find(user => user.id === userId)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                        Tasks
                    </h2>
                    <div className="flex items-center space-x-2">
                        <UsersAvatarGroup 
                            users={members.map(memberId => getUserById(memberId)).filter(Boolean)}
                            avatarProps={{ size: 24 }}
                        />
                        <Button
                            size="sm"
                            variant="twoTone"
                            icon={<HiOutlineUserAdd />}
                            onClick={() => setIsAddMembersOpen(true)}
                        >
                            Add members
                        </Button>
                    </div>
                </div>
                <Button
                    variant="solid"
                    icon={<HiOutlinePlus />}
                    onClick={() => setIsCreateSectionOpen(true)}
                >
                    Add Section
                </Button>
            </div>

            {/* Drag and Drop Context */}
            <DragDropContext onDragEnd={handleDragEnd}>
                <StrictModeDroppable droppableId="sections" type="section" direction="vertical">
                    {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-6">
                            {sections
                                .sort((a, b) => (a.order || 0) - (b.order || 0))
                                .map((section, sectionIndex) => {
                                    const sectionTasks = tasks
                                        .filter(task => task.sectionId === section.id)
                                        .sort((a, b) => (a.order || 0) - (b.order || 0))
                                    
                                    return (
                                        <Draggable key={section.id} draggableId={section.id} index={sectionIndex}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    className={`rounded-2xl bg-gray-50/50 dark:bg-gray-800/30 backdrop-blur-sm p-6 ${
                                                        snapshot.isDragging ? 'shadow-2xl opacity-90' : ''
                                                    }`}
                                                >
                                                    {/* Section Header */}
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center space-x-3">
                                                            <div
                                                                {...provided.dragHandleProps}
                                                                className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200"
                                                            >
                                                                <HiOutlineMenu size={20} />
                                                            </div>
                                                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                                                {section.name}
                                                            </h3>
                                                            <span className="text-sm text-gray-500">
                                                                {sectionTasks.length} tasks
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="twoTone"
                                                                icon={<HiOutlinePlus />}
                                                                onClick={() => {
                                                                    setSelectedSection(section)
                                                                    setIsCreateTaskOpen(true)
                                                                }}
                                                            >
                                                                Add task
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="plain"
                                                                icon={<HiOutlineTrash />}
                                                                onClick={() => handleDeleteSection(section.id)}
                                                                className="text-red-600 hover:text-red-700"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Tasks (no drag-and-drop) */}
                                                    <div className="min-h-[100px] space-y-2">
                                                        {sectionTasks.length === 0 ? (
                                                            <div className="text-center py-8 text-gray-500">
                                                                No tasks in this section
                                                            </div>
                                                        ) : (
                                                            sectionTasks.map((task) => (
                                                                <div
                                                                    key={task.id}
                                                                    className={`bg-white dark:bg-gray-700 rounded-lg border shadow-sm hover:shadow-md ${
                                                                        task.status === 'completed' ? 'opacity-60' : ''
                                                                    }`}
                                                                >
                                                                    <div className="flex items-center p-3">
                                                                        <Checkbox
                                                                            checked={task.status === 'completed'}
                                                                            onChange={() => handleToggleTask(task.id, task.status)}
                                                                            className="mr-3"
                                                                        />
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className={`font-medium ${
                                                                                task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900 dark:text-white'
                                                                            }`}>
                                                                                {task.name}
                                                                            </p>
                                                                        </div>
                                                                        <div className="flex items-center space-x-2">
                                                                            <Tag className={getStatusColor(task.status)}>
                                                                                {statusOptions.find(opt => opt.value === task.status)?.label}
                                                                            </Tag>
                                                                            <Tag className={getPriorityColor(task.priority)}>
                                                                                {priorityOptions.find(opt => opt.value === task.priority)?.label}
                                                                            </Tag>
                                                                            <span className="text-sm text-gray-500">
                                                                                {formatDate(task.dueDate)}
                                                                            </span>
                                                                            {task.assignee && (
                                                                                <Tooltip title={getUserById(task.assignee)?.name || 'Unknown'}>
                                                                                    <Avatar size={24}>
                                                                                        {getUserById(task.assignee)?.name?.charAt(0) || '?'}
                                                                                    </Avatar>
                                                                                </Tooltip>
                                                                            )}
                                                                            <Button
                                                                                size="sm"
                                                                                variant="plain"
                                                                                icon={<HiOutlinePencil />}
                                                                                onClick={() => openEditTask(task)}
                                                                                className="text-blue-600 hover:text-blue-700"
                                                                            />
                                                                            <Button
                                                                                size="sm"
                                                                                variant="plain"
                                                                                icon={<HiOutlineTrash />}
                                                                                onClick={() => handleDeleteTask(task.id)}
                                                                                className="text-red-600 hover:text-red-700"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </Draggable>
                                    )
                                })}
                            {provided.placeholder}
                        </div>
                    )}
                </StrictModeDroppable>
            </DragDropContext>

            {/* Create Section Dialog */}
            <Dialog isOpen={isCreateSectionOpen} onClose={() => setIsCreateSectionOpen(false)} width={400}>
                <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Create New Section</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Section Name</label>
                            <Input
                                value={newSectionName}
                                onChange={(e) => setNewSectionName(e.target.value)}
                                placeholder="Enter section name"
                            />
                        </div>
                        <div className="flex justify-end space-x-2">
                            <Button
                                variant="twoTone"
                                onClick={() => setIsCreateSectionOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="solid"
                                onClick={handleCreateSection}
                                disabled={!newSectionName.trim()}
                            >
                                Create Section
                            </Button>
                        </div>
                    </div>
                </div>
            </Dialog>

            {/* Create Task Dialog */}
            <Dialog isOpen={isCreateTaskOpen} onClose={() => setIsCreateTaskOpen(false)} width={500}>
                <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Create New Task</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Task Name *</label>
                            <Input
                                value={taskForm.name}
                                onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
                                placeholder="Enter task name"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Status</label>
                                <Select
                                    options={statusOptions}
                                    value={statusOptions.find(opt => opt.value === taskForm.status)}
                                    onChange={(opt) => setTaskForm({ ...taskForm, status: opt?.value || 'pending' })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Priority</label>
                                <Select
                                    options={priorityOptions}
                                    value={priorityOptions.find(opt => opt.value === taskForm.priority)}
                                    onChange={(opt) => setTaskForm({ ...taskForm, priority: opt?.value || 'medium' })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Due Date</label>
                                <DatePicker
                                    value={taskForm.dueDate}
                                    onChange={(date) => setTaskForm({ ...taskForm, dueDate: date })}
                                    placeholder="Select due date"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Assignee</label>
                                <Select
                                    options={assigneeOptions}
                                    value={assigneeOptions.find(opt => opt.value === taskForm.assignee)}
                                    onChange={(opt) => setTaskForm({ ...taskForm, assignee: opt?.value || null })}
                                    isClearable
                                    placeholder="Select assignee"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end space-x-2">
                            <Button
                                variant="twoTone"
                                onClick={() => setIsCreateTaskOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="solid"
                                onClick={handleCreateTask}
                                disabled={!taskForm.name.trim()}
                            >
                                Create Task
                            </Button>
                        </div>
                    </div>
                </div>
            </Dialog>

            {/* Edit Task Dialog */}
            <Dialog isOpen={isEditTaskOpen} onClose={() => setIsEditTaskOpen(false)} width={500}>
                <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Edit Task</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Task Name *</label>
                            <Input
                                value={taskForm.name}
                                onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
                                placeholder="Enter task name"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Status</label>
                                <Select
                                    options={statusOptions}
                                    value={statusOptions.find(opt => opt.value === taskForm.status)}
                                    onChange={(opt) => setTaskForm({ ...taskForm, status: opt?.value || 'pending' })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Priority</label>
                                <Select
                                    options={priorityOptions}
                                    value={priorityOptions.find(opt => opt.value === taskForm.priority)}
                                    onChange={(opt) => setTaskForm({ ...taskForm, priority: opt?.value || 'medium' })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Due Date</label>
                                <DatePicker
                                    value={taskForm.dueDate}
                                    onChange={(date) => setTaskForm({ ...taskForm, dueDate: date })}
                                    placeholder="Select due date"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Assignee</label>
                                <Select
                                    options={assigneeOptions}
                                    value={assigneeOptions.find(opt => opt.value === taskForm.assignee)}
                                    onChange={(opt) => setTaskForm({ ...taskForm, assignee: opt?.value || null })}
                                    isClearable
                                    placeholder="Select assignee"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end space-x-2">
                            <Button
                                variant="twoTone"
                                onClick={() => {
                                    setIsEditTaskOpen(false)
                                    setSelectedTask(null)
                                    setTaskForm({
                                        name: '',
                                        status: 'pending',
                                        priority: 'medium',
                                        dueDate: null,
                                        assignee: null
                                    })
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="solid"
                                onClick={handleEditTask}
                                disabled={!taskForm.name.trim()}
                            >
                                Update Task
                            </Button>
                        </div>
                    </div>
                </div>
            </Dialog>

            {/* Add Members Dialog */}
            <Dialog isOpen={isAddMembersOpen} onClose={() => setIsAddMembersOpen(false)} width={500}>
                <div className="p-6">
                    <h3 className="text-lg font-semibold mb-2">Add people</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Invite existing team member to this project.
                    </p>
                    
                    <div className="space-y-4">
                        <div className="relative">
                            <Input
                                placeholder="Quick search member"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                prefix={<HiOutlineSearch size={16} />}
                            />
                        </div>
                        
                        <div className="text-sm text-gray-500 uppercase tracking-wide">
                            {availableUsers.length} MEMBERS AVAILABLE
                        </div>
                        
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {availableUsers
                                .filter(user => 
                                    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    user.email.toLowerCase().includes(searchTerm.toLowerCase())
                                )
                                .map(user => {
                                    const isMember = members.includes(user.id)
                                    return (
                                        <div key={user.id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
                                            <div className="flex items-center space-x-3">
                                                <Avatar size={32}>
                                                    {user.name.charAt(0)}
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium text-gray-900 dark:text-white">{user.name}</p>
                                                    <p className="text-sm text-gray-500">{user.email}</p>
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant={isMember ? "twoTone" : "outline"}
                                                onClick={() => {
                                                    if (isMember) {
                                                        setMembers(members.filter(id => id !== user.id))
                                                    } else {
                                                        setMembers([...members, user.id])
                                                    }
                                                }}
                                                className={isMember ? "text-red-600 border-red-200 hover:border-red-300" : ""}
                                            >
                                                {isMember ? 'Remove' : 'Add'}
                                            </Button>
                                        </div>
                                    )
                                })}
                        </div>
                        
                        <div className="flex justify-end">
                            <Button
                                variant="solid"
                                onClick={() => setIsAddMembersOpen(false)}
                                className="w-full"
                            >
                                Done
                            </Button>
                        </div>
                    </div>
                </div>
            </Dialog>

            {/* Delete Section Confirmation Dialog */}
            <Dialog 
                isOpen={isDeleteSectionOpen} 
                onClose={() => {
                    setIsDeleteSectionOpen(false)
                    setSectionToDelete(null)
                }} 
                width={500}
            >
                <div className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Delete Section</h3>
                    <Alert 
                        type="danger" 
                        showIcon 
                        title="Warning: This action cannot be undone"
                        className="mb-4"
                    >
                        Are you sure you want to delete <strong>"{sectionToDelete?.name}"</strong>? This will permanently delete the section and all tasks within it.
                    </Alert>
                    <div className="flex justify-end space-x-2">
                        <Button
                            variant="twoTone"
                            onClick={() => {
                                setIsDeleteSectionOpen(false)
                                setSectionToDelete(null)
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="solid"
                            onClick={confirmDeleteSection}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Delete Section
                        </Button>
                    </div>
                </div>
            </Dialog>
        </div>
    )
}

export default TasksManager