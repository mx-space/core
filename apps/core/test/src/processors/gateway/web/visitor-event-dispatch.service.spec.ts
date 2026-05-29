import { BusinessEvents } from '~/constants/business-event.constant'
import { VisitorEventDispatchService } from '~/processors/gateway/web/visitor-event-dispatch.service'

const createService = () => {
  const broadcasts: Array<{
    data: any
    event: BusinessEvents
    rooms?: string[]
  }> = []
  const webGateway = {
    broadcast: vi.fn((event, data, options) => {
      broadcasts.push({ data, event, rooms: options?.rooms })
    }),
    getSocketsOfRoom: vi
      .fn()
      .mockResolvedValue([{ id: 'socket-ja' }, { id: 'socket-zh' }]),
  }
  const gatewayService = {
    getSocketMetadata: vi.fn(async (socket: { id: string }) =>
      socket.id === 'socket-ja' ? { lang: 'ja' } : { lang: 'zh' },
    ),
  }
  const translationService = {
    getDictTranslations: vi.fn(async (keyPath: string, lang: string) => {
      if (lang !== 'ja') return new Map()
      if (keyPath === 'note.mood') return new Map([['开心', 'うれしい']])
      if (keyPath === 'note.weather') return new Map([['晴', '晴れ']])
      return new Map()
    }),
    getEntityTranslations: vi.fn(async (keyPath: string, lang: string) => {
      if (lang !== 'ja') return new Map()
      if (keyPath === 'topic.name') return new Map([['topic-1', '随筆']])
      if (keyPath === 'topic.introduce')
        return new Map([['topic-1', '随筆の紹介']])
      if (keyPath === 'topic.description')
        return new Map([['topic-1', '随筆の説明']])
      if (keyPath === 'category.name') return new Map([['category-1', '技術']])
      return new Map()
    }),
    translateArticle: vi.fn(async ({ originalData, targetLang }) => {
      if (targetLang === 'ja') {
        return {
          ...originalData,
          availableTranslations: ['ja'],
          isTranslated: true,
          sourceLang: 'zh',
          text: '日本語本文',
          title: '日本語タイトル',
          translationMeta: {
            sourceLang: 'zh',
            targetLang: 'ja',
            translatedAt: new Date('2026-05-26T00:00:00.000Z'),
          },
        }
      }

      return {
        ...originalData,
        availableTranslations: ['ja'],
        isTranslated: false,
        sourceLang: 'zh',
      }
    }),
  }

  const service = new VisitorEventDispatchService(
    {} as any,
    webGateway as any,
    {} as any,
    translationService as any,
    gatewayService as any,
  )

  return { broadcasts, service, translationService, webGateway }
}

describe('VisitorEventDispatchService socket localization', () => {
  it('broadcasts note update payloads with article and topic translations for socket lang', async () => {
    const { broadcasts, service } = createService()

    await (service as any).broadcastWithTranslation(
      BusinessEvents.NOTE_UPDATE,
      {
        id: 'note-1',
        mood: '开心',
        text: '中文正文',
        title: '中文标题',
        topic: {
          description: '中文说明',
          id: 'topic-1',
          introduce: '中文介绍',
          name: '随想',
        },
        weather: '晴',
      },
      'article-note-1',
    )

    const jaPayload = broadcasts.find((item) =>
      item.rooms?.includes('socket-ja'),
    )?.data

    expect(jaPayload).toMatchObject({
      mood: 'うれしい',
      payloadLang: 'ja',
      text: '日本語本文',
      title: '日本語タイトル',
      topic: {
        description: '随筆の説明',
        introduce: '随筆の紹介',
        name: '随筆',
      },
      weather: '晴れ',
    })
  })

  it('broadcasts post update payloads with category translations for socket lang', async () => {
    const { broadcasts, service } = createService()

    await (service as any).broadcastWithTranslation(
      BusinessEvents.POST_UPDATE,
      {
        category: {
          id: 'category-1',
          name: '技术',
          slug: 'tech',
        },
        id: 'post-1',
        summary: '中文摘要',
        tags: ['标签'],
        text: '中文正文',
        title: '中文标题',
      },
      'article-post-1',
    )

    const jaPayload = broadcasts.find((item) =>
      item.rooms?.includes('socket-ja'),
    )?.data

    expect(jaPayload).toMatchObject({
      category: {
        name: '技術',
      },
      payloadLang: 'ja',
      text: '日本語本文',
      title: '日本語タイトル',
    })
  })
})
