/**
 * Static catalog of all permissions the workspace supports.
 * Roles store a subset of these keys in their `permissions` column.
 * The frontend renders the permission matrix from GET /permissions.
 */
export interface PermissionDef {
  key: string;
  label: string;
  category: string;
  description: string;
}

export const PERMISSION_CATALOG: PermissionDef[] = [
  // User management
  {
    key: 'manage_users',
    label: 'Manage Users',
    category: 'User Management',
    description: 'Tạo, sửa, vô hiệu hóa tài khoản người dùng',
  },
  {
    key: 'manage_roles',
    label: 'Manage Roles',
    category: 'User Management',
    description: 'Tạo role và phân quyền (truy cập trang này)',
  },
  // Projects
  {
    key: 'create_project',
    label: 'Create Project',
    category: 'Projects',
    description: 'Tạo dự án mới',
  },
  {
    key: 'edit_project',
    label: 'Edit Project',
    category: 'Projects',
    description: 'Chỉnh sửa thông tin dự án',
  },
  {
    key: 'delete_project',
    label: 'Delete Project',
    category: 'Projects',
    description: 'Xóa dự án',
  },
  // Sprints & tasks
  {
    key: 'create_sprint',
    label: 'Create Sprint',
    category: 'Sprints & Tasks',
    description: 'Tạo và quản lý sprint',
  },
  {
    key: 'assign_tasks',
    label: 'Assign Tasks',
    category: 'Sprints & Tasks',
    description: 'Gán task cho thành viên',
  },
  {
    key: 'create_task',
    label: 'Create Task',
    category: 'Sprints & Tasks',
    description: 'Tạo task mới',
  },
  {
    key: 'update_own_task',
    label: 'Update Own Task',
    category: 'Sprints & Tasks',
    description: 'Cập nhật trạng thái task của mình',
  },
  {
    key: 'approve_task',
    label: 'Approve Task',
    category: 'Sprints & Tasks',
    description: 'Duyệt / approve task',
  },
  // Reports & billing
  {
    key: 'view_reports',
    label: 'View Reports',
    category: 'Reports & Billing',
    description: 'Xem báo cáo và thống kê',
  },
  {
    key: 'billing_access',
    label: 'Billing Access',
    category: 'Reports & Billing',
    description: 'Quản lý gói dịch vụ và thanh toán',
  },
  // General
  {
    key: 'invite_client',
    label: 'Invite Client',
    category: 'General',
    description: 'Mời khách (client) vào dự án',
  },
  {
    key: 'view_pages',
    label: 'View Page',
    category: 'General',
    description: 'Quyền xem các trang được chia sẻ',
  },
];

export const PERMISSION_KEYS = PERMISSION_CATALOG.map((p) => p.key);

/** Default workspace roles + their permission matrix (from permissions-role.md). */
export interface DefaultRole {
  key: string;
  name: string;
  description: string;
  sortOrder: number;
  permissions: string[];
}

const ALL = PERMISSION_KEYS;

export const DEFAULT_ROLES: DefaultRole[] = [
  {
    key: 'owner',
    name: 'Owner',
    description: 'Toàn quyền hệ thống. Quản lý gói dịch vụ. Xóa workspace.',
    sortOrder: 0,
    permissions: [...ALL],
  },
  {
    key: 'admin',
    name: 'Admin',
    description: 'Quản lý người dùng. Tạo dự án. Quản lý phân quyền.',
    sortOrder: 1,
    permissions: [
      'manage_users',
      'manage_roles',
      'create_project',
      'edit_project',
      'delete_project',
      'create_sprint',
      'assign_tasks',
      'create_task',
      'update_own_task',
      'approve_task',
      'view_reports',
      'invite_client',
      'view_pages',
    ],
  },
  {
    key: 'pm',
    name: 'PM',
    description: 'Tạo Sprint. Gán task. Quản lý tiến độ. Xem báo cáo.',
    sortOrder: 2,
    permissions: [
      'create_project',
      'edit_project',
      'create_sprint',
      'assign_tasks',
      'create_task',
      'update_own_task',
      'approve_task',
      'view_reports',
      'invite_client',
      'view_pages',
    ],
  },
  {
    key: 'team_lead',
    name: 'Team Lead',
    description: 'Review code. Approve task. Theo dõi hiệu suất team.',
    sortOrder: 3,
    permissions: [
      'edit_project',
      'create_sprint',
      'assign_tasks',
      'create_task',
      'update_own_task',
      'approve_task',
      'view_reports',
      'view_pages',
    ],
  },
  {
    key: 'member',
    name: 'Member',
    description:
      'Developer / QA / Designer / BA. Xem dự án, tạo task, cập nhật trạng thái, comment, upload file, log work.',
    sortOrder: 4,
    permissions: ['create_task', 'update_own_task', 'view_reports', 'view_pages'],
  },
  {
    key: 'client',
    name: 'Client',
    description: 'Chỉ xem các project được mời. Comment trên task. Xem báo cáo được chia sẻ.',
    sortOrder: 5,
    permissions: ['view_reports', 'view_pages'],
  },
];
