import {
  COMMENT_CREATED_EVENT,
  COMMENT_REPLIED_EVENT,
  CONTENT_PUBLISHED_EVENT,
  type PushEvent,
} from '@mx-space/push-protocol'
import { describe, expect, it } from 'vitest'

import {
  FANOUT_DELIVERY_INSERT_SQL,
  fanoutQueryForEvent,
  SPACE_APP_ID,
  YOHAKU_APP_ID,
} from '../src/fanout.js'

const envelope = {
  specversion: '1.0' as const,
  source: 'urn:mx-core:instance:src_1',
  time: '2026-08-07T12:00:00.000Z',
  datacontenttype: 'application/json' as const,
}

const commentCreated = (): PushEvent => ({
  ...envelope,
  id: 'comment.created:123',
  type: COMMENT_CREATED_EVENT,
  subject: 'comment/123',
  data: { resource_id: '123', resource_type: 'comment' },
})

const contentPublished = (
  resourceType: 'post' | 'note' | 'recently',
): PushEvent => ({
  ...envelope,
  id: `content.published:${resourceType}-1`,
  type: CONTENT_PUBLISHED_EVENT,
  subject: `${resourceType}/abc`,
  data: { resource_id: 'abc', resource_type: resourceType },
})

const commentReplied = (recipientReaderId = 'reader_1'): PushEvent => ({
  ...envelope,
  id: 'comment.replied:456',
  type: COMMENT_REPLIED_EVENT,
  subject: 'comment/456',
  data: {
    resource_id: '456',
    resource_type: 'comment',
    recipient_reader_id: recipientReaderId,
  },
})

describe('fanoutQueryForEvent', () => {
  it('routes comment.created.v1 to Space with no preference or reader filter', () => {
    expect(fanoutQueryForEvent(commentCreated())).toEqual({
      appId: SPACE_APP_ID,
      readerId: null,
      preferenceKey: null,
    })
  })

  it.each([
    ['post', 'content_post'],
    ['note', 'content_note'],
    ['recently', 'content_recently'],
  ] as const)(
    'routes content.published.v1 %s to Yohaku using preference %s',
    (resourceType, preferenceKey) => {
      expect(fanoutQueryForEvent(contentPublished(resourceType))).toEqual({
        appId: YOHAKU_APP_ID,
        readerId: null,
        preferenceKey,
      })
    },
  )

  it('routes comment.replied.v1 to the matching Yohaku reader with comment_replied', () => {
    expect(fanoutQueryForEvent(commentReplied('reader_9'))).toEqual({
      appId: YOHAKU_APP_ID,
      readerId: 'reader_9',
      preferenceKey: 'comment_replied',
    })
  })
})

describe('FANOUT_DELIVERY_INSERT_SQL', () => {
  it('filters with bound parameters and explicit text casts', () => {
    expect(FANOUT_DELIVERY_INSERT_SQL).toContain('i.app_id = $4')
    expect(FANOUT_DELIVERY_INSERT_SQL).toMatch(/b\.reader_id\s*=\s*\$5::text/)
    expect(FANOUT_DELIVERY_INSERT_SQL).toMatch(
      /b\.preferences\s*->>\s*\(\$6::text\)/,
    )
    expect(FANOUT_DELIVERY_INSERT_SQL).not.toMatch(/preferences->>["'`]/)
    expect(FANOUT_DELIVERY_INSERT_SQL).not.toContain('preferences->>${')
  })
})
