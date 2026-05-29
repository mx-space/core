import { useCallback, useEffect, useRef, useState } from 'react'
import type { FileType } from '~/api/files'

import { uploadFileWithProgress } from '~/api/files'

import { getErrorMessage } from '../utils/format'

export interface UploadItem {
  id: string
  name: string
  progress: number
  status: 'done' | 'error' | 'uploading'
  error?: string
}

interface UseFileUploaderOptions {
  type: FileType
  acceptImage: boolean
  onValidationError: (message: string) => void
  onSettled: (result: { successCount: number; failureCount: number }) => void
  maxVisible?: number
  uploadFailedMessage: string
  notImageMessage: (name: string) => string
}

export function useFileUploader(options: UseFileUploaderOptions) {
  const { maxVisible = 8 } = options
  const [items, setItems] = useState<UploadItem[]>([])
  const optionsRef = useRef(options)
  optionsRef.current = options

  const upload = useCallback(
    async (files: File[]) => {
      const cfg = optionsRef.current
      const valid = files.filter((file) => {
        if (!cfg.acceptImage || file.type.startsWith('image/')) return true
        cfg.onValidationError(cfg.notImageMessage(file.name))
        return false
      })
      if (valid.length === 0) return

      const seeded: UploadItem[] = valid.map((file) => ({
        id: `${file.name}-${file.lastModified}-${file.size}-${crypto.randomUUID()}`,
        name: file.name,
        progress: 0,
        status: 'uploading',
      }))

      setItems((previous) => [...seeded, ...previous].slice(0, maxVisible))

      const results = await Promise.allSettled(
        valid.map((file, index) =>
          uploadFileWithProgress(file, {
            onProgress: (progress) => {
              setItems((previous) =>
                previous.map((item) =>
                  item.id === seeded[index].id ? { ...item, progress } : item,
                ),
              )
            },
            type: cfg.type,
          }),
        ),
      )

      setItems((previous) =>
        previous.map((item) => {
          const index = seeded.findIndex((seed) => seed.id === item.id)
          if (index === -1) return item
          const result = results[index]
          if (result.status === 'fulfilled') {
            return { ...item, progress: 100, status: 'done' }
          }
          return {
            ...item,
            error: getErrorMessage(result.reason, cfg.uploadFailedMessage),
            status: 'error',
          }
        }),
      )

      const successCount = results.filter(
        (r) => r.status === 'fulfilled',
      ).length
      const failureCount = results.length - successCount
      cfg.onSettled({ successCount, failureCount })
    },
    [maxVisible],
  )

  const clearDone = useCallback(() => {
    setItems((previous) =>
      previous.filter((item) => item.status === 'uploading'),
    )
  }, [])

  // Auto-prune: drop done items 4s after they settle so the dock stays calm.
  useEffect(() => {
    const hasResolved = items.some((item) => item.status !== 'uploading')
    if (!hasResolved) return
    const handle = setTimeout(() => {
      setItems((previous) =>
        previous.filter((item) => item.status === 'uploading'),
      )
    }, 4000)
    return () => clearTimeout(handle)
  }, [items])

  const busy = items.some((item) => item.status === 'uploading')

  return { items, busy, upload, clearDone }
}
