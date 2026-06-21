import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, Reply, Pencil, Trash2, MoreHorizontal } from 'lucide-react'
import { commentsApi, type Comment } from '@/api/comments'
import { useAuthStore } from '@/stores/useAuthStore'
import { Avatar, Button, Dropdown, Skeleton } from '@/components/ui'
import { useToast } from '@/hooks/useToast'
import { formatRelative } from '@/lib/utils'

interface Props {
  projectId: string
  taskId: string
}

export function CommentThread({ projectId, taskId }: Props) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const toast = useToast()
  const [content, setContent] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null)

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['comments', projectId, taskId],
    queryFn: () => commentsApi.list(projectId, taskId),
  })

  const { mutate: addComment, isPending } = useMutation({
    mutationFn: () => commentsApi.create(projectId, taskId, {
      content: content.trim(),
      parentId: replyTo?.id,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', projectId, taskId] })
      setContent('')
      setReplyTo(null)
    },
    onError: () => toast.error(t('board.commentFailed')),
  })

  const { mutate: updateComment } = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      commentsApi.update(projectId, taskId, id, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', projectId, taskId] })
      setEditing(null)
    },
    onError: () => toast.error(t('board.commentUpdateFailed')),
  })

  const { mutate: deleteComment } = useMutation({
    mutationFn: (id: string) => commentsApi.delete(projectId, taskId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', projectId, taskId] }),
    onError: () => toast.error(t('board.commentDeleteFailed')),
  })

  const topLevel = comments.filter((c) => !c.parentId)
  const getReplies = (id: string) => comments.filter((c) => c.parentId === id)

  if (isLoading) return (
    <div className="space-y-3">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="flex gap-2">
          <Skeleton className="w-7 h-7 rounded-full shrink-0" />
          <Skeleton className="flex-1 h-14 rounded-lg" />
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-4">
      {topLevel.length === 0 && (
        <p className="text-sm text-fg-subtle text-center py-4">{t('board.noComments')}</p>
      )}

      {topLevel.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          replies={getReplies(comment.id)}
          currentUserId={user?.id}
          editing={editing}
          onReply={setReplyTo}
          onEdit={setEditing}
          onUpdateComment={updateComment}
          onDeleteComment={deleteComment}
        />
      ))}

      {/* Input */}
      <div className="flex gap-2 pt-2 border-t border-border">
        {user && <Avatar name={user.fullName} avatarUrl={user.avatarUrl} size="sm" className="shrink-0 mt-1" />}
        <div className="flex-1 space-y-1.5">
          {replyTo && (
            <div className="flex items-center gap-2 text-xs text-fg-muted bg-bg-elevated rounded-lg px-2.5 py-1.5">
              <Reply className="w-3.5 h-3.5" />
              {t('board.replyingTo', { name: replyTo.author.fullName })}
              <button onClick={() => setReplyTo(null)} className="ml-auto text-fg-subtle hover:text-fg">✕</button>
            </div>
          )}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && content.trim()) addComment()
            }}
            placeholder={t('board.commentPlaceholder')}
            rows={2}
            className="w-full bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-fg resize-none focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-fg-subtle"
          />
          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              disabled={!content.trim()}
              loading={isPending}
              onClick={() => addComment()}
            >
              <Send className="w-3.5 h-3.5" /> {t('board.send')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CommentItem({
  comment, replies, currentUserId, editing,
  onReply, onEdit, onUpdateComment, onDeleteComment,
}: {
  comment: Comment
  replies: Comment[]
  currentUserId?: string
  editing: { id: string; content: string } | null
  onReply: (c: Comment) => void
  onEdit: (e: { id: string; content: string } | null) => void
  onUpdateComment: (args: { id: string; content: string }) => void
  onDeleteComment: (id: string) => void
}) {
  const { t } = useTranslation()
  const isOwn = comment.authorId === currentUserId
  const isEditing = editing?.id === comment.id

  return (
    <div className="flex gap-2 group">
      <Avatar name={comment.author.fullName} avatarUrl={comment.author.avatarUrl} size="sm" className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-fg">{comment.author.fullName}</span>
          <span className="text-xs text-fg-subtle">{formatRelative(comment.createdAt)}</span>
          {comment.editedAt && <span className="text-xs text-fg-subtle">{t('board.edited')}</span>}
        </div>

        {isEditing ? (
          <div className="space-y-1.5">
            <textarea
              value={editing.content}
              onChange={(e) => onEdit({ ...editing, content: e.target.value })}
              autoFocus
              rows={2}
              className="w-full bg-bg-elevated border border-accent rounded-lg px-3 py-2 text-sm text-fg resize-none focus:outline-none"
            />
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => onUpdateComment({ id: comment.id, content: editing.content })}
              >
                {t('common.save')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onEdit(null)}>{t('common.cancel')}</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-fg-muted whitespace-pre-wrap">{comment.content}</p>
        )}

        <div className="flex items-center gap-3 mt-1.5">
          <button
            onClick={() => onReply(comment)}
            className="text-xs text-fg-subtle hover:text-fg flex items-center gap-1 transition-colors"
          >
            <Reply className="w-3 h-3" /> {t('board.reply')}
          </button>
          {isOwn && !isEditing && (
            <Dropdown
              trigger={
                <button title={t('board.editDelete')} className="text-xs text-fg-subtle hover:text-fg opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              }
              items={[
                { label: t('board.edit'), icon: <Pencil className="w-4 h-4" />, onClick: () => onEdit({ id: comment.id, content: comment.content }) },
                { label: t('board.delete'), icon: <Trash2 className="w-4 h-4" />, onClick: () => onDeleteComment(comment.id), danger: true },
              ]}
            />
          )}
        </div>

        {/* Replies */}
        {replies.length > 0 && (
          <div className="mt-3 ml-4 space-y-3 border-l-2 border-border pl-3">
            {replies.map((r) => (
              <CommentItem
                key={r.id}
                comment={r}
                replies={[]}
                currentUserId={currentUserId}
                editing={editing}
                onReply={onReply}
                onEdit={onEdit}
                onUpdateComment={onUpdateComment}
                onDeleteComment={onDeleteComment}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
