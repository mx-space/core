import {
  deleteJson,
  getJson,
  patchJson,
  requestBlob,
  requestJson,
} from './http'

export interface BackupFile {
  createdAt: string
  filename: string
  size: string
}

export async function getBackups() {
  return getJson<BackupFile[]>('/backups')
}

export function createBackup() {
  return requestBlob('/backups/new')
}

export function downloadBackup(filename: string) {
  return requestBlob(`/backups/${encodeURIComponent(filename)}`)
}

export function deleteBackup(filename: string) {
  return deleteJson<void>(`/backups/${encodeURIComponent(filename)}`)
}

export function rollbackBackup(filename: string) {
  return patchJson<void, Record<string, never>>(
    `/backups/rollback/${encodeURIComponent(filename)}`,
    {},
  )
}

export async function uploadAndRestoreBackup(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  await requestJson<void>('/backups/rollback', {
    body: formData,
    method: 'POST',
  })
}
