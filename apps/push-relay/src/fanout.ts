import {
  COMMENT_CREATED_EVENT,
  COMMENT_REPLIED_EVENT,
  CONTENT_PUBLISHED_EVENT,
  type PushEvent,
  type PushPreferences,
} from '@mx-space/push-protocol'

export const SPACE_APP_ID = 'space'
export const YOHAKU_APP_ID = 'yohaku'

export const FANOUT_DELIVERY_INSERT_SQL = `INSERT INTO push_deliveries
         (id, source_id, event_id, binding_id, installation_id, next_attempt_at)
         SELECT 'dlv_' || encode(gen_random_bytes(18), 'hex'), b.source_id, $1,
                b.id, b.installation_id, $3
         FROM push_bindings b
         JOIN push_installations i ON i.id = b.installation_id
         WHERE b.source_id = $2 AND b.revoked_at IS NULL AND i.revoked_at IS NULL
           AND i.app_id = $4
           AND ($5::text IS NULL OR b.reader_id = $5::text)
           AND ($6::text IS NULL OR COALESCE((b.preferences ->> ($6::text))::boolean, false) = true)`

export type FanoutQuery = {
  appId: string
  readerId: string | null
  preferenceKey: keyof PushPreferences | null
}

const publishedPreferenceKey = {
  post: 'content_post',
  note: 'content_note',
  recently: 'content_recently',
} as const satisfies Record<'post' | 'note' | 'recently', keyof PushPreferences>

export const fanoutQueryForEvent = (event: PushEvent): FanoutQuery | null => {
  switch (event.type) {
    case COMMENT_CREATED_EVENT: {
      return { appId: SPACE_APP_ID, readerId: null, preferenceKey: null }
    }
    case CONTENT_PUBLISHED_EVENT: {
      return {
        appId: YOHAKU_APP_ID,
        readerId: null,
        preferenceKey: publishedPreferenceKey[event.data.resource_type],
      }
    }
    case COMMENT_REPLIED_EVENT: {
      return {
        appId: YOHAKU_APP_ID,
        readerId: event.data.recipient_reader_id,
        preferenceKey: 'comment_replied',
      }
    }
    default: {
      return null
    }
  }
}
