/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react'
import Image, { type ImageOptions } from '@tiptap/extension-image'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { attachmentsApi, attachmentFilename } from '@/api/attachments'
import { cn } from '@/lib/utils'

interface SecureImageOptions { projectId: string }

function SecureImageView({ node, extension, selected }: NodeViewProps) {
  const src = (node.attrs.src as string) ?? ''
  const alt = (node.attrs.alt as string | null) ?? ''
  const projectId = (extension.options as SecureImageOptions).projectId
  const filename = attachmentFilename(src)
  const [result, setResult] = useState<{ filename: string; url: string } | null>(null)
  const [failedFor, setFailedFor] = useState<string | null>(null)

  useEffect(() => {
    if (!filename || !projectId) return
    let objectUrl: string | null = null
    let cancelled = false
    attachmentsApi.rawByName(projectId, filename).then((blob) => {
      if (cancelled) return
      objectUrl = URL.createObjectURL(blob)
      setResult({ filename, url: objectUrl })
    }).catch(() => {
      if (!cancelled) setFailedFor(filename)
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [filename, projectId])

  const resolved = filename ? (result?.filename === filename ? result.url : null) : src
  const failed = !!filename && failedFor === filename
  return (
    <NodeViewWrapper as="div" className="my-2">
      {failed ? (
        <span className="inline-block rounded border border-border bg-bg-subtle px-2 py-1 text-xs text-fg-subtle">Không tải được ảnh</span>
      ) : resolved ? (
        <img src={resolved} alt={alt} data-drag-handle className={cn('max-w-full rounded', selected && 'ring-2 ring-accent')} />
      ) : (
        <span className="inline-block h-24 w-40 animate-pulse rounded bg-bg-subtle" />
      )}
    </NodeViewWrapper>
  )
}

export const SecureImage = Image.extend<ImageOptions & SecureImageOptions>({
  addOptions() {
    const parent = this.parent?.()
    return {
      ...parent,
      inline: parent?.inline ?? false,
      allowBase64: parent?.allowBase64 ?? false,
      HTMLAttributes: parent?.HTMLAttributes ?? {},
      resize: parent?.resize ?? false,
      projectId: '',
    }
  },
  addNodeView() { return ReactNodeViewRenderer(SecureImageView) },
})
