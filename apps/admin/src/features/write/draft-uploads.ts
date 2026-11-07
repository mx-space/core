import { useMemo, useRef } from 'react'

import { uploadFile, uploadFileWithProgress } from '~/api/files'

import { createExcalidrawSnapshotSaver } from './excalidraw-snapshot-saver'

type ProgressOptions = { onProgress?: (percent: number) => void }

export function createDraftUploads(
  readDraftId: () => string | undefined,
  api = { uploadFile, uploadFileWithProgress },
) {
  const getDraftId = () => readDraftId() || undefined
  const withProgress = async (
    file: File,
    type: 'file' | 'video',
    opts?: ProgressOptions,
  ) => {
    const result = await api.uploadFileWithProgress(file, {
      type,
      draftId: getDraftId(),
      onProgress: (percent) => opts?.onProgress?.(percent),
    })
    return { src: result.url }
  }

  return {
    getDraftId,
    imageUpload: async (file: File, options?: { keepOriginal?: boolean }) => {
      const result = await api.uploadFile(file, 'image', {
        raw: options?.keepOriginal,
        draftId: getDraftId(),
      })
      return { src: result.url }
    },
    trackUpload: async (file: File) => {
      const result = await api.uploadFile(file, 'file', {
        draftId: getDraftId(),
      })
      return { url: result.url }
    },
    videoUpload: (file: File, opts?: ProgressOptions) =>
      withProgress(file, 'video', opts),
    fileUpload: (file: File, opts?: ProgressOptions) =>
      withProgress(file, 'file', opts),
    saveExcalidrawSnapshot: createExcalidrawSnapshotSaver(
      getDraftId,
      api.uploadFile,
    ),
  }
}

export function useDraftUploads(draftId: string | undefined) {
  const draftIdRef = useRef(draftId)
  draftIdRef.current = draftId
  return useMemo(() => createDraftUploads(() => draftIdRef.current), [])
}
