import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  LayoutGrid, LayoutDashboard, Calendar, Users, BarChart2, Gauge, Paperclip, Bell, Activity, ShieldCheck, UserCog,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Plus, Check, Folder, LogOut, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/useUIStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePermissions } from '@/hooks/usePermissions'
import { projectsApi, type Project } from '@/api/projects'
import { notificationsApi } from '@/api/notifications'
import { authApi } from '@/api/auth'
import { Avatar, Button, Input, Modal, Tooltip } from '@/components/ui'
import { useToast } from '@/hooks/useToast'

// ─── Constants ────────────────────────────────────────────────────────────────

interface NavItem {
  to: string
  icon: LucideIcon
  label: string
  /** When set, link to this absolute path instead of the project-scoped route. */
  absolutePath?: string
  requiresProject?: boolean
  requiresPermission?: string
  badge?: boolean
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { to: 'summary', icon: LayoutDashboard, label: 'Summary' },
    ],
  },
  {
    title: 'Work',
    items: [
      { to: 'tasks', icon: LayoutGrid, label: 'Board' },
      { to: 'calendar', icon: Calendar, label: 'Calendar' },
      { to: 'attachments', icon: Paperclip, label: 'Attachments' },
    ],
  },
  {
    title: 'Insights',
    items: [
      { to: 'reports', icon: BarChart2, label: 'Reports' },
      { to: 'developer-report', icon: Gauge, label: 'Dev Report' },
    ],
  },
  {
    title: 'Collaboration',
    items: [
      { to: 'team', icon: Users, label: 'Team', requiresProject: true },
      { to: 'notifications', icon: Bell, label: 'Notifications', requiresProject: true, badge: true },
      { to: 'activity', icon: Activity, label: 'Activity', requiresProject: true },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: 'users', icon: UserCog, label: 'User Management', absolutePath: '/users', requiresPermission: 'manage_users' },
      { to: 'roles', icon: ShieldCheck, label: 'Roles & Permissions', absolutePath: '/roles', requiresPermission: 'manage_roles' },
    ],
  },
]

const PROJ_COLORS = ['#2684FF', '#00B8D9', '#36B37E', '#FFAB00', '#FF5630', '#6554C0', '#FF7452']
function projColor(id: string) {
  return PROJ_COLORS[id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % PROJ_COLORS.length]
}

// ─── Project Dropdown ─────────────────────────────────────────────────────────

