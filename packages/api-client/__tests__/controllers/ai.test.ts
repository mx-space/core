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
})
