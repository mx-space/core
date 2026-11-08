import { createPgTestDatabase } from 'test/helper/pg-verify-url'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { ConfigsService } from '~/modules/configs/configs.service'
import { OptionsRepository } from '~/modules/configs/options.repository'
import { SnowflakeService } from '~/shared/id/snowflake.service'

describe('configuration commit boundary', () => {
  let context: Awaited<ReturnType<typeof createPgTestDatabase>>
  let service: ConfigsService
  let repository: OptionsRepository
  let cache: string
  let setCache: ReturnType<typeof vi.fn>
  const emit = vi.fn()
  const bump = vi.fn()
  beforeAll(async () => {
    context = await createPgTestDatabase('mx_config_commit')
    repository = new OptionsRepository(context.db, new SnowflakeService())
    await context.pool
      .query(`CREATE FUNCTION reject_config_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.value->>'title' = 'reject-commit' OR NEW.value->>'webUrl' = 'https://reject-commit.example' THEN RAISE EXCEPTION 'test commit rejection'; END IF; RETURN NEW; END $$;
      CREATE CONSTRAINT TRIGGER reject_commit AFTER INSERT OR UPDATE ON options DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_config_commit()`)
  })
  afterAll(async () => context?.close())
  beforeEach(async () => {
    await context.pool.query('TRUNCATE options')
    await repository.upsert('seo', { title: 'committed' })
    setCache = vi.fn(async (_key, value) => {
      cache = value
    })
    emit.mockReset().mockResolvedValue(undefined)
    bump.mockReset().mockResolvedValue(1)
    service = new ConfigsService(
      repository,
      {
        waitForReady: async () => {},
        getClient: () => ({ get: async () => cache, set: setCache }),
      } as any,
      { bump } as any,
      { emit } as any,
    )
    await service.onModuleInit()
    setCache.mockClear()
    emit.mockClear()
    bump.mockClear()
  })
  it.each([
    ['seo', { title: 'reject-commit' }],
    ['url', { webUrl: 'https://reject-commit.example' }],
  ] as const)(
    'does not publish cache/events/versions when %s commit fails',
    async (key, value) => {
      const beforeCache = cache
      const beforeRows = await repository.findAll()
      await expect(service.patchAndValid(key, value)).rejects.toThrow()
      expect(await repository.findAll()).toEqual(beforeRows)
      expect(cache).toBe(beforeCache)
      expect(setCache).not.toHaveBeenCalled()
      expect(emit).not.toHaveBeenCalled()
      expect(bump).not.toHaveBeenCalled()
    },
  )
  it('keeps committed data when a subsequent event delivery fails', async () => {
    emit.mockRejectedValue(new Error('event delivery failed'))
    await expect(
      service.patchAndValid('seo', { title: 'after-commit' }),
    ).rejects.toThrow('event delivery failed')
    expect(await repository.get('seo')).toMatchObject({ title: 'after-commit' })
    expect(JSON.parse(cache).seo.title).toBe('after-commit')
  })
  it('keeps conflicting stored secrets readable and requires an explicit replacement to save', async () => {
    await repository.upsert('membership', {
      apiKey: 'canonical-key',
      dodoApiKey: 'legacy-key',
    })
    await expect(
      service.patchAndValid('membership', { enabled: true }),
    ).rejects.toMatchObject({ code: 'CONFIG_VALIDATION_FAILED' })
    expect(await repository.get('membership')).toMatchObject({
      apiKey: 'canonical-key',
      dodoApiKey: 'legacy-key',
    })
    await service.patchAndValid('membership', { apiKey: 'chosen-key' })
    const stored = await repository.get<Record<string, unknown>>('membership')
    expect(stored).not.toHaveProperty('dodoApiKey')
    expect((await service.get('membership')).apiKey).toBe('chosen-key')
  })
  it('orders cache publication before allowing the next configuration writer', async () => {
    let entered!: () => void
    let release!: () => void
    const publishing = new Promise<void>((resolve) => {
      entered = resolve
    })
    const mayPublish = new Promise<void>((resolve) => {
      release = resolve
    })
    setCache.mockImplementation(async (_key, value) => {
      if (JSON.parse(value).seo.title === 'first') {
        entered()
        await mayPublish
      }
      cache = value
    })
    const first = service.patchAndValid('seo', { title: 'first' })
    await publishing
    let secondDone = false
    let second: Promise<void> = Promise.resolve()
    try {
      expect(await repository.get('seo')).toMatchObject({ title: 'first' })
      second = service.patchAndValid('seo', { title: 'second' }).then(() => {
        secondDone = true
      })
      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(secondDone).toBe(false)
    } finally {
      release()
      await Promise.allSettled([first, second])
    }
    expect(JSON.parse(cache).seo.title).toBe('second')
    expect(await repository.get('seo')).toMatchObject({ title: 'second' })
  })
})
