import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createE2EBackend, type E2EBackend } from '../src/helpers/e2e-app'
import { parseEnvelope, runMxs } from '../src/helpers/mxs'
import { seedOwnerAndWriteProfile } from '../src/helpers/seed-auth'
import { makeTmpHome, type TmpHome } from '../src/helpers/tmp-home'

describe('mxs auth state commands against real core', () => {
  let backend: E2EBackend
  let tmpHome: TmpHome

  beforeAll(async () => {
    backend = await createE2EBackend()
    tmpHome = makeTmpHome()
    await seedOwnerAndWriteProfile(backend, {
      profile: 'auth-state',
      tmpHome: tmpHome.path,
    })
  }, 90_000)

  afterAll(async () => {
    tmpHome?.cleanup()
    await backend?.stop()
  })

  const env = () => ({
    XDG_CONFIG_HOME: tmpHome.path,
    MXS_PROFILE: 'auth-state',
  })

  it('reports status, whoami, and logout state', async () => {
    const status = await runMxs(['--json', 'auth', 'status'], env())
    expect(status.code, status.stderr || status.stdout).toBe(0)
    expect(parseEnvelope(status.stdout).data).toMatchObject({
      authenticated: true,
      profile: 'auth-state',
    })

    const whoami = await runMxs(['--json', 'auth', 'whoami'], env())
    expect(whoami.code, whoami.stderr || whoami.stdout).toBe(0)
    expect(parseEnvelope(whoami.stdout).data).toMatchObject({
      profile: 'auth-state',
    })

    const logout = await runMxs(['--json', 'auth', 'logout'], env())
    expect(logout.code, logout.stderr || logout.stdout).toBe(0)

    const loggedOut = await runMxs(['--json', 'auth', 'status'], env())
    expect(loggedOut.code, loggedOut.stderr || loggedOut.stdout).toBe(0)
    expect(parseEnvelope(loggedOut.stdout).data).toMatchObject({
      authenticated: false,
      profile: 'auth-state',
    })
  }, 60_000)
})
