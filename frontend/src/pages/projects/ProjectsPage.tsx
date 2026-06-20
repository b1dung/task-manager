import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Folder } from 'lucide-react'
import { projectsApi } from '@/api/projects'
import { Button, EmptyState, Modal, Input, Skeleton } from '@/components/ui'
import { useToast } from '@/hooks/useToast'
import { useForm } from 'react-hook-form'
import { usePermissions } from '@/hooks/usePermissions'

export function ProjectsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const canCreate = usePermissions().includes('create_project')
  const [showCreate, setShowCreate] = useState(false)

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })

  const { register, handleSubmit, reset } = useForm<{ name: string; description?: string }>()

  const { mutate: create, isPending } = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Dự án đã được tạo')
      setShowCreate(false)
      reset()
      navigate(`/projects/${p.id}/tasks`)
    },
    onError: () => toast.error('Tạo dự án thất bại'),
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-fg">Dự án</h1>
        {canCreate && (
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> Tạo dự án
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-card" />)}
        </div>
      ) : !projects?.length ? (
        <EmptyState
          icon={<Folder className="w-12 h-12" />}
          title="Chưa có dự án nào"
          description={canCreate ? 'Tạo dự án đầu tiên để bắt đầu quản lý công việc' : 'Bạn chưa được thêm vào dự án nào'}
          action={
            canCreate ? (
              <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4" /> Tạo dự án
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/projects/${p.id}/tasks`)}
              className="rounded-card border border-border bg-bg-elevated p-4 text-left hover:border-accent/50 hover:bg-accent/5 transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center mb-3">
                <Folder className="w-4 h-4 text-accent" />
              </div>
              <p className="font-medium text-fg text-sm group-hover:text-accent transition-colors">{p.name}</p>
              {p.description && <p className="mt-1 text-xs text-fg-muted line-clamp-2">{p.description}</p>}
            </button>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => { setShowCreate(false); reset() }} title="Tạo dự án mới" size="sm">
        <form onSubmit={handleSubmit((d) => create(d))} className="p-5 space-y-4">
          <Input {...register('name', { required: true })} label="Tên dự án" placeholder="VD: Website Redesign" />
          <Input {...register('description')} label="Mô tả (tùy chọn)" placeholder="Mô tả ngắn về dự án..." />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => { setShowCreate(false); reset() }}>Hủy</Button>
            <Button variant="primary" type="submit" loading={isPending}>Tạo</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
