import { symmetricEncrypt } from 'better-auth/crypto'

import { ENCRYPT, SECURITY } from '~/app.config'
import { reviewDemoDatabaseHooks } from '~/modules/auth/auth.implement'
import { ConfigsService } from '~/modules/configs/configs.service'
import { EncryptUtil } from '~/utils/encrypt.util'

it('always writes authenticated V2 envelopes, even when obsolete codec options are supplied', async () => {
  const { SecretCodec } = await import('~/utils/secret-codec')
  const codec = new SecretCodec({
    key: ENCRYPT.key,
    enable: false,
    v2: false,
  } as any)
  const encrypted = codec.encrypt('stored-secret', 'field')
  expect(encrypted).toMatch(/^\$\$\{mx\}\$\$v2\./)
  expect(codec.decrypt(encrypted, 'field')).toBe('stored-secret')
})

it('reads legacy plaintext configuration and encrypts updated storage and cache', async () => {
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
  expect(
    EncryptUtil.decrypt(
      JSON.parse(cache!).backupOptions.secretKey,
      'backupOptions.secretKey',
    ),
  ).toBe('existing-secret')
  await expect(service.get('backupOptions')).resolves.toMatchObject({
    secretKey: 'existing-secret',
  })
  await service.patchAndValid('backupOptions', { secretKey: 'updated-secret' })
  expect((stored as any).secretKey).toMatch(/^\$\$\{mx\}\$\$v2\./)
  expect(
    EncryptUtil.decrypt((stored as any).secretKey, 'backupOptions.secretKey'),
  ).toBe('updated-secret')
  expect(
    EncryptUtil.decrypt(
      JSON.parse(cache!).backupOptions.secretKey,
      'backupOptions.secretKey',
    ),
  ).toBe('updated-secret')
  await expect(service.getForResponse('backupOptions')).resolves.toMatchObject({
    secretKey: '',
  })
})

it('keeps encrypted OAuth tokens encrypted at the database hook boundary', async () => {
  const key = {
    currentVersion: 1,
    keys: new Map([[1, SECURITY.jwtSecret!]]),
    legacySecret: SECURITY.jwtSecret!,
  }
  const encrypted = await symmetricEncrypt({ key, data: 'provider-token' })
  const before = reviewDemoDatabaseHooks.account!.update!.before!
  const account = { accessToken: encrypted }
  const result = await before(
    account as any,
    { context: { secretConfig: key } } as any,
  )
  expect((result ? result.data : account).accessToken).toBe(encrypted)
})
