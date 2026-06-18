import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createE2EBackend, type E2EBackend } from '../src/helpers/e2e-app'
import { parseEnvelope, runMxs } from '../src/helpers/mxs'
import { seedOwnerAndWriteProfile } from '../src/helpers/seed-auth'
import { makeTmpHome, type TmpHome } from '../src/helpers/tmp-home'

describe('mxs profile commands against real profile files', () => {
  let backend: E2EBackend
  let tmpHome: TmpHome

  beforeAll(async () => {
    backend = await createE2EBackend()
    tmpHome = makeTmpHome()
    await seedOwnerAndWriteProfile(backend, {
      tmpHome: tmpHome.path,
      forceProfileName: 'one',
    })
    await seedOwnerAndWriteProfile(backend, {
      tmpHome: tmpHome.path,
      forceProfileName: 'two',
    })
  }, 90_000)

  afterAll(async () => {
    tmpHome?.cleanup()
    await backend?.stop()
  })

  const env = () => ({ XDG_CONFIG_HOME: tmpHome.path })

  it('lists, shows, and switches profiles', async () => {
    const listed = await runMxs(['--json', 'profile', 'ls'], env())
    expect(listed.code).toBe(0)
    const rows = parseEnvelope(listed.stdout).data as Array<{ name: string }>
    expect(rows.map((row) => row.name)).toEqual(
      expect.arrayContaining(['one', 'two']),
    )

    const showTwo = await runMxs(['--json', 'profile', 'show', 'two'], env())
    expect(showTwo.code).toBe(0)
    expect(parseEnvelope(showTwo.stdout).data).toMatchObject({
      name: 'two',
      authenticated: true,
    })

    const useOne = await runMxs(['--json', 'profile', 'use', 'one'], env())
    expect(useOne.code).toBe(0)

    const showCurrent = await runMxs(['--json', 'profile', 'show'], env())
    expect(showCurrent.code).toBe(0)
    expect(parseEnvelope(showCurrent.stdout).data).toMatchObject({
      name: 'one',
    })
  }, 60_000)
})
