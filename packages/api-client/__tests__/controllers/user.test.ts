import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { UserController } from '~/controllers'
import camelcaseKeys from 'camelcase-keys'

describe('test user client', () => {
  const client = mockRequestInstance(UserController)

  test('GET /master', async () => {
    const mocked = mockResponse('/master', {
      id: '5ea4fe632507ba128f4c938c',
      introduce: '这是我的小世界呀',
      mail: 'i@innei.ren',
      url: 'https://innei.in',
      name: 'Innei',
      social_ids: {
        bili_id: 26578164,
        netease_id: 84302804,
        github: 'Innei',
      },
      username: 'Innei',
      created: '2020-04-26T03:22:11.784Z',
      modified: '2020-11-13T09:38:49.014Z',
      last_login_time: '2021-11-17T13:42:48.209Z',
      avatar: 'https://cdn.innei.ren/avatar.png',
    })
    const data = await client.user.getMasterInfo()
    expect(data.id).toEqual(mocked.id)
    expect(data).toEqual(camelcaseKeys(mocked, { deep: true }))
    expect(data.$raw.data).toEqual(mocked)
  })

  test('POST /login', async () => {
    const mocked = mockResponse(
      '/master/login',
      {
        id: '5ea4fe632507ba128f4c938c',
      },
      'post',
    )
    const data = await client.user.login('test', 'test')
    expect(data.id).toEqual(mocked.id)
    expect(data.$raw.data).toEqual(mocked)
  })

  test('GET /check_logged', async () => {
    const mocked = mockResponse('/check_logged?token=bearer token', {
      isGuest: true,
    })
    const data = await client.user.checkTokenValid('token')
    expect(data).toEqual(mocked)
  })

  it('should call `master.xx` work', () => {
    expect(client.master.getMasterInfo).toBeInstanceOf(Function)
    expect(client.master).toEqual(client.user)
  })
})
