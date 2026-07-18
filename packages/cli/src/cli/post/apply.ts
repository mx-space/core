import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { Generic } from '../../domain/errors'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import {
  asRecord,
  first,
  unwrapDocument,
} from '../../services/Renderer/content'
import { Resolver } from '../../services/Resolver'
import { camelizeDeep } from '../draft/_shared'

const slugOrId = Args.text({ name: 'slugOrId' })

const parseTypeSpecificData = (raw: unknown): Record<string, unknown> => {
  if (!raw) return {}
  if (typeof raw === 'object' && !Array.isArray(raw))
    return raw as Record<string, unknown>
  if (typeof raw !== 'string') return {}
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? parsed
      : {}
  } catch {
    return {}
  }
}

export const apply = Command.make('apply', { slugOrId }, ({ slugOrId }) =>
  Effect.gen(function* () {
    const resolver = yield* Resolver
    const api = yield* Api
    const renderer = yield* Renderer
    const id = yield* resolver.resolvePostId(slugOrId)

    // The server returns null when there is no draft for this post or when
    // the draft has no pending changes (publishedVersion === version).
    const draft = asRecord(
      unwrapDocument(yield* api.request(`/drafts/by-ref/post/${id}`)),
    )
    const draftId = first(draft, 'id')
    if (typeof draftId !== 'string' || !draftId) {
      return yield* Effect.fail(
        new Generic({
          message: `no staged changes for post ${slugOrId}`,
          hint: 'stage changes first with `mxs post stage <slugOrId> --file <article.xml>`',
        }),
      )
    }

    const body: Record<string, unknown> = {
      ...parseTypeSpecificData(
        first(draft, 'type_specific_data', 'typeSpecificData'),
      ),
    }
    const title = first(draft, 'title')
    const text = first(draft, 'text')
    const content = first(draft, 'content')
    const contentFormat = first(draft, 'content_format', 'contentFormat')
    const meta = first(draft, 'meta')
    if (title !== undefined) body.title = title
    if (text !== undefined) body.text = text
    if (content !== undefined) body.content = content
    if (contentFormat !== undefined) body.contentFormat = contentFormat
    if (meta !== undefined) body.meta = camelizeDeep(meta)
    // Sending draftId makes the server mark the draft's current version as
    // published; the draft itself is retained (with its history).
    body.draftId = draftId

    const res = yield* api.request(`/posts/${id}`, {
      method: 'PATCH',
      body,
    })
    yield* renderer.emitSuccess(res)
  }),
).pipe(
  Command.withDescription(
    'apply the staged draft of a post to the live post (the confirm step after `post stage`)',
  ),
)
