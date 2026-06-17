import { Effect } from 'effect'

import { ResourceNotFound } from '../../domain/errors'
import { isSnowflakeId, type ResolverService } from '../../services/Resolver'

/**
 * Resolve an article reference (snowflake id, slug, or title) to a Snowflake.
 * Tries post first, then note. AI generation has no page surface.
 */
export const resolveArticleId = (
  resolver: ResolverService,
  ref: string,
): Effect.Effect<string, ResourceNotFound> =>
  Effect.gen(function* () {
    if (isSnowflakeId(ref)) return ref
    const asPost = yield* resolver
      .resolvePostId(ref)
      .pipe(Effect.catchAll(() => Effect.succeed<string | null>(null)))
    if (asPost) return asPost
    const asNote = yield* resolver
      .resolveNoteId(ref)
      .pipe(Effect.catchAll(() => Effect.succeed<string | null>(null)))
    if (asNote) return asNote
    return yield* Effect.fail(
      new ResourceNotFound({
        message: `article not found: ${ref}`,
        kind: 'article',
        ref,
        hint: 'pass a snowflake id, a post slug, or a numeric note nid',
      }),
    )
  })
