import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { run } from '../../../src/commands/profile/use'
import type { OutputOptions } from '../../../src/core/output'
import { MxsErrorCode } from '../../../src/core/errors'

let tmpDir: string
let origXdg: string | undefined

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mxs-use-test-'))
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

async function makeProfile(name: string) {
  const dir = path.join(mxsDir(), 'profiles', name)
  await fs.mkdir(dir, { recursive: true })
}

async function readCurrent(): Promise<string> {
  return (await fs.readFile(path.join(mxsDir(), 'current'), 'utf8')).trim()
}

const out: OutputOptions = { json: false, output: 'readable', quiet: false, verbose: false }

describe('profile use', () => {
  it('sets the active profile', async () => {
    await makeProfile('dev')
    const writes: string[] = []
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation((c: any) => { writes.push(String(c)); return true })
    await run('dev', {}, out)
    spy.mockRestore()

    expect(await readCurrent()).toBe('dev')
    expect(writes.join('')).toContain("active profile is now 'dev'")
  })

  it('throws profile.not_found for missing profile dir', async () => {
    await expect(run('ghost', {}, out)).rejects.toMatchObject({
      code: MxsErrorCode.ProfileNotFound,
    })
  })

  it('throws profile.invalid_name for invalid name', async () => {
    await expect(run('HAS SPACES', {}, out)).rejects.toMatchObject({
      code: MxsErrorCode.ProfileInvalidName,
    })
  })

  it('throws profile.invalid_name for reserved name', async () => {
    await expect(run('current', {}, out)).rejects.toMatchObject({
      code: MxsErrorCode.ProfileInvalidName,
    })
  })
})
