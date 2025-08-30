import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { CommentController } from '~/controllers/comment'
import camelcaseKeys from 'camelcase-keys'

describe('test note client', () => {
  const client = mockRequestInstance(CommentController)

  test('get comment by id', async () => {
    mockResponse('/comments/11111', {
      ref_type: 'Page',
      state: 1,
      children: [],
      comments_index: 1,
      id: '6188b80b6290547080c9e1f3',
      author: 'yss',
      text: '做的框架模板不错。(•౪• ) ',
      url: 'https://gitee.com/kmyss/',
      key: '#26',
      ref: '5e0318319332d06503619337',
      created: '2021-11-08T05:39:23.010Z',
      avatar:
        'https://sdn.geekzu.org/avatar/8675fa376c044b0d93a23374549c4248?d=retro',
    })

    const data = await client.comment.getById('11111')
    expect(data.children).toEqual([])
    expect(data.text).toBeDefined()
  })

  test('get comment by ref id', async () => {
    const comments = [
      {
        ref_type: 'Page',
        state: 1,
        children: [],
        comments_index: 1,
        id: '6188b80b6290547080c9e1f3',
        author: 'yss',
        text: '做的框架模板不错。(•౪• ) ',
        url: 'https://gitee.com/kmyss/',
        key: '#26',
        ref: '5e0318319332d06503619337',
        created: '2021-11-08T05:39:23.010Z',
        avatar:
          'https://sdn.geekzu.org/avatar/8675fa376c044b0d93a23374549c4248?d=retro',
      },
    ]
    mockResponse(
      '/comments/ref/5e0318319332d06503619337',
      {
        data: comments,
        pagination: {
          total: 23,
          current_page: 1,
          total_page: 3,
          size: 10,
          has_next_page: true,
          has_prev_page: false,
        },
      },
      'get',
    )

    const data = await client.comment.getByRefId('5e0318319332d06503619337')

    expect(data.data).toEqual(camelcaseKeys(comments, { deep: true }))
    expect(data.pagination.total).toEqual(23)
    expect(data.pagination.hasNextPage).toEqual(true)
  })

  it('should comment successfully', async () => {
    mockResponse(
      '/comments/1',
      {
        id: '1',
        text: 'bar',
      },
      'post',
    )

    const data = await client.comment.comment('1', {
      author: 'foo',
      text: 'bar',
      mail: 'xx@aa.com',
    })

    expect(data).toEqual({
      id: '1',
      text: 'bar',
    })
  })

  it('should reply comment successfully', async () => {
    mockResponse(
      '/comments/reply/1',
      {
        id: '1',
        text: 'bar',
      },
      'post',
    )

    const data = await client.comment.reply('1', {
      author: 'f',
      text: 'bar',
      mail: 'a@q.com',
    })

    expect(data).toEqual({ id: '1', text: 'bar' })
  })
})
