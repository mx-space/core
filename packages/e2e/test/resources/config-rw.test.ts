import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createE2EBackend, type E2EBackend } from '../../src/helpers/e2e-app'
import { parseEnvelope, runMxs } from '../../src/helpers/mxs'
import { seedOwnerAndWriteProfile } from '../../src/helpers/seed-auth'
import { makeTmpHome, type TmpHome } from '../../src/helpers/tmp-home'

describe('mxs config read-write against real core', () => {
  let backend: E2EBackend
  let tmpHome: TmpHome

  beforeAll(async () => {
    backend = await createE2EBackend()
    tmpHome = makeTmpHome()
    await seedOwnerAndWriteProfile(backend, {
      profile: 'config-rw',
      tmpHome: tmpHome.path,
    })
  }, 90_000)

  afterAll(async () => {
    tmpHome?.cleanup()
    await backend?.stop()
  })

  const env = () => ({
    XDG_CONFIG_HOME: tmpHome.path,
    MXS_PROFILE: 'config-rw',
  })

  it('lists config keys', async () => {
    const result = await runMxs(['--json', 'config', 'list'], env())
    expect(result.code, result.stderr || result.stdout).toBe(0)
    const envelope = parseEnvelope(result.stdout)
    expect(envelope.ok).toBe(true)
    expect(envelope.data).toBeTruthy()
  }, 90_000)

  it('gets a config key', async () => {
    const result = await runMxs(['--json', 'config', 'get', 'seo'], env())
    expect(result.code, result.stderr || result.stdout).toBe(0)
    const envelope = parseEnvelope(result.stdout)
    expect(envelope.ok).toBe(true)
  }, 90_000)

  it('sets and reads back a config value', async () => {
    const newTitle = `E2E Site ${Date.now()}`

    const seoResult = await runMxs(
      ['--json', 'config', 'get', 'seo'],
      env(),
    )
    expect(seoResult.code, seoResult.stderr || seoResult.stdout).toBe(0)
    const currentSeo = parseEnvelope(seoResult.stdout).data as Record<
      string,
      unknown
    >

    const updated = { ...(currentSeo ?? {}), title: newTitle }
    const setResult = await runMxs(
      [
        '--json',
        'config',
        'set',
        'seo',
        JSON.stringify(updated),
        '--type',
        'json',
      ],
      env(),
    )
    expect(setResult.code, setResult.stderr || setResult.stdout).toBe(0)

    const readback = await runMxs(['--json', 'config', 'get', 'seo'], env())
    expect(readback.code, readback.stderr || readback.stdout).toBe(0)
    const readEnvelope = parseEnvelope(readback.stdout)
    expect((readEnvelope.data as Record<string, unknown>)?.title).toBe(newTitle)
  }, 90_000)
})
