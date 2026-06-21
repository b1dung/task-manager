import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Folder } from 'lucide-react'
import { projectsApi } from '@/api/projects'
import { Button, EmptyState, Modal, Input, Skeleton } from '@/components/ui'
import { useToast } from '@/hooks/useToast'
import { useForm } from 'react-hook-form'
import { usePermissions } from '@/hooks/usePermissions'
import { useTranslation } from 'react-i18next'

export function ProjectsPage() {
  const { t } = useTranslation()
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
      toast.success(t('projects.created'))
      setShowCreate(false)
      reset()
      navigate(`/projects/${p.id}/tasks`)
    },
    onError: () => toast.error(t('projects.createFailed')),
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-fg">{t('projects.title')}</h1>
        {canCreate && (
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> {t('projects.create')}
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
          title={t('projects.empty')}
          description={canCreate ? t('projects.emptyCreate') : t('projects.emptyMember')}
          action={
            canCreate ? (
              <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4" /> {t('projects.create')}
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

      <Modal open={showCreate} onClose={() => { setShowCreate(false); reset() }} title={t('projects.createTitle')} size="sm">
        <form onSubmit={handleSubmit((d) => create(d))} className="p-5 space-y-4">
          <Input {...register('name', { required: true })} label={t('projects.name')} placeholder={t('projects.namePlaceholder')} />
          <Input {...register('description')} label={t('projects.description')} placeholder={t('projects.descriptionPlaceholder')} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => { setShowCreate(false); reset() }}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" loading={isPending}>{t('common.create')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
