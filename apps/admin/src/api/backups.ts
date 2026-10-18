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
  encrypted?: boolean
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

export function rollbackBackup({
  filename,
  decryptionKey,
}: {
  filename: string
  decryptionKey?: string
}) {
  return patchJson<void, { decryptionKey?: string }>(
    `/backups/rollback/${encodeURIComponent(filename)}`,
    { decryptionKey },
  )
}

export async function uploadAndRestoreBackup({
  file,
  decryptionKey,
}: {
  file: File
  decryptionKey?: string
}) {
  const formData = new FormData()
  if (decryptionKey) formData.append('decryptionKey', decryptionKey)
  formData.append('file', file)

  await requestJson<void>('/backups/rollback', {
    body: formData,
    method: 'POST',
  })
}
