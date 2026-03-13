import { APP_INTERCEPTOR, Reflector } from '@nestjs/core'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { dbHelper } from 'test/helper/db-mock.helper'
import { setupE2EApp } from 'test/helper/setup-e2e'
import { eventEmitterProvider } from 'test/mock/processors/event.mock'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { JSONTransformInterceptor } from '~/common/interceptors/json-transform.interceptor'
import { ResponseInterceptor } from '~/common/interceptors/response.interceptor'
import { TranslationEntryInterceptor } from '~/common/interceptors/translation-entry.interceptor'
import { TranslationEntryService } from '~/modules/ai/ai-translation/translation-entry.service'
import { TopicBaseController } from '~/modules/topic/topic.controller'
import { TopicModel } from '~/modules/topic/topic.model'
import { getModelToken } from '~/transformers/model.transformer'

describe('TopicBaseController translation (e2e)', () => {
  let app: NestFastifyApplication
  let model: MongooseModel<TopicModel>
  let translatedTopicId = ''

  const getTranslationsBatch = vi.fn()

  beforeAll(async () => {
    model = dbHelper.getModel(TopicModel)

    const [translatedTopic] = await model.create([
      {
        name: '前端',
        introduce: '前端介绍',
        slug: 'frontend',
      },
    ])

    translatedTopicId = translatedTopic._id.toString()

    app = await setupE2EApp({
      controllers: [TopicBaseController],
      providers: [
        ...eventEmitterProvider,
        {
          provide: getModelToken(TopicModel.name),
          useValue: model,
        },
        {
          provide: TranslationEntryService,
          useValue: {
            getTranslationsBatch,
          },
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: JSONTransformInterceptor,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: ResponseInterceptor,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: TranslationEntryInterceptor,
        },
        {
          provide: 'Reflector',
          useExisting: Reflector,
        },
      ],
    })
  })

  afterAll(async () => {
    await app?.close()
  })

  test('GET /topics/all translates list fields from wrapped data', async () => {
    getTranslationsBatch.mockResolvedValueOnce({
      entityMaps: new Map([
        ['topic.name', new Map([[translatedTopicId, 'Frontend']])],
        ['topic.introduce', new Map([[translatedTopicId, 'Frontend Intro']])],
      ]),
      dictMaps: new Map(),
    })

    const res = await app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/topics/all?lang=en`,
    })

    expect(res.statusCode).toBe(200)
    expect(getTranslationsBatch).toHaveBeenCalledWith('en', {
      entityLookups: [
        { keyPath: 'topic.name', lookupKeys: [translatedTopicId] },
        { keyPath: 'topic.introduce', lookupKeys: [translatedTopicId] },
      ],
      dictLookups: [],
    })

    const json = res.json()
    expect(json.data).toHaveLength(1)
    expect(json.data[0].name).toBe('Frontend')
    expect(json.data[0].introduce).toBe('Frontend Intro')
  })

  test('GET /topics/slug/:slug returns a topic by slug', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/topics/slug/frontend`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().slug).toBe('frontend')
  })

  test('GET /topics/:id returns a topic by id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/topics/${translatedTopicId}`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().slug).toBe('frontend')
  })
})
