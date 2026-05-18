import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Create an isolated `XDG_CONFIG_HOME` so the spawned CLI never touches the
 * developer's real `~/.config/mxs/` profile store. Returns a cleanup fn.
 */
export const makeTmpHome = (): (() => void) => {
  const dir = mkdtempSync(join(tmpdir(), 'mxs-int-'))
  const prevXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = dir
  return () => {
    if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME
    else process.env.XDG_CONFIG_HOME = prevXdg
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
}
