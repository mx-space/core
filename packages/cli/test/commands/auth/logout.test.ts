import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { run } from '../../../src/commands/auth/logout'
import type { OutputOptions } from '../../../src/core/output'
import { MxsErrorCode } from '../../../src/core/errors'

let tmpDir: string
let origXdg: string | undefined

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mxs-logout-test-'))
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
  withCredentials = true,
  withConfig = true,
) {
  const dir = path.join(mxsDir(), 'profiles', name)
  await fs.mkdir(dir, { recursive: true })
  if (withConfig) {
    await fs.writeFile(
      path.join(dir, 'config.json'),
      JSON.stringify({ api_url: 'http://example.com' }),
    )
  }
  if (withCredentials) {
    await fs.writeFile(
      path.join(dir, 'credentials.json'),
      JSON.stringify({ access_token: 'tok', expires_at: 9999 }),
      { mode: 0o600 },
    )
  }
}

async function setCurrent(name: string) {
  await fs.mkdir(mxsDir(), { recursive: true })
  await fs.writeFile(path.join(mxsDir(), 'current'), `${name}\n`)
}

async function credentialsExists(name: string): Promise<boolean> {
  try {
    await fs.stat(path.join(mxsDir(), 'profiles', name, 'credentials.json'))
    return true
  } catch {
    return false
  }
}

async function configExists(name: string): Promise<boolean> {
  try {
    await fs.stat(path.join(mxsDir(), 'profiles', name, 'config.json'))
    return true
  } catch {
    return false
  }
}

async function currentFileExists(): Promise<boolean> {
  try {
    await fs.stat(path.join(mxsDir(), 'current'))
    return true
  } catch {
    return false
  }
}

const out: OutputOptions = { json: false, output: 'readable', quiet: true, verbose: false }

describe('auth logout', () => {
  it('removes credentials file for active profile', async () => {
    await makeProfile('dev')
    await setCurrent('dev')

    await run({}, out)

    expect(await credentialsExists('dev')).toBe(false)
    // config.json must still be present
    expect(await configExists('dev')).toBe(true)
    // current file must still be present
    expect(await currentFileExists()).toBe(true)
  })

  it('removes credentials file for --profile flag target', async () => {
    await makeProfile('prod')
    await makeProfile('dev')
    await setCurrent('dev')

    await run({ profile: 'prod' }, out)

    expect(await credentialsExists('prod')).toBe(false)
    // dev credentials untouched
    expect(await credentialsExists('dev')).toBe(true)
  })

  it('succeeds even if credentials file is already absent', async () => {
    await makeProfile('dev', false, true)
    await setCurrent('dev')

    await expect(run({}, out)).resolves.toBeUndefined()
  })

  it('throws profile.none_active when no current and no --profile', async () => {
    await expect(run({}, out)).rejects.toMatchObject({
      code: MxsErrorCode.ProfileNoneActive,
    })
  })
})
