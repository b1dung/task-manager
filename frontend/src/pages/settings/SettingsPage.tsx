import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Settings as SettingsIcon, Save, Archive, UserCog, Trash2, AlertTriangle,
  LayoutGrid, Users, Calendar,
} from 'lucide-react'
import { projectsApi } from '@/api/projects'
import { membersApi } from '@/api/members'
import { Avatar, Button, ConfirmDialog, Input, Modal, Skeleton } from '@/components/ui'
import { useToast } from '@/hooks/useToast'
import { useHasPermission } from '@/hooks/usePermissions'

function apiErrorMessage(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
  if (Array.isArray(msg)) return msg[0] ?? fallback
  return msg || fallback
}

function Section({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-bg-elevated">
      <div className="px-5 py-3 border-b border-border flex items-center gap-2">
        <span className="text-fg-muted">{icon}</span>
        <div>
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          {desc && <p className="text-xs text-fg-subtle">{desc}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

export function SettingsPage() {
  const { t } = useTranslation()
  const { projectId = '' } = useParams<{ projectId: string }>()
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const canEdit = useHasPermission('edit_project')
  const canDelete = useHasPermission('delete_project')

  const { data: project, isLoading } = useQuery({ queryKey: ['project', projectId], queryFn: () => projectsApi.get(projectId), enabled: !!projectId })

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [showArchive, setShowArchive] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null)
  if (project && loadedProjectId !== project.id) {
    setLoadedProjectId(project.id)
    setName(project.name)
    setDescription(project.description ?? '')
    const d = (project as { deadline?: string | null }).deadline
    setDeadline(d ? d.slice(0, 10) : '')
  }

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['project', projectId] })
    qc.invalidateQueries({ queryKey: ['projects'] })
    qc.invalidateQueries({ queryKey: ['manage-projects'] })
  }

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () => projectsApi.manageUpdate(projectId, { name: name.trim(), description: description.trim(), deadline: deadline ? new Date(deadline).toISOString() : null }),
    onSuccess: () => { invalidate(); toast.success(t('settings.saved')) },
    onError: (err) => toast.error(apiErrorMessage(err, t('settings.saveFailed'))),
  })

  const { mutate: archive, isPending: archiving } = useMutation({
    mutationFn: () => projectsApi.manageArchive(projectId, true),
    onSuccess: () => { invalidate(); toast.success(t('settings.archived')); setShowArchive(false); navigate('/projects') },
    onError: (err) => toast.error(apiErrorMessage(err, t('settings.archiveFailed'))),
  })

  const { mutate: remove, isPending: deleting } = useMutation({
    mutationFn: () => projectsApi.manageDelete(projectId),
    onSuccess: () => { invalidate(); toast.success(t('settings.deleted')); setShowDelete(false); navigate('/projects') },
    onError: (err) => toast.error(apiErrorMessage(err, t('settings.deleteFailed'))),
  })

  if (isLoading || !project) {
    return <div className="p-6 max-w-3xl mx-auto space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-card" />)}</div>
  }

  return (
    <div className="h-full overflow-auto scrollbar-thin">
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-fg-muted" />
          <h1 className="text-base font-semibold text-fg">{t('pages.settings')}</h1>
        </div>

        <Section icon={<SettingsIcon className="w-4 h-4" />} title={t('settings.generalInfo')}>
          <div className="space-y-4">
            <div><label className="mb-1 block text-xs font-medium text-fg-muted">{t('settings.projectName')} *</label><Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} /></div>
            <div><label className="mb-1 block text-xs font-medium text-fg-muted">{t('settings.slug')}</label><Input value={project.slug} disabled /></div>
            <div><label className="mb-1 block text-xs font-medium text-fg-muted">{t('settings.description')}</label><Input value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit} /></div>
            <div><label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-fg-muted"><Calendar className="w-3.5 h-3.5" /> {t('settings.deadline')}</label>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} disabled={!canEdit} className="h-9 rounded-lg border border-border bg-bg-elevated px-3 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60" />
            </div>
            {canEdit && (
              <div className="flex justify-end"><Button variant="primary" size="sm" loading={saving} disabled={name.trim().length < 2} onClick={() => save()}><Save className="w-4 h-4" /> {t('settings.saveChanges')}</Button></div>
            )}
          </div>
        </Section>

        <Section icon={<LayoutGrid className="w-4 h-4" />} title={t('settings.workflowTeam')} desc={t('settings.workflowTeamDesc')}>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate(`/projects/${projectId}/tasks`)}><LayoutGrid className="w-4 h-4" /> {t('settings.manageColumns')}</Button>
            <Button variant="secondary" size="sm" onClick={() => navigate(`/projects/${projectId}/team`)}><Users className="w-4 h-4" /> {t('settings.members')}</Button>
          </div>
        </Section>

        {canDelete && (
          <section className="rounded-card border border-danger/30 bg-danger/5">
            <div className="px-5 py-3 border-b border-danger/20 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-danger" />
              <h2 className="text-sm font-semibold text-danger">{t('settings.dangerZone')}</h2>
            </div>
            <div className="p-5 space-y-3">
              <Row title={t('settings.archiveRowTitle')} desc={t('settings.archiveRowDesc')} action={<Button variant="secondary" size="sm" onClick={() => setShowArchive(true)}><Archive className="w-4 h-4" /> {t('settings.archive')}</Button>} />
              <Row title={t('settings.transferRowTitle')} desc={t('settings.transferRowDesc')} action={<Button variant="secondary" size="sm" onClick={() => setShowTransfer(true)}><UserCog className="w-4 h-4" /> {t('settings.transfer')}</Button>} />
              <Row title={t('settings.deleteRowTitle')} desc={t('settings.deleteRowDesc')} action={<Button variant="danger" size="sm" onClick={() => setShowDelete(true)}><Trash2 className="w-4 h-4" /> {t('common.delete')}</Button>} />
            </div>
          </section>
        )}
      </div>

      <ConfirmDialog open={showArchive} onClose={() => setShowArchive(false)} onConfirm={() => archive()} title={t('settings.archiveTitle')} message={t('settings.archiveMsg', { name: project.name })} confirmLabel={t('settings.archive')} requireText="archive" danger={false} loading={archiving} />
      <ConfirmDialog open={showDelete} onClose={() => setShowDelete(false)} onConfirm={() => remove()} title={t('settings.deleteTitle')} message={t('settings.deleteMsg', { name: project.name })} confirmLabel={t('settings.deleteProject')} requireText={project.slug} loading={deleting} />
      {showTransfer && <TransferOwnerModal projectId={projectId} onClose={() => setShowTransfer(false)} onDone={invalidate} />}
    </div>
  )
}

