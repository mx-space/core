import { dbHelper } from 'test/helper/db-mock.helper'
import { MockCacheService, redisHelper } from 'test/helper/redis-mock.helper'

import { BadRequestException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Test } from '@nestjs/testing'
import { getModelForClass } from '@typegoose/typegoose'

import { RedisKeys } from '~/constants/cache.constant'
import { OptionModel } from '~/modules/configs/configs.model'
import { ConfigsService } from '~/modules/configs/configs.service'
import { UserService } from '~/modules/user/user.service'
import { CacheService } from '~/processors/cache/cache.service'
import { getModelToken } from '~/transformers/model.transformer'
import { getRedisKey } from '~/utils/redis.util'

describe('Test ConfigsService', () => {
  let service: ConfigsService

  let redisService: MockCacheService
  afterAll(async () => {
    await dbHelper.clear()
    await dbHelper.close()
    await (await redisHelper).close()
  })
  const optionModel = getModelForClass(OptionModel)
  const mockEmitFn = jest.fn()
  beforeAll(async () => {
    const { CacheService: redisService$ } = await redisHelper

    redisService = redisService$
    await dbHelper.connect()

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
          provide: CacheService,
          useValue: redisService$,
        },
        { provide: EventEmitter2, useValue: { emit: mockEmitFn } },
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
    ).rejects.toThrow(BadRequestException)
  })

  it('should emit event if enable email option and update search', async () => {
    await service.patchAndValid('mailOptions', { enable: true })
    expect(mockEmitFn).toBeCalledTimes(1)
    mockEmitFn.mockClear()

    await service.patchAndValid('mailOptions', { pass: '*' })
    expect(mockEmitFn).toBeCalledTimes(1)
    mockEmitFn.mockClear()

    await service.patchAndValid('mailOptions', { pass: '*', enable: false })
    expect(mockEmitFn).toBeCalledTimes(0)
    mockEmitFn.mockClear()

    await service.patchAndValid('algoliaSearchOptions', {
      enable: true,
    })
    expect(mockEmitFn).toBeCalledTimes(1)
    mockEmitFn.mockClear()

    await service.patchAndValid('algoliaSearchOptions', {
      indexName: 'x',
    })
    expect(mockEmitFn).toBeCalledTimes(1)
    mockEmitFn.mockClear()

    await service.patchAndValid('algoliaSearchOptions', {
      enable: false,
    })
    expect(mockEmitFn).toBeCalledTimes(0)
    mockEmitFn.mockClear()
  })
})
