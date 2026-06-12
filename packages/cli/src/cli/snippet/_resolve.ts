import { Effect } from 'effect'

import { ResourceNotFound } from '../../domain/errors'
import type { ApiService } from '../../services/Api'
import { isSnowflakeId } from '../../services/Resolver'

interface SnippetListItem {
  readonly id?: string
  readonly name?: string
}

const unwrapList = (res: unknown): readonly SnippetListItem[] => {
  if (Array.isArray(res)) return res as SnippetListItem[]
  if (res && typeof res === 'object') {
    const data = (res as { data?: unknown }).data
    if (Array.isArray(data)) return data as SnippetListItem[]
  }
  return []
}

export const resolveSnippetId = (
  api: ApiService,
  ref: string,
): Effect.Effect<string, ResourceNotFound> =>
  Effect.gen(function* () {
    if (isSnowflakeId(ref)) return ref
    const slash = ref.indexOf('/')
    const reference = slash === -1 ? 'root' : ref.slice(0, slash)
    const name = slash === -1 ? ref : ref.slice(slash + 1)
    const res = yield* api
      .request(`/snippets/group/${encodeURIComponent(reference)}`)
      .pipe(Effect.catchAll(() => Effect.succeed(null)))
    const match = unwrapList(res).find((s) => s.name === name)
    if (!match?.id) {
      return yield* Effect.fail(
        new ResourceNotFound({
          kind: 'snippet',
          ref,
          message: `snippet not found: ${ref}`,
        }),
      )
    }
    return match.id
  })
