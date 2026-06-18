import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = fileURLToPath(new URL('../../../..', import.meta.url))

export type StaticFileType = 'file' | 'image' | 'icon' | 'avatar'

// Mirrors apps/core/src/constants/path.constant.ts: in dev mode
// (which setup.ts forces) DATA_DIR = `<cwd>/tmp`, so the static dir is
// `<workspaceRoot>/tmp/static`. Vitest workers run from the workspace root.
export const E2E_DATA_DIR = join(workspaceRoot, 'tmp')
export const E2E_STATIC_FILE_DIR = join(E2E_DATA_DIR, 'static')
export const E2E_STATIC_FILE_TRASH_DIR = join(E2E_DATA_DIR, 'trash')

export function staticFilePath(
  type: StaticFileType | string,
  name: string,
): string {
  return join(E2E_STATIC_FILE_DIR, type, name)
}

export function cleanStaticFiles(): void {
  for (const dir of [E2E_STATIC_FILE_DIR, E2E_STATIC_FILE_TRASH_DIR]) {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  }
}
