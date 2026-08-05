import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { AIController } from '~/controllers'

describe('test ai client', () => {
  const client = mockRequestInstance(AIController)

  test('POST /generate-summary', async () => {
    mockResponse('/ai/summaries/generate', {}, 'post', {
      lang: 'zh-CN',
      refId: '11',
    })

    await expect(
      client.ai.generateSummary('11', 'zh-CN'),
    ).resolves.not.toThrowError()
  })

  test('GET /summary/:id', async () => {
    mockResponse(
      '/ai/summaries/article/11?articleId=11&lang=zh-CN&onlyDb=true',
      {},
      'get',
    )

    await expect(
      client.ai.getSummary({
        articleId: '11',
        lang: 'zh-CN',
        onlyDb: true,
      }),
    ).resolves.not.toThrowError()
  })

  test('getTts requests the article narration', async () => {
    mockResponse(
      '/ai/tts/article/post-1?lang=zh',
      {
        lang: 'zh',
        model: 'tts-1',
        voice: 'nova',
        blockOrder: ['block-1'],
        segments: [],
      },
      'get',
    )

    const response = await client.ai.getTts({ articleId: 'post-1', lang: 'zh' })
    expect(response).not.toHaveProperty('error')
    expect(response.lang).toBe('zh')
    expect(response.model).toBe('tts-1')
    expect(response.voice).toBe('nova')
  })
})
