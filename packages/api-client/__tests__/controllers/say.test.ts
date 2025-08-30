import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { SayController } from '~/controllers/say'
import camelcaseKeys from 'camelcase-keys'

describe('test say client', () => {
  const client = mockRequestInstance(SayController)

  test('GET /says/all', async () => {
    const mocked = mockResponse('/says/all', {
      data: [
        {
          id: '5eb52a73505ad56acfd25c94',
          source: '网络',
          text: '找不到路，就自己走一条出来。',
          author: '魅影陌客',
          created: '2020-05-08T09:46:27.694Z',
        },
        {
          id: '5eb52a94505ad56acfd25c95',
          source: '网络',
          text: '生活中若没有朋友，就像生活中没有阳光一样。',
          author: '能美',
          created: '2020-05-08T09:47:00.436Z',
        },
      ],
    })
    const data = await client.say.getAll()
    expect(data.$raw.data).toEqual(mocked)
    expect(data.data).toEqual(mocked.data)
    expect(data.data[0].text).toEqual('找不到路，就自己走一条出来。')
  })

  describe('GET /says', () => {
    it('should get without page and size', async () => {
      const mocked = mockResponse('/says', {
        data: [
          {
            id: '61397d9892992823d7329bc9',
            text: '每位师傅各有所长，我都会一点点。',
            author: '陆沉',
            source: '',
            created: '2021-09-09T03:20:56.769Z',
          },
          {
            id: '60853492fbfab397775cc12d',
            text: '我不是一个优秀的人，只是我们观测的角度不同。',
            created: '2021-04-25T09:21:22.115Z',
          },
        ],
        pagination: {
          total: 26,
          current_page: 1,
          total_page: 3,
          size: 10,
          has_next_page: true,
          has_prev_page: false,
        },
      })

      const data = await client.say.getAllPaginated()
      expect(data.$raw.data).toEqual(mocked)
      expect(data.data).toEqual(camelcaseKeys(mocked.data, { deep: true }))
      expect(data.data[0].text).toEqual('每位师傅各有所长，我都会一点点。')
    })

    it('should with page and size', async () => {
      const mocked = await mockResponse('/says?size=1&page=1', {
        data: [
          {
            id: '61397d9892992823d7329bc9',
            text: '每位师傅各有所长，我都会一点点。',
            author: '陆沉',
            source: '',
            created: '2021-09-09T03:20:56.769Z',
          },
        ],
        pagination: {
          total: 26,
          current_page: 1,
          total_page: 26,
          size: 1,
          has_next_page: true,
          has_prev_page: false,
        },
      })

      const data = await client.say.getAllPaginated(1, 1)
      expect(data.$raw.data).toEqual(mocked)
    })
  })

  test('GET /says/:id', async () => {
    const mocked = mockResponse('/says/61397d9892992823d7329bc9', {
      id: '61397d9892992823d7329bc9',
      text: '每位师傅各有所长，我都会一点点。',
      author: '陆沉',
      source: '',
      created: '2021-09-09T03:20:56.769Z',
    })
    const data = await client.say.getById('61397d9892992823d7329bc9')
    expect(data.$raw.data).toEqual(mocked)
    expect(data.id).toEqual('61397d9892992823d7329bc9')
  })
})
