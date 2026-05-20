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

export const APP_ERROR_DEFINITIONS = {
  [AppErrorCode.ACK_INVALID_PAYLOAD]: {
    status: 400,
    message: (payload) => payload?.message ?? 'Invalid ack payload',
  },
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
    message: (payload) => payload?.message ?? 'AI feature is not enabled',
  },
  [AppErrorCode.AI_PROVIDER_DISABLED]: {
    status: 400,
    message: (payload) =>
      payload?.providerId
        ? `Provider ${payload.providerId} is not enabled`
        : 'Provider is not enabled',
    details: (payload) =>
      payload?.providerId ? { providerId: payload.providerId } : undefined,
  },
  [AppErrorCode.AI_PROVIDER_NOT_FOUND]: {
    status: 404,
    message: (payload) =>
      payload?.providerId
        ? `Provider ${payload.providerId} not found`
        : 'Provider not found',
    details: (payload) =>
      payload?.providerId ? { providerId: payload.providerId } : undefined,
  },
  [AppErrorCode.AI_REVIEW_NOT_ENABLED]: {
    status: 400,
    message: 'AI review is not enabled',
  },
  [AppErrorCode.AI_SERVICE_ERROR]: {
    status: 500,
    message: (payload) => payload?.message ?? 'AI service error',
  },
  [AppErrorCode.AI_TASK_NOT_FOUND]: {
    status: 404,
    message: 'AI task not found',
    details: (payload) => (payload?.id ? { id: payload.id } : undefined),
  },
  [AppErrorCode.AUTH_DEVICE_FLOW_PENDING]: {
    status: 202,
    message: 'Device flow pending',
  },
  [AppErrorCode.AUTH_INVALID_CREDENTIALS]: {
    status: 401,
    message: 'Invalid credentials',
  },
  [AppErrorCode.AUTH_NOT_LOGGED_IN]: {
    status: 401,
    message: 'Not logged in',
  },
  [AppErrorCode.AUTH_SESSION_EXPIRED]: {
    status: 401,
    message: 'Session expired',
  },
  [AppErrorCode.AUTH_TOKEN_NOT_FOUND]: {
    status: 404,
    message: 'Token not found',
  },
  [AppErrorCode.CATEGORY_NOT_FOUND]: {
    status: 404,
    message: 'Category not found',
    details: (payload) => (payload?.id ? { id: payload.id } : undefined),
  },
  [AppErrorCode.COMMENT_DISABLED]: {
    status: 403,
    message: 'Comments are disabled',
  },
  [AppErrorCode.COMMENT_FORBIDDEN]: {
    status: 403,
    message: 'Commenting is not allowed here',
  },
  [AppErrorCode.COMMENT_NOT_FOUND]: {
    status: 404,
    message: 'Comment not found',
    details: (payload) => (payload?.id ? { id: payload.id } : undefined),
  },
  [AppErrorCode.DRAFT_NOT_FOUND]: {
    status: 404,
    message: 'Draft not found',
    details: (payload) => (payload?.id ? { id: payload.id } : undefined),
  },
  [AppErrorCode.ENRICHMENT_BROWSER_MODE_REQUIRED]: {
    status: 409,
    message: 'OpenGraph fetchMode must be `browser` to recapture',
  },
  [AppErrorCode.ENRICHMENT_CAPTURE_FAILED]: {
    status: 422,
    message: 'Screenshot was not produced by the refresh',
  },
  [AppErrorCode.ENRICHMENT_NOT_FOUND]: {
    status: 404,
    message: (payload) =>
      payload?.id ? `Enrichment ${payload.id} not found` : 'Enrichment not found',
    details: (payload) => (payload?.id ? { id: payload.id } : undefined),
  },
  [AppErrorCode.ENRICHMENT_SCREENSHOT_DISABLED]: {
    status: 409,
    message: 'openGraph.screenshot.enabled is false',
  },
  [AppErrorCode.FILE_NOT_FOUND]: {
    status: 404,
    message: 'File not found',
    details: (payload) => (payload?.name ? { name: payload.name } : undefined),
  },
  [AppErrorCode.FILE_STORAGE_NOT_CONFIGURED]: {
    status: 400,
    message: 'Image storage is not configured',
  },
  [AppErrorCode.FILE_UPLOAD_DISABLED]: {
    status: 403,
    message: 'Comment uploads are disabled',
  },
  [AppErrorCode.FILE_UPLOAD_NOT_AUTHORIZED]: {
    status: 401,
    message: 'Upload not authorized',
  },
  [AppErrorCode.HELPER_DOCUMENT_NOT_FOUND]: {
    status: 404,
    message: 'Document not found or cannot be redirected',
    details: (payload) => (payload?.id ? { id: payload.id } : undefined),
  },
  [AppErrorCode.INIT_ALREADY_COMPLETED]: {
    status: 400,
    message: 'Server is already initialized',
  },
  [AppErrorCode.INIT_FORBIDDEN]: {
    status: 403,
    message: 'Init is forbidden',
  },
  [AppErrorCode.INIT_INVALID_BODY]: {
    status: 400,
    message: 'Invalid request body',
  },
  [AppErrorCode.INIT_INVALID_MIME_TYPE]: {
    status: 400,
    message: 'Invalid MIME type - expected a zip file',
    details: (payload) => (payload?.got ? { got: payload.got } : undefined),
  },
  [AppErrorCode.INVALID_ORDER_VALUE]: {
    status: 400,
    message: 'Order values must be unique',
  },
  [AppErrorCode.INVALID_PARAMETER]: {
    status: 400,
    message: ({ message }) => message,
  },
  [AppErrorCode.INVALID_SEARCH_TYPE]: {
    status: 400,
    message: ({ type }) => `Invalid search type: ${type}`,
    details: ({ type }) => ({ type }),
  },
  [AppErrorCode.INVALID_VIEW]: {
    status: 400,
    message: ({ view }) => `Unknown view: ${view}`,
    details: ({ view, available }) => ({ view, available }),
  },
  [AppErrorCode.LINK_APPLY_DISABLED]: {
    status: 403,
    message: '主人目前不允许申请友链了！',
  },
  [AppErrorCode.META_PRESET_KEY_EXISTS]: {
    status: 400,
    message: 'A preset with this key already exists',
    details: (payload) => (payload?.key ? { key: payload.key } : undefined),
  },
  [AppErrorCode.META_PRESET_NOT_FOUND]: {
    status: 404,
    message: 'Meta preset not found',
    details: (payload) => (payload?.id ? { id: payload.id } : undefined),
  },
  [AppErrorCode.NOTE_FORBIDDEN]: {
    status: 403,
    message: 'Access to this note is forbidden',
  },
  [AppErrorCode.NOTE_NOT_FOUND]: {
    status: 404,
    message: 'Note not found',
    details: (payload) => (payload?.id ? { id: payload.id } : undefined),
  },
  [AppErrorCode.NOTE_PASSWORD_REQUIRED]: {
    status: 403,
    message: 'Note requires a password',
  },
  [AppErrorCode.OWNER_NOT_FOUND]: {
    status: 404,
    message: 'Owner not found',
  },
  [AppErrorCode.PAGE_NOT_FOUND]: {
    status: 404,
    message: 'Page not found',
    details: (payload) => (payload?.id ? { id: payload.id } : undefined),
  },
  [AppErrorCode.POST_NOT_FOUND]: {
    status: 404,
    message: 'Post not found',
    details: (payload) => (payload?.id ? { id: payload.id } : undefined),
  },
  [AppErrorCode.POST_UNPUBLISHED]: {
    status: 403,
    message: 'Post is not published',
    details: (payload) => (payload?.id ? { id: payload.id } : undefined),
  },
  [AppErrorCode.READER_NOT_FOUND]: {
    status: 404,
    message: 'Reader not found',
    details: (payload) => (payload?.id ? { id: payload.id } : undefined),
  },
  [AppErrorCode.RECENTLY_NOT_FOUND]: {
    status: 404,
    message: 'Recently entry not found',
    details: (payload) => (payload?.id ? { id: payload.id } : undefined),
  },
  [AppErrorCode.SUBSCRIBE_NOT_ENABLED]: {
    status: 403,
    message: 'Subscribe feature is not enabled',
  },
  [AppErrorCode.SUBSCRIBE_TYPE_EMPTY]: {
    status: 400,
    message: 'No valid subscription type provided',
  },
  [AppErrorCode.TOPIC_NOT_FOUND]: {
    status: 404,
    message: 'Topic not found',
    details: (payload) => (payload?.id ? { id: payload.id } : undefined),
  },
  [AppErrorCode.WEBHOOK_EVENT_NOT_FOUND]: {
    status: 404,
    message: 'Webhook event not found',
    details: (payload) => (payload?.id ? { id: payload.id } : undefined),
  },
  [AppErrorCode.WEBHOOK_NOT_FOUND]: {
    status: 404,
    message: 'Webhook not found',
    details: (payload) => (payload?.id ? { id: payload.id } : undefined),
  },
} satisfies {
  [C in AppErrorCode]: AppErrorDefinition<C>
}
