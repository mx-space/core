import camelcaseKeys from 'camelcase-keys'

import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { CommentController } from '~/controllers/comment'

describe('comment client thread endpoints', () => {
  const client = mockRequestInstance(CommentController)

  test('get comment by ref id returns threaded items', async () => {
    const comments = [
      {
        id: 'root-1',
        ref_type: 'Post',
        ref: 'ref-1',
        root_comment_id: null,
        parent_comment_id: null,
        reply_count: 21,
        latest_reply_at: '2026-01-30T00:00:00.000Z',
        author: 'root',
        text: 'root',
        created: '2026-01-01T00:00:00.000Z',
        replies: [
          {
            id: 'reply-1',
            root_comment_id: 'root-1',
            parent_comment_id: 'root-1',
            author: 'reply-1',
            text: 'reply-1',
            created: '2026-01-02T00:00:00.000Z',
          },
        ],
        reply_window: {
          total: 21,
          returned: 6,
          threshold: 20,
          has_hidden: true,
          hidden_count: 15,
          next_cursor: 'reply-3',
        },
      },
    ]

    mockResponse(
      '/comments/ref/ref-1',
      {
        data: comments,
        pagination: {
          total: 1,
          current_page: 1,
          total_page: 1,
          size: 10,
          has_next_page: false,
          has_prev_page: false,
        },
      },
      'get',
    )

    const data = await client.comment.getByRefId('ref-1')

    expect(data.data).toEqual(camelcaseKeys(comments, { deep: true }))
    expect(data.data[0].replyWindow.nextCursor).toBe('reply-3')
  })

  test('get thread replies by root comment id', async () => {
    mockResponse(
      '/comments/thread/root-1',
      {
        replies: [
          {
            id: 'reply-4',
            root_comment_id: 'root-1',
            parent_comment_id: 'reply-3',
            text: 'reply-4',
          },
        ],
        next_cursor: 'reply-4',
        remaining: 11,
        done: false,
      },
      'get',
    )

    const data = await client.comment.getThreadReplies('root-1', {
      cursor: 'reply-3',
      size: 10,
    })

    expect(data).toEqual(
      camelcaseKeys(
        {
          replies: [
            {
              id: 'reply-4',
              root_comment_id: 'root-1',
              parent_comment_id: 'reply-3',
              text: 'reply-4',
            },
          ],
          next_cursor: 'reply-4',
          remaining: 11,
          done: false,
        },
        { deep: true },
      ),
    )
  })
})
