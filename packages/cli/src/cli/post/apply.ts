import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { Generic } from '../../domain/errors'
import { Api } from '../../services/Api'
import { Renderer } from '../../services/Renderer'
import { Resolver } from '../../services/Resolver'
import { normalizeVersionContext, publishSavedDraft } from '../draft/_shared'

const slugOrId = Args.text({ name: 'slugOrId' })

export const apply = Command.make('apply', { slugOrId }, ({ slugOrId }) =>
  Effect.gen(function* () {
    const resolver = yield* Resolver
    const api = yield* Api
    const renderer = yield* Renderer
    const id = yield* resolver.resolvePostId(slugOrId)

    const context = normalizeVersionContext(
      yield* api.request(`/drafts/context/post/${id}`),
    )
    const branches = context.branches.filter(
      (branch) =>
        branch.status === 'active' && branch.relationToPublished !== 'same',
    )
    if (branches.length === 0) {
      return yield* Effect.fail(
        new Generic({
          message: `no staged changes for post ${slugOrId}`,
          hint: 'stage changes first with `mxs post stage <slugOrId> --file <article.xml>`',
        }),
      )
    }
    if (branches.length > 1) {
      return yield* Effect.fail(
        new Generic({
          message: `post ${slugOrId} has ${branches.length} draft branches`,
          hint: 'publish the intended branch explicitly with `mxs draft publish <branchId>`',
        }),
      )
    }

    const res = yield* publishSavedDraft(api, branches[0])
    yield* renderer.emitSuccess(res)
  }),
).pipe(
  Command.withDescription(
    'publish the exact staged post draft through the server publish job',
  ),
)
