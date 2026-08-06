import { z } from 'zod'

import { AggregateViews } from '~/modules/aggregate/aggregate.views'
import {
  BatchCommentStateSchema,
  CommentAdminPagerSchema,
  CommentStatePatchSchema,
  CommentTabCountsQuerySchema,
  ReaderReplyCommentSchema,
} from '~/modules/comment/comment.schema'
import { CommentViews } from '~/modules/comment/comment.views'
import { ResolveQuerySchema } from '~/modules/enrichment/enrichment.schema'
import { EnrichmentViews } from '~/modules/enrichment/enrichment.views'
import { FileUploadSchema } from '~/modules/file/file.schema'
import { FileViews } from '~/modules/file/file.views'
import { NoteSchema } from '~/modules/note/note.schema'
import { NoteViews } from '~/modules/note/note.views'
import { RecentlySchema } from '~/modules/recently/recently.schema'
import { RecentlyViews } from '~/modules/recently/recently.views'
import { SayCreateSchema } from '~/modules/say/say.controller'
import { SayViews } from '~/modules/say/say.views'
import { EntityIdSchema } from '~/shared/dto/id.dto'
import { OffsetSchema } from '~/shared/dto/pager.dto'

import type { OpenApiRoute } from './openapi.types'

/**
 * better-auth's device-authorization plugin speaks RFC 8628 verbatim and is
 * mounted as a Nest middleware, so neither the case pipeline nor the response
 * envelope applies. These schemas therefore carry literal wire names.
 */
const DeviceCodeRequestSchema = z.object({
  client_id: z.string(),
  scope: z.string().optional(),
})

const DeviceCodeResponseSchema = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_uri: z.string(),
  verification_uri_complete: z.string().optional(),
  expires_in: z.number().int(),
  interval: z.number().int(),
})

const DeviceTokenRequestSchema = z.object({
  grant_type: z.literal('urn:ietf:params:oauth:grant-type:device_code'),
  device_code: z.string(),
  client_id: z.string(),
})

const DeviceTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number().int(),
  scope: z.string().optional(),
})

const DeviceErrorSchema = z.object({
  error: z.enum([
    'authorization_pending',
    'slow_down',
    'expired_token',
    'access_denied',
    'invalid_client',
    'invalid_request',
    'server_error',
  ]),
  error_description: z.string().optional(),
})

const HealthResponseSchema = z.object({ ok: z.boolean() })

