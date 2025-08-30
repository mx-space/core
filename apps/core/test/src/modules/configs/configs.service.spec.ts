import { UnprocessableEntityException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { getModelForClass } from '@typegoose/typegoose'
import { ExtendedValidationPipe } from '~/common/pipes/validation.pipe'
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
          useValue: ExtendedValidationPipe.shared,
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
    ).rejects.toThrow(UnprocessableEntityException)
  })

  it('should emit event if enable email option and update search', async () => {
    // + 1 call time because of `config.changed` event
    await service.patchAndValid('mailOptions', { enable: true })

    expect(mockEmitFn).toBeCalledTimes(3)
    mockEmitFn.mockClear()

    await service.patchAndValid('mailOptions', { pass: '*' })
    expect(mockEmitFn).toBeCalledTimes(2)
    mockEmitFn.mockClear()

    await service.patchAndValid('mailOptions', { pass: '*', enable: false })
    expect(mockEmitFn).toBeCalledTimes(1)
    mockEmitFn.mockClear()

    await service.patchAndValid('algoliaSearchOptions', {
      enable: true,
    })
    expect(mockEmitFn).toBeCalledTimes(2)
    mockEmitFn.mockClear()

    await service.patchAndValid('algoliaSearchOptions', {
      indexName: 'x',
    })
    expect(mockEmitFn).toBeCalledTimes(2)
    mockEmitFn.mockClear()

    await service.patchAndValid('algoliaSearchOptions', {
      enable: false,
    })
    expect(mockEmitFn).toBeCalledTimes(1)
    mockEmitFn.mockClear()
  })
})
