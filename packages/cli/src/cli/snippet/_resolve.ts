import { Effect } from 'effect'

import { ResourceNotFound } from '../../domain/errors'
import type { ApiService } from '../../services/Api'
import { isSnowflakeId } from '../../services/Resolver'

interface SnippetListItem {
  readonly id?: string
  readonly path?: string
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
    const res = yield* api
      .request('/snippets/by-path', { query: { path: ref } })
      .pipe(Effect.catchAll(() => Effect.succeed(null)))
    const doc = res && typeof res === 'object' ? (res as any).data || res : null
    const match = Array.isArray(doc)
      ? unwrapList(doc).find((s) => s.path === ref)
      : (doc as SnippetListItem | null)
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
