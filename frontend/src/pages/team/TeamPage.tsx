import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, User, Briefcase, Search, Check, Trash2 } from 'lucide-react'
import { membersApi, type ProjectMember } from '@/api/members'
import { usersApi, type AppUser } from '@/api/users'
import { Avatar, Button, ConfirmDialog, EmptyState, Modal, Skeleton, Spinner } from '@/components/ui'
import { useToast } from '@/hooks/useToast'
import { useAuthStore } from '@/stores/useAuthStore'
import { useHasPermission } from '@/hooks/usePermissions'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDate, cn } from '@/lib/utils'

const WORKLOAD_OPTIONS = [
  { value: '', key: 'filter.allWorkload' },
  { value: 'overloaded', key: 'filter.workloadOverloaded' },
  { value: 'normal', key: 'filter.workloadNormal' },
  { value: 'free', key: 'filter.workloadFree' },
]

export function TeamPage() {
  const { t } = useTranslation()
  const { projectId = '' } = useParams<{ projectId: string }>()
  const qc = useQueryClient()
  const toast = useToast()
  const { user } = useAuthStore()
  const [workloadFilter, setWorkloadFilter] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<ProjectMember | null>(null)

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', projectId, workloadFilter],
    queryFn: () => membersApi.list(projectId, {
      workload: workloadFilter || undefined,
    }),
    enabled: !!projectId,
  })

  // Member management (invite / remove) is gated by `manage_users` on the backend
  // (admin & owner) — mirror that here so they always see the controls.
  const canManageMembers = useHasPermission('manage_users')

  const { mutate: remove, isPending: removing } = useMutation({
    mutationFn: (userId: string) => membersApi.remove(projectId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', projectId] })
      toast.success(t('team.removed'))
      setRemoveTarget(null)
    },
    onError: () => toast.error(t('team.removeFailed')),
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-base font-semibold text-fg">{t('pages.team')}</h1>
          <p className="text-xs text-fg-muted mt-0.5">{t('pages.teamSubtitle', { count: members.length })}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={workloadFilter}
            onChange={(e) => setWorkloadFilter(e.target.value)}
            className="h-8 rounded-lg border border-border bg-bg-elevated px-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {WORKLOAD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(o.key)}</option>)}
          </select>
          {canManageMembers && (
            <Button variant="primary" size="sm" onClick={() => setShowInvite(true)}>
              <UserPlus className="w-4 h-4" /> {t('team.invite')}
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4 rounded-card border border-border">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            icon={<User className="w-12 h-12" />}
            title={t('team.emptyTitle')}
            action={canManageMembers ? <Button variant="primary" size="sm" onClick={() => setShowInvite(true)}><UserPlus className="w-4 h-4" /> {t('team.inviteNow')}</Button> : undefined}
          />
        ) : (
          <div className="rounded-card border border-border overflow-x-auto scrollbar-thin">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[48%]" />
                <col className="w-[20%]" />
                <col className="w-[22%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead>
                <tr className="bg-bg-subtle text-left text-xs text-fg-muted">
                  <th className="px-4 py-2.5 font-semibold">{t('team.colMember')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('team.colWorkload')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('team.colJoined')}</th>
                  <th className="px-4 py-2.5 font-semibold text-right">{t('team.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.userId} className="border-t border-border hover:bg-bg-subtle/40">
                    {/* Member */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar name={m.user.fullName} avatarUrl={m.user.avatarUrl} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium text-fg truncate">{m.user.fullName}</p>
                          <p className="text-xs text-fg-muted truncate">{m.user.email}</p>
                        </div>
                      </div>
                    </td>
                    {/* Workload */}
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-bg-subtle text-xs text-fg-muted">
                        <Briefcase className="w-3.5 h-3.5 text-fg-subtle" />
                        {t('team.tasksCount', { count: m.taskCount })}
                      </span>
                    </td>
                    {/* Joined */}
                    <td className="px-4 py-2.5 text-xs text-fg-subtle whitespace-nowrap">
                      {formatDate(m.joinedAt)}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-2.5 text-right">
                      {canManageMembers && user?.id !== m.userId && (
                        <button
                          onClick={() => setRemoveTarget(m)}
                          className="p-1.5 rounded-lg text-fg-muted hover:text-danger hover:bg-danger/10 transition-colors"
                          title={t('team.removeFromProject')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <InviteModal
        open={showInvite}
        projectId={projectId}
        onClose={() => setShowInvite(false)}
      />

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => removeTarget && remove(removeTarget.userId)}
        title={t('team.removeTitle')}
        message={removeTarget ? t('team.removeConfirmMsg', { name: removeTarget.user.fullName }) : null}
        confirmLabel={t('team.removeFromProject')}
        loading={removing}
      />
    </div>
  )
}

function InviteModal({ open, projectId, onClose }: { open: boolean; projectId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const debouncedSearch = useDebounce(search, 300)

  const { data: members = [] } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => membersApi.list(projectId),
    enabled: open,
  })

  const { data: allUsers = [], isFetching } = useQuery({
    queryKey: ['users', debouncedSearch],
    queryFn: () => usersApi.list(debouncedSearch || undefined),
    enabled: open,
  })

  const memberIds = useMemo(() => new Set(members.map((m) => m.userId)), [members])

  const availableUsers = useMemo(
    () => allUsers.filter((u) => !memberIds.has(u.id)),
    [allUsers, memberIds],
  )

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === availableUsers.length && availableUsers.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(availableUsers.map((u) => u.id)))
    }
  }

  const { mutate: addMember, isPending } = useMutation({
    mutationFn: (userId: string) => membersApi.add(projectId, { userId, role: 'member' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', projectId] })
    },
  })

  const handleSubmit = async () => {
    if (selected.size === 0) return
    const ids = Array.from(selected)
    let ok = 0
    for (const id of ids) {
      try { await new Promise<void>((res, rej) => addMember(id, { onSuccess: () => res(), onError: rej })); ok++ }
      catch { /* continue adding the remaining selected users */ }
    }
    if (ok > 0) toast.success(t('team.added', { count: ok }))
    if (ok < ids.length) toast.error(t('team.addFailed', { count: ids.length - ok }))
    handleClose()
  }

  const handleClose = () => {
    setSearch('')
    setSelected(new Set())
    onClose()
  }

  const allSelected = availableUsers.length > 0 && selected.size === availableUsers.length

  return (
    <Modal open={open} onClose={handleClose} title={t('team.inviteModalTitle')} size="md">
      <div className="flex flex-col" style={{ maxHeight: '70vh' }}>
        {/* Search */}
        <div className="px-5 pt-4 pb-3 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('filter.searchNameEmail')}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-bg-elevated text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {isFetching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <Spinner size="sm" />
              </span>
            )}
          </div>
        </div>

        {/* User list */}
        <div className="overflow-y-auto flex-1 scrollbar-thin">
          {availableUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-5">
              <User className="w-8 h-8 text-fg-subtle mb-2" />
              <p className="text-sm text-fg-muted">
                {search ? t('team.noUsersFound') : t('team.allAreMembers')}
              </p>
            </div>
          ) : (
            <>
              {/* Select all row */}
              <button
                onClick={toggleAll}
                className="flex w-full items-center gap-3 px-5 py-2.5 hover:bg-bg-subtle transition-colors border-b border-border"
              >
                <div className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                  allSelected ? 'bg-accent border-accent' : 'border-border bg-bg-elevated',
                )}>
                  {allSelected && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <span className="text-xs text-fg-muted font-medium">
                  {t('team.selectAll', { count: availableUsers.length })}
                </span>
              </button>

              {availableUsers.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  checked={selected.has(u.id)}
                  onToggle={() => toggle(u.id)}
                />
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border shrink-0 flex items-center justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={handleClose}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            size="sm"
            loading={isPending}
            disabled={selected.size === 0}
            onClick={handleSubmit}
          >
            {t('team.inviteBtn')} {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function UserRow({ user, checked, onToggle }: { user: AppUser; checked: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-3 px-5 py-3 hover:bg-bg-subtle transition-colors text-left',
        checked && 'bg-accent/5',
      )}
    >
      <div className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
        checked ? 'bg-accent border-accent' : 'border-border bg-bg-elevated',
      )}>
        {checked && <Check className="w-2.5 h-2.5 text-white" />}
      </div>
      <Avatar name={user.fullName} avatarUrl={user.avatarUrl} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-fg truncate">{user.fullName}</p>
        <p className="text-xs text-fg-muted truncate">{user.email}</p>
      </div>
    </button>
  )
}
