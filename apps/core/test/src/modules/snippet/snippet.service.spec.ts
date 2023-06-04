import { redisHelper } from 'test/helper/redis-mock.helper'

import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { getModelForClass } from '@typegoose/typegoose'

import { ServerlessService } from '~/modules/serverless/serverless.service'
import { SnippetModel, SnippetType } from '~/modules/snippet/snippet.model'
import { SnippetService } from '~/modules/snippet/snippet.service'
import { DatabaseService } from '~/processors/database/database.service'
import { CacheService } from '~/processors/redis/cache.service'
import { getModelToken } from '~/transformers/model.transformer'

describe('test Snippet Service', () => {
  let service: SnippetService

  beforeAll(async () => {
    const redis = await redisHelper
    const moduleRef = Test.createTestingModule({
      providers: [
        SnippetService,
        { provide: DatabaseService, useValue: {} },
        { provide: CacheService, useValue: redis.CacheService },
        { provide: ServerlessService, useValue: {} },

        {
          provide: getModelToken(SnippetModel.name),
          useValue: getModelForClass(SnippetModel),
        },
      ],
    })

    const app = await moduleRef.compile()
    await app.init()
    service = app.get(SnippetService)
  })

  const snippet = {
    name: 'test',
    raw: '{"foo": "bar"}',
    type: SnippetType.JSON,
    private: false,
    reference: 'root',
  }

  let id = ''
  it('should create one', async () => {
    const res = await service.create(snippet)

    expect(res).toMatchObject(snippet)
    expect(res.id).toBeDefined()

    id = res.id
  })

  it('should not allow duplicate create', async () => {
    await expect(service.create(snippet)).rejects.toThrow(BadRequestException)
  })

  test('get snippet by name', async () => {
    const res = await service.getSnippetByName(snippet.name, snippet.reference)
    expect(res.name).toBe(snippet.name)
  })

  test('get snippet by name again from cache', async () => {
    const res = await service.getSnippetByName(snippet.name, snippet.reference)
    expect(res.name).toBe(snippet.name)
  })

  test('get full snippet', async () => {
    const res = await service.getSnippetById(id)
    expect(res.name).toBe(snippet.name)
  })

  test('modify', async () => {
    const newSnippet = {
      ...snippet,
      raw: '{"foo": "b"}',
    }
    const res = await service.update(id, newSnippet)
    expect(res.raw).toBe(newSnippet.raw)
  })

  test('get snippet by name after update', async () => {
    const res = await service.getSnippetByName(snippet.name, snippet.reference)
    expect(res.raw).toBe('{"foo": "b"}')
  })

  test('delete', async () => {
    await service.delete(id)
    await expect(service.getSnippetById(id)).rejects.toThrow(NotFoundException)
  })
})
