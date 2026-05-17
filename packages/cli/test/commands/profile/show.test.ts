import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { run } from '../../../src/commands/profile/show'
import type { OutputOptions } from '../../../src/core/output'

let tmpDir: string
let origXdg: string | undefined

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mxs-show-test-'))
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

async function makeProfile(
  name: string,
  cfg: Record<string, unknown> = {},
  creds?: Record<string, unknown>,
) {
  const dir = path.join(mxsDir(), 'profiles', name)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, 'config.json'), JSON.stringify(cfg))
  if (creds) {
    await fs.writeFile(path.join(dir, 'credentials.json'), JSON.stringify(creds), { mode: 0o600 })
  }
}

async function setCurrent(name: string) {
  await fs.mkdir(mxsDir(), { recursive: true })
  await fs.writeFile(path.join(mxsDir(), 'current'), `${name}\n`)
}

const out: OutputOptions = { json: true, output: 'json', quiet: true, verbose: false }

describe('profile show', () => {
  it('shows named profile info with credentials', async () => {
    const expiresAt = Date.now() + 3600_000
    await makeProfile(
      'dev',
      { api_url: 'http://dev.local', production: false },
      { access_token: 'tok', expires_at: expiresAt, user: { id: 'u1', email: 'a@b.com' } },
    )

    const writes: string[] = []
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((c: any) => { writes.push(String(c)); return true })
    await run('dev', {}, out)
    spy.mockRestore()

    const result = JSON.parse(writes.join(''))
    expect(result.ok).toBe(true)
    expect(result.data.name).toBe('dev')
    expect(result.data.api_url).toBe('http://dev.local')
    expect(result.data.authenticated).toBe(true)
    expect(result.data.user?.email).toBe('a@b.com')
    expect(result.data.expires_at).toBe(expiresAt)
    // Token must NOT be in output
    expect(JSON.stringify(result)).not.toContain('tok')
  })

  it('shows active profile when no name passed', async () => {
    await makeProfile('dev', { api_url: 'http://dev.local' })
    await setCurrent('dev')

    const writes: string[] = []
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((c: any) => { writes.push(String(c)); return true })
    await run(undefined, {}, out)
    spy.mockRestore()

    const result = JSON.parse(writes.join(''))
    expect(result.data.name).toBe('dev')
  })

  it('throws profile.none_active when no name and no current', async () => {
    await expect(run(undefined, {}, out)).rejects.toMatchObject({
      code: 'profile.none_active',
    })
  })

  it('throws profile.not_found for non-existent profile', async () => {
    await expect(run('ghost', {}, out)).rejects.toMatchObject({
      code: 'profile.not_found',
    })
  })

  it('shows unauthenticated when no credentials file', async () => {
    await makeProfile('dev', { api_url: 'http://dev.local' })

    const writes: string[] = []
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((c: any) => { writes.push(String(c)); return true })
    await run('dev', {}, out)
    spy.mockRestore()

    const result = JSON.parse(writes.join(''))
    expect(result.data.authenticated).toBe(false)
    expect(result.data.user).toBeNull()
  })
})