function ProjectDropdown({
  collapsed,
  onCreateProject,
  canCreate,
}: {
  collapsed: boolean
  onCreateProject: () => void
  canCreate: boolean
}) {
  const [open, setOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { projectId } = useParams()
  const setActiveProject = useUIStore((s) => s.setActiveProject)

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
    staleTime: 60_000,
  })

  const current = projects.find((p) => p.id === projectId)

  useEffect(() => {
    if (!open) return
    const fn = (e: MouseEvent) => {
      if (!dropRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [open])

  const switchProject = (p: Project) => {
    setActiveProject(p.id)
    setOpen(false)
    navigate(`/projects/${p.id}/tasks`)
  }

  if (collapsed) {
    return (
      <div className="px-1.5 py-2 border-b border-border">
        <Tooltip content={current?.name ?? 'Select project'} side="right">
          <button
            onClick={() => current && navigate(`/projects/${current.id}/tasks`)}
            className="flex w-full items-center justify-center rounded-lg p-2 hover:bg-bg-subtle transition-colors"
          >
            {current ? (
              <span
                className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white"
                style={{ backgroundColor: projColor(current.id) }}
              >
                {current.name.slice(0, 2).toUpperCase()}
              </span>
            ) : (
              <Folder className="h-4 w-4 text-fg-subtle" />
            )}
          </button>
        </Tooltip>
      </div>
    )
  }

  return (
    <div ref={dropRef} className="relative border-b border-border px-1.5 py-2">
      <div className="flex items-center gap-1">
        <button
          data-testid="project-trigger"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 hover:bg-bg-subtle transition-colors"
        >
          {current ? (
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
              style={{ backgroundColor: projColor(current.id) }}
            >
              {current.name.slice(0, 2).toUpperCase()}
            </span>
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-fg-subtle" />
          )}
          <span className="flex-1 truncate text-left text-sm font-medium text-fg">
            {current?.name ?? 'My Projects'}
          </span>
          {open
            ? <ChevronUp className="h-3 w-3 shrink-0 text-fg-subtle" />
            : <ChevronDown className="h-3 w-3 shrink-0 text-fg-subtle" />}
        </button>

        {canCreate && (
          <Tooltip content="Tạo project mới" side="right">
            <button
              onClick={(e) => { e.stopPropagation(); onCreateProject() }}
              className="shrink-0 rounded-lg p-1.5 text-fg-subtle hover:text-fg hover:bg-bg-subtle transition-colors"
              title="Tạo project mới"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        )}
      </div>

      {open && (
        <div className="absolute left-1.5 right-1.5 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-bg-surface shadow-app-md">
          {projects.length === 0 && (
            <p className="px-3 py-2 text-sm text-fg-muted">Chưa có project nào</p>
          )}
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => switchProject(p)}
              className="flex w-full items-center gap-2.5 px-3 py-2 hover:bg-bg-subtle transition-colors"
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                style={{ backgroundColor: projColor(p.id) }}
              >
                {p.name.slice(0, 2).toUpperCase()}
              </span>
              <span
                className={cn(
                  'flex-1 truncate text-left text-sm',
                  p.id === projectId ? 'font-medium text-accent' : 'text-fg',
                )}
              >
                {p.name}
              </span>
              {p.id === projectId && (
                <Check className="h-3.5 w-3.5 shrink-0 text-accent" />
              )}
            </button>
          ))}
          {canCreate && (
            <div className="border-t border-border">
              <button
                onClick={() => { setOpen(false); onCreateProject() }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-accent hover:bg-bg-subtle transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm">Tạo project mới</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Create Project Modal ─────────────────────────────────────────────────────

const PALETTE = ['#2684FF', '#00B8D9', '#36B37E', '#FFAB00', '#FF5630', '#6554C0', '#FF7452']

interface CreateForm {
  name: string
  key: string
  description: string
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)
}

function CreateProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const [color, setColor] = useState(PALETTE[0])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateForm>({ defaultValues: { name: '', key: '', description: '' } })

  const name = watch('name')

  useEffect(() => {
    if (name) setValue('key', slugify(name))
  }, [name, setValue])

  const { mutate: createProject, isPending } = useMutation({
    mutationFn: (data: CreateForm) =>
      projectsApi.create({
        name: data.name,
        slug: data.key || undefined,
        description: data.description || undefined,
      }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Đã tạo project')
      reset()
      setColor(PALETTE[0])
      onClose()
      navigate(`/projects/${p.id}/tasks`)
    },
    onError: () => toast.error('Tạo project thất bại'),
  })

  const handleClose = () => { reset(); setColor(PALETTE[0]); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title="Tạo project mới" size="sm">
      <form onSubmit={handleSubmit((d) => createProject(d))} className="space-y-4 p-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-fg-muted">Tên *</label>
          <Input
            {...register('name', {
              required: 'Tên bắt buộc',
              minLength: { value: 2, message: 'Tối thiểu 2 ký tự' },
            })}
            placeholder="VD: Website Redesign"
          />
          {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-fg-muted">Key (slug) *</label>
          <Input
            {...register('key', {
              required: true,
              pattern: {
                value: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                message: 'Chỉ chữ thường, số, dấu gạch ngang',
              },
            })}
            placeholder="website-redesign"
          />
          <p className="mt-0.5 text-[11px] text-fg-subtle">Auto-generate từ tên. Dùng trong URL.</p>
          {errors.key && <p className="mt-1 text-xs text-danger">{errors.key.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-fg-muted">Mô tả</label>
          <Input {...register('description')} placeholder="Mô tả ngắn về project..." />
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-fg-muted">Màu</label>
          <div className="flex gap-2">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  'h-6 w-6 rounded-full transition-all',
                  color === c && 'scale-110 ring-2 ring-accent ring-offset-2 ring-offset-bg-surface',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={handleClose}>Hủy</Button>
          <Button variant="primary" type="submit" loading={isPending}>Tạo</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const { user, logout } = useAuthStore()
  const permissions = usePermissions()
  const canCreateProject = permissions.includes('create_project')
  const [showCreate, setShowCreate] = useState(false)

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 30_000,
    enabled: !!user,
  })
  const unread = unreadData?.count ?? 0

  const handleLogout = async () => {
    try { await authApi.logout(useAuthStore.getState().refreshToken!) } catch {}
    logout()
    navigate('/login')
  }

  const navCls = (isActive: boolean) =>
    cn(
      'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
      isActive ? 'bg-bg-active text-accent font-medium' : 'text-fg-muted hover:text-fg hover:bg-bg-subtle',
      sidebarCollapsed && 'justify-center px-2',
    )

  return (
    <>
      <aside
        className={cn(
          'flex h-full shrink-0 flex-col border-r border-border bg-bg-surface transition-all duration-200',
          sidebarCollapsed ? 'w-14' : 'w-60',
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            'flex h-14 shrink-0 items-center border-b border-border px-3',
            sidebarCollapsed ? 'justify-center' : 'gap-2',
          )}
        >
          <span className="gradient-accent shadow-app-sm flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white">
            TB
          </span>
          {!sidebarCollapsed && (
            <span className="text-sm font-semibold text-fg">TaskBoard</span>
          )}
        </div>

        {/* Project dropdown */}
        <ProjectDropdown collapsed={sidebarCollapsed} onCreateProject={() => setShowCreate(true)} canCreate={canCreateProject} />

        {/* Main nav — grouped by function */}
        <nav className="scrollbar-thin flex-1 overflow-y-auto px-1.5 py-2">
          {NAV_GROUPS.map((group, gi) => {
            const items = group.items.filter(
              (it) =>
                (!it.requiresProject || projectId) &&
                (!it.requiresPermission || permissions.includes(it.requiresPermission)),
            )
            if (items.length === 0) return null
            return (
              <div key={group.title} className={gi > 0 ? 'mt-3' : ''}>
                {sidebarCollapsed
                  ? gi > 0 && <div className="mx-2 mb-2 h-px bg-border" />
                  : <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">{group.title}</p>}

                <div className="space-y-0.5">
                  {items.map(({ to, icon: Icon, label, badge, absolutePath }) => {
                    const href = absolutePath ?? (projectId ? `/projects/${projectId}/${to}` : '/projects')
                    return (
                      <Tooltip key={to} content={label} side="right" disabled={!sidebarCollapsed}>
                        <NavLink to={href} className={({ isActive }) => navCls(isActive)}>
                          <Icon className="h-4 w-4 shrink-0" />
                          {!sidebarCollapsed && <span className="flex-1 truncate">{label}</span>}
                          {badge && unread > 0 && (
                            <span className="flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-white shrink-0">
                              {unread > 99 ? '99+' : unread}
                            </span>
                          )}
                        </NavLink>
                      </Tooltip>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="shrink-0 space-y-0.5 border-t border-border p-1.5">
          <button
            onClick={toggleSidebar}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-fg-subtle hover:text-fg hover:bg-bg-subtle transition-colors',
              sidebarCollapsed && 'justify-center px-2',
            )}
          >
            {sidebarCollapsed
              ? <ChevronRight className="h-4 w-4" />
              : <><ChevronLeft className="h-4 w-4" /><span>Collapse</span></>}
          </button>

          {user && (
            <div className={cn('flex items-center gap-1', sidebarCollapsed && 'flex-col')}>
              <Tooltip content={`${user.fullName} — Tài khoản`} side="right" disabled={!sidebarCollapsed}>
                <button
                  onClick={() => navigate('/account')}
                  className={cn(
                    'flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-fg-muted hover:text-fg hover:bg-bg-subtle transition-colors',
                    sidebarCollapsed && 'justify-center px-2 flex-none w-full',
                  )}
                >
                  <Avatar name={user.fullName} avatarUrl={user.avatarUrl} size="xs" />
                  {!sidebarCollapsed && (
                    <span className="flex-1 truncate text-left">{user.fullName}</span>
                  )}
                </button>
              </Tooltip>

              <Tooltip content="Đăng xuất" side="right">
                <button
                  onClick={handleLogout}
                  className={cn(
                    'flex shrink-0 items-center justify-center rounded-lg p-2 text-fg-muted hover:text-danger hover:bg-danger/10 transition-colors',
                  )}
                  title="Đăng xuất"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            </div>
          )}
        </div>
      </aside>

      <CreateProjectModal open={showCreate} onClose={() => setShowCreate(false)} />
    </>
  )
}
