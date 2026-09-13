import { watch } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, dirname } from 'node:path'

export interface AuthorWatcher {
  readonly close: () => void
}

export function watchAuthorFile(
  filePath: string,
  onText: (text: string) => void,
  debounceMs = 100,
): AuthorWatcher {
  const name = basename(filePath)
  let timer: NodeJS.Timeout | undefined
  // Editors and our own save replace the inode via rename, so watch the
  // directory and filter by name instead of watching the file itself.
  const watcher = watch(dirname(filePath), (_event, changed) => {
    if (changed !== null && changed !== name) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      void readFile(filePath, 'utf8').then(onText, () => undefined)
    }, debounceMs)
  })
  return {
    close: () => {
      clearTimeout(timer)
      watcher.close()
    },
  }
}
