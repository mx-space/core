import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { openAdminEdit } from '../../domain/admin-link'
import { Generic } from '../../domain/errors'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { extractId, openFlag, silentFlag } from '../post/_flags'
import {
  camelizeDeep,
  type DraftRow,
  normalizeDraftRow,
  parseTypeSpecificData,
  REF_TYPE_TO_RESOURCE,
  unwrapData,
} from './_shared'

const id = Args.text({ name: 'id' })

export const publish = Command.make(
  'publish',
  { id, open: openFlag, silent: silentFlag },
  ({ id, open, silent }) =>
    Effect.gen(function* () {
      const api = yield* Api
      const renderer = yield* Renderer
      const draft = normalizeDraftRow(
        unwrapData<DraftRow>(
          yield* api.request(`/drafts/${encodeURIComponent(id)}`),
        ),
      )
      if (!draft?.id || !draft.refType) {
        return yield* Effect.fail(
          new Generic({ message: `draft not found: ${id}` }),
        )
      }
      const resource = REF_TYPE_TO_RESOURCE[draft.refType]
      if (!resource) {
        return yield* Effect.fail(
          new Generic({
            message: `unsupported draft refType: ${draft.refType}`,
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
      if (draft.meta !== undefined && draft.meta !== null)
        body.meta = camelizeDeep(draft.meta)
      // Sending draftId makes the server link the draft to the created
      // resource and mark its current version as published; the draft is
      // retained with its history.
      body.draftId = draft.id

      let res: unknown
      if (draft.refId) {
        // Draft is attached to an existing resource: apply changes and make
        // sure the result is live.
        if (draft.refType !== 'page') body.isPublished = true
        res = yield* api.request(`/${resource}/${draft.refId}`, {
          method: 'PATCH',
          body,
        })
      } else {
        if (draft.refType !== 'page') body.isPublished = true
        res = yield* api.request(`/${resource}`, {
          method: 'POST',
          body,
        })
      }

      const publishedId = extractId(res) ?? draft.refId
      yield* renderer.emitSuccess(silent ? { ok: true, id: publishedId } : res)
      if (open && publishedId && draft.refType !== 'page') {
        yield* openAdminEdit(resource as 'posts' | 'notes', publishedId)
      }
    }),
).pipe(
  Command.withDescription(
    'publish a draft: creates the post/note/page (or applies to the linked one) and marks it live',
  ),
)
