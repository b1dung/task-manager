import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Folder, Plus, Pencil, Trash2, ExternalLink, Search, Archive, ArchiveRestore,
  Calendar, Users, ListTodo, X, UserPlus,
} from 'lucide-react'
import { projectsApi, type ManagedProject } from '@/api/projects'
import { usersApi } from '@/api/users'
import { Avatar, Button, ConfirmDialog, EmptyState, Modal, Input, Skeleton, Spinner } from '@/components/ui'
import { useToast } from '@/hooks/useToast'
import { useHasPermission } from '@/hooks/usePermissions'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDate, cn } from '@/lib/utils'

function apiErrorMessage(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
  if (Array.isArray(msg)) return msg[0] ?? fallback
  return msg || fallback
}

export function ManageProjectsPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const canCreate = useHasPermission('create_project')
  const canEdit = useHasPermission('edit_project')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<ManagedProject | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ManagedProject | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<ManagedProject | null>(null)

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['manage-projects'],
    queryFn: projectsApi.manageList,
  })

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase()),
  )

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['manage-projects'] })
    qc.invalidateQueries({ queryKey: ['projects'] })
  }

  const { mutate: archive, isPending: archiving } = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) => projectsApi.manageArchive(id, archived),
    onSuccess: (_d, v) => { invalidate(); setArchiveTarget(null); toast.success(v.archived ? t('manageProjects.archivedProject') : t('manageProjects.restoredProject')) },
    onError: (err) => toast.error(apiErrorMessage(err, t('manageProjects.actionFailed'))),
  })

  const { mutate: removeProject, isPending: deleting } = useMutation({
    mutationFn: (p: ManagedProject) => projectsApi.manageDelete(p.id).then(() => p),
    onSuccess: (p) => {
      invalidate()
      setDeleteTarget(null)
      toast.undo(t('manageProjects.deletedProject', { name: p.name }), () => {
        projectsApi.manageRestore(p.id)
          .then(() => { invalidate(); toast.success(t('manageProjects.projectRestored')) })
          .catch(() => toast.error(t('manageProjects.undoFailed')))
      })
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('manageProjects.deleteFailed'))),
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-base font-semibold text-fg">{t('nav.projectManagement')}</h1>
          <p className="text-xs text-fg-muted mt-0.5">{t('pages.projectManagementSubtitle', { count: projects.length })}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('filter.searchNameSlug')}
              className="h-8 w-56 pl-8 pr-3 rounded-lg border border-border bg-bg-elevated text-xs text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          {canCreate && (
            <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" /> {t('manageProjects.create')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin p-6">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Folder className="w-12 h-12" />} title={t('manageProjects.emptyTitle')} />
        ) : (
          <div className="rounded-card border border-border overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-subtle text-left text-xs text-fg-muted">
                  <th className="px-4 py-2.5 font-semibold">{t('manageProjects.colProject')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('manageProjects.colStatus')}</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">{t('manageProjects.colTaskMember')}</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">{t('manageProjects.colDeadline')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('manageProjects.colOwner')}</th>
                  <th className="px-4 py-2.5 font-semibold text-right">{t('manageProjects.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const archived = !!p.archivedAt
                  return (
                    <tr key={p.id} className={cn('border-t border-border hover:bg-bg-subtle/40', archived && 'opacity-60')}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent">
                            <Folder className="w-3.5 h-3.5" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-fg truncate">{p.name}</p>
                            <p className="text-xs text-fg-subtle font-mono truncate">{p.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          archived ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success',
                        )}>
                          {archived ? t('manageProjects.statusArchived') : t('manageProjects.statusActive')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-fg-muted whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 mr-3"><ListTodo className="w-3.5 h-3.5 text-fg-subtle" />{p.taskCount ?? 0}</span>
                        <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5 text-fg-subtle" />{p.memberCount ?? 0}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs whitespace-nowrap text-fg-muted">
                        {p.deadline ? formatDate(p.deadline) : <span className="text-fg-subtle">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {p.owner ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={p.owner.fullName} avatarUrl={p.owner.avatarUrl} size="xs" />
                            <span className="text-fg truncate">{p.owner.fullName}</span>
                          </div>
                        ) : <span className="text-fg-subtle text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button onClick={() => navigate(`/projects/${p.id}/tasks`)} className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-bg-subtle transition-colors" title={t('manageProjects.openBoard')}>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <button onClick={() => setEditTarget(p)} className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-bg-subtle transition-colors" title={t('manageProjects.edit')}>
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canEdit && (
                            <button onClick={() => archived ? archive({ id: p.id, archived: false }) : setArchiveTarget(p)} className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-bg-subtle transition-colors" title={archived ? t('manageProjects.restore') : t('manageProjects.archive')}>
                              {archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <button onClick={() => setDeleteTarget(p)} className="p-1.5 rounded-lg text-fg-muted hover:text-danger hover:bg-danger/10 transition-colors" title={t('manageProjects.deleteProject')}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateProjectModal open={showCreate} onClose={() => setShowCreate(false)} />
      {editTarget && <EditProjectModal project={editTarget} onClose={() => setEditTarget(null)} />}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && removeProject(deleteTarget)}
        title={t('manageProjects.deleteTitle')}
        message={deleteTarget ? t('manageProjects.deleteMsg', { name: deleteTarget.name }) : null}
        warning={deleteTarget && (deleteTarget.taskCount ?? 0) > 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm">
            <ListTodo className="w-4 h-4 text-warning mt-0.5 shrink-0" />
            <span className="text-fg-muted">
              {t('manageProjects.deleteWarning', { count: deleteTarget.taskCount ?? 0 })}
            </span>
          </div>
        ) : undefined}
        confirmLabel={t('manageProjects.deletePermanent')}
        requireText="delete"
        loading={deleting}
      />

      <ConfirmDialog
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => archiveTarget && archive({ id: archiveTarget.id, archived: true })}
        title={t('manageProjects.archiveTitle')}
        message={archiveTarget ? t('manageProjects.archiveMsg', { name: archiveTarget.name }) : null}
        confirmLabel={t('manageProjects.archive')}
        requireText="archive"
        danger={false}
        loading={archiving}
      />
    </div>
  )
}

function CreateProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const { mutate, isPending } = useMutation({
    mutationFn: () => projectsApi.manageCreate({ name: name.trim(), description: description.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manage-projects'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success(t('manageProjects.createdProject'))
      setName(''); setDescription(''); onClose()
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('manageProjects.createFailed'))),
  })

  return (
    <Modal open={open} onClose={onClose} title={t('manageProjects.createTitle')} size="sm">
      <div className="px-5 py-4 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-fg-muted">{t('manageProjects.name')} *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('manageProjects.namePlaceholder')} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-fg-muted">{t('manageProjects.description')}</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('manageProjects.descriptionPlaceholder')} />
        </div>
      </div>
      <div className="px-5 py-4 border-t border-border flex justify-end gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" size="sm" loading={isPending} disabled={name.trim().length < 2} onClick={() => mutate()}>{t('manageProjects.create2')}</Button>
      </div>
    </Modal>
  )
}

