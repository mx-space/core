import { symmetricEncrypt } from 'better-auth/crypto'

import { ENCRYPT, SECURITY } from '~/app.config'
import { reviewDemoDatabaseHooks } from '~/modules/auth/auth.implement'
import { EncryptUtil } from '~/utils/encrypt.util'

const gate = vi.hoisted(() => ({ v2: false }))
vi.mock('../../../src/app.config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/app.config')>()),
  get SECRET_STORAGE_V2() {
    return gate.v2
  },
}))

it('keeps legacy writes while reading new ciphertext during a rolling upgrade', () => {
  gate.v2 = false
  const legacy = EncryptUtil.encrypt('legacy-compatible', 'field')
  expect(legacy).not.toContain('v2.')
  gate.v2 = true
  const upgraded = EncryptUtil.encrypt(legacy, 'field')
  expect(upgraded).toContain('v2.')
  gate.v2 = false
  expect(EncryptUtil.decrypt(upgraded, 'field')).toBe('legacy-compatible')
  expect(EncryptUtil.encrypt(upgraded, 'field')).toBe(upgraded)
})

it('keeps native OAuth encryption readable while preserving legacy write format until activation', async () => {
  const key = {
    currentVersion: 1,
    keys: new Map([[1, SECURITY.jwtSecret!]]),
    legacySecret: SECURITY.jwtSecret!,
  }
  const encrypted = await symmetricEncrypt({ key, data: 'provider-token' })
  const before = reviewDemoDatabaseHooks.account!.create!.before!
  gate.v2 = false
  const legacy = await before(
    { accessToken: encrypted } as any,
    { context: { secretConfig: key } } as any,
  )
  expect(legacy).toMatchObject({ data: { accessToken: 'provider-token' } })
  gate.v2 = true
  expect(
    await before(
      { accessToken: encrypted } as any,
      { context: { secretConfig: key } } as any,
    ),
  ).toBeUndefined()
  expect(ENCRYPT.enable).toBe(true)
})
