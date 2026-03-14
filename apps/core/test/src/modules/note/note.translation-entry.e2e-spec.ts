import { APP_INTERCEPTOR, Reflector } from '@nestjs/core'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { dbHelper } from 'test/helper/db-mock.helper'
import { setupE2EApp } from 'test/helper/setup-e2e'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

import { apiRoutePrefix } from '~/common/decorators/api-controller.decorator'
import { JSONTransformInterceptor } from '~/common/interceptors/json-transform.interceptor'
import { ResponseInterceptor } from '~/common/interceptors/response.interceptor'
import { TranslationEntryInterceptor } from '~/common/interceptors/translation-entry.interceptor'
import { TranslationEntryService } from '~/modules/ai/ai-translation/translation-entry.service'
import { NoteController } from '~/modules/note/note.controller'
import { NoteModel } from '~/modules/note/note.model'
import { NoteService } from '~/modules/note/note.service'
import { TopicModel } from '~/modules/topic/topic.model'
import { CountingService } from '~/processors/helper/helper.counting.service'
import { TranslationService } from '~/processors/helper/helper.translation.service'

describe('NoteController translation entry (e2e)', () => {
  let app: NestFastifyApplication
  let noteModel: MongooseModel<NoteModel>
  let topicModel: MongooseModel<TopicModel>

  const getTranslationsBatch = vi.fn()
  const translateArticleList = vi.fn(async () => new Map())

  beforeAll(async () => {
    noteModel = dbHelper.getModel(NoteModel)
    topicModel = dbHelper.getModel(TopicModel)

    app = await setupE2EApp({
      controllers: [NoteController],
      providers: [
        {
          provide: NoteService,
          useValue: {
            model: noteModel,
            publicNoteQueryCondition: {
              isPublished: true,
            },
          },
        },
        {
          provide: CountingService,
          useValue: {},
        },
        {
          provide: TranslationService,
          useValue: {
            translateArticleList,
          },
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
    await noteModel.deleteMany({})
    await topicModel.deleteMany({})
    await app?.close()
  })

  test('GET /notes translates mood and topic fields from paginated docs', async () => {
    const topic = await topicModel.create({
      name: '近况',
      introduce: '记录最近发生的碎碎念。',
      slug: 'recent-situation',
    })

    await noteModel.create({
      title: 'Translated note',
      text: 'Content with topic',
      created: new Date('2026-03-14T12:00:00.000Z'),
      allowComment: true,
      isPublished: true,
      mood: '开心',
      topicId: topic._id,
    })

    getTranslationsBatch.mockResolvedValueOnce({
      entityMaps: new Map([
        ['topic.name', new Map([[topic._id.toString(), 'Recent']])],
        [
          'topic.introduce',
          new Map([[topic._id.toString(), 'Recent updates']]),
        ],
      ]),
      dictMaps: new Map([['note.mood', new Map([['开心', 'Happy']])]]),
    })

    const res = await app.inject({
      method: 'GET',
      url: `${apiRoutePrefix}/notes?lang=en&size=1`,
    })

    expect(res.statusCode).toBe(200)
    expect(getTranslationsBatch).toHaveBeenCalledWith('en', {
      entityLookups: [
        { keyPath: 'topic.name', lookupKeys: [topic._id.toString()] },
        { keyPath: 'topic.introduce', lookupKeys: [topic._id.toString()] },
      ],
      dictLookups: [{ keyPath: 'note.mood', sourceTexts: ['开心'] }],
    })

    const json = res.json()
    expect(json.data).toHaveLength(1)
    expect(json.data[0].mood).toBe('Happy')
    expect(json.data[0].topic.name).toBe('Recent')
    expect(json.data[0].topic.introduce).toBe('Recent updates')
  })
})
