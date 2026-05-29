export function formatBytes(bytes: null | number | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function isPreviewColor(value: string | undefined): boolean {
  if (!value) return false
  return (
    /^#[0-9a-f]{3,8}$/i.test(value) ||
    /^rgba?\([\d\s.,%]+\)$/i.test(value) ||
    /^hsla?\([\d\s.,%a-z-]+\)$/i.test(value)
  )
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}
