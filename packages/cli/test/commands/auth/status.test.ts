import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { run } from '../../../src/commands/auth/status'
import type { OutputOptions } from '../../../src/core/output'

let tmpDir: string
let origXdg: string | undefined

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mxs-status-test-'))
  origXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = tmpDir
})

afterEach(async () => {
  if (origXdg === undefined) delete process.env.XDG_CONFIG_HOME
  else process.env.XDG_CONFIG_HOME = origXdg
  await fs.rm(tmpDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

function mxsDir() {
  return path.join(tmpDir, 'mxs')
}

async function makeProfile(
  name: string,
  creds: object | null = { access_token: 'tok', expires_at: Date.now() + 3600_000 },
) {
  const dir = path.join(mxsDir(), 'profiles', name)
  await fs.mkdir(dir, { recursive: true })
  if (creds) {
    await fs.writeFile(
      path.join(dir, 'credentials.json'),
      JSON.stringify(creds),
      { mode: 0o600 },
    )
  }
}

async function setCurrent(name: string) {
  await fs.mkdir(mxsDir(), { recursive: true })
  await fs.writeFile(path.join(mxsDir(), 'current'), `${name}\n`)
}

const out: OutputOptions = { json: true, output: 'json', quiet: true, verbose: false }

describe('auth status', () => {
  it('returns authenticated:true when credentials exist in the active profile', async () => {
    const expiresAt = Date.now() + 3600_000
    await makeProfile('default', {
      access_token: 'my-token',
      expires_at: expiresAt,
      user: { id: 'u1', email: 'owner@example.com' },
    })
    await setCurrent('default')

    const writes: string[] = []
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      writes.push(String(chunk))
      return true
    })

    await run({}, out)

    const result = JSON.parse(writes.join(''))
    expect(result.ok).toBe(true)
    expect(result.data.authenticated).toBe(true)
    expect(result.data.expires_at).toBe(expiresAt)
    expect(result.data.has_refresh).toBe(false)
  })

  it('returns authenticated:false when no current profile is set', async () => {
    const writes: string[] = []
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      writes.push(String(chunk))
      return true
    })

    await run({}, out)

    const result = JSON.parse(writes.join(''))
    expect(result.ok).toBe(true)
    expect(result.data.authenticated).toBe(false)
  })

  it('returns authenticated:false when profile has no credentials file', async () => {
    await makeProfile('empty', null)
    await setCurrent('empty')

    const writes: string[] = []
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      writes.push(String(chunk))
      return true
    })

    await run({}, out)

    const result = JSON.parse(writes.join(''))
    expect(result.ok).toBe(true)
    expect(result.data.authenticated).toBe(false)
  })

  it('reports has_refresh:true when credentials include a refresh_token', async () => {
    await makeProfile('dev', {
      access_token: 'tok',
      refresh_token: 'refresh-tok',
      expires_at: Date.now() + 3600_000,
    })
    await setCurrent('dev')

    const writes: string[] = []
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      writes.push(String(chunk))
      return true
    })

    await run({}, out)

    const result = JSON.parse(writes.join(''))
    expect(result.data.has_refresh).toBe(true)
  })
})
