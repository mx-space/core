import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { run } from '../../../src/commands/profile/mark'
import type { OutputOptions } from '../../../src/core/output'
import { MxsErrorCode } from '../../../src/core/errors'

let tmpDir: string
let origXdg: string | undefined

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mxs-mark-test-'))
  origXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = tmpDir
})

afterEach(async () => {
  if (origXdg === undefined) delete process.env.XDG_CONFIG_HOME
  else process.env.XDG_CONFIG_HOME = origXdg
  await fs.rm(tmpDir, { recursive: true, force: true })
})

function mxsDir() {
  return path.join(tmpDir, 'mxs')
}

async function makeProfile(name: string, cfg: Record<string, unknown> = {}) {
  const dir = path.join(mxsDir(), 'profiles', name)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'config.json'), JSON.stringify(cfg))
}

async function readConfig(name: string): Promise<any> {
  return JSON.parse(
    await fs.readFile(path.join(mxsDir(), 'profiles', name, 'config.json'), 'utf8'),
  )
}

const out: OutputOptions = { json: false, output: 'readable', quiet: false, verbose: false }

describe('profile mark', () => {
  it('marks profile as production', async () => {
    await makeProfile('dev', { api_url: 'http://dev.local' })
    const writes: string[] = []
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation((c: any) => { writes.push(String(c)); return true })
    await run('dev', { production: true }, {}, out)
    spy.mockRestore()

    const cfg = await readConfig('dev')
    expect(cfg.production).toBe(true)
    expect(writes.join('')).toContain('--production')
  })

  it('marks profile as non-production', async () => {
    await makeProfile('prod', { api_url: 'https://prod.example.com', production: true })
    const spy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    await run('prod', { production: false }, {}, out)
    spy.mockRestore()

    const cfg = await readConfig('prod')
    expect(cfg.production).toBe(false)
  })

  it('throws validation.failed when no flag supplied', async () => {
    await makeProfile('dev', {})
    await expect(run('dev', {}, {}, out)).rejects.toMatchObject({
      code: MxsErrorCode.ValidationFailed,
    })
  })

  it('throws profile.not_found for missing profile', async () => {
    await expect(run('ghost', { production: true }, {}, out)).rejects.toMatchObject({
      code: MxsErrorCode.ProfileNotFound,
    })
  })
})
