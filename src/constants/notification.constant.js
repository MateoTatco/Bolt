// Notification Types
export const NOTIFICATION_TYPES = {
    // Task notifications
    TASK_ASSIGNED: 'task_assigned',
    TASK_COMPLETED: 'task_completed',
    TASK_UPDATED: 'task_updated',
    TASK_DUE_SOON: 'task_due_soon',
    TASK_OVERDUE: 'task_overdue',
    
    // Entity notifications
    ENTITY_CREATED: 'entity_created',
    ENTITY_UPDATED: 'entity_updated',
    ENTITY_STATUS_CHANGED: 'entity_status_changed',
    ENTITY_DELETED: 'entity_deleted',
    
    // Attachment notifications
    ATTACHMENT_ADDED: 'attachment_added',
    ATTACHMENT_DELETED: 'attachment_deleted',
    
    // Activity notifications
    ACTIVITY_ADDED: 'activity_added',
    
    // System notifications
    SYSTEM: 'system',
}

// Entity Types
export const ENTITY_TYPES = {
    LEAD: 'lead',
    CLIENT: 'client',
    PROJECT: 'project',
}

// Notification Icons Mapping
export const NOTIFICATION_ICONS = {
    [NOTIFICATION_TYPES.TASK_ASSIGNED]: 'HiOutlineUserAdd',
    [NOTIFICATION_TYPES.TASK_COMPLETED]: 'HiOutlineCheckCircle',
    [NOTIFICATION_TYPES.TASK_UPDATED]: 'HiOutlinePencil',
    [NOTIFICATION_TYPES.TASK_DUE_SOON]: 'HiOutlineClock',
    [NOTIFICATION_TYPES.TASK_OVERDUE]: 'HiOutlineExclamationCircle',
    [NOTIFICATION_TYPES.ENTITY_CREATED]: 'HiOutlinePlusCircle',
    [NOTIFICATION_TYPES.ENTITY_UPDATED]: 'HiOutlinePencil',
    [NOTIFICATION_TYPES.ENTITY_STATUS_CHANGED]: 'HiOutlineRefresh',
    [NOTIFICATION_TYPES.ENTITY_DELETED]: 'HiOutlineTrash',
    [NOTIFICATION_TYPES.ATTACHMENT_ADDED]: 'HiOutlinePaperClip',
    [NOTIFICATION_TYPES.ATTACHMENT_DELETED]: 'HiOutlineTrash',
    [NOTIFICATION_TYPES.ACTIVITY_ADDED]: 'HiOutlineClock',
    [NOTIFICATION_TYPES.SYSTEM]: 'HiOutlineBell',
}

// Notification Colors Mapping
export const NOTIFICATION_COLORS = {
    [NOTIFICATION_TYPES.TASK_ASSIGNED]: 'blue',
    [NOTIFICATION_TYPES.TASK_COMPLETED]: 'green',
    [NOTIFICATION_TYPES.TASK_UPDATED]: 'gray',
    [NOTIFICATION_TYPES.TASK_DUE_SOON]: 'amber',
    [NOTIFICATION_TYPES.TASK_OVERDUE]: 'red',
    [NOTIFICATION_TYPES.ENTITY_CREATED]: 'blue',
    [NOTIFICATION_TYPES.ENTITY_UPDATED]: 'gray',
    [NOTIFICATION_TYPES.ENTITY_STATUS_CHANGED]: 'indigo',
    [NOTIFICATION_TYPES.ENTITY_DELETED]: 'red',
    [NOTIFICATION_TYPES.ATTACHMENT_ADDED]: 'blue',
    [NOTIFICATION_TYPES.ATTACHMENT_DELETED]: 'red',
    [NOTIFICATION_TYPES.ACTIVITY_ADDED]: 'gray',
    [NOTIFICATION_TYPES.SYSTEM]: 'gray',
}

