import { useEffect, useState } from 'react'
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

  useEffect(() => {
    if (project) {
      setName(project.name)
      setDescription(project.description ?? '')
      const d = (project as { deadline?: string | null }).deadline
      setDeadline(d ? d.slice(0, 10) : '')
    }
  }, [project])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['project', projectId] })
    qc.invalidateQueries({ queryKey: ['projects'] })
    qc.invalidateQueries({ queryKey: ['manage-projects'] })
  }

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () => projectsApi.manageUpdate(projectId, { name: name.trim(), description: description.trim(), deadline: deadline ? new Date(deadline).toISOString() : null }),
    onSuccess: () => { invalidate(); toast.success('Đã lưu thay đổi') },
    onError: (err) => toast.error(apiErrorMessage(err, 'Lưu thất bại')),
  })

  const { mutate: archive, isPending: archiving } = useMutation({
    mutationFn: () => projectsApi.manageArchive(projectId, true),
    onSuccess: () => { invalidate(); toast.success('Đã lưu trữ dự án'); setShowArchive(false); navigate('/projects') },
    onError: (err) => toast.error(apiErrorMessage(err, 'Lưu trữ thất bại')),
  })

  const { mutate: remove, isPending: deleting } = useMutation({
    mutationFn: () => projectsApi.manageDelete(projectId),
    onSuccess: () => { invalidate(); toast.success('Đã xóa dự án'); setShowDelete(false); navigate('/projects') },
    onError: (err) => toast.error(apiErrorMessage(err, 'Xóa thất bại')),
  })

  if (isLoading || !project) {
    return <div className="p-6 max-w-3xl mx-auto space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-card" />)}</div>
  }

  return (
    <div className="h-full overflow-auto scrollbar-thin">
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-fg-muted" />
          <h1 className="text-base font-semibold text-fg">Cài đặt dự án</h1>
        </div>

        <Section icon={<SettingsIcon className="w-4 h-4" />} title="Thông tin chung">
          <div className="space-y-4">
            <div><label className="mb-1 block text-xs font-medium text-fg-muted">Tên dự án *</label><Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} /></div>
            <div><label className="mb-1 block text-xs font-medium text-fg-muted">Mã (slug)</label><Input value={project.slug} disabled /></div>
            <div><label className="mb-1 block text-xs font-medium text-fg-muted">Mô tả</label><Input value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit} /></div>
            <div><label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-fg-muted"><Calendar className="w-3.5 h-3.5" /> Hạn chót</label>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} disabled={!canEdit} className="h-9 rounded-lg border border-border bg-bg-elevated px-3 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60" />
            </div>
            {canEdit && (
              <div className="flex justify-end"><Button variant="primary" size="sm" loading={saving} disabled={name.trim().length < 2} onClick={() => save()}><Save className="w-4 h-4" /> Lưu thay đổi</Button></div>
            )}
          </div>
        </Section>

        <Section icon={<LayoutGrid className="w-4 h-4" />} title="Workflow & Đội ngũ" desc="Quản lý cột bảng và thành viên ở trang riêng">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate(`/projects/${projectId}/tasks`)}><LayoutGrid className="w-4 h-4" /> Quản lý cột (Board)</Button>
            <Button variant="secondary" size="sm" onClick={() => navigate(`/projects/${projectId}/team`)}><Users className="w-4 h-4" /> Thành viên</Button>
          </div>
        </Section>

        {canDelete && (
          <section className="rounded-card border border-danger/30 bg-danger/5">
            <div className="px-5 py-3 border-b border-danger/20 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-danger" />
              <h2 className="text-sm font-semibold text-danger">Vùng nguy hiểm</h2>
            </div>
            <div className="p-5 space-y-3">
              <Row title="Lưu trữ dự án" desc="Ẩn khỏi danh sách, giữ nguyên dữ liệu." action={<Button variant="secondary" size="sm" onClick={() => setShowArchive(true)}><Archive className="w-4 h-4" /> Lưu trữ</Button>} />
              <Row title="Chuyển quyền sở hữu" desc="Chỉ định owner mới cho dự án." action={<Button variant="secondary" size="sm" onClick={() => setShowTransfer(true)}><UserCog className="w-4 h-4" /> Chuyển</Button>} />
              <Row title="Xóa dự án" desc="Xóa mềm; cần gõ slug để xác nhận." action={<Button variant="danger" size="sm" onClick={() => setShowDelete(true)}><Trash2 className="w-4 h-4" /> Xóa</Button>} />
            </div>
          </section>
        )}
      </div>

      <ConfirmDialog open={showArchive} onClose={() => setShowArchive(false)} onConfirm={() => archive()} title="Lưu trữ dự án" message={<>Lưu trữ <span className="font-medium text-fg">"{project.name}"</span>? Có thể khôi phục sau.</>} confirmLabel="Lưu trữ" requireText="archive" danger={false} loading={archiving} />
      <ConfirmDialog open={showDelete} onClose={() => setShowDelete(false)} onConfirm={() => remove()} title="Xóa dự án" message={<>Xóa mềm dự án <span className="font-medium text-fg">"{project.name}"</span>? Gõ slug để xác nhận.</>} confirmLabel="Xóa dự án" requireText={project.slug} loading={deleting} />
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
  const toast = useToast()
  const [ownerId, setOwnerId] = useState('')
  const { data: members = [] } = useQuery({ queryKey: ['members', projectId], queryFn: () => membersApi.list(projectId) })

  const { mutate, isPending } = useMutation({
    mutationFn: () => projectsApi.manageTransferOwner(projectId, ownerId),
    onSuccess: () => { onDone(); toast.success('Đã chuyển quyền sở hữu'); onClose() },
    onError: (err) => toast.error(apiErrorMessage(err, 'Chuyển quyền thất bại')),
  })

  return (
    <Modal open onClose={onClose} title="Chuyển quyền sở hữu" size="sm">
      <div className="px-5 py-4 space-y-3">
        <p className="text-sm text-fg-muted">Chọn thành viên trở thành owner mới của dự án.</p>
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
        <Button variant="ghost" size="sm" onClick={onClose}>Hủy</Button>
        <Button variant="primary" size="sm" loading={isPending} disabled={!ownerId} onClick={() => mutate()}>Chuyển quyền</Button>
      </div>
    </Modal>
  )
}
