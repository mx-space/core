import { exec } from 'child_process'
import { promisify } from 'util'

export async function getFolderSize(folderPath: string) {
  try {
    return (
      (
        await promisify(exec)(`du -shc ${folderPath} | head -n 1 | cut -f1`, {
          encoding: 'utf-8',
        })
      ).stdout.split('\t')[0] || 'N/A'
    )
  } catch {
    return 'N/A'
  }
}

export const formatByteSize = (byteSize: number) => {
  let size: string
  if (byteSize > 1024 * 1024 * 1024) {
    size = `${(byteSize / 1024 / 1024 / 1024).toFixed(2)} GB`
  } else if (byteSize > 1024 * 1024) {
    size = `${(byteSize / 1024 / 1024).toFixed(2)} MB`
  } else if (byteSize > 1024) {
    size = `${(byteSize / 1024).toFixed(2)} KB`
  } else {
    size = `${byteSize} B`
  }
  return size
}