function Row({ title, desc, action }: { title: string; desc: string; action: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div><p className="text-sm font-medium text-fg">{title}</p><p className="text-xs text-fg-muted">{desc}</p></div>
      {action}
    </div>
  )
}

function TransferOwnerModal({ projectId, onClose, onDone }: { projectId: string; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [ownerId, setOwnerId] = useState('')
  const { data: members = [] } = useQuery({ queryKey: ['members', projectId], queryFn: () => membersApi.list(projectId) })

  const { mutate, isPending } = useMutation({
    mutationFn: () => projectsApi.manageTransferOwner(projectId, ownerId),
    onSuccess: () => { onDone(); toast.success(t('settings.transferred')); onClose() },
    onError: (err) => toast.error(apiErrorMessage(err, t('settings.transferFailed'))),
  })

  return (
    <Modal open onClose={onClose} title={t('settings.transferTitle')} size="sm">
      <div className="px-5 py-4 space-y-3">
        <p className="text-sm text-fg-muted">{t('settings.transferDesc')}</p>
        <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin">
          {members.map((m) => (
            <button key={m.userId} onClick={() => setOwnerId(m.userId)} className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${ownerId === m.userId ? 'border-accent bg-accent/5' : 'border-border hover:bg-bg-subtle'}`}>
              <Avatar name={m.user.fullName} avatarUrl={m.user.avatarUrl} size="xs" />
              <span className="flex-1 min-w-0 truncate text-fg">{m.user.fullName}</span>
              <span className="text-xs text-fg-subtle">{m.role}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="px-5 py-4 border-t border-border flex justify-end gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" size="sm" loading={isPending} disabled={!ownerId} onClick={() => mutate()}>{t('settings.transferConfirm')}</Button>
      </div>
    </Modal>
  )
}
