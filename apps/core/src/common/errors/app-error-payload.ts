import type { AppErrorCode } from './app-error-code'

export type AppErrorPayloadMap = {
  [AppErrorCode.ACK_INVALID_PAYLOAD]: { message?: string } | undefined
  [AppErrorCode.AI_CONTENT_MISSING]: { message: string }
  [AppErrorCode.AI_INVALID_PARAMETER]: { message: string }
  [AppErrorCode.AI_INVALID_QUERY_TYPE]: undefined
  [AppErrorCode.AI_NOT_ENABLED]: { message?: string } | undefined
  [AppErrorCode.AI_PROVIDER_DISABLED]: { providerId?: string } | undefined
  [AppErrorCode.AI_PROVIDER_NOT_FOUND]: { providerId?: string } | undefined
  [AppErrorCode.AI_REVIEW_NOT_ENABLED]: undefined
  [AppErrorCode.AI_SERVICE_ERROR]: { message?: string } | undefined
  [AppErrorCode.AI_TASK_NOT_FOUND]: { id?: string } | undefined
  [AppErrorCode.AUTH_DEVICE_FLOW_PENDING]: undefined
  [AppErrorCode.AUTH_INVALID_CREDENTIALS]: undefined
  [AppErrorCode.AUTH_NOT_LOGGED_IN]: undefined
  [AppErrorCode.AUTH_SESSION_EXPIRED]: undefined
  [AppErrorCode.AUTH_TOKEN_NOT_FOUND]: undefined
  [AppErrorCode.CATEGORY_NOT_FOUND]: { id?: string } | undefined
  [AppErrorCode.COMMENT_DISABLED]: undefined
  [AppErrorCode.COMMENT_FORBIDDEN]: undefined
  [AppErrorCode.COMMENT_NOT_FOUND]: { id?: string } | undefined
  [AppErrorCode.DRAFT_NOT_FOUND]: { id?: string } | undefined
  [AppErrorCode.ENRICHMENT_BROWSER_MODE_REQUIRED]: undefined
  [AppErrorCode.ENRICHMENT_CAPTURE_FAILED]: undefined
  [AppErrorCode.ENRICHMENT_NOT_FOUND]: { id?: string } | undefined
  [AppErrorCode.ENRICHMENT_SCREENSHOT_DISABLED]: undefined
  [AppErrorCode.FILE_NOT_FOUND]: { name?: string } | undefined
  [AppErrorCode.FILE_STORAGE_NOT_CONFIGURED]: undefined
  [AppErrorCode.FILE_UPLOAD_DISABLED]: undefined
  [AppErrorCode.FILE_UPLOAD_NOT_AUTHORIZED]: undefined
  [AppErrorCode.HELPER_DOCUMENT_NOT_FOUND]: { id?: string } | undefined
  [AppErrorCode.INIT_ALREADY_COMPLETED]: undefined
  [AppErrorCode.INIT_FORBIDDEN]: undefined
  [AppErrorCode.INIT_INVALID_BODY]: undefined
  [AppErrorCode.INIT_INVALID_MIME_TYPE]: { got?: string } | undefined
  [AppErrorCode.INVALID_ORDER_VALUE]: undefined
  [AppErrorCode.INVALID_PARAMETER]: { message: string }
  [AppErrorCode.INVALID_SEARCH_TYPE]: { type: string }
  [AppErrorCode.INVALID_VIEW]: { view: string; available: string[] }
  [AppErrorCode.LINK_APPLY_DISABLED]: undefined
  [AppErrorCode.META_PRESET_KEY_EXISTS]: { key?: string } | undefined
  [AppErrorCode.META_PRESET_NOT_FOUND]: { id?: string } | undefined
  [AppErrorCode.NOTE_FORBIDDEN]: undefined
  [AppErrorCode.NOTE_NOT_FOUND]: { id?: string } | undefined
  [AppErrorCode.NOTE_PASSWORD_REQUIRED]: undefined
  [AppErrorCode.OWNER_NOT_FOUND]: undefined
  [AppErrorCode.PAGE_NOT_FOUND]: { id?: string } | undefined
  [AppErrorCode.POST_NOT_FOUND]: { id?: string } | undefined
  [AppErrorCode.POST_UNPUBLISHED]: { id?: string } | undefined
  [AppErrorCode.READER_NOT_FOUND]: { id?: string } | undefined
  [AppErrorCode.RECENTLY_NOT_FOUND]: { id?: string } | undefined
  [AppErrorCode.SUBSCRIBE_NOT_ENABLED]: undefined
  [AppErrorCode.SUBSCRIBE_TYPE_EMPTY]: undefined
  [AppErrorCode.TOPIC_NOT_FOUND]: { id?: string } | undefined
  [AppErrorCode.WEBHOOK_EVENT_NOT_FOUND]: { id?: string } | undefined
  [AppErrorCode.WEBHOOK_NOT_FOUND]: { id?: string } | undefined
}
