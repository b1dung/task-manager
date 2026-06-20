import { useEffect, useState } from 'react'
import Image, { type ImageOptions } from '@tiptap/extension-image'
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from '@tiptap/react'
import { attachmentsApi, attachmentFilename } from '@/api/attachments'
import { cn } from '@/lib/utils'

export interface SecureImageOptions {
  /** Project the editor belongs to — used to fetch member-only inline images. */
  projectId: string
}

/**
 * Inline description images are stored as private attachments (`/uploads/attachments/...`)
 * which are no longer served statically. This NodeView fetches them through the
 * authenticated, membership-scoped endpoint and renders an object URL so the
 * `<img>` works without exposing the file publicly. External URLs render as-is.
 */
function SecureImageView({ node, extension, selected }: NodeViewProps) {
  const src = (node.attrs.src as string) ?? ''
  const alt = (node.attrs.alt as string | null) ?? ''
  const projectId = (extension.options as SecureImageOptions).projectId
  const filename = attachmentFilename(src)

  const [resolved, setResolved] = useState<string | null>(
    filename ? null : src,
  )
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!filename || !projectId) {
      setResolved(filename ? null : src)
      return
    }
    let objectUrl: string | null = null
    let cancelled = false
    setResolved(null)
    setFailed(false)
    attachmentsApi
      .rawByName(projectId, filename)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setResolved(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [filename, projectId, src])

  return (
    <NodeViewWrapper as="div" className="my-2">
      {failed ? (
        <span className="inline-block rounded border border-border bg-bg-subtle px-2 py-1 text-xs text-fg-subtle">
          Không tải được ảnh
        </span>
      ) : resolved ? (
        <img
          src={resolved}
          alt={alt}
          data-drag-handle
          className={cn(
            'max-w-full rounded',
            selected && 'ring-2 ring-accent',
          )}
        />
      ) : (
        <span className="inline-block h-24 w-40 animate-pulse rounded bg-bg-subtle" />
      )}
    </NodeViewWrapper>
  )
}

export const SecureImage = Image.extend<ImageOptions & SecureImageOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      projectId: '',
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(SecureImageView)
  },
})
