import { execSync } from 'child_process'

export function getFolderSize(folderPath: string) {
  try {
    return (
      execSync(`du -shc ${folderPath} | head -n 1 | cut -f1`, {
        encoding: 'utf-8',
      }).split('\t')[0] || 'N/A'
    )
  } catch {
    return 'N/A'
  }
}
