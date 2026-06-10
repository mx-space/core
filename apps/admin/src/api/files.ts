import { API_URL } from '~/constants/env'
import { translate } from '~/i18n/translate'

import { deleteJson, getJson, patchJson, requestJson } from './http'

export interface FileItem {
  thumbhash?: null | string
  created?: number
  name: string
  palette?: { dominant?: string; swatches?: string[] } | null
  url: string
}

export interface UploadResponse {
  thumbhash?: null | string
  name: string
  palette?: { dominant?: string; swatches?: string[] } | null
  url: string
}

export interface OrphanFile {
  thumbhash?: null | string
  byteSize?: null | number
  createdAt: string
  detachedAt?: null | string
  fileName: string
  fileUrl: string
  id: string
  mimeType?: null | string
  readerId?: null | string
  refId?: null | string
  refType?: null | string
  palette?: { dominant?: string; swatches?: string[] } | null
  status?: 'active' | 'detached' | 'pending'
  uploadedBy?: null | string
}

export interface FileListPagination {
  currentPage: number
  hasNextPage: boolean
  hasPrevPage: boolean
  size: number
  total: number
  totalPage: number
}

export interface OrphanListResponse {
  data: OrphanFile[]
  pagination: FileListPagination
}

export interface CleanupResult {
  deletedCount: number
  totalOrphan: number
}

export interface CommentUploadFile {
  thumbhash?: null | string
  byteSize?: number
  createdAt: string
  detachedAt?: string
  fileName: string
  fileUrl: string
  id: string
  mimeType?: string
  readerId?: string
  refId?: string
  refType?: string
  palette?: { dominant?: string; swatches?: string[] } | null
  status: 'active' | 'detached' | 'pending'
}

export interface CommentUploadListResponse {
  data: CommentUploadFile[]
  pagination: FileListPagination
}

export type FileType = 'avatar' | 'file' | 'icon' | 'image' | 'video'
export type CommentUploadStatus = '' | 'active' | 'detached' | 'pending'

export function getFilesByType(type: FileType) {
  return getJson<FileItem[]>(`/files/${type}`)
}

export function uploadFile(file: File, type?: FileType) {
  const formData = new FormData()
  formData.append('file', file)

  const query = type ? `?type=${encodeURIComponent(type)}` : ''

  return requestJson<UploadResponse>(`/files/upload${query}`, {
    body: formData,
    method: 'POST',
  })
}

export function uploadFileWithProgress(
  file: File,
  options: {
    onProgress: (progress: number) => void
    type?: FileType
  },
) {
  const formData = new FormData()
  formData.append('file', file)

  const query = options.type ? `?type=${encodeURIComponent(options.type)}` : ''

  return new Promise<UploadResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.open('POST', `${API_URL}/files/upload${query}`)
    xhr.withCredentials = true
    xhr.setRequestHeader('x-skip-translation', '1')

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      options.onProgress(Math.round((event.loaded / event.total) * 100))
    }

    xhr.onload = () => {
      const responseData = readXhrJson(xhr.responseText)

      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(readXhrError(responseData, xhr.statusText)))
        return
      }

      options.onProgress(100)
      resolve(readUploadResponse(responseData))
    }

    xhr.onerror = () => reject(new Error(translate('api.error.uploadFailed')))
    xhr.send(formData)
  })
}

export function updateFile(type: FileType, name: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)

  return requestJson<UploadResponse>(
    `/files/${type}/${encodeURIComponent(name)}`,
    {
      body: formData,
      method: 'PUT',
    },
  )
}

export function deleteFileByTypeAndName(type: FileType, name: string) {
  return deleteJson<void>(`/files/${type}/${encodeURIComponent(name)}`)
}

export function renameFile(type: FileType, name: string, newName: string) {
  return patchJson<void, { name: string }>(
    `/files/${type}/${encodeURIComponent(name)}/rename`,
    { name: newName },
  )
}

export function getOrphanFiles(page = 1, size = 24) {
  return getJson<OrphanListResponse>('/files/orphans/list', { page, size })
}

export function getOrphanFileCount() {
  return getJson<{ count: number }>('/files/orphans/count')
}

export function cleanupOrphanFiles(maxAgeMinutes = 60) {
  return requestJson<CleanupResult>(
    `/files/orphans/cleanup?maxAgeMinutes=${maxAgeMinutes}`,
    { method: 'POST' },
  )
}

export function batchDeleteOrphanFiles(
  options: { all: true } | { ids: string[] },
) {
  return deleteJson<{ deletedCount: number }, typeof options>(
    '/files/orphans/batch',
    options,
  )
}

export function getCommentUploads(params: {
  page?: number
  readerId?: string
  refId?: string
  size?: number
  status?: Exclude<CommentUploadStatus, ''>
}) {
  return getJson<CommentUploadListResponse>('/files/comment-uploads/list', {
    page: params.page,
    readerId: params.readerId,
    refId: params.refId,
    size: params.size,
    status: params.status,
  })
}

export function deleteCommentUpload(id: string) {
  return deleteJson<{ storageRemoved: boolean }>(`/files/comment-uploads/${id}`)
}

function readXhrJson(text: string) {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function readUploadResponse(responseData: unknown): UploadResponse {
  if (
    responseData &&
    typeof responseData === 'object' &&
    'data' in responseData
  ) {
    return (responseData as { data: UploadResponse }).data
  }

  return responseData as UploadResponse
}

function readXhrError(responseData: unknown, fallback: string) {
  if (!responseData || typeof responseData !== 'object') return fallback

  const message =
    'error' in responseData
      ? (responseData as { error?: { message?: string | string[] } }).error
          ?.message
      : 'message' in responseData
        ? (responseData as { message?: string | string[] }).message
        : undefined

  return Array.isArray(message) ? message.join(', ') : (message ?? fallback)
}
