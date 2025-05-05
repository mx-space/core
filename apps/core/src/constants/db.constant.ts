/* eslint-disable @typescript-eslint/prefer-literal-enum-member */
export const MIGRATE_COLLECTION_NAME = 'migrations'
export const CHECKSUM_COLLECTION_NAME = 'checksum'

/// biz
export const POST_COLLECTION_NAME = 'posts'
export const NOTE_COLLECTION_NAME = 'notes'
export const PAGE_COLLECTION_NAME = 'pages'

export const TOPIC_COLLECTION_NAME = 'topics'
export const CATEGORY_COLLECTION_NAME = 'categories'

export const COMMENT_COLLECTION_NAME = 'comments'
export const RECENTLY_COLLECTION_NAME = 'recentlies'

export const ANALYZE_COLLECTION_NAME = 'analyzes'
export const WEBHOOK_EVENT_COLLECTION_NAME = 'webhook_events'
export const AI_SUMMARY_COLLECTION_NAME = 'ai_summaries'
export const AI_DEEP_READING_COLLECTION_NAME = 'ai_deep_readings'

export const USER_COLLECTION_NAME = 'users'
export enum CollectionRefTypes {
  Post = POST_COLLECTION_NAME,
  Note = NOTE_COLLECTION_NAME,
  Page = PAGE_COLLECTION_NAME,
  Recently = RECENTLY_COLLECTION_NAME,
}
