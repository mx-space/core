import { stringify } from 'qs'
import { redisHelper } from 'test/helper/redis-mock.helper'

import { nanoid } from '@mx-space/compiled'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { getModelForClass } from '@typegoose/typegoose'

import { ServerlessService } from '~/modules/serverless/serverless.service'
import { SnippetModel, SnippetType } from '~/modules/snippet/snippet.model'
import { SnippetService } from '~/modules/snippet/snippet.service'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { CacheService } from '~/processors/redis/cache.service'
import { getModelToken } from '~/transformers/model.transformer'

const mockedEventManageService = { async emit() {} }
describe('test Snippet Service', () => {
  let service: SnippetService

  beforeAll(async () => {
    const redis = await redisHelper
    const moduleRef = Test.createTestingModule({
      providers: [
        SnippetService,
        { provide: DatabaseService, useValue: {} },
        { provide: CacheService, useValue: redis.CacheService },
        {
          provide: ServerlessService,
          useValue: {
            isValidServerlessFunction() {
              return true
            },
          },
        },
        { provide: EventManagerService, useValue: mockedEventManageService },

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
  } as SnippetModel

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
    } as SnippetModel
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

  describe('update function snippet with secret', () => {
    const createTestingModel = () =>
      ({
        name: `test-fn-${nanoid.nanoid()}`,
        raw: 'export default async function handler() {}',
        type: SnippetType.Function,
        private: false,
        reference: 'root',
        id: nanoid.nanoid(),
        secret: 'username=123&password=123',
      }) as SnippetModel

    test('patch secret', async () => {
      const newSnippet = createTestingModel()
      const doc = await service.create(newSnippet)

      await service.update(doc.id, {
        ...newSnippet,
        secret: stringify({ username: '', password: '' }),
      })
      const afterUpdate = await service.getSnippetById(doc.id)

      expect(afterUpdate.secret).toStrictEqual({
        username: '',
        password: '',
      })

      const raw = await service.model.findById(doc.id).select('+secret').lean({
        getters: true,
      })

      expect(raw.secret).toBe(newSnippet.secret)
    })
  })
})
