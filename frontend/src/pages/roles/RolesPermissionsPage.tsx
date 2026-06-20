import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, Plus, Pencil, Trash2, Check, Lock, X } from 'lucide-react'
import { rolesApi, type Role, type PermissionDef, type RoleInput } from '@/api/roles'
import { Button, EmptyState, Modal, Spinner } from '@/components/ui'
import { useToast } from '@/hooks/useToast'
import { useHasPermission } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'

type Tab = 'roles' | 'permissions'

/** Group permissions by category, preserving catalog order. */
function groupByCategory(perms: PermissionDef[]): { category: string; items: PermissionDef[] }[] {
  const groups: { category: string; items: PermissionDef[] }[] = []
  for (const p of perms) {
    let g = groups.find((x) => x.category === p.category)
    if (!g) { g = { category: p.category, items: [] }; groups.push(g) }
    g.items.push(p)
  }
  return groups
}

export function RolesPermissionsPage() {
  const isAdmin = useHasPermission('manage_roles')
  const qc = useQueryClient()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('roles')
  const [editing, setEditing] = useState<Role | null>(null)
  const [creating, setCreating] = useState(false)

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: rolesApi.listRoles,
  })
  const { data: permissions = [], isLoading: permsLoading } = useQuery({
    queryKey: ['permissions'],
    queryFn: rolesApi.listPermissions,
    staleTime: 5 * 60_000,
  })

  const groups = useMemo(() => groupByCategory(permissions), [permissions])

  const { mutate: updateRole } = useMutation({
    mutationFn: ({ id, ...dto }: RoleInput & { id: string }) => rolesApi.update(id, dto),
    onMutate: async ({ id, permissions: perms, name, description }) => {
      await qc.cancelQueries({ queryKey: ['roles'] })
      const prev = qc.getQueryData<Role[]>(['roles'])
      qc.setQueryData<Role[]>(['roles'], (old) =>
        old?.map((r) =>
          r.id === id
            ? {
                ...r,
                ...(perms !== undefined ? { permissions: perms } : {}),
                ...(name !== undefined ? { name } : {}),
                ...(description !== undefined ? { description } : {}),
              }
            : r,
        ),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['roles'], ctx.prev)
      toast.error('Cập nhật phân quyền thất bại')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  })

  const { mutate: deleteRole } = useMutation({
    mutationFn: (id: string) => rolesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Đã xóa role')
    },
    onError: () => toast.error('Không thể xóa role'),
  })

  const togglePermission = (role: Role, permKey: string) => {
    if (!isAdmin) return
    const has = role.permissions.includes(permKey)
    const next = has
      ? role.permissions.filter((p) => p !== permKey)
      : [...role.permissions, permKey]
    updateRole({ id: role.id, permissions: next })
  }

  const handleDelete = (role: Role) => {
    if (window.confirm(`Xóa role "${role.name}"? Hành động này không thể hoàn tác.`)) {
      deleteRole(role.id)
    }
  }

  const loading = rolesLoading || permsLoading

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-base font-semibold text-fg">Roles & Permissions</h1>
          <p className="text-xs text-fg-muted mt-0.5">Quản lý vai trò và phân quyền trong workspace</p>
        </div>
        {tab === 'roles' && isAdmin && (
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" /> Tạo role mới
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 pt-3 border-b border-border shrink-0">
        {(['roles', 'permissions'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t
                ? 'border-accent text-accent'
                : 'border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {t === 'roles' ? 'Roles' : 'Permissions'}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto scrollbar-thin p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Spinner /></div>
        ) : tab === 'roles' ? (
          <RolesTab
            roles={roles}
            permissions={permissions}
            isAdmin={isAdmin}
            onEdit={setEditing}
            onDelete={handleDelete}
          />
        ) : (
          <PermissionsMatrix
            roles={roles}
            groups={groups}
            isAdmin={isAdmin}
            onToggle={togglePermission}
          />
        )}
      </div>

      {isAdmin && (creating || editing) && (
        <RoleFormModal
          open
          role={editing}
          groups={groups}
          onClose={() => { setCreating(false); setEditing(null) }}
        />
      )}
    </div>
  )
}

// ─── Roles tab ──────────────────────────────────────────────────────────────

function RolesTab({
  roles, permissions, isAdmin, onEdit, onDelete,
}: {
  roles: Role[]
  permissions: PermissionDef[]
  isAdmin: boolean
  onEdit: (r: Role) => void
  onDelete: (r: Role) => void
}) {
  if (roles.length === 0) {
    return <EmptyState icon={<Shield className="w-12 h-12" />} title="Chưa có role nào" />
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {roles.map((role) => (
        <div key={role.id} className="rounded-card bg-white border border-border bg-bg-elevated p-4 flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Shield className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-fg truncate">{role.name}</p>
                {role.isSystem && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-fg-subtle">
                    <Lock className="w-2.5 h-2.5" /> Hệ thống
                  </span>
                )}
              </div>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => onEdit(role)} className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-bg-subtle transition-colors" title="Sửa">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {!role.isSystem && (
                  <button onClick={() => onDelete(role)} className="p-1.5 rounded-lg text-fg-muted hover:text-danger hover:bg-danger/10 transition-colors" title="Xóa">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
          {role.description && (
            <p className="mt-2 text-xs text-fg-muted line-clamp-2">{role.description}</p>
          )}
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-fg-subtle">
              {role.permissions.length}/{permissions.length} quyền được cấp
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Permissions matrix tab ───────────────────────────────────────────────────

function PermissionsMatrix({
  roles, groups, isAdmin, onToggle,
}: {
  roles: Role[]
  groups: { category: string; items: PermissionDef[] }[]
  isAdmin: boolean
  onToggle: (role: Role, permKey: string) => void
}) {
  if (roles.length === 0) {
    return <EmptyState icon={<Shield className="w-12 h-12" />} title="Chưa có role nào" />
  }
  return (
    <div className="rounded-card border border-border overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-bg-subtle">
              <th className="sticky left-0 z-10 bg-bg-subtle text-left font-semibold text-fg px-4 py-3 min-w-[220px]">
                Permission
              </th>
              {roles.map((r) => (
                <th key={r.id} className="px-3 py-3 text-center font-semibold text-fg whitespace-nowrap min-w-[88px]">
                  {r.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <FragmentGroup key={g.category} group={g} roles={roles} isAdmin={isAdmin} onToggle={onToggle} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FragmentGroup({
  group, roles, isAdmin, onToggle,
}: {
  group: { category: string; items: PermissionDef[] }
  roles: Role[]
  isAdmin: boolean
  onToggle: (role: Role, permKey: string) => void
}) {
  return (
    <>
      <tr>
        <td colSpan={roles.length + 1} className="sticky left-0 bg-bg-surface px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle border-y border-border">
          {group.category}
        </td>
      </tr>
      {group.items.map((perm) => (
        <tr key={perm.key} className="border-t border-border hover:bg-bg-subtle/50">
          <td className="sticky left-0 z-10 bg-bg px-4 py-2.5">
            <p className="font-medium text-fg">{perm.label}</p>
            <p className="text-xs text-fg-subtle">{perm.description}</p>
          </td>
          {roles.map((role) => {
            const granted = role.permissions.includes(perm.key)
            return (
              <td key={role.id} className="px-3 py-2.5 text-center">
                <button
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => onToggle(role, perm.key)}
                  className={cn(
                    'inline-flex h-5 w-5 items-center justify-center rounded border transition-colors',
                    granted ? 'bg-accent border-accent text-white' : 'border-border bg-bg-elevated text-transparent',
                    isAdmin ? 'cursor-pointer hover:border-accent' : 'cursor-default opacity-80',
                  )}
                  aria-label={`${role.name} - ${perm.label}`}
                  aria-pressed={granted}
                >
                  {granted ? <Check className="w-3 h-3" /> : <X className="w-3 h-3 text-fg-subtle/30" />}
                </button>
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}

// ─── Create / edit role modal ─────────────────────────────────────────────────

function RoleFormModal({
  open, role, groups, onClose,
}: {
  open: boolean
  role: Role | null
  groups: { category: string; items: PermissionDef[] }[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const isEdit = !!role
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissions ?? []))

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const { mutate: submit, isPending } = useMutation({
    mutationFn: () => {
      const dto: RoleInput = {
        name: name.trim(),
        description: description.trim(),
        permissions: Array.from(selected),
      }
      return isEdit ? rolesApi.update(role!.id, dto) : rolesApi.create(dto)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      toast.success(isEdit ? 'Đã cập nhật role' : 'Đã tạo role mới')
      onClose()
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
      toast.error(Array.isArray(msg) ? msg[0] : msg || 'Lưu role thất bại')
    },
  })

  const valid = name.trim().length >= 2
  const nameLocked = isEdit && role?.isSystem

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? `Chỉnh sửa role` : 'Tạo role mới'} size="lg">
      <div className="flex flex-col" style={{ maxHeight: '75vh' }}>
        <div className="px-5 pt-4 pb-3 space-y-3 border-b border-border shrink-0">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-fg-muted">Tên role</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={nameLocked}
              placeholder="VD: Reviewer"
              className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {nameLocked && <p className="text-[11px] text-fg-subtle">Role hệ thống không thể đổi tên, nhưng vẫn chỉnh được quyền.</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-fg-muted">Mô tả</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả ngắn về role này..."
              className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-3 space-y-4">
          <p className="text-xs font-medium text-fg-muted">Phân quyền ({selected.size})</p>
          {groups.map((g) => (
            <div key={g.category}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle mb-1.5">{g.category}</p>
              <div className="space-y-1">
                {g.items.map((perm) => {
                  const checked = selected.has(perm.key)
                  return (
                    <button
                      key={perm.key}
                      type="button"
                      onClick={() => toggle(perm.key)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                        checked ? 'bg-accent/5' : 'hover:bg-bg-subtle',
                      )}
                    >
                      <div className={cn(
                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                        checked ? 'bg-accent border-accent' : 'border-border bg-bg-elevated',
                      )}>
                        {checked && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-fg">{perm.label}</p>
                        <p className="text-xs text-fg-subtle">{perm.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-border shrink-0 flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>Hủy</Button>
          <Button variant="primary" size="sm" loading={isPending} disabled={!valid} onClick={() => submit()}>
            {isEdit ? 'Lưu thay đổi' : 'Tạo role'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