function EditProjectModal({ project, onClose }: { project: ManagedProject; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [deadline, setDeadline] = useState(project.deadline ? project.deadline.slice(0, 10) : '')

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['manage-projects'] })
    qc.invalidateQueries({ queryKey: ['projects'] })
  }

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => projectsApi.manageUpdate(project.id, {
      name: name.trim(),
      description: description.trim(),
      deadline: deadline ? new Date(deadline).toISOString() : null,
    }),
    onSuccess: () => { invalidate(); toast.success(t('manageProjects.savedProject')); onClose() },
    onError: (err) => toast.error(apiErrorMessage(err, t('manageProjects.saveFailed'))),
  })

  return (
    <Modal open onClose={onClose} title={t('manageProjects.editTitle')} size="md">
      <div className="px-5 py-4 space-y-4 max-h-[65vh] overflow-y-auto scrollbar-thin">
        <div>
          <label className="mb-1 block text-xs font-medium text-fg-muted">{t('manageProjects.name')} *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-fg-muted">{t('manageProjects.description')}</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-fg-muted"><Calendar className="w-3.5 h-3.5" /> {t('manageProjects.deadline')}</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="h-9 rounded-lg border border-border bg-bg-elevated px-3 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <MembersEditor projectId={project.id} />
      </div>
      <div className="px-5 py-4 border-t border-border flex justify-end gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>{t('common.close')}</Button>
        <Button variant="primary" size="sm" loading={isPending} disabled={name.trim().length < 2} onClick={() => save()}>{t('manageProjects.saveChanges')}</Button>
      </div>
    </Modal>
  )
}

function MembersEditor({ projectId }: { projectId: string }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search, 300)
  const [adding, setAdding] = useState(false)

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['manage-project-members', projectId],
    queryFn: () => projectsApi.manageMembers(projectId),
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users', debounced],
    queryFn: () => usersApi.list(debounced || undefined),
    enabled: adding,
  })

  const memberIds = new Set(members.map((m) => m.userId))
  const candidates = users.filter((u) => !memberIds.has(u.id)).slice(0, 6)

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['manage-project-members', projectId] })
    qc.invalidateQueries({ queryKey: ['manage-projects'] })
  }

  const { mutate: add } = useMutation({
    mutationFn: (userId: string) => projectsApi.manageAddMember(projectId, userId),
    onSuccess: () => { refresh(); setSearch('') },
    onError: (err) => toast.error(apiErrorMessage(err, t('manageProjects.addMemberFailed'))),
  })
  const { mutate: remove } = useMutation({
    mutationFn: (userId: string) => projectsApi.manageRemoveMember(projectId, userId),
    onSuccess: refresh,
    onError: (err) => toast.error(apiErrorMessage(err, t('manageProjects.removeMemberFailed'))),
  })

  return (
    <div className="pt-2 border-t border-border">
      <div className="flex items-center justify-between mb-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-fg-muted"><Users className="w-3.5 h-3.5" /> {t('manageProjects.membersLabel')} ({members.length})</label>
        <button onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
          <UserPlus className="w-3.5 h-3.5" /> {t('manageProjects.add')}
        </button>
      </div>

      {adding && (
        <div className="mb-2 rounded-lg border border-border p-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('filter.searchNameEmail')} />
          {candidates.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 max-h-40 overflow-y-auto scrollbar-thin">
              {candidates.map((u) => (
                <li key={u.id}>
                  <button onClick={() => add(u.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-bg-subtle">
                    <Avatar name={u.fullName} avatarUrl={u.avatarUrl} size="xs" />
                    <span className="flex-1 min-w-0 truncate">{u.fullName}</span>
                    <Plus className="w-3.5 h-3.5 text-accent" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-3"><Spinner size="sm" /></div>
      ) : (
        <ul className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm">
              <Avatar name={m.user.fullName} avatarUrl={m.user.avatarUrl} size="xs" />
              <div className="flex-1 min-w-0">
                <p className="text-fg truncate">{m.user.fullName}</p>
                <p className="text-xs text-fg-subtle truncate">{m.role} · {m.user.email}</p>
              </div>
              <button onClick={() => remove(m.userId)} className="p-1 rounded text-fg-muted hover:text-danger hover:bg-danger/10" title={t('manageProjects.removeFromProject')}>
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
