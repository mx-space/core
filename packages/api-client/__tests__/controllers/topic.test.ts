import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { TopicController } from '~/controllers/topic'
import camelcaseKeys from 'camelcase-keys'

describe('test topic client', () => {
  const client = mockRequestInstance(TopicController)

  test('GET /topics/slug/:slug', async () => {
    const mocked = mockResponse('/topics/slug/111', {
      name: 'name-topic',
    })
    const data = await client.topic.getTopicBySlug('111')
    expect(data).toEqual(camelcaseKeys(mocked))
  })
})
