import { AppErrorCode } from './app-error-code'
import type { AppErrorPayloadMap } from './app-error-payload'

type PayloadFor<C extends AppErrorCode> = AppErrorPayloadMap[C]
type PresentPayloadFor<C extends AppErrorCode> = Exclude<
  PayloadFor<C>,
  undefined
>

type AppErrorDefinition<C extends AppErrorCode> =
  undefined extends PayloadFor<C>
    ? {
        status: number
        message:
          | string
          | ((payload: PresentPayloadFor<C> | undefined) => string)
        details?: (
          payload: PresentPayloadFor<C> | undefined,
        ) => Record<string, unknown> | undefined
      }
    : {
        status: number
        message: string | ((payload: PresentPayloadFor<C>) => string)
        details?: (
          payload: PresentPayloadFor<C>,
        ) => Record<string, unknown> | undefined
      }

const withExtra = (msg: string) => (payload: { extra?: string } | undefined) =>
  payload?.extra ? `${msg}: ${payload.extra}` : msg

export const APP_ERROR_DEFINITIONS = {
  // generic
  [AppErrorCode.INTERNAL_ERROR]: {
    status: 500,
    message: (p) => p?.message ?? 'Internal server error',
  },
  [AppErrorCode.NOT_FOUND]: {
    status: 404,
    message: (p) => p?.message ?? 'Not found',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },
  [AppErrorCode.NO_CONTENT_MODIFIABLE]: {
    status: 400,
    message: 'No content to modify',
  },
  [AppErrorCode.DEMO_FORBIDDEN]: {
    status: 403,
    message: 'This operation is not allowed in demo mode',
  },
  [AppErrorCode.RESOURCE_NOT_FOUND]: {
    status: 404,
    message: 'Resource not found',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },
  [AppErrorCode.CONTENT_NOT_FOUND]: {
    status: 404,
    message: 'Content not found',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },
  [AppErrorCode.CONTENT_NOT_FOUND_CANT_PROCESS]: {
    status: 400,
    message: (p) => p?.message ?? 'Content not found, cannot process',
  },
  [AppErrorCode.MAX_COUNT_LIMIT]: { status: 400, message: 'Max count reached' },
  [AppErrorCode.MASTER_LOST]: {
    status: 500,
    message: 'Site owner information is missing',
  },
  [AppErrorCode.CANNOT_GET_IP]: { status: 422, message: 'Cannot resolve IP' },
  [AppErrorCode.ENTRY_NOT_FOUND]: {
    status: 404,
    message: 'Entry not found',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },
  [AppErrorCode.REF_MODEL_NOT_FOUND]: {
    status: 404,
    message: withExtra('Referenced model not found'),
  },

  // validation
  [AppErrorCode.INVALID_PARAMETER]: {
    status: 400,
    message: ({ message }) => message ?? 'Invalid parameter',
  },
  [AppErrorCode.INVALID_BODY]: {
    status: 422,
    message: 'Request body must be an object',
  },
  [AppErrorCode.INVALID_SLUG]: {
    status: 422,
    message: 'slug must be a string',
  },
  [AppErrorCode.INVALID_NAME]: {
    status: 422,
    message: 'name must be a string',
  },
  [AppErrorCode.INVALID_REFERENCE]: {
    status: 422,
    message: 'reference must be a string',
  },
  [AppErrorCode.INVALID_ORDER_VALUE]: {
    status: 422,
    message: 'order value must be unique',
  },
  [AppErrorCode.INVALID_SEARCH_TYPE]: {
    status: 400,
    message: ({ type }) => `Invalid search type: ${type}`,
    details: ({ type }) => ({ type }),
  },
  [AppErrorCode.INVALID_ROOM_NAME]: {
    status: 400,
    message: 'Invalid room name',
  },
  [AppErrorCode.INVALID_SUBSCRIBE_TYPE]: {
    status: 400,
    message: 'Invalid subscribe type',
  },
  [AppErrorCode.INVALID_VIEW]: {
    status: 400,
    message: ({ view, available }) =>
      `Invalid view "${view}"; available: ${available.join(', ')}`,
    details: ({ view, available }) => ({ view, available }),
  },
  [AppErrorCode.SLUG_NOT_AVAILABLE]: {
    status: 400,
    message: 'slug is not available',
  },
  [AppErrorCode.VALIDATION_FAILED]: {
    status: 400,
    message: 'Validation failed',
    details: (p) => (p?.issues ? { issues: p.issues } : undefined),
  },

  // ack
  [AppErrorCode.ACK_INVALID_PAYLOAD]: {
    status: 400,
    message: (p) => p?.message ?? 'Invalid ack payload',
  },

  // ai
  [AppErrorCode.AI_CONTENT_MISSING]: {
    status: 400,
    message: ({ message }) => message,
  },
  [AppErrorCode.AI_INVALID_PARAMETER]: {
    status: 400,
    message: ({ message }) => message,
  },
  [AppErrorCode.AI_INVALID_QUERY_TYPE]: {
    status: 400,
    message: 'Invalid query type',
  },
  [AppErrorCode.AI_NOT_ENABLED]: {
    status: 400,
    message: (p) => p?.message ?? 'AI feature is not enabled',
  },
  [AppErrorCode.AI_KEY_EXPIRED]: {
    status: 400,
    message: 'AI key has expired, please contact the administrator',
  },
  [AppErrorCode.AI_PROCESSING]: {
    status: 400,
    message: 'AI is processing this request, please try again later',
  },
  [AppErrorCode.AI_PROVIDER_DISABLED]: {
    status: 400,
    message: (p) =>
      p?.providerId
        ? `Provider ${p.providerId} is not enabled`
        : 'No enabled AI provider configured',
    details: (p) => (p?.providerId ? { providerId: p.providerId } : undefined),
  },
  [AppErrorCode.AI_PROVIDER_NOT_FOUND]: {
    status: 404,
    message: (p) =>
      p?.providerId
        ? `Provider ${p.providerId} not found`
        : 'Provider not found',
    details: (p) => (p?.providerId ? { providerId: p.providerId } : undefined),
  },
  [AppErrorCode.AI_REVIEW_NOT_ENABLED]: {
    status: 400,
    message: 'AI review is not enabled',
  },
  [AppErrorCode.AI_RESULT_PARSING_ERROR]: {
    status: 500,
    message: (p) => p?.message ?? 'Failed to parse AI result',
  },
  [AppErrorCode.AI_SERVICE_ERROR]: {
    status: 500,
    message: (p) => p?.message ?? 'AI service error',
  },
  [AppErrorCode.AI_TASK_NOT_FOUND]: {
    status: 404,
    message: 'AI task not found',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },
  [AppErrorCode.AI_TASK_ALREADY_COMPLETED]: {
    status: 400,
    message: 'AI task is already completed and cannot be cancelled',
  },
  [AppErrorCode.AI_TASK_CANNOT_RETRY]: {
    status: 400,
    message: (p) => p?.reason ?? 'AI task cannot be retried',
  },
  [AppErrorCode.AI_TRANSLATION_NOT_FOUND]: {
    status: 404,
    message: 'Translation not found',
  },

  // auth
  [AppErrorCode.AUTH_DEVICE_FLOW_PENDING]: {
    status: 202,
    message: 'Device flow pending',
  },
  [AppErrorCode.AUTH_INVALID_CREDENTIALS]: {
    status: 401,
    message: 'Invalid credentials',
  },
  [AppErrorCode.AUTH_NOT_LOGGED_IN]: { status: 401, message: 'Not logged in' },
  [AppErrorCode.AUTH_SESSION_EXPIRED]: {
    status: 401,
    message: 'Session expired',
  },
  [AppErrorCode.AUTH_TOKEN_NOT_FOUND]: {
    status: 404,
    message: 'Token not found',
  },
  [AppErrorCode.AUTH_CHALLENGE_MISSING]: {
    status: 400,
    message: 'Challenge not found',
  },
  [AppErrorCode.AUTH_CHALLENGE_EXPIRED]: {
    status: 400,
    message: 'Challenge has expired',
  },
  [AppErrorCode.AUTH_REGISTRATION_MISSING]: {
    status: 400,
    message: 'Registration record not found',
  },
  [AppErrorCode.AUTH_USERNAME_INCORRECT]: {
    status: 403,
    message: 'Incorrect username',
  },
  [AppErrorCode.AUTH_PASSWORD_INCORRECT]: {
    status: 403,
    message: 'Incorrect password',
  },
  [AppErrorCode.AUTH_SESSION_NOT_FOUND]: {
    status: 400,
    message: 'Session not found',
  },
  [AppErrorCode.AUTH_USER_ID_NOT_FOUND]: {
    status: 400,
    message: 'User id not found',
  },
  [AppErrorCode.AUTH_FAILED]: {
    status: 400,
    message: (p) =>
      p?.message
        ? `Authentication failed: ${p.message}`
        : 'Authentication failed',
  },
  [AppErrorCode.AUTH_TOKEN_INVALID]: { status: 401, message: 'Invalid token' },
  [AppErrorCode.PASSWORD_LOGIN_DISABLED]: {
    status: 400,
    message: 'Password login is disabled',
  },
  [AppErrorCode.PASSWORD_SAME_AS_OLD]: {
    status: 422,
    message: 'New password must be different from the old one',
  },

  // category
  [AppErrorCode.CATEGORY_NOT_FOUND]: {
    status: 404,
    message: 'Category not found',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },
  [AppErrorCode.CATEGORY_HAS_POSTS]: {
    status: 400,
    message: 'Category still has posts, cannot delete',
  },

  // comment
  [AppErrorCode.COMMENT_DISABLED]: {
    status: 403,
    message: 'Comments are globally disabled',
  },
  [AppErrorCode.COMMENT_FORBIDDEN]: {
    status: 403,
    message: 'Comments are forbidden by the owner',
  },
  [AppErrorCode.COMMENT_NOT_FOUND]: {
    status: 404,
    message: 'Comment not found',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },
  [AppErrorCode.COMMENT_TOO_DEEP]: {
    status: 400,
    message: 'Comment nesting is too deep',
  },
  [AppErrorCode.COMMENT_POST_NOT_EXISTS]: {
    status: 400,
    message: 'Commented post does not exist',
  },
  [AppErrorCode.COMMENT_IMAGE_CAP_EXCEEDED]: {
    status: 422,
    message: 'Comment image count exceeds the limit',
  },
  [AppErrorCode.COMMENT_UPLOAD_DISABLED]: {
    status: 503,
    message: 'Comment image upload is disabled',
  },
  [AppErrorCode.COMMENT_UPLOAD_FILE_TOO_LARGE]: {
    status: 413,
    message: 'Image size exceeds the limit',
  },
  [AppErrorCode.COMMENT_UPLOAD_INVALID_MIME]: {
    status: 415,
    message: 'Unsupported image format',
  },
  [AppErrorCode.COMMENT_UPLOAD_FILE_NOT_OWNED]: {
    status: 403,
    message: 'Cannot reference an image uploaded by someone else',
  },
  [AppErrorCode.COMMENT_UPLOAD_FILE_ALREADY_BOUND]: {
    status: 409,
    message: 'Image already bound to another comment, please upload again',
  },
  [AppErrorCode.COMMENT_UPLOAD_RATE_LIMITED]: {
    status: 429,
    message: 'Upload too frequent, please try again later',
  },
  [AppErrorCode.COMMENT_UPLOAD_QUOTA_EXCEEDED]: {
    status: 429,
    message: 'Image storage quota exceeded',
  },
  [AppErrorCode.COMMENT_UPLOAD_ACCOUNT_TOO_NEW]: {
    status: 403,
    message: 'Account is too new to upload images',
  },
  [AppErrorCode.COMMENT_UPLOAD_INSUFFICIENT_COMMENTS]: {
    status: 403,
    message: 'More comments required before uploading is allowed',
  },

  // config
  [AppErrorCode.CONFIG_NOT_FOUND]: {
    status: 404,
    message: 'Config not found',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },
  [AppErrorCode.CONFIG_VALIDATION_FAILED]: {
    status: 422,
    message: (p) => p?.message ?? 'Config validation failed',
  },

  // cron
  [AppErrorCode.CRON_NOT_FOUND]: {
    status: 404,
    message: withExtra('Cron task not found'),
  },
  [AppErrorCode.INVALID_CRON_METHOD]: {
    status: 400,
    message: 'Invalid cron method',
  },
  [AppErrorCode.FUNCTION_NOT_FOUND]: {
    status: 404,
    message: (p) =>
      p?.path ? `Function not found: ${p.path}` : 'Function not found',
    details: (p) => (p?.path ? { path: p.path } : undefined),
  },

  // draft
  [AppErrorCode.DRAFT_NOT_FOUND]: {
    status: 404,
    message: 'Draft not found',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },
  [AppErrorCode.DRAFT_HISTORY_NOT_FOUND]: {
    status: 404,
    message: 'Draft history not found',
  },

  // document / helper
  [AppErrorCode.DOCUMENT_NOT_FOUND]: {
    status: 404,
    message: 'Document not found',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },
  [AppErrorCode.HELPER_DOCUMENT_NOT_FOUND]: {
    status: 404,
    message: 'Document not found',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },

  // email
  [AppErrorCode.EMAIL_TEMPLATE_NOT_FOUND]: {
    status: 400,
    message: 'Email template not found',
  },

  // enrichment
  [AppErrorCode.ENRICHMENT_BROWSER_MODE_REQUIRED]: {
    status: 409,
    message: 'Browser mode required for enrichment',
  },
  [AppErrorCode.ENRICHMENT_CAPTURE_FAILED]: {
    status: 500,
    message: 'Enrichment capture failed',
  },
  [AppErrorCode.ENRICHMENT_NOT_FOUND]: {
    status: 404,
    message: 'Enrichment not found',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },
  [AppErrorCode.ENRICHMENT_SCREENSHOT_DISABLED]: {
    status: 409,
    message: 'Enrichment screenshot is disabled',
  },

  // file
  [AppErrorCode.FILE_NOT_FOUND]: {
    status: 404,
    message: (p) => {
      if (p?.extra) return `File not found: ${p.extra}`
      if (p?.name) return `File not found: ${p.name}`
      return 'File not found'
    },
    details: (p) => (p?.name ? { name: p.name } : undefined),
  },
  [AppErrorCode.FILE_EXISTS]: { status: 400, message: 'File already exists' },
  [AppErrorCode.FILE_RENAME_FAILED]: {
    status: 400,
    message: 'File rename failed',
  },
  [AppErrorCode.FILE_TOO_LARGE]: {
    status: 413,
    message: 'File size exceeds the limit',
  },
  [AppErrorCode.FILE_STORAGE_NOT_CONFIGURED]: {
    status: 400,
    message: 'S3 image storage is not configured',
  },
  [AppErrorCode.FILE_UPLOAD_DISABLED]: {
    status: 503,
    message: 'File upload is disabled',
  },
  [AppErrorCode.FILE_UPLOAD_NOT_AUTHORIZED]: {
    status: 403,
    message: 'File upload is not authorized',
  },
  [AppErrorCode.MIME_ZIP_REQUIRED]: {
    status: 422,
    message: (p) =>
      p?.got
        ? `File must be a zip archive, got: ${p.got}`
        : 'File must be a zip archive',
    details: (p) => (p?.got ? { got: p.got } : undefined),
  },

  // init
  [AppErrorCode.INIT_ALREADY_COMPLETED]: {
    status: 400,
    message: 'Initialization already completed, please log in to configure',
  },
  [AppErrorCode.INIT_FORBIDDEN]: {
    status: 403,
    message: 'Default settings are hidden after registration',
  },
  [AppErrorCode.INIT_INVALID_BODY]: {
    status: 422,
    message: 'Request body must be an object',
  },
  [AppErrorCode.INIT_INVALID_MIME_TYPE]: {
    status: 415,
    message: (p) =>
      p?.got ? `Invalid mime type: ${p.got}` : 'Invalid mime type',
    details: (p) => (p?.got ? { got: p.got } : undefined),
  },

  // link
  [AppErrorCode.LINK_APPLY_DISABLED]: {
    status: 403,
    message: 'Link applications are currently closed',
  },
  [AppErrorCode.LINK_NOT_FOUND]: {
    status: 404,
    message: 'Link not found',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },
  [AppErrorCode.LINK_DISABLED]: {
    status: 400,
    message: 'Your link has been disabled, please contact the administrator',
  },
  [AppErrorCode.SUBPATH_LINK_DISABLED]: {
    status: 422,
    message: 'Subpath link applications are disabled by the administrator',
  },
  [AppErrorCode.DUPLICATE_LINK]: {
    status: 400,
    message: 'Please do not submit duplicate link applications',
  },
  [AppErrorCode.LINK_AVATAR_VALIDATION_FAILED]: {
    status: 400,
    message: (p) =>
      p?.reason
        ? `Avatar validation failed: ${p.reason}`
        : 'Avatar validation failed',
    details: (p) => (p?.reason ? { reason: p.reason } : undefined),
  },

  // meta preset
  [AppErrorCode.META_PRESET_KEY_EXISTS]: {
    status: 400,
    message: (p) =>
      p?.key
        ? `Preset key already exists: ${p.key}`
        : 'Preset key already exists',
    details: (p) => (p?.key ? { key: p.key } : undefined),
  },
  [AppErrorCode.META_PRESET_NOT_FOUND]: {
    status: 404,
    message: 'Preset not found',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },
  [AppErrorCode.BUILTIN_PRESET_CANNOT_DELETE]: {
    status: 403,
    message: 'Built-in presets cannot be deleted',
  },

  // note
  [AppErrorCode.NOTE_FORBIDDEN]: {
    status: 403,
    message: 'Please do not peek at private notes',
  },
  [AppErrorCode.NOTE_NOT_FOUND]: {
    status: 404,
    message: 'Note not found',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },
  [AppErrorCode.NOTE_PASSWORD_REQUIRED]: {
    status: 403,
    message: 'Note password required',
  },

  // owner / reader / user
  [AppErrorCode.OWNER_NOT_FOUND]: { status: 404, message: 'Owner not found' },
  [AppErrorCode.READER_NOT_FOUND]: {
    status: 404,
    message: 'Reader not found',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },
  [AppErrorCode.USER_NOT_EXISTS]: {
    status: 400,
    message: 'No owner exists yet',
  },
  [AppErrorCode.USER_ALREADY_EXISTS]: {
    status: 400,
    message: 'An owner already exists',
  },

  // page
  [AppErrorCode.PAGE_NOT_FOUND]: {
    status: 404,
    message: 'Page not found',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },

  // project
  [AppErrorCode.PROJECT_NOT_FOUND]: {
    status: 404,
    message: 'Project not found',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },
  [AppErrorCode.PROJECT_NAME_TAKEN]: {
    status: 409,
    message: (p) =>
      p?.name
        ? `A project with the name "${p.name}" already exists`
        : 'A project with this name already exists',
    details: (p) => (p?.name ? { name: p.name } : undefined),
  },

  // post
  [AppErrorCode.POST_NOT_FOUND]: {
    status: 404,
    message: 'Post not found',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },
  [AppErrorCode.POST_UNPUBLISHED]: {
    status: 404,
    message: 'Post is not published',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },
  [AppErrorCode.POST_HIDDEN_OR_ENCRYPTED]: {
    status: 403,
    message: 'Post is hidden or encrypted',
  },
  [AppErrorCode.POST_RELATED_NOT_EXISTS]: {
    status: 400,
    message: 'Related post does not exist',
  },
  [AppErrorCode.POST_SELF_RELATION]: {
    status: 400,
    message: 'Post cannot relate to itself',
  },

  // recently
  [AppErrorCode.RECENTLY_NOT_FOUND]: {
    status: 404,
    message: 'Recently entry not found',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },

  // backup
  [AppErrorCode.BACKUP_NOT_ENABLED]: {
    status: 400,
    message: 'Backup is not enabled in settings',
  },

  // serverless
  [AppErrorCode.SERVERLESS_ERROR]: {
    status: 500,
    message: (p) => p?.message ?? 'Function execution failed',
  },
  [AppErrorCode.SERVERLESS_NO_PERMISSION]: {
    status: 403,
    message: 'No permission to run this function',
  },

  // snippet
  [AppErrorCode.SNIPPET_NOT_FOUND]: {
    status: 404,
    message: 'Snippet not found',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },
  [AppErrorCode.SNIPPET_EXISTS]: {
    status: 400,
    message: 'Snippet already exists',
  },
  [AppErrorCode.SNIPPET_PRIVATE]: {
    status: 403,
    message: 'Snippet is private',
  },
  [AppErrorCode.SNIPPET_INVALID_JSON]: {
    status: 400,
    message: 'Content is not valid JSON',
  },
  [AppErrorCode.SNIPPET_INVALID_JSON5]: {
    status: 400,
    message: 'Content is not valid JSON5',
  },
  [AppErrorCode.SNIPPET_INVALID_YAML]: {
    status: 400,
    message: 'Content is not valid YAML',
  },
  [AppErrorCode.SNIPPET_INVALID_FUNCTION]: {
    status: 400,
    message: withExtra('Invalid serverless function'),
  },

  // subscribe
  [AppErrorCode.SUBSCRIBE_NOT_ENABLED]: {
    status: 400,
    message: 'Subscription is not enabled',
  },
  [AppErrorCode.SUBSCRIBE_TYPE_EMPTY]: {
    status: 400,
    message: 'Subscribe type cannot be empty',
  },
  [AppErrorCode.ALREADY_SUPPORTED]: {
    status: 400,
    message: 'You already supported this',
  },

  // topic
  [AppErrorCode.TOPIC_NOT_FOUND]: {
    status: 404,
    message: 'Topic not found',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },

  // webhook
  [AppErrorCode.WEBHOOK_EVENT_NOT_FOUND]: {
    status: 404,
    message: 'Webhook event not found',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },
  [AppErrorCode.WEBHOOK_NOT_FOUND]: {
    status: 404,
    message: 'Webhook not found',
    details: (p) => (p?.id ? { id: p.id } : undefined),
  },

  // bing
  [AppErrorCode.BING_API_FAILED]: {
    status: 503,
    message: 'Bing API request failed',
  },
  [AppErrorCode.BING_KEY_INVALID]: {
    status: 401,
    message: 'Bing API key invalid',
  },
  [AppErrorCode.BING_DOMAIN_INVALID]: {
    status: 400,
    message: 'Bing API domain invalid',
  },
} satisfies {
  [C in AppErrorCode]: AppErrorDefinition<C>
}
