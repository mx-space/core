import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

export type StaticFileType = 'file' | 'image' | 'icon' | 'avatar'

// Mirrors apps/core/src/constants/path.constant.ts: in dev mode (which
// setup.ts forces) DATA_DIR = `<cwd>/tmp`. The vitest worker's cwd is
// `packages/e2e/` (pnpm -C runs from there), so the server writes under
// `packages/e2e/tmp/static`. Compute lazily so the helper tracks whatever
// cwd the server itself captured at module-load time.
const dataDir = () => join(process.cwd(), 'tmp')
export const E2E_STATIC_FILE_DIR = join(dataDir(), 'static')
export const E2E_STATIC_FILE_TRASH_DIR = join(dataDir(), 'trash')

export function staticFilePath(
  type: StaticFileType | string,
  name: string,
): string {
  return join(dataDir(), 'static', type, name)
}

export function cleanStaticFiles(): void {
  for (const dir of [E2E_STATIC_FILE_DIR, E2E_STATIC_FILE_TRASH_DIR]) {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  }
}
