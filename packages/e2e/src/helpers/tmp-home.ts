import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface TmpHome {
  path: string
  cleanup: () => void
}

export function makeTmpHome(): TmpHome {
  const path = mkdtempSync(join(tmpdir(), 'mxs-e2e-'))

  return {
    path,
    cleanup() {
      rmSync(path, { recursive: true, force: true })
    },
  }
}
