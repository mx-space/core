import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock @clack/prompts so tests can control confirm() without TTY
vi.mock('@clack/prompts', async (importOriginal) => {
  const original = await importOriginal<typeof import('@clack/prompts')>()
  return {
    ...original,
    confirm: vi.fn().mockResolvedValue(true),
    isCancel: (v: unknown) => typeof v === 'symbol',
  }
})

import { confirm } from '@clack/prompts'

import { run } from '../../../src/commands/profile/rm'
import type { OutputOptions } from '../../../src/core/output'

let tmpDir: string
let origXdg: string | undefined

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mxs-rm-test-'))
  origXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = tmpDir
  vi.mocked(confirm).mockResolvedValue(true)
})

afterEach(async () => {
  if (origXdg === undefined) delete process.env.XDG_CONFIG_HOME
  else process.env.XDG_CONFIG_HOME = origXdg
  await fs.rm(tmpDir, { recursive: true, force: true })
  vi.clearAllMocks()
})

function mxsDir() {
  return path.join(tmpDir, 'mxs')
}

async function makeProfile(name: string) {
  const dir = path.join(mxsDir(), 'profiles', name)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(
    path.join(dir, 'config.json'),
    JSON.stringify({ api_url: 'http://example.com' }),
  )
}

async function setCurrent(name: string) {
  await fs.mkdir(mxsDir(), { recursive: true })
  await fs.writeFile(path.join(mxsDir(), 'current'), `${name}\n`)
}

async function profileExists(name: string): Promise<boolean> {
  try {
    await fs.stat(path.join(mxsDir(), 'profiles', name))
    return true
  } catch {
    return false
  }
}

const out: OutputOptions = { json: false, output: 'readable', quiet: false, verbose: false }

describe('profile rm', () => {
  it('removes profile with --force (no confirmation)', async () => {
    await makeProfile('dev')
    const spy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    await run('dev', { force: true }, {}, out)
    spy.mockRestore()
    expect(await profileExists('dev')).toBe(false)
  })

  it('throws validation.failed when removing current profile without --force', async () => {
    await makeProfile('dev')
    await setCurrent('dev')
    await expect(run('dev', {}, {}, out)).rejects.toMatchObject({
      code: 'validation.failed',
    })
  })

  it('allows removing current profile with --force', async () => {
    await makeProfile('dev')
    await setCurrent('dev')
    const spy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    await run('dev', { force: true }, {}, out)
    spy.mockRestore()
    expect(await profileExists('dev')).toBe(false)
  })

  it('aborts without removing when TTY confirm returns false', async () => {
    await makeProfile('dev')
    vi.mocked(confirm).mockResolvedValue(false)
    const origIsTTY = (process.stdin as any).isTTY
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true })
    const spy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    await run('dev', {}, {}, out)
    spy.mockRestore()
    Object.defineProperty(process.stdin, 'isTTY', { value: origIsTTY, configurable: true })
    expect(await profileExists('dev')).toBe(true)
  })

  it('aborts without removing when confirm returns isCancel symbol', async () => {
    await makeProfile('dev')
    vi.mocked(confirm).mockResolvedValue(Symbol('cancel') as any)
    const origIsTTY = (process.stdin as any).isTTY
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true })
    const spy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    await run('dev', {}, {}, out)
    spy.mockRestore()
    Object.defineProperty(process.stdin, 'isTTY', { value: origIsTTY, configurable: true })
    expect(await profileExists('dev')).toBe(true)
  })

  it('throws resource.not_found for non-existent profile', async () => {
    await expect(run('ghost', { force: true }, {}, out)).rejects.toMatchObject({
      code: 'resource.not_found',
    })
  })
})
