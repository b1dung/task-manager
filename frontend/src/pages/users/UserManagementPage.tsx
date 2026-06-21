/* eslint-disable react-hooks/set-state-in-effect */
import { useMemo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Shield, User, Mail, Lock, Search, Pencil, Link2, Copy, Check, Trash2, Clock } from 'lucide-react'
import { usersApi, type AppUser } from '@/api/users'
import { rolesApi, type Role } from '@/api/roles'
import { invitesApi, type Invite } from '@/api/invites'
import { Avatar, Button, EmptyState, Modal, Skeleton, Spinner } from '@/components/ui'
import { useToast } from '@/hooks/useToast'
import { useHasPermission } from '@/hooks/usePermissions'
import { useAuthStore } from '@/stores/useAuthStore'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDate, cn } from '@/lib/utils'

const inputCls =
  'w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent transition-shadow'
const labelCls = 'flex items-center gap-1.5 text-xs font-medium text-fg-muted'
const EMAIL_RE = /\S+@\S+\.\S+/

function apiErrorMessage(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response
    ?.data?.message
  if (Array.isArray(msg)) return msg[0] ?? fallback
  return msg || fallback
}

export function UserManagementPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const toast = useToast()
  const canManage = useHasPermission('manage_users')
  const currentUserId = useAuthStore((s) => s.user?.id)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [showCreate, setShowCreate] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', debouncedSearch],
    queryFn: () => usersApi.list(debouncedSearch || undefined),
  })
  const pendingCount = users.filter((u) => !u.isActive).length

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: rolesApi.listRoles,
  })
  const roleById = useMemo(
    () => new Map(roles.map((r) => [r.id, r])),
    [roles],
  )

  // Only an owner can manage (edit role/status/delete) another owner — mirror the
  // backend guard so admins don't see actions that would just 403.
  const { data: myPerms } = useQuery({
    queryKey: ['me', 'permissions'],
    queryFn: rolesApi.myPermissions,
    staleTime: 5 * 60_000,
  })
  const iAmOwner = myPerms?.roleKey === 'owner'
  const isOwnerUser = (u: AppUser) => !!u.roleId && roleById.get(u.roleId)?.key === 'owner'
  const canActOn = (u: AppUser) => iAmOwner || !isOwnerUser(u)

  const { mutate: patchUser } = useMutation({
    mutationFn: ({ id, ...dto }: { id: string; roleId?: string | null; isActive?: boolean }) =>
      usersApi.update(id, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['me', 'permissions'] })
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('users.updateFailed'))),
  })

  const { mutate: deleteUser, isPending: deleting } = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(t('users.deleted'))
      setDeleteTarget(null)
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('users.deleteFailed'))),
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-base font-semibold text-fg">{t('pages.users')}</h1>
          <p className="text-xs text-fg-muted mt-0.5">
            {t('pages.usersSubtitle', { count: users.length })}
            {pendingCount > 0 && (
              <span className="text-warning"> · {t('pages.usersPending', { count: pendingCount })}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('filter.searchNameEmail')}
              className="h-8 w-56 pl-8 pr-3 rounded-lg border border-border bg-bg-elevated text-xs text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          {canManage && (
            <>
              <Button variant="secondary" size="sm" onClick={() => setShowInvite(true)}>
                <Link2 className="w-4 h-4" /> {t('users.inviteLink')}
              </Button>
              <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
                <UserPlus className="w-4 h-4" /> {t('users.createUser')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin p-6">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : users.length === 0 ? (
          <EmptyState icon={<User className="w-12 h-12" />} title={t('users.emptyTitle')} />
        ) : (
          <div className="rounded-card border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-subtle text-left text-xs text-fg-muted">
                  <th className="px-4 py-2.5 font-semibold">{t('users.colUser')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('users.colEmail')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('users.colRole')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('users.colStatus')}</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">{t('users.colCreated')}</th>
                  {canManage && <th className="px-4 py-2.5 font-semibold text-right">{t('users.colActions')}</th>}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border hover:bg-bg-subtle/40">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.fullName} avatarUrl={u.avatarUrl} size="sm" />
                        <span className="font-medium text-fg">{u.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-fg-muted">{u.email}</td>
                    <td className="px-4 py-2.5">
                      {canManage && canActOn(u) ? (
                        <select
                          value={u.roleId ?? ''}
                          onChange={(e) => patchUser({ id: u.id, roleId: e.target.value || null })}
                          className="h-8 max-w-[180px] rounded-lg border border-border bg-bg-elevated px-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent"
                        >
                          <option value="">{t('users.defaultRole', { role: u.role })}</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-fg">
                          {u.roleId ? roleById.get(u.roleId)?.name ?? '—' : t('users.defaultRole', { role: u.role })}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {canManage && canActOn(u) ? (
                        u.isActive ? (
                          <button
                            type="button"
                            onClick={() => patchUser({ id: u.id, isActive: false })}
                            className="inline-flex items-center gap-2"
                            title={t('users.lockAccount')}
                          >
                            <span className="relative h-5 w-9 shrink-0 rounded-full bg-accent">
                              <span className="absolute top-0.5 left-0.5 h-4 w-4 translate-x-4 rounded-full bg-white" />
                            </span>
                            <span className="text-xs text-fg-muted">{t('users.active')}</span>
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                              <Clock className="w-3 h-3" /> {t('users.pending')}
                            </span>
                            <Button size="sm" variant="primary" onClick={() => patchUser({ id: u.id, isActive: true })}>
                              <Check className="w-3.5 h-3.5" /> {t('users.approve')}
                            </Button>
                          </div>
                        )
                      ) : (
                        <span className={cn('text-xs', u.isActive ? 'text-success' : 'text-warning')}>
                          {u.isActive ? t('users.active') : t('users.pending')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-fg-subtle text-xs whitespace-nowrap">{formatDate(u.createdAt)}</td>
                    {canManage && (
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          {canActOn(u) && (
                            <button
                              onClick={() => setEditId(u.id)}
                              className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-bg-subtle transition-colors"
                              title={t('users.edit')}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {u.id !== currentUserId && canActOn(u) && (
                            <button
                              onClick={() => setDeleteTarget(u)}
                              className="p-1.5 rounded-lg text-fg-muted hover:text-danger hover:bg-danger/10 transition-colors"
                              title={t('users.deleteUser')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canManage && (
        <>
          <CreateUserModal open={showCreate} roles={roles} onClose={() => setShowCreate(false)} />
          <EditUserModal open={!!editId} userId={editId} roles={roles} onClose={() => setEditId(null)} />
          <InviteModal open={showInvite} roles={roles} onClose={() => setShowInvite(false)} />
          <Modal open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} title={t('users.deleteTitle')} size="sm">
            {deleteTarget && (
              <>
                <div className="px-5 py-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={deleteTarget.fullName} avatarUrl={deleteTarget.avatarUrl} size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-fg truncate">{deleteTarget.fullName}</p>
                      <p className="text-xs text-fg-muted truncate">{deleteTarget.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm">
                    <Trash2 className="w-4 h-4 text-danger mt-0.5 shrink-0" />
                    <span className="text-fg-muted">{t('users.deleteWarning')}</span>
                  </div>
                </div>
                <div className="px-5 py-4 border-t border-border flex justify-end gap-3">
                  <Button variant="ghost" size="sm" disabled={deleting} onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
                  <Button variant="danger" size="sm" loading={deleting} onClick={() => deleteUser(deleteTarget.id)}>
                    {t('users.deletePermanent')}
                  </Button>
                </div>
              </>
            )}
          </Modal>
        </>
      )}
    </div>
  )
}

function InviteModal({ open, roles, onClose }: { open: boolean; roles: Role[]; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [created, setCreated] = useState<{ email: string; link: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: pending = [] } = useQuery({
    queryKey: ['invites'],
    queryFn: invitesApi.listPending,
    enabled: open,
  })

  const handleClose = () => {
    setEmail(''); setRoleId(''); setCreated(null); setCopied(false)
    onClose()
  }

  const { mutate: submit, isPending } = useMutation({
    mutationFn: () => invitesApi.create({ email: email.trim(), roleId: roleId || undefined }),
    onSuccess: (inv) => {
      setCreated({ email: inv.email, link: inv.link })
      setEmail(''); setRoleId('')
      qc.invalidateQueries({ queryKey: ['invites'] })
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('users.inviteCreateFailed'))),
  })

  const { mutate: revoke } = useMutation({
    mutationFn: (id: string) => invitesApi.revoke(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
    onError: (err) => toast.error(apiErrorMessage(err, t('users.revokeFailed'))),
  })

  const copyLink = async () => {
    if (!created) return
    await navigator.clipboard.writeText(created.link)
    setCopied(true)
    toast.success(t('users.linkCopied'))
    setTimeout(() => setCopied(false), 2000)
  }

  const valid = EMAIL_RE.test(email.trim())

  return (
    <Modal open={open} onClose={handleClose} title={t('users.inviteTitle')} size="md">
      <div className="px-5 py-4 space-y-4">
        {created ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2.5 text-sm">
              <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
              <span className="text-fg-muted">{t('users.inviteCreatedMsg', { email: created.email })}</span>
            </div>
            <div className="flex items-center gap-2">
              <input readOnly value={created.link} className={cn(inputCls, 'font-mono text-xs')} />
              <Button variant="secondary" size="sm" onClick={copyLink}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setCreated(null)}>{t('users.inviteAnother')}</Button>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className={labelCls}><Mail className="w-3.5 h-3.5" /> {t('users.inviteEmailLabel')}</label>
              <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@taskboard.dev" />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}><Shield className="w-3.5 h-3.5" /> {t('users.roleLabel')}</label>
              <select className={inputCls} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                <option value="">{t('users.defaultMember')}</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <Button variant="primary" size="sm" className="w-full" loading={isPending} disabled={!valid} onClick={() => submit()}>
              <Link2 className="w-4 h-4" /> {t('users.createInviteLink')}
            </Button>
          </>
        )}

        {pending.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-medium text-fg-muted mb-2">{t('users.pendingInvites', { count: pending.length })}</p>
            <ul className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
              {pending.map((inv: Invite) => (
                <li key={inv.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-fg truncate">{inv.email}</p>
                    <p className="text-xs text-fg-subtle">{inv.roleName ?? 'Member'} · {t('users.expiresOn', { date: formatDate(inv.expiresAt) })}</p>
                  </div>
                  <button
                    onClick={() => revoke(inv.id)}
                    className="p-1.5 rounded-lg text-fg-muted hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
                    title={t('users.revokeInvite')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="px-5 py-4 border-t border-border flex justify-end">
        <Button variant="ghost" size="sm" onClick={handleClose}>{t('common.close')}</Button>
      </div>
    </Modal>
  )
}

function CreateUserModal({ open, roles, onClose }: { open: boolean; roles: Role[]; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const toast = useToast()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId] = useState('')

  const handleClose = () => {
    setFullName(''); setEmail(''); setPassword(''); setRoleId('')
    onClose()
  }

  const { mutate: submit, isPending } = useMutation({
    mutationFn: async () => {
      const created = await usersApi.create({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
      })
      if (roleId) await usersApi.update(created.id, { roleId })
      return created
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(t('users.createdUser'))
      handleClose()
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('users.createUserFailed'))),
  })

  const valid = fullName.trim().length >= 2 && EMAIL_RE.test(email.trim()) && password.length >= 8

  return (
    <Modal open={open} onClose={handleClose} title={t('users.createUser')} size="md">
      <div className="px-5 py-4 space-y-4">
        <div className="space-y-1.5">
          <label className={labelCls}><User className="w-3.5 h-3.5" /> {t('users.fullNameLabel')}</label>
          <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('users.fullNamePlaceholder')} />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}><Mail className="w-3.5 h-3.5" /> Email</label>
          <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@taskboard.dev" />
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}><Lock className="w-3.5 h-3.5" /> {t('users.passwordLabel')}</label>
          <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('users.passwordPlaceholder')} />
          {password.length > 0 && password.length < 8 && (
            <p className="text-xs text-danger">{t('users.passwordMin8')}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}><Shield className="w-3.5 h-3.5" /> {t('users.roleLabel')}</label>
          <select className={inputCls} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            <option value="">{t('users.defaultMember')}</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </div>
      <div className="px-5 py-4 border-t border-border flex justify-end gap-3">
        <Button variant="ghost" size="sm" onClick={handleClose}>{t('common.cancel')}</Button>
        <Button variant="primary" size="sm" loading={isPending} disabled={!valid} onClick={() => submit()}>
          {t('users.createUserBtn')}
        </Button>
      </div>
    </Modal>
  )
}

function EditUserModal({ open, userId, roles, onClose }: { open: boolean; userId: string | null; roles: Role[]; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const toast = useToast()

  const { data: detail, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersApi.get(userId!),
    enabled: open && !!userId,
  })

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (detail) {
      setFullName(detail.fullName)
      setEmail(detail.email)
      setRoleId(detail.roleId ?? '')
      setIsActive(detail.isActive)
    }
  }, [detail])

  const { mutate: save, isPending } = useMutation({
    mutationFn: () =>
      usersApi.update(userId!, {
        fullName: fullName.trim(),
        email: email.trim(),
        roleId: roleId || null,
        isActive,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', userId] })
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['me', 'permissions'] })
      toast.success(t('users.userUpdated'))
      onClose()
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('users.updateFailed'))),
  })

  const dirty =
    !!detail &&
    (fullName.trim() !== detail.fullName ||
      email.trim() !== detail.email ||
      roleId !== (detail.roleId ?? '') ||
      isActive !== detail.isActive)
  const valid = fullName.trim().length >= 2 && EMAIL_RE.test(email.trim())

  return (
    <Modal open={open} onClose={onClose} title={t('users.editTitle')} size="md">
      {isLoading || !detail ? (
        <div className="flex items-center justify-center py-16"><Spinner /></div>
      ) : (
        <>
          <div className="px-5 py-4 space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={detail.fullName} avatarUrl={detail.avatarUrl} size="lg" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg truncate">{detail.fullName}</p>
                <p className="text-xs text-fg-muted truncate">{detail.email}</p>
                <p className="mt-1 text-xs text-fg-subtle">{t('users.createdOn', { date: formatDate(detail.createdAt) })}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}><User className="w-3.5 h-3.5" /> {t('users.fullNameLabel')}</label>
              <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}><Mail className="w-3.5 h-3.5" /> Email</label>
              <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}><Shield className="w-3.5 h-3.5" /> {t('users.roleLabel')}</label>
              <select className={inputCls} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                <option value="">{t('users.defaultByRole', { role: detail.role })}</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-elevated px-3 py-2.5 cursor-pointer">
              <span className="text-sm text-fg">{t('users.accountActive')}</span>
              <button
                type="button"
                onClick={() => setIsActive((v) => !v)}
                className={cn(
                  'relative h-5 w-9 shrink-0 rounded-full transition-colors',
                  isActive ? 'bg-accent' : 'bg-bg-subtle border border-border',
                )}
              >
                <span className={cn(
                  'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
                  isActive ? 'left-0.5 translate-x-4' : 'left-0.5',
                )} />
              </button>
            </label>
          </div>
          <div className="px-5 py-4 border-t border-border flex justify-end gap-3">
            <Button variant="ghost" size="sm" onClick={onClose}>{t('common.close')}</Button>
            <Button variant="primary" size="sm" loading={isPending} disabled={!dirty || !valid} onClick={() => save()}>
              {t('users.saveChanges')}
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
