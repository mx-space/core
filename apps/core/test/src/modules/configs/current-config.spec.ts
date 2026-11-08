import { ConfigsService } from '~/modules/configs/configs.service'

function createService(rows: { name: string; value: unknown }[] = []) {
  let cache: string | null = null
  const repository = {
    findAll: async () => rows,
    upsert: vi.fn(async (name, value) => ({ name, value })),
  }
  const service = new ConfigsService(
    repository as any,
    {
      waitForReady: async () => {},
      getClient: () => ({
        get: async () => cache,
        set: async (_key, value) => {
          cache = value
        },
      }),
    } as any,
    { bump: vi.fn() } as any,
    { emit: vi.fn() } as any,
  )
  return { service, repository, cache: () => cache }
}

it('exposes only current configuration and rejects retired sections without writes', async () => {
  const { service, repository } = createService()
  const config = await service.getConfigForResponse()
  expect(config).not.toHaveProperty('imageGenerationOptions')
  expect(config).not.toHaveProperty('ttsOptions')
  for (const section of ['imageGenerationOptions', 'ttsOptions']) {
    await expect(service.get(section as any)).rejects.toMatchObject({
      code: 'CONFIG_NOT_FOUND',
    })
    await expect(service.getForResponse(section as any)).rejects.toMatchObject({
      code: 'CONFIG_NOT_FOUND',
    })
    await expect(
      service.patchAndValid(
        section as any,
        { apiKey: 'must-not-write' } as any,
      ),
    ).rejects.toMatchObject({ code: 'CONFIG_NOT_FOUND' })
  }
  expect(repository.upsert).not.toHaveBeenCalled()
})

it.each([
  ['membership', { dodoApiKey: 'must-not-write' }],
  ['thirdPartyServiceIntegration', { githubToken: 'must-not-write' }],
  [
    'thirdPartyServiceIntegration',
    { github: { unexpected: 'must-not-write' } },
  ],
])(
  'rejects unknown and retired fields in %s instead of translating or ignoring them',
  async (key, value) => {
    const { service, repository } = createService()
    await expect(
      service.patchAndValid(key as any, value as any),
    ).rejects.toMatchObject({ code: 'CONFIG_VALIDATION_FAILED' })
    expect(repository.upsert).not.toHaveBeenCalled()
  },
)

it.each([
  { name: 'membership', value: { dodoApiKey: 'stored-private' } },
  { name: 'imageGenerationOptions', value: { apiKey: 'stored-private' } },
  { name: 'ai', value: { providers: [] } },
])(
  'requires DB migration rather than converting old %s values in startup/cache',
  async (row) => {
    const { service, cache } = createService([row])
    await expect(service.onModuleInit()).rejects.toThrow('migration')
    expect(cache()).toBeNull()
  },
)

it('preserves freeform OAuth keys and values during partial updates', async () => {
  const { service, repository } = createService()
  await service.patchAndValid('oauth', {
    public: { google: { custom_dynamic_key: 'exact-value' } },
  })
  expect(repository.upsert).toHaveBeenCalledWith(
    'oauth',
    expect.objectContaining({
      public: { google: { custom_dynamic_key: 'exact-value' } },
    }),
  )
})
