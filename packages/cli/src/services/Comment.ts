import { Context, Effect, Layer } from 'effect'

import type { ApiError } from './Api'
import { Api } from './Api'

// ---------------------------------------------------------------------------
// Public models
// ---------------------------------------------------------------------------

export type CommentStateName = 'unread' | 'read' | 'junk'

export const COMMENT_STATE_NAMES: readonly CommentStateName[] = [
  'unread',
  'read',
  'junk',
]

const stateToCode: Record<CommentStateName, number> = {
  unread: 0,
  read: 1,
  junk: 2,
}

const codeToState: Record<number, CommentStateName> = {
  0: 'unread',
  1: 'read',
  2: 'junk',
}

export const stateNameToCode = (s: CommentStateName): number => stateToCode[s]
export const stateCodeToName = (n: number): CommentStateName | undefined =>
  codeToState[n]

export interface CommentListOptions {
  readonly page?: number
  readonly size?: number
  readonly state?: CommentStateName
  readonly all?: boolean
}

export interface CommentListResponse {
  readonly data: ReadonlyArray<unknown>
  readonly pagination?: Record<string, unknown>
  readonly readers?: Record<string, unknown>
}

export interface CommentBatchFilter {
  readonly currentState?: CommentStateName
}

export interface CommentService {
  readonly list: (
    opts: CommentListOptions,
  ) => Effect.Effect<CommentListResponse, ApiError>

  readonly get: (id: string) => Effect.Effect<unknown, ApiError>

  /** Mark one or more comments as read (state=1). Routes through batch endpoint. */
  readonly approve: (
    ids: ReadonlyArray<string>,
  ) => Effect.Effect<void, ApiError>

  /** Mark one or more comments as junk (state=2). Routes through batch endpoint. */
  readonly reject: (ids: ReadonlyArray<string>) => Effect.Effect<void, ApiError>

  /** Soft-delete one or more comments. Routes through batch endpoint. */
  readonly delete: (ids: ReadonlyArray<string>) => Effect.Effect<void, ApiError>

  /** Approve all comments matching `filter` (optional currentState). */
  readonly approveAll: (
    filter: CommentBatchFilter,
  ) => Effect.Effect<void, ApiError>

  /** Reject all comments matching `filter` (optional currentState). */
  readonly rejectAll: (
    filter: CommentBatchFilter,
  ) => Effect.Effect<void, ApiError>

  /** Soft-delete all comments matching `filter` (optional currentState). */
  readonly deleteAll: (
    filter: CommentBatchFilter,
  ) => Effect.Effect<void, ApiError>
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const mergeListResponses = (
  responses: ReadonlyArray<CommentListResponse>,
): CommentListResponse => {
  const data: unknown[] = []
  const readers: Record<string, unknown> = {}
  let total = 0
  for (const r of responses) {
    if (Array.isArray(r.data)) data.push(...r.data)
    if (r.readers) Object.assign(readers, r.readers)
    const t =
      r.pagination && typeof r.pagination.total === 'number'
        ? (r.pagination.total as number)
        : 0
    total += t
  }
  return {
    data,
    pagination: { total, size: data.length, page: 1, totalPages: 1 },
    readers,
  }
}

const makeService = (api: Context.Tag.Service<Api>): CommentService => {
  const requestList = (
    state: CommentStateName,
    page?: number,
    size?: number,
  ): Effect.Effect<CommentListResponse, ApiError> =>
    api.request<CommentListResponse>('/comments', {
      query: { page, size, state: stateNameToCode(state) },
    })

  const patchBatchState = (
    body: Record<string, unknown>,
  ): Effect.Effect<void, ApiError> =>
    Effect.asVoid(
      api.request('/comments/batch/state', {
        method: 'PATCH',
        body,
      }),
    )

  const deleteBatch = (
    body: Record<string, unknown>,
  ): Effect.Effect<void, ApiError> =>
    Effect.asVoid(
      api.request('/comments/batch', {
        method: 'DELETE',
        body,
      }),
    )

  return {
    list: (opts) => {
      if (opts.all) {
        return Effect.all(
          COMMENT_STATE_NAMES.map((s) => requestList(s, opts.page, opts.size)),
          { concurrency: 3 },
        ).pipe(Effect.map(mergeListResponses))
      }
      return requestList(opts.state ?? 'unread', opts.page, opts.size)
    },

    get: (id) => api.request(`/comments/${id}`),

    approve: (ids) =>
      patchBatchState({ ids: [...ids], state: stateToCode.read }),
    reject: (ids) =>
      patchBatchState({ ids: [...ids], state: stateToCode.junk }),
    delete: (ids) => deleteBatch({ ids: [...ids] }),

    approveAll: (filter) =>
      patchBatchState({
        all: true,
        state: stateToCode.read,
        currentState:
          filter.currentState !== undefined
            ? stateNameToCode(filter.currentState)
            : undefined,
      }),
    rejectAll: (filter) =>
      patchBatchState({
        all: true,
        state: stateToCode.junk,
        currentState:
          filter.currentState !== undefined
            ? stateNameToCode(filter.currentState)
            : undefined,
      }),
    deleteAll: (filter) =>
      deleteBatch({
        all: true,
        state:
          filter.currentState !== undefined
            ? stateNameToCode(filter.currentState)
            : undefined,
      }),
  }
}

export class Comment extends Context.Tag('Comment')<
  Comment,
  CommentService
>() {
  static Default: Layer.Layer<Comment, never, Api> = Layer.effect(
    Comment,
    Effect.gen(function* () {
      const api = yield* Api
      return makeService(api)
    }),
  )
}
