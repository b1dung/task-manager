export declare enum UserRole {
    ADMIN = "admin",
    MANAGER = "manager",
    MEMBER = "member",
    VIEWER = "viewer"
}
export declare enum TaskStatus {
    TODO = "todo",
    IN_PROGRESS = "in_progress",
    IN_REVIEW = "in_review",
    DONE = "done"
}
export declare enum TaskPriority {
    URGENT = "urgent",
    HIGH = "high",
    MEDIUM = "medium",
    LOW = "low"
}
export declare enum TaskType {
    BUG = "bug",
    FEATURE = "feature",
    TASK = "task",
    STORY = "story",
    EPIC = "epic"
}
export declare enum TaskLinkType {
    BLOCKS = "blocks",
    BLOCKED_BY = "blocked_by",
    RELATES_TO = "relates_to"
}
export declare enum SprintStatus {
    PLANNED = "planned",
    ACTIVE = "active",
    COMPLETED = "completed"
}
export declare enum NotificationType {
    TASK_ASSIGNED = "task_assigned",
    TASK_UPDATED = "task_updated",
    TASK_MOVED = "task_moved",
    COMMENT_ADDED = "comment_added",
    MENTION = "mention",
    DUE_DATE_REMINDER = "due_date_reminder",
    EXPORT_READY = "export_ready"
}
export declare enum ActivityAction {
    CREATED = "created",
    UPDATED = "updated",
    DELETED = "deleted",
    MOVED = "moved",
    COMMENTED = "commented",
    ASSIGNED = "assigned",
    STATUS_CHANGED = "status_changed"
}
export declare enum ActivityEntityType {
    TASK = "task",
    PROJECT = "project",
    COLUMN = "column",
    COMMENT = "comment",
    SPRINT = "sprint",
    MEMBER = "member"
}
