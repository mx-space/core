export function formatBackupDate(filename: string) {
  const match = filename.match(/(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})/)
  if (match) {
    return `${match[1]} ${match[2].replaceAll('-', ':')}`
  }
  return filename
}

export function saveBackupBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${filename}.${blob.type === 'application/zip' ? 'zip' : 'mxbackup'}`
  anchor.click()
  URL.revokeObjectURL(url)
}
