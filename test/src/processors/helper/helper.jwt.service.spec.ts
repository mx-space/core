import { redisHelper } from 'test/helper/redis-mock.helper'

import { Test } from '@nestjs/testing'

import { CacheService } from '~/processors/cache/cache.service'
import { JWTService } from '~/processors/helper/helper.jwt.service'

describe('test jwt service', () => {
  let service: JWTService

  afterAll(async () => {
    await (await redisHelper).close()
  })

  beforeAll(async () => {
    const { CacheService: MCacheService } = await redisHelper
    const moduleRef = Test.createTestingModule({
      providers: [JWTService, CacheService],
    })
      .overrideProvider(CacheService)
      .useValue(MCacheService)

    const module = await moduleRef.compile()
    service = module.get(JWTService)
  })

  let token1 = ''

  it('should sign token', async () => {
    const _token = service.sign('1')
    expect(_token).toBeDefined()

    token1 = _token
  })

  it('should verify token', async () => {
    const res = await service.verify(token1)
    expect(res).toBeDefined()

    const has = await service.isTokenInRedis(token1)
    expect(has).toBeTruthy()
  })

  it('should remove token', async () => {
    await service.revokeToken(token1)
    const has = await service.isTokenInRedis(token1)
    expect(has).toBeFalsy()

    const res = await service.verify(token1)
    expect(res).toBeFalsy()
  })

  it('should revoke all token', async () => {
    const token1 = service.sign('1')
    expect(token1).toBeDefined()
    const token2 = service.sign('2')
    expect(token2).toBeDefined()
    const token3 = service.sign('2')
    expect(token3).toBeDefined()

    await service.revokeAll()

    const res1 = await service.verify(token1)
    expect(res1).toBeFalsy()
    const res2 = await service.verify(token2)
    expect(res2).toBeFalsy()
    const res3 = await service.verify(token3)
    expect(res3).toBeFalsy()
  })
})
