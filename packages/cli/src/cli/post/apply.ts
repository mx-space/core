import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { Generic } from '../../domain/errors'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { Resolver } from '../../services/Resolver'

const slugOrId = Args.text({ name: 'slugOrId' })

interface StagedDraft {
  id?: string
  title?: string
  text?: string
  content?: string | null
  contentFormat?: string
  typeSpecificData?: Record<string, unknown> | string | null
}

const parseTypeSpecificData = (
  raw: StagedDraft['typeSpecificData'],
): Record<string, unknown> => {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
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
    const draft = (yield* api.request(`/drafts/by-ref/post/${id}`)) as
      | StagedDraft
      | null
      | undefined
    if (!draft || !draft.id) {
      return yield* Effect.fail(
        new Generic({
          message: `no staged changes for post ${slugOrId}`,
          hint: 'stage changes first with `mxs post stage <slugOrId> --file <article.xml>`',
        }),
      )
    }

    const body: Record<string, unknown> = {
      ...parseTypeSpecificData(draft.typeSpecificData),
    }
    if (draft.title !== undefined) body.title = draft.title
    if (draft.text !== undefined) body.text = draft.text
    if (draft.content !== undefined && draft.content !== null)
      body.content = draft.content
    if (draft.contentFormat !== undefined)
      body.contentFormat = draft.contentFormat
    // Sending draftId makes the server mark the draft's current version as
    // published; the draft itself is retained (with its history).
    body.draftId = draft.id

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
