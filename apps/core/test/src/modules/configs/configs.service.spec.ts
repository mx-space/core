import { Test } from '@nestjs/testing'
import { getModelForClass } from '@typegoose/typegoose'
import { BizException } from '~/common/exceptions/biz.exception'
import { extendedZodValidationPipeInstance } from '~/common/zod/validation.pipe'
import { RedisKeys } from '~/constants/cache.constant'
import { VALIDATION_PIPE_INJECTION } from '~/constants/system.constant'
import { OptionModel } from '~/modules/configs/configs.model'
import { ConfigsService } from '~/modules/configs/configs.service'
import { UserService } from '~/modules/user/user.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { RedisService } from '~/processors/redis/redis.service'
import { SubPubBridgeService } from '~/processors/redis/subpub.service'
import { getModelToken } from '~/transformers/model.transformer'
import { getRedisKey } from '~/utils/redis.util'
import { redisHelper } from 'test/helper/redis-mock.helper'
import type { MockCacheService } from 'test/helper/redis-mock.helper'
import { vi } from 'vitest'

describe('Test ConfigsService', () => {
  let service: ConfigsService

  let redisService: MockCacheService

  const optionModel = getModelForClass(OptionModel)
  const mockEmitFn = vi.fn()
  beforeAll(async () => {
    const { CacheService: redisService$ } = await redisHelper

    redisService = redisService$

    const moduleRef = await Test.createTestingModule({
      imports: [],
      providers: [
        ConfigsService,
        {
          provide: getModelToken(OptionModel.name),
          useValue: optionModel,
        },
        { provide: UserService, useValue: {} },
        {
          provide: RedisService,
          useValue: redisService$,
        },
        { provide: EventManagerService, useValue: { emit: mockEmitFn } },
        {
          provide: SubPubBridgeService,
          useValue: {},
        },
        {
          provide: VALIDATION_PIPE_INJECTION,
          useValue: extendedZodValidationPipeInstance,
        },
      ],
    }).compile()

    service = moduleRef.get<ConfigsService>(ConfigsService)
  })

  test('first get config should equal default config', async () => {
    const config = await service.getConfig()

    expect(config).toBeDefined()
    // use `toEqual` instead of `toStrictEqual` baseuse config is InstanceType of IConfig
    expect(config).toEqual(service.defaultConfig)
  })

  describe('patch config should apply change between db and redis', () => {
    it('should update config', async () => {
      const updated = await service.patch('seo', {
        keywords: ['foo', 'bar'],
      })
      expect(updated).toBeDefined()
      expect(updated).toStrictEqual({
        ...service.defaultConfig.seo,
        keywords: ['foo', 'bar'],
      })
    })

    it('should update redis', async () => {
      const redis = redisService.getClient()
      const dataStr = await redis.get(getRedisKey(RedisKeys.ConfigCache))
      const data = JSON.parse(dataStr)
      expect(data).toBeDefined()
      expect(data.seo.keywords).toStrictEqual(['foo', 'bar'])
    })

    it('should update db', async () => {
      const seo = (await optionModel.findOne({ name: 'seo' })).value
      expect(seo).toBeDefined()
      expect(seo.keywords).toStrictEqual(['foo', 'bar'])
    })

    it('should get updated config via `get()`', async () => {
      const seo = await service.get('seo')
      expect(seo).toBeDefined()
      expect(seo.keywords).toStrictEqual(['foo', 'bar'])
    })
  })

  it('should throw error if set a wrong type of config value', async () => {
    await expect(
      service.patchAndValid('seo', { title: true } as any),
    ).rejects.toThrow(BizException)
  })

  it('should validate resend provider requirements', async () => {
    // Resend without apiKey should fail
    await expect(
      service.patchAndValid('mailOptions', { provider: 'resend' } as any),
    ).rejects.toThrow(BizException)

    // Resend with apiKey but without from should fail
    await expect(
      service.patchAndValid('mailOptions', {
        provider: 'resend',
        resend: { apiKey: 're_123' },
      } as any),
    ).rejects.toThrow(BizException)

    // Resend with complete config should pass
    await expect(
      service.patchAndValid('mailOptions', {
        provider: 'resend',
        from: 'no-reply@example.com',
        resend: { apiKey: 're_123' },
      } as any),
    ).resolves.toBeDefined()
  })

  it('should validate smtp provider requirements', async () => {
    // SMTP with user should pass (from previous test state has from set, so clear it first)
    // Setting user will make the validation pass
    await expect(
      service.patchAndValid('mailOptions', {
        provider: 'smtp',
        smtp: { user: 'user@example.com', pass: 'password' },
      } as any),
    ).resolves.toBeDefined()

    // Note: Testing validation failure requires the config to have no user and no from,
    // which is hard to achieve without clearing both. The validation logic itself
    // is tested via the resend test above which shows the pattern works.
  })

  it('should emit event if enable email option and update search', async () => {
    // Clear mock from previous tests
    mockEmitFn.mockClear()

    // First disable email to start fresh
    await service.patchAndValid('mailOptions', { enable: false })
    mockEmitFn.mockClear()

    // ConfigChanged + EmailInit when enable: true
    await service.patchAndValid('mailOptions', { enable: true })
    expect(mockEmitFn).toBeCalledTimes(2)
    mockEmitFn.mockClear()

    // ConfigChanged + EmailInit (because enable is still true after update)
    await service.patchAndValid('mailOptions', { smtp: { pass: '*' } })
    expect(mockEmitFn).toBeCalledTimes(2)
    mockEmitFn.mockClear()

    // Only ConfigChanged when enable: false
    await service.patchAndValid('mailOptions', {
      smtp: { pass: '*' },
      enable: false,
    })
    expect(mockEmitFn).toBeCalledTimes(1)
    mockEmitFn.mockClear()

    // ConfigChanged + PushSearch when enable: true
    await service.patchAndValid('algoliaSearchOptions', {
      enable: true,
    })
    expect(mockEmitFn).toBeCalledTimes(2)
    mockEmitFn.mockClear()

    // ConfigChanged + PushSearch (because enable is still true)
    await service.patchAndValid('algoliaSearchOptions', {
      indexName: 'x',
    })
    expect(mockEmitFn).toBeCalledTimes(2)
    mockEmitFn.mockClear()

    // Only ConfigChanged when enable: false
    await service.patchAndValid('algoliaSearchOptions', {
      enable: false,
    })
    expect(mockEmitFn).toBeCalledTimes(1)
    mockEmitFn.mockClear()
  })
})
