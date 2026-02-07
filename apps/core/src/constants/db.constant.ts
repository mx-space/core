/* eslint-disable @typescript-eslint/prefer-literal-enum-member */
export const MIGRATE_COLLECTION_NAME = 'migrations'
export const MIGRATION_LOCK_COLLECTION_NAME = 'migration_locks'
export const CHECKSUM_COLLECTION_NAME = 'checksum'

/// auth
export const ACCOUNT_COLLECTION_NAME = 'accounts'
export const SESSION_COLLECTION_NAME = 'sessions'

/// biz
export const ACTIVITY_COLLECTION_NAME = 'activities'
export const ANALYZE_COLLECTION_NAME = 'analyzes'
export const CATEGORY_COLLECTION_NAME = 'categories'
export const COMMENT_COLLECTION_NAME = 'comments'
export const DRAFT_COLLECTION_NAME = 'drafts'
export const FILE_REFERENCE_COLLECTION_NAME = 'file_references'
export const LINK_COLLECTION_NAME = 'links'
export const META_PRESET_COLLECTION_NAME = 'meta_presets'
export const NOTE_COLLECTION_NAME = 'notes'
export const OPTION_COLLECTION_NAME = 'options'
export const OWNER_PROFILE_COLLECTION_NAME = 'owner_profiles'
export const PAGE_COLLECTION_NAME = 'pages'
export const POST_COLLECTION_NAME = 'posts'
export const PROJECT_COLLECTION_NAME = 'projects'
export const READER_COLLECTION_NAME = 'readers'
export const RECENTLY_COLLECTION_NAME = 'recentlies'
export const SAY_COLLECTION_NAME = 'says'
export const SERVERLESS_LOG_COLLECTION_NAME = 'serverless_logs'
export const SERVERLESS_STORAGE_COLLECTION_NAME = 'serverless_storages'
export const SLUG_TRACKER_COLLECTION_NAME = 'slug_trackers'
export const SNIPPET_COLLECTION_NAME = 'snippets'
export const SUBSCRIBE_COLLECTION_NAME = 'subscribes'
export const TOPIC_COLLECTION_NAME = 'topics'
export const WEBHOOK_COLLECTION_NAME = 'webhooks'
export const WEBHOOK_EVENT_COLLECTION_NAME = 'webhook_events'

export const AI_SUMMARY_COLLECTION_NAME = 'ai_summaries'
export const AI_DEEP_READING_COLLECTION_NAME = 'ai_deep_readings'
export const AI_TRANSLATION_COLLECTION_NAME = 'ai_translations'

export const USER_COLLECTION_NAME = 'users'
export enum CollectionRefTypes {
  Post = POST_COLLECTION_NAME,
  Note = NOTE_COLLECTION_NAME,
  Page = PAGE_COLLECTION_NAME,
  Recently = RECENTLY_COLLECTION_NAME,
}
