/**
 * Pending upload store for image uploads
 * Stores base64 data for images being uploaded so they can be previewed
 */

export interface PendingUpload {
  base64: string
  status: 'uploading' | 'error'
  fileName?: string
}

// Global store for pending uploads, keyed by upload ID
const pendingUploads = new Map<string, PendingUpload>()

// Listeners for store changes
type StoreListener = () => void
const listeners = new Set<StoreListener>()

export function addPendingUpload(
  uploadId: string,
  base64: string,
  fileName?: string,
): void {
  pendingUploads.set(uploadId, {
    base64,
    status: 'uploading',
    fileName,
  })
  notifyListeners()
}

export function getPendingUpload(uploadId: string): PendingUpload | undefined {
  return pendingUploads.get(uploadId)
}

export function setPendingUploadError(uploadId: string): void {
  const upload = pendingUploads.get(uploadId)
  if (upload) {
    upload.status = 'error'
    notifyListeners()
  }
}

export function removePendingUpload(uploadId: string): void {
  pendingUploads.delete(uploadId)
  notifyListeners()
}

export function isPendingUploadId(url: string): boolean {
  return url.startsWith('__upload_') && url.endsWith('__')
}

export function subscribeToUploadStore(listener: StoreListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notifyListeners(): void {
  listeners.forEach((listener) => listener())
}
