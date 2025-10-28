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
    Checkbox
} from '@/components/ui'
import { StrictModeDroppable, UsersAvatarGroup } from '@/components/shared'
import { 
    HiOutlinePlus, 
    HiOutlineUserAdd, 
    HiOutlineMenu,
    HiOutlineTrash,
    HiOutlineSearch
} from 'react-icons/hi'
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '@/configs/firebase.config'

const TasksManager = ({ entityType, entityId }) => {
    const [sections, setSections] = useState([])
    const [tasks, setTasks] = useState([])
    const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false)
    const [isAddMembersOpen, setIsAddMembersOpen] = useState(false)
    const [isCreateSectionOpen, setIsCreateSectionOpen] = useState(false)
    const [selectedSection, setSelectedSection] = useState(null)
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

    // Handle drag and drop - completely rewritten for stability
    const handleDragEnd = async (result) => {
        const { destination, source, draggableId, type } = result

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
        } else {
            // Handle task reordering
            const sourceSectionId = source.droppableId
            const destSectionId = destination.droppableId
            const sourceIndex = source.index
            const destIndex = destination.index

            if (sourceSectionId === destSectionId) {
                // Reorder within same section
                const sectionTasks = tasks
                    .filter(task => task.sectionId === sourceSectionId)
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                
                const newTasks = Array.from(sectionTasks)
                const [reorderedTask] = newTasks.splice(sourceIndex, 1)
                newTasks.splice(destIndex, 0, reorderedTask)

                // Update task order in Firebase
                const updatePromises = newTasks.map((task, index) => {
                    if (task.order !== index) {
                        return updateDoc(doc(db, `${entityType}s`, entityId, 'tasks', task.id), {
                            order: index
                        })
                    }
                    return Promise.resolve()
                })
                
                await Promise.all(updatePromises)
            } else {
                // Move task to different section
                const task = tasks.find(t => t.id === draggableId)
                if (task) {
                    // Get tasks in destination section to calculate new order
                    const destSectionTasks = tasks
                        .filter(t => t.sectionId === destSectionId)
                        .sort((a, b) => (a.order || 0) - (b.order || 0))
                    
                    // Update the moved task
                    await updateDoc(doc(db, `${entityType}s`, entityId, 'tasks', task.id), {
                        sectionId: destSectionId,
                        order: destIndex
                    })

                    // Update order of other tasks in destination section if needed
                    const updatePromises = destSectionTasks.map((t, index) => {
                        const newOrder = index >= destIndex ? index + 1 : index
                        if (t.order !== newOrder) {
                            return updateDoc(doc(db, `${entityType}s`, entityId, 'tasks', t.id), {
                                order: newOrder
                            })
                        }
                        return Promise.resolve()
                    })
                    
                    await Promise.all(updatePromises)
                }
            }
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
        } catch (error) {
            console.error('Error updating task:', error)
        }
    }

    // Delete task
    const handleDeleteTask = async (taskId) => {
        try {
            await deleteDoc(doc(db, `${entityType}s`, entityId, 'tasks', taskId))
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
                                                    </div>

                                                    {/* Tasks */}
                                                    <StrictModeDroppable droppableId={section.id} type="task">
                                                        {(provided, snapshot) => (
                                                            <div
                                                                {...provided.droppableProps}
                                                                ref={provided.innerRef}
                                                                className={`min-h-[100px] space-y-2 transition-colors duration-200 ${
                                                                    snapshot.isDraggingOver ? 'bg-blue-50 dark:bg-blue-900/20 rounded-lg' : ''
                                                                }`}
                                                            >
                                                                {sectionTasks.length === 0 ? (
                                                                    <div className="text-center py-8 text-gray-500">
                                                                        No tasks in this section
                                                                    </div>
                                                                ) : (
                                                                    sectionTasks.map((task, taskIndex) => (
                                                                        <Draggable key={task.id} draggableId={task.id} index={taskIndex}>
                                                                            {(provided, snapshot) => (
                                                                                <div
                                                                                    ref={provided.innerRef}
                                                                                    {...provided.draggableProps}
                                                                                    className={`flex items-center space-x-3 p-3 bg-white dark:bg-gray-700 rounded-lg border transition-all duration-200 ${
                                                                                        snapshot.isDragging 
                                                                                            ? 'shadow-2xl rotate-1 scale-105 border-primary/50' 
                                                                                            : 'shadow-sm hover:shadow-md'
                                                                                    } ${task.status === 'completed' ? 'opacity-60' : ''}`}
                                                                                >
                                                                                    <div
                                                                                        {...provided.dragHandleProps}
                                                                                        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200"
                                                                                    >
                                                                                        <HiOutlineMenu size={16} />
                                                                                    </div>
                                                                                    
                                                                                    <Checkbox
                                                                                        checked={task.status === 'completed'}
                                                                                        onChange={() => handleToggleTask(task.id, task.status)}
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
                                                                                            icon={<HiOutlineTrash />}
                                                                                            onClick={() => handleDeleteTask(task.id)}
                                                                                            className="text-red-600 hover:text-red-700"
                                                                                        />
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </Draggable>
                                                                    ))
                                                                )}
                                                                {provided.placeholder}
                                                            </div>
                                                        )}
                                                    </StrictModeDroppable>
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
        </div>
    )
}

export default TasksManager