import type { ChangeEvent } from 'react'

export async function handleFileInputChange(
  event: ChangeEvent<HTMLInputElement>,
  handleFiles: (files: File[]) => Promise<void>,
) {
  await handleFiles(Array.from(event.target.files ?? []))
}

export async function readMarkdownFile(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (
    (file.type && file.type !== 'text/markdown') ||
    !['md', 'markdown'].includes(ext ?? '')
  ) {
    throw new Error(`markdown.fileType.error:${file.type || ext}`)
  }

  return file.text()
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
