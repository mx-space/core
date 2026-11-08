import { symmetricEncrypt } from 'better-auth/crypto'

import { ENCRYPT, SECURITY } from '~/app.config'
import { reviewDemoDatabaseHooks } from '~/modules/auth/auth.implement'
import { ConfigsService } from '~/modules/configs/configs.service'
import { EncryptUtil } from '~/utils/encrypt.util'

const gate = vi.hoisted(() => ({ v2: false }))
vi.mock('../../../src/app.config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/app.config')>()),
  get SECRET_STORAGE_V2() {
    return gate.v2
  },
}))

const encryptionConfig = { ...ENCRYPT }
afterEach(() => {
  Object.assign(ENCRYPT, encryptionConfig)
  gate.v2 = false
})

it('temporarily preserves legacy plaintext writes when encryption is disabled', () => {
  ENCRYPT.enable = false
  ENCRYPT.key = 'legacy-machine-id'
  const data = { secret: 'legacy-secret', nested: ['another-secret', null, 42] }

  expect(EncryptUtil.encrypt(data)).toEqual(data)
  expect(EncryptUtil.decrypt(data)).toEqual(data)
})

it.each([false, true])(
  'refuses to pass through existing ciphertext with encryption disabled (v2=%s)',
  (v2) => {
    gate.v2 = v2
    const encrypted = EncryptUtil.encrypt('stored-secret', 'field')
    gate.v2 = false
    ENCRYPT.enable = false

    expect(() => EncryptUtil.encrypt(encrypted, 'field')).toThrow(
      'encryption is disabled',
    )
    expect(() => EncryptUtil.decrypt(encrypted, 'field')).toThrow(
      'encryption is disabled',
    )
    expect(() => EncryptUtil.assertConfigured()).toThrow()
  },
)

it('rejects invalid keys when legacy encryption is enabled', () => {
  ENCRYPT.key = 'not-a-hex-key'

  expect(() => EncryptUtil.encrypt('secret')).toThrow()
})

it('initializes and updates legacy plaintext configuration without exposing secrets in responses', async () => {
  ENCRYPT.enable = false
  ENCRYPT.key = 'legacy-machine-id'
  let cache: string | null = null
  let stored: unknown
  const service = new ConfigsService(
    {
      findAll: async () => [
        { name: 'backupOptions', value: { secretKey: 'existing-secret' } },
      ],
      upsert: async (name, value) => {
        stored = value
        return { name, value }
      },
    } as any,
    {
      waitForReady: async () => {},
      getClient: () => ({
        get: async () => cache,
        set: async (_key, value) => {
          cache = value
        },
      }),
    } as any,
    {} as any,
    { emit: vi.fn() } as any,
  )

  await service.onModuleInit()
  expect(JSON.parse(cache!).backupOptions.secretKey).toBe('existing-secret')
  await expect(service.get('backupOptions')).resolves.toMatchObject({
    secretKey: 'existing-secret',
  })
  await service.patchAndValid('backupOptions', { secretKey: 'updated-secret' })
  expect(stored).toMatchObject({ secretKey: 'updated-secret' })
  expect(JSON.parse(cache!).backupOptions.secretKey).toBe('updated-secret')
  await expect(service.getForResponse('backupOptions')).resolves.toMatchObject({
    secretKey: '',
  })
})

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
