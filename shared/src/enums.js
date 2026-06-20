"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityEntityType = exports.ActivityAction = exports.NotificationType = exports.SprintStatus = exports.TaskLinkType = exports.TaskType = exports.TaskPriority = exports.TaskStatus = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "admin";
    UserRole["MANAGER"] = "manager";
    UserRole["MEMBER"] = "member";
    UserRole["VIEWER"] = "viewer";
})(UserRole || (exports.UserRole = UserRole = {}));
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["TODO"] = "todo";
    TaskStatus["IN_PROGRESS"] = "in_progress";
    TaskStatus["IN_REVIEW"] = "in_review";
    TaskStatus["DONE"] = "done";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
var TaskPriority;
(function (TaskPriority) {
    TaskPriority["URGENT"] = "urgent";
    TaskPriority["HIGH"] = "high";
    TaskPriority["MEDIUM"] = "medium";
    TaskPriority["LOW"] = "low";
})(TaskPriority || (exports.TaskPriority = TaskPriority = {}));
var TaskType;
(function (TaskType) {
    TaskType["BUG"] = "bug";
    TaskType["FEATURE"] = "feature";
    TaskType["TASK"] = "task";
    TaskType["STORY"] = "story";
    TaskType["EPIC"] = "epic";
})(TaskType || (exports.TaskType = TaskType = {}));
var TaskLinkType;
(function (TaskLinkType) {
    TaskLinkType["BLOCKS"] = "blocks";
    TaskLinkType["BLOCKED_BY"] = "blocked_by";
    TaskLinkType["RELATES_TO"] = "relates_to";
})(TaskLinkType || (exports.TaskLinkType = TaskLinkType = {}));
var SprintStatus;
(function (SprintStatus) {
    SprintStatus["PLANNED"] = "planned";
    SprintStatus["ACTIVE"] = "active";
    SprintStatus["COMPLETED"] = "completed";
})(SprintStatus || (exports.SprintStatus = SprintStatus = {}));
var NotificationType;
(function (NotificationType) {
    NotificationType["TASK_ASSIGNED"] = "task_assigned";
    NotificationType["TASK_UPDATED"] = "task_updated";
    NotificationType["TASK_MOVED"] = "task_moved";
    NotificationType["COMMENT_ADDED"] = "comment_added";
    NotificationType["MENTION"] = "mention";
    NotificationType["DUE_DATE_REMINDER"] = "due_date_reminder";
    NotificationType["EXPORT_READY"] = "export_ready";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var ActivityAction;
(function (ActivityAction) {
    ActivityAction["CREATED"] = "created";
    ActivityAction["UPDATED"] = "updated";
    ActivityAction["DELETED"] = "deleted";
    ActivityAction["MOVED"] = "moved";
    ActivityAction["COMMENTED"] = "commented";
    ActivityAction["ASSIGNED"] = "assigned";
    ActivityAction["STATUS_CHANGED"] = "status_changed";
})(ActivityAction || (exports.ActivityAction = ActivityAction = {}));
var ActivityEntityType;
(function (ActivityEntityType) {
    ActivityEntityType["TASK"] = "task";
    ActivityEntityType["PROJECT"] = "project";
    ActivityEntityType["COLUMN"] = "column";
    ActivityEntityType["COMMENT"] = "comment";
    ActivityEntityType["SPRINT"] = "sprint";
    ActivityEntityType["MEMBER"] = "member";
})(ActivityEntityType || (exports.ActivityEntityType = ActivityEntityType = {}));
//# sourceMappingURL=enums.js.map