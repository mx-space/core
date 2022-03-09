import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { getModelForClass } from '@typegoose/typegoose'
import { getModelToken } from 'nestjs-typegoose'
import { dbHelper } from 'test/helper/db-mock.helper'
import { SnippetModel, SnippetType } from '~/modules/snippet/snippet.model'
import { SnippetService } from '~/modules/snippet/snippet.service'
import { CacheService } from '~/processors/cache/cache.service'
import { AssetService } from '~/processors/helper/helper.asset.service'
import { HttpService } from '~/processors/helper/helper.http.service'

describe('test Snippet Service', () => {
  let service: SnippetService

  beforeAll(async () => {
    await dbHelper.connect()
    const moduleRef = Test.createTestingModule({
      providers: [
        SnippetService,
        AssetService,
        HttpService,
        { provide: CacheService, useValue: {} },
        {
          provide: getModelToken('SnippetModel'),
          useValue: getModelForClass(SnippetModel),
        },
      ],
    })

    const app = await moduleRef.compile()
    await app.init()
    service = app.get(SnippetService)
  })

  afterAll(async () => {
    await dbHelper.close()
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

  test('get only data snippet', async () => {
    const res = await service.getSnippetByName(snippet.name, snippet.reference)
    expect(res.name).toBe(snippet.name)
    expect(res.data).toBeDefined()
  })

  test('get full snippet', async () => {
    const res = await service.getSnippetById(id)
    expect(res.name).toBe(snippet.name)
  })

  test('modify', async () => {
    const newSnippet = {
      name: 'test',
      raw: '{"foo": "b"}',
      type: SnippetType.JSON,
      private: true,
      reference: 'root',
    }
    const res = await service.update(id, newSnippet)
    expect(res.raw).toBe(newSnippet.raw)
  })
  test('delete', async () => {
    await service.delete(id)
    await expect(service.getSnippetById(id)).rejects.toThrow(NotFoundException)
  })
})
