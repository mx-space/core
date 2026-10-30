import { Effect } from 'effect'

import { AuthDenied, ServerError } from '../../../domain/errors'
import { Api, type ApiError } from '../../../services/Api'
import type { CategoryRef } from './document'
import {
  gatewayUrlFor,
  type IncomingPresence,
  openRoom,
  type Room,
  RoomAuthError,
} from './room'

export interface DraftRoom {
  readonly room: Room
  readonly categories: readonly CategoryRef[]
  readonly url: string
  readonly headers: Record<string, string>
}

const asCategories = (res: unknown): CategoryRef[] => {
  const data =
    res && typeof res === 'object' && 'data' in res
      ? (res as { data: unknown }).data
      : res
  return Array.isArray(data)
    ? data.map((c: { id: unknown; name?: unknown; slug: unknown }) => ({
        id: String(c.id),
        name: typeof c.name === 'string' ? c.name : undefined,
        slug: String(c.slug),
      }))
    : []
}

interface UrlOptions {
  readonly data?: { readonly ws_url?: string }
  readonly ws_url?: string
}

export const withDraftRoom = <A, E, R>(
  draftId: string,
  method: 'GET' | 'POST',
  use: (draft: DraftRoom) => Effect.Effect<A, E, R>,
): Effect.Effect<A, E | ApiError | AuthDenied | ServerError, R | Api> =>
  Effect.gen(function* () {
    const api = yield* Api
    const { apiBase, headers } = yield* api.connection(method)
    const categories = asCategories(yield* api.request('/categories'))
    const override = process.env.MXS_GATEWAY_URL
    const advertised = override
      ? undefined
      : yield* api.request<UrlOptions>('/options/url').pipe(
          Effect.map((res) => res.data?.ws_url ?? res.ws_url),
          Effect.catch(() => Effect.succeed(undefined)),
        )
    const url = override
      ? gatewayUrlFor(override)
      : gatewayUrlFor(apiBase, advertised)
    const room = yield* Effect.tryPromise({
      try: () => openRoom({ url, headers, draftId }),
      catch: (error) =>
        error instanceof RoomAuthError
          ? new AuthDenied({ message: error.message })
          : new ServerError({ message: (error as Error).message }),
    })
    return yield* use({ room, categories, url, headers }).pipe(
      Effect.ensuring(Effect.sync(() => room.close())),
    )
  })

export interface HumanSelection {
  readonly at: number
  readonly ids: readonly string[]
  readonly user: string
}

export function latestSelection(
  presences: readonly IncomingPresence[],
): HumanSelection | null {
  let best: HumanSelection | null = null
  for (const presence of presences) {
    if (presence.entry) continue
    const selection = presence.caret?.selection
    if (!selection || typeof selection.at !== 'number') continue
    const ids = Array.isArray(selection.blocks)
      ? selection.blocks
          .map((b: { id?: unknown }) => b?.id)
          .filter((id: unknown): id is string => typeof id === 'string')
      : []
    if (!ids.length) continue
    if (!best || selection.at > best.at) {
      best = { at: selection.at, ids, user: presence.user?.name ?? '' }
    }
  }
  return best
}
