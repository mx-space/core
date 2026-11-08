import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { useI18n } from '~/i18n'

import {
  classifyFile,
  type ComposerAttachment,
  MAX_ATTACHMENTS,
  MAX_IMAGE_BYTES,
  MAX_TEXT_BYTES,
} from './composer-attachments'

export type UploadImage = (
  file: File,
  onProgress: (progress: number) => void,
) => Promise<string>

const createPreview = (file: File) =>
  typeof URL.createObjectURL === 'function'
    ? URL.createObjectURL(file)
    : undefined

const revokePreview = (attachment: ComposerAttachment) => {
  if (attachment.previewUrl && typeof URL.revokeObjectURL === 'function')
    URL.revokeObjectURL(attachment.previewUrl)
}

export function useComposerAttachments(uploadImage: UploadImage) {
  const { t } = useI18n()
  const [items, setItems] = useState<ComposerAttachment[]>([])
  const itemsRef = useRef(items)
  itemsRef.current = items
  const filesRef = useRef(new Map<string, File>())

  useEffect(
    () => () => {
      for (const item of itemsRef.current) revokePreview(item)
    },
    [],
  )

  const patch = (id: string, change: Partial<ComposerAttachment>) =>
    setItems((list) =>
      list.map((item) => (item.id === id ? { ...item, ...change } : item)),
    )

  const load = (item: ComposerAttachment, file: File) => {
    const failed = (error: unknown) =>
      patch(item.id, {
        error: error instanceof Error ? error.message : String(error),
        status: 'error',
      })
    if (item.kind === 'text') {
      file
        .text()
        .then(
          (content) =>
            patch(item.id, { content, progress: 100, status: 'ready' }),
          failed,
        )
      return
    }
    uploadImage(file, (progress) => patch(item.id, { progress })).then(
      (url) => patch(item.id, { progress: 100, status: 'ready', url }),
      failed,
    )
  }

  const add = (files: File[]) => {
    const room = MAX_ATTACHMENTS - itemsRef.current.length
    if (files.length > room)
      toast.error(t('write.agent.attachment.limit', { count: MAX_ATTACHMENTS }))
    const accepted: Array<{ item: ComposerAttachment; file: File }> = []
    for (const file of files.slice(0, Math.max(room, 0))) {
      const kind = classifyFile(file)
      if (!kind) {
        toast.error(
          t('write.agent.attachment.unsupported', { name: file.name }),
        )
        continue
      }
      if (file.size > (kind === 'image' ? MAX_IMAGE_BYTES : MAX_TEXT_BYTES)) {
        toast.error(t('write.agent.attachment.tooLarge', { name: file.name }))
        continue
      }
      const item: ComposerAttachment = {
        id: crypto.randomUUID(),
        kind,
        mimeType: file.type || 'text/plain',
        name: file.name || (kind === 'image' ? 'image.png' : 'file.txt'),
        previewUrl: kind === 'image' ? createPreview(file) : undefined,
        progress: 0,
        size: file.size,
        status: 'uploading',
      }
      filesRef.current.set(item.id, file)
      accepted.push({ file, item })
    }
    if (!accepted.length) return
    setItems((list) => [...list, ...accepted.map(({ item }) => item)])
    for (const { file, item } of accepted) load(item, file)
  }

  const remove = (id: string) => {
    const item = itemsRef.current.find((entry) => entry.id === id)
    if (item) revokePreview(item)
    filesRef.current.delete(id)
    setItems((list) => list.filter((entry) => entry.id !== id))
  }

  const retry = (id: string) => {
    const item = itemsRef.current.find((entry) => entry.id === id)
    const file = filesRef.current.get(id)
    if (!item || !file) return
    patch(id, { error: undefined, progress: 0, status: 'uploading' })
    load(item, file)
  }

  const take = () => {
    const taken = itemsRef.current
    for (const item of taken) revokePreview(item)
    filesRef.current.clear()
    setItems([])
    return taken
  }

  return {
    add,
    items,
    remove,
    retry,
    take,
    uploading: items.some((item) => item.status === 'uploading'),
  }
}