export const routeManifest: readonly OpenApiRoute[] = [
  {
    operationId: 'getHealth',
    method: 'get',
    path: '/health',
    tag: 'health',
    summary: 'Probe reachability and API version of a self-hosted instance',
    auth: false,
    response: { name: 'HealthStatus', schema: HealthResponseSchema },
  },

  {
    operationId: 'requestDeviceCode',
    method: 'post',
    path: '/auth/device/code',
    tag: 'auth',
    summary: 'Start the device authorization pairing flow',
    auth: false,
    envelope: false,
    body: { name: 'DeviceCodeRequest', schema: DeviceCodeRequestSchema },
    response: { name: 'DeviceCodeResponse', schema: DeviceCodeResponseSchema },
    errorResponse: { name: 'DeviceError', schema: DeviceErrorSchema },
  },
  {
    operationId: 'pollDeviceToken',
    method: 'post',
    path: '/auth/device/token',
    tag: 'auth',
    summary: 'Exchange an approved device code for a session token',
    auth: false,
    envelope: false,
    body: { name: 'DeviceTokenRequest', schema: DeviceTokenRequestSchema },
    response: {
      name: 'DeviceTokenResponse',
      schema: DeviceTokenResponseSchema,
    },
    errorResponse: { name: 'DeviceError', schema: DeviceErrorSchema },
  },

  {
    operationId: 'getDesk',
    method: 'get',
    path: '/aggregate/desk',
    tag: 'dashboard',
    summary: 'Dashboard desk payload',
    auth: true,
    response: { name: 'Desk', schema: AggregateViews.desk },
  },
  {
    operationId: 'getStat',
    method: 'get',
    path: '/aggregate/stat',
    tag: 'dashboard',
    summary: 'Aggregate counters',
    auth: true,
    response: { name: 'Stat', schema: AggregateViews.stat },
  },

  {
    operationId: 'listComments',
    method: 'get',
    path: '/comments',
    tag: 'comments',
    summary: 'Paginated admin comment list',
    auth: true,
    query: CommentAdminPagerSchema,
    response: { name: 'CommentRow', schema: CommentViews.row },
    responseIsArray: true,
  },
  {
    operationId: 'getCommentTabCounts',
    method: 'get',
    path: '/comments/tab-counts',
    tag: 'comments',
    summary: 'Per-tab comment counts',
    auth: true,
    query: CommentTabCountsQuerySchema,
    response: { name: 'CommentTabCounts', schema: CommentViews.tabCounts },
  },
  {
    operationId: 'getComment',
    method: 'get',
    path: '/comments/:id',
    tag: 'comments',
    summary: 'Single comment with its thread context',
    auth: true,
    params: EntityIdSchema,
    response: { name: 'CommentDetail', schema: CommentViews.detail },
  },
  {
    operationId: 'patchCommentState',
    method: 'patch',
    path: '/comments/:id',
    tag: 'comments',
    summary: 'Change moderation state or pin flag',
    auth: true,
    params: EntityIdSchema,
    body: { name: 'CommentStatePatch', schema: CommentStatePatchSchema },
  },
  {
    operationId: 'deleteComment',
    method: 'delete',
    path: '/comments/:id',
    tag: 'comments',
    summary: 'Soft-delete a comment',
    auth: true,
    params: EntityIdSchema,
  },
  {
    operationId: 'replyAsOwner',
    successStatus: 201,
    method: 'post',
    path: '/comments/owner-reply/:id',
    tag: 'comments',
    summary: 'Reply to a comment as the site owner',
    auth: true,
    params: EntityIdSchema,
    body: { name: 'OwnerReply', schema: ReaderReplyCommentSchema },
    response: { name: 'CommentDetail', schema: CommentViews.detail },
  },
  {
    operationId: 'batchPatchCommentState',
    method: 'patch',
    path: '/comments/batch/state',
    tag: 'comments',
    summary: 'Change moderation state for many comments at once',
    auth: true,
    body: { name: 'BatchCommentState', schema: BatchCommentStateSchema },
  },

  {
    operationId: 'createNote',
    successStatus: 201,
    method: 'post',
    path: '/notes',
    tag: 'compose',
    summary: 'Publish a note',
    auth: true,
    body: { name: 'NoteCreate', schema: NoteSchema },
    response: { name: 'NoteDetail', schema: NoteViews.detail },
  },
  {
    operationId: 'createSay',
    successStatus: 201,
    method: 'post',
    path: '/says',
    tag: 'compose',
    summary: 'Publish a say',
    auth: true,
    body: { name: 'SayCreate', schema: SayCreateSchema },
    response: { name: 'Say', schema: SayViews.detail },
  },

  {
    operationId: 'listRecently',
    method: 'get',
    path: '/recently',
    tag: 'recently',
    summary: 'Cursor-paged recently entries with hydrated media enrichments',
    auth: false,
    query: OffsetSchema,
    response: { name: 'RecentlyCard', schema: RecentlyViews.card },
    responseIsArray: true,
  },
  {
    operationId: 'createRecently',
    successStatus: 201,
    method: 'post',
    path: '/recently',
    tag: 'recently',
    summary: 'Post a recently entry',
    auth: true,
    body: { name: 'RecentlyCreate', schema: RecentlySchema },
    response: { name: 'RecentlyDetail', schema: RecentlyViews.detail },
  },
  {
    operationId: 'updateRecently',
    method: 'put',
    path: '/recently/:id',
    tag: 'recently',
    summary: 'Rewrite a recently entry',
    auth: true,
    params: EntityIdSchema,
    body: { name: 'RecentlyCreate', schema: RecentlySchema },
    response: { name: 'RecentlyDetail', schema: RecentlyViews.detail },
  },
  {
    operationId: 'deleteRecently',
    method: 'delete',
    path: '/recently/:id',
    tag: 'recently',
    summary: 'Delete a recently entry',
    auth: true,
    params: EntityIdSchema,
  },

  {
    operationId: 'resolveEnrichment',
    method: 'get',
    path: '/enrichment/resolve',
    tag: 'recently',
    summary: 'Resolve a URL into a media card before posting it',
    auth: false,
    query: ResolveQuerySchema,
    response: { name: 'EnrichmentResult', schema: EnrichmentViews.result },
  },

  {
    operationId: 'uploadObject',
    successStatus: 201,
    method: 'post',
    path: '/objects/upload',
    tag: 'files',
    summary: 'Upload a file',
    auth: true,
    query: FileUploadSchema,
    bodyContentType: 'multipart/form-data',
    body: {
      name: 'UploadBody',
      json: {
        type: 'object',
        required: ['file'],
        properties: {
          file: {
            type: 'string',
            contentMediaType: 'application/octet-stream',
          },
        },
      },
    },
    response: { name: 'UploadResult', schema: FileViews.uploadResult },
  },
] as const
