import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { ReturnModelType } from '@typegoose/typegoose'
import { createE2EApp } from 'test/helper/create-e2e-app'
import { authPassHeader } from 'test/mock/guard/auth.guard'

import { redisHelper } from '@/helper/redis-mock.helper'
import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { CommentService } from '~/modules/comment/comment.service'
import { ConfigsService } from '~/modules/configs/configs.service'
import { RecentlyController } from '~/modules/recently/recently.controller'
import { RecentlyModel } from '~/modules/recently/recently.model'
import { RecentlyTypeEnum } from '~/modules/recently/recently.schema'
import { RecentlyService } from '~/modules/recently/recently.service'
import { DatabaseService } from '~/processors/database/database.service'
import { EventManagerService } from '~/processors/helper/helper.event.service'
import { RedisService } from '~/processors/redis/redis.service'

describe('test /recently', async () => {
  let app: NestFastifyApplication
  let model: ReturnModelType<typeof RecentlyModel>

  const proxy = createE2EApp({
    controllers: [RecentlyController],
    providers: [
      RecentlyService,
      { provide: DatabaseService, useValue: {} },
      {
        provide: RedisService,
        useValue: (await redisHelper).RedisService,
      },
      {
        provide: EventManagerService,
        useValue: {
          async emit() {},
        },
      },
      {
        provide: ConfigsService,
        useValue: {
          get() {
            return { commentShouldAudit: false }
          },
        },
      },
      {
        provide: CommentService,
        useValue: {
          model: {
            countDocuments() {
              return 0
            },
            deleteMany() {
              return { deletedCount: 0 }
            },
          },
        },
      },
    ],
    models: [RecentlyModel],
    async pourData(modelMap) {
      model = modelMap.get(RecentlyModel)!.model as ReturnModelType<
        typeof RecentlyModel
      >
    },
  })

  beforeEach(() => {
    app = proxy.app
  })

  test('POST /recently without type defaults to text', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/recently`,
      headers: { ...authPassHeader },
      payload: {
        content: 'Hello world',
      },
    })
    expect(res.statusCode).toBe(201)
    const data = res.json()
    expect(data.type).toBe(RecentlyTypeEnum.Text)
    expect(data.content).toBe('Hello world')
  })

  test('POST /recently with type=text requires content', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/recently`,
      headers: { ...authPassHeader },
      payload: {
        type: RecentlyTypeEnum.Text,
        content: '',
      },
    })
    expect(res.statusCode).toBe(422)
  })

  test('POST /recently with type=book and metadata creates successfully', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/recently`,
      headers: { ...authPassHeader },
      payload: {
        type: RecentlyTypeEnum.Book,
        content: 'Great book',
        metadata: {
          url: 'https://example.com/book',
          title: 'Test Book',
          author: 'Author Name',
        },
      },
    })
    expect(res.statusCode).toBe(201)
    const data = res.json()
    expect(data.type).toBe(RecentlyTypeEnum.Book)
    expect(data.metadata.title).toBe('Test Book')
    expect(data.metadata.author).toBe('Author Name')
  })

  test('POST /recently with type=book allows empty content', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/recently`,
      headers: { ...authPassHeader },
      payload: {
        type: RecentlyTypeEnum.Book,
        metadata: {
          url: 'https://example.com/book2',
          title: 'Another Book',
          author: 'Another Author',
        },
      },
    })
    expect(res.statusCode).toBe(201)
    const data = res.json()
    expect(data.type).toBe(RecentlyTypeEnum.Book)
    expect(data.content).toBe('')
  })

  test('POST /recently with type=book rejects missing metadata', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/recently`,
      headers: { ...authPassHeader },
      payload: {
        type: RecentlyTypeEnum.Book,
        content: 'Missing metadata',
      },
    })
    expect(res.statusCode).toBe(422)
  })

  test('POST /recently with type=link and metadata creates successfully', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/recently`,
      headers: { ...authPassHeader },
      payload: {
        type: RecentlyTypeEnum.Link,
        content: 'Check this link',
        metadata: {
          url: 'https://example.com',
          title: 'Example Site',
        },
      },
    })
    expect(res.statusCode).toBe(201)
    const data = res.json()
    expect(data.type).toBe(RecentlyTypeEnum.Link)
    expect(data.metadata.url).toBe('https://example.com')
  })

  test('PUT /recently/:id updates type and metadata', async () => {
    const doc = await model.create({
      content: 'Original text',
      type: RecentlyTypeEnum.Text,
    })

    const res = await app.inject({
      method: 'PUT',
      url: `${apiRoutePrefix}/recently/${doc._id.toHexString()}`,
      headers: { ...authPassHeader },
      payload: {
        type: RecentlyTypeEnum.Book,
        content: 'Updated to book',
        metadata: {
          url: 'https://example.com/updated',
          title: 'Updated Book',
          author: 'Updated Author',
        },
      },
    })
    expect(res.statusCode).toBe(200)
    const data = res.json()
    expect(data.type).toBe(RecentlyTypeEnum.Book)
    expect(data.metadata.title).toBe('Updated Book')
  })

  test('POST /recently with invalid metadata url rejects', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `${apiRoutePrefix}/recently`,
      headers: { ...authPassHeader },
      payload: {
        type: RecentlyTypeEnum.Book,
        content: 'Bad url',
        metadata: {
          url: 'not-a-url',
          title: 'Test',
          author: 'Author',
        },
      },
    })
    expect(res.statusCode).toBe(422)
  })
})
