import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runDeviceFlow } from '../src/helpers/device-flow'
import { createE2EBackend, type E2EBackend } from '../src/helpers/e2e-app'
import { parseEnvelope, runMxs } from '../src/helpers/mxs'
import { makeTmpHome, type TmpHome } from '../src/helpers/tmp-home'

describe('mxs auth device flow against real core', () => {
  let backend: E2EBackend
  let tmpHome: TmpHome

  beforeAll(async () => {
    backend = await createE2EBackend()
    tmpHome = makeTmpHome()
  }, 90_000)

  afterAll(async () => {
    tmpHome?.cleanup()
    await backend?.stop()
  })

  it('logs in through the real device flow and persists the target profile', async () => {
    const result = await runDeviceFlow(backend, {
      profile: 'device',
      tmpHome: tmpHome.path,
    })

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('"profile":"device"')

    const status = await runMxs(['--json', 'auth', 'status'], {
      XDG_CONFIG_HOME: tmpHome.path,
      MXS_PROFILE: 'device',
    })
    expect(status.code).toBe(0)
    expect(parseEnvelope(status.stdout).data).toMatchObject({
      authenticated: true,
      profile: 'device',
    })
  }, 90_000)
})
