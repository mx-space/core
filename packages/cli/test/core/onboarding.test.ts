import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  probeAuthEndpoint: vi.fn(),
}))

vi.mock('../../src/core/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/core/auth')>()
  return {
    ...original,
    probeAuthEndpoint: mocks.probeAuthEndpoint,
    defaultHttp: original.defaultHttp,
  }
})

import { runOnboarding } from '../../src/core/onboarding'
import { MxsErrorCode } from '../../src/core/errors'

let tmpDir: string
let origXdg: string | undefined

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mxs-onboarding-test-'))
  origXdg = process.env.XDG_CONFIG_HOME
  process.env.XDG_CONFIG_HOME = tmpDir

  mocks.probeAuthEndpoint.mockResolvedValue({
    apiUrl: 'https://blog.example.com',
    apiBase: 'https://blog.example.com/api/v2',
    authBase: 'https://blog.example.com/api/v2/auth',
    apiVersion: 2,
  })
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

async function readProfileConfig(name: string): Promise<any> {
  return JSON.parse(
    await fs.readFile(
      path.join(mxsDir(), 'profiles', name, 'config.json'),
      'utf8',
    ),
  )
}

async function readCurrent(): Promise<string | null> {
  try {
    return (await fs.readFile(path.join(mxsDir(), 'current'), 'utf8')).trim()
  } catch {
    return null
  }
}

async function setCurrent(name: string) {
  await fs.mkdir(mxsDir(), { recursive: true })
  await fs.writeFile(path.join(mxsDir(), 'current'), `${name}\n`)
}

async function makeProfile(name: string) {
  const dir = path.join(mxsDir(), 'profiles', name)
  await fs.mkdir(dir, { recursive: true })
}

describe('runOnboarding', () => {
  it('writes to profiles/default on fresh install (no current)', async () => {
    const result = await runOnboarding({
      initialApiUrl: 'https://blog.example.com',
      isTTY: false,
    })

    expect(result.apiUrl).toBe('https://blog.example.com')
    const cfg = await readProfileConfig('default')
    expect(cfg.api_url).toBe('https://blog.example.com')
    expect(await readCurrent()).toBe('default')
  })

  it('writes to active profile when one exists', async () => {
    await makeProfile('staging')
    await setCurrent('staging')

    await runOnboarding({
      initialApiUrl: 'https://staging.example.com',
      isTTY: false,
    })

    const cfg = await readProfileConfig('staging')
    expect(cfg.api_url).toBe('https://blog.example.com')
    expect(await readCurrent()).toBe('staging')
  })

  it('respects --profile override', async () => {
    await makeProfile('existing')
    await setCurrent('existing')

    await runOnboarding({
      initialApiUrl: 'https://custom.example.com',
      isTTY: false,
      profile: 'custom',
    })

    const cfg = await readProfileConfig('custom')
    expect(cfg.api_url).toBe('https://blog.example.com')
    expect(await readCurrent()).toBe('custom')
    // existing profile current should have changed to custom
  })

  it('throws config.missing.api_url in non-TTY without initialApiUrl', async () => {
    await expect(
      runOnboarding({ isTTY: false }),
    ).rejects.toMatchObject({ code: MxsErrorCode.ConfigMissingApiUrl })
  })

  it('aborts when prompt returns non-string (cancel)', async () => {
    await expect(
      runOnboarding({
        isTTY: true,
        prompt: async () => {
          throw Symbol('cancel') as any
        },
      }),
    ).rejects.toThrow()
  })
})
