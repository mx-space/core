import type { AppErrorCode } from './app-error-code'

type WithMessage = { message: string }
type OptMessage = { message?: string } | undefined
type WithId = { id?: string } | undefined
type WithExtra = { extra?: string } | undefined

export type AppErrorPayloadMap = {
  // generic
  [AppErrorCode.INTERNAL_ERROR]: OptMessage
  [AppErrorCode.NOT_FOUND]: { message?: string; id?: string } | undefined
  [AppErrorCode.NO_CONTENT_MODIFIABLE]: undefined
  [AppErrorCode.DEMO_FORBIDDEN]: undefined
  [AppErrorCode.RESOURCE_NOT_FOUND]: WithId
  [AppErrorCode.CONTENT_NOT_FOUND]: WithId
  [AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS]: OptMessage
  [AppErrorCode.MAX_COUNT_LIMIT]: undefined
  [AppErrorCode.MASTER_LOST]: undefined
  [AppErrorCode.CANNOT_GET_IP]: undefined
  [AppErrorCode.ENTRY_NOT_FOUND]: WithId
  [AppErrorCode.REF_MODEL_NOT_FOUND]: WithExtra

  // validation
  [AppErrorCode.INVALID_PARAMETER]: WithMessage
  [AppErrorCode.INVALID_BODY]: undefined
  [AppErrorCode.INVALID_SLUG]: undefined
  [AppErrorCode.INVALID_NAME]: undefined
  [AppErrorCode.INVALID_REFERENCE]: undefined
  [AppErrorCode.INVALID_ORDER_VALUE]: undefined
  [AppErrorCode.INVALID_SEARCH_TYPE]: { type: string }
  [AppErrorCode.INVALID_ROOM_NAME]: undefined
  [AppErrorCode.INVALID_SUBSCRIBE_TYPE]: undefined
  [AppErrorCode.INVALID_VIEW]: { view: string; available: string[] }
  [AppErrorCode.SLUG_NOT_AVAILABLE]: undefined
  [AppErrorCode.VALIDATION_FAILED]: { issues?: unknown } | undefined

  // ack
  [AppErrorCode.ACK_INVALID_PAYLOAD]: OptMessage

  // ai
  [AppErrorCode.AI_CONTENT_MISSING]: WithMessage
  [AppErrorCode.AI_INVALID_PARAMETER]: WithMessage
  [AppErrorCode.AI_INVALID_QUERY_TYPE]: undefined
  [AppErrorCode.AI_NOT_ENABLED]: OptMessage
  [AppErrorCode.AI_KEY_EXPIRED]: undefined
  [AppErrorCode.AI_PROCESSING]: undefined
  [AppErrorCode.AI_PROVIDER_DISABLED]: { providerId?: string } | undefined
  [AppErrorCode.AI_PROVIDER_NOT_FOUND]: { providerId?: string } | undefined
  [AppErrorCode.AI_REVIEW_NOT_ENABLED]: undefined
  [AppErrorCode.AI_RESULT_PARSING_ERROR]: OptMessage
  [AppErrorCode.AI_SERVICE_ERROR]: OptMessage
  [AppErrorCode.AI_TASK_NOT_FOUND]: WithId
  [AppErrorCode.AI_TASK_ALREADY_COMPLETED]: undefined
  [AppErrorCode.AI_TASK_CANNOT_RETRY]: { reason?: string } | undefined
  [AppErrorCode.AI_TRANSLATION_NOT_FOUND]: undefined

  // auth
  [AppErrorCode.AUTH_DEVICE_FLOW_PENDING]: undefined
  [AppErrorCode.AUTH_INVALID_CREDENTIALS]: undefined
  [AppErrorCode.AUTH_NOT_LOGGED_IN]: undefined
  [AppErrorCode.AUTH_SESSION_EXPIRED]: undefined
  [AppErrorCode.AUTH_TOKEN_NOT_FOUND]: undefined
  [AppErrorCode.AUTH_CHALLENGE_MISSING]: undefined
  [AppErrorCode.AUTH_CHALLENGE_EXPIRED]: undefined
  [AppErrorCode.AUTH_REGISTRATION_MISSING]: undefined
  [AppErrorCode.AUTH_USERNAME_INCORRECT]: undefined
  [AppErrorCode.AUTH_PASSWORD_INCORRECT]: undefined
  [AppErrorCode.AUTH_SESSION_NOT_FOUND]: undefined
  [AppErrorCode.AUTH_USER_ID_NOT_FOUND]: undefined
  [AppErrorCode.AUTH_FAILED]: OptMessage
  [AppErrorCode.AUTH_TOKEN_INVALID]: undefined
  [AppErrorCode.PASSWORD_LOGIN_DISABLED]: undefined
  [AppErrorCode.PASSWORD_SAME_AS_OLD]: undefined

  // category
  [AppErrorCode.CATEGORY_NOT_FOUND]: WithId
  [AppErrorCode.CATEGORY_HAS_POSTS]: undefined

  // comment
  [AppErrorCode.COMMENT_DISABLED]: undefined
  [AppErrorCode.COMMENT_FORBIDDEN]: undefined
  [AppErrorCode.COMMENT_NOT_FOUND]: WithId
  [AppErrorCode.COMMENT_TOO_DEEP]: undefined
  [AppErrorCode.COMMENT_POST_NOT_EXISTS]: undefined
  [AppErrorCode.COMMENT_IMAGE_CAP_EXCEEDED]: undefined
  [AppErrorCode.COMMENT_UPLOAD_DISABLED]: undefined
  [AppErrorCode.COMMENT_UPLOAD_FILE_TOO_LARGE]: undefined
  [AppErrorCode.COMMENT_UPLOAD_INVALID_MIME]: undefined
  [AppErrorCode.COMMENT_UPLOAD_FILE_NOT_OWNED]: undefined
  [AppErrorCode.COMMENT_UPLOAD_FILE_ALREADY_BOUND]: undefined
  [AppErrorCode.COMMENT_UPLOAD_RATE_LIMITED]: undefined
  [AppErrorCode.COMMENT_UPLOAD_QUOTA_EXCEEDED]: undefined
  [AppErrorCode.COMMENT_UPLOAD_ACCOUNT_TOO_NEW]: undefined
  [AppErrorCode.COMMENT_UPLOAD_INSUFFICIENT_COMMENTS]: undefined

  // config
  [AppErrorCode.CONFIG_NOT_FOUND]: WithId
  [AppErrorCode.CONFIG_VALIDATION_FAILED]: OptMessage

  // cron
  [AppErrorCode.CRON_NOT_FOUND]: WithExtra
  [AppErrorCode.INVALID_CRON_METHOD]: undefined
  [AppErrorCode.FUNCTION_NOT_FOUND]: { path?: string } | undefined

  // draft
  [AppErrorCode.DRAFT_NOT_FOUND]: WithId
  [AppErrorCode.DRAFT_HISTORY_NOT_FOUND]: undefined

  // document / helper
  [AppErrorCode.DOCUMENT_NOT_FOUND]: WithId
  [AppErrorCode.HELPER_DOCUMENT_NOT_FOUND]: WithId

  // email
  [AppErrorCode.EMAIL_TEMPLATE_NOT_FOUND]: undefined

  // enrichment
  [AppErrorCode.ENRICHMENT_BROWSER_MODE_REQUIRED]: undefined
  [AppErrorCode.ENRICHMENT_CAPTURE_FAILED]: undefined
  [AppErrorCode.ENRICHMENT_NOT_FOUND]: WithId
  [AppErrorCode.ENRICHMENT_SCREENSHOT_DISABLED]: undefined

  // file
  [AppErrorCode.FILE_NOT_FOUND]: { name?: string; extra?: string } | undefined
  [AppErrorCode.FILE_EXISTS]: undefined
  [AppErrorCode.FILE_RENAME_FAILED]: undefined
  [AppErrorCode.FILE_STORAGE_NOT_CONFIGURED]: undefined
  [AppErrorCode.FILE_UPLOAD_DISABLED]: undefined
  [AppErrorCode.FILE_UPLOAD_NOT_AUTHORIZED]: undefined
  [AppErrorCode.MIME_ZIP_REQUIRED]: { got?: string } | undefined

  // init
  [AppErrorCode.INIT_ALREADY_COMPLETED]: undefined
  [AppErrorCode.INIT_FORBIDDEN]: undefined
  [AppErrorCode.INIT_INVALID_BODY]: undefined
  [AppErrorCode.INIT_INVALID_MIME_TYPE]: { got?: string } | undefined

  // link
  [AppErrorCode.LINK_APPLY_DISABLED]: undefined
  [AppErrorCode.LINK_NOT_FOUND]: WithId
  [AppErrorCode.LINK_DISABLED]: undefined
  [AppErrorCode.SUBPATH_LINK_DISABLED]: undefined
  [AppErrorCode.DUPLICATE_LINK]: undefined
  [AppErrorCode.LINK_AVATAR_VALIDATION_FAILED]: { reason?: string } | undefined

  // meta preset
  [AppErrorCode.META_PRESET_KEY_EXISTS]: { key?: string } | undefined
  [AppErrorCode.META_PRESET_NOT_FOUND]: WithId
  [AppErrorCode.BUILTIN_PRESET_CANNOT_DELETE]: undefined

  // note
  [AppErrorCode.NOTE_FORBIDDEN]: undefined
  [AppErrorCode.NOTE_NOT_FOUND]: WithId
  [AppErrorCode.NOTE_PASSWORD_REQUIRED]: undefined

  // owner / reader / user
  [AppErrorCode.OWNER_NOT_FOUND]: undefined
  [AppErrorCode.READER_NOT_FOUND]: WithId
  [AppErrorCode.USER_NOT_EXISTS]: undefined
  [AppErrorCode.USER_ALREADY_EXISTS]: undefined

  // page
  [AppErrorCode.PAGE_NOT_FOUND]: WithId

  // project
  [AppErrorCode.PROJECT_NOT_FOUND]: WithId
  [AppErrorCode.PROJECT_NAME_TAKEN]: { name?: string } | undefined

  // post
  [AppErrorCode.POST_NOT_FOUND]: WithId
  [AppErrorCode.POST_UNPUBLISHED]: WithId
  [AppErrorCode.POST_HIDDEN_OR_ENCRYPTED]: undefined
  [AppErrorCode.POST_RELATED_NOT_EXISTS]: undefined
  [AppErrorCode.POST_SELF_RELATION]: undefined

  // recently
  [AppErrorCode.RECENTLY_NOT_FOUND]: WithId

  // backup
  [AppErrorCode.BACKUP_NOT_ENABLED]: undefined

  // serverless
  [AppErrorCode.SERVERLESS_ERROR]: OptMessage
  [AppErrorCode.SERVERLESS_NO_PERMISSION]: undefined

  // snippet
  [AppErrorCode.SNIPPET_NOT_FOUND]: WithId
  [AppErrorCode.SNIPPET_EXISTS]: undefined
  [AppErrorCode.SNIPPET_PRIVATE]: undefined
  [AppErrorCode.SNIPPET_INVALID_JSON]: undefined
  [AppErrorCode.SNIPPET_INVALID_JSON5]: undefined
  [AppErrorCode.SNIPPET_INVALID_YAML]: undefined
  [AppErrorCode.SNIPPET_INVALID_FUNCTION]: WithExtra

  // subscribe
  [AppErrorCode.SUBSCRIBE_NOT_ENABLED]: undefined
  [AppErrorCode.SUBSCRIBE_TYPE_EMPTY]: undefined
  [AppErrorCode.ALREADY_SUPPORTED]: undefined

  // topic
  [AppErrorCode.TOPIC_NOT_FOUND]: WithId

  // webhook
  [AppErrorCode.WEBHOOK_EVENT_NOT_FOUND]: WithId
  [AppErrorCode.WEBHOOK_NOT_FOUND]: WithId

  // bing
  [AppErrorCode.BING_API_FAILED]: undefined
  [AppErrorCode.BING_KEY_INVALID]: undefined
  [AppErrorCode.BING_DOMAIN_INVALID]: undefined
}
