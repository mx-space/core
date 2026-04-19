import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { AIController } from '~/controllers'

describe('AIController.insights', () => {
  const client = mockRequestInstance(AIController)

  test('getInsightsGenerateUrl builds correct URL', () => {
    const url = client.ai.getInsightsGenerateUrl({
      articleId: 'a1',
      lang: 'zh',
    })
    expect(url).toBe(
      'https://api.innei.ren/v2/ai/insights/article/a1/generate?lang=zh',
    )
  })

  test('getInsights issues GET with correct params', async () => {
    mockResponse(
      '/ai/insights/article/a1?articleId=a1&lang=en&onlyDb=true',
      {},
      'get',
    )
    await expect(
      client.ai.getInsights({ articleId: 'a1', lang: 'en', onlyDb: true }),
    ).resolves.not.toThrowError()
  })
})
