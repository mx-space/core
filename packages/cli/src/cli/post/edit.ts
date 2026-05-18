import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { coerceMeta, parseEnvelope } from '../../domain/envelope'
import { ValidationXml } from '../../domain/errors'
import { buildPostPayload } from '../../domain/payload'
import { Api } from '../../services/Api'
import { Editor } from '../../services/Editor'
import { Lexical } from '../../services/Lexical'
import { Renderer } from '../../services/Renderer'
import { Resolver } from '../../services/Resolver'
import {
  postWriteOptions,
  resolveCategoryRefs,
  toPostFlagInputs,
} from './_flags'

const slugOrId = Args.text({ name: 'slugOrId' })

const escapeXml = (s: string): string =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

interface PostForEditor {
  id?: string
  title?: string
  slug?: string
  contentFormat?: string
  content?: string
  summary?: string
  isPublished?: boolean
  tags?: string[]
}

const materializeForEditor = (slugOrId: string) =>
  Effect.gen(function* () {
    const api = yield* Api
    const resolver = yield* Resolver
    const lexical = yield* Lexical
    const path = yield* resolver.resolvePostReadPath(slugOrId)
    const post = (yield* api.request(path, {
      query: { prefer: 'lexical' },
    })) as PostForEditor
    const isLexical = post.contentFormat === 'lexical'
    let innerXml: string
    if (isLexical && post.content) {
      const state = JSON.parse(post.content)
      innerXml = yield* lexical.payloadToLitexml(state)
    } else {
      innerXml = post.content ?? ''
    }
    const tagsXml = (post.tags ?? [])
      .map((t) => `    <tag>${escapeXml(t)}</tag>`)
      .join('\n')
    return `<mxpost>
  <meta>
    <title>${escapeXml(post.title ?? '')}</title>
    <slug>${escapeXml(post.slug ?? '')}</slug>
    <state>${post.isPublished ? 'publish' : 'draft'}</state>
    ${post.summary ? `<summary>${escapeXml(post.summary)}</summary>` : ''}
    ${tagsXml ? `<tags>\n${tagsXml}\n    </tags>` : ''}
  </meta>
  <content>
${innerXml}
  </content>
</mxpost>
`
  })

const metaFromEnvelope = (
  meta: Record<string, unknown>,
): Record<string, unknown> => {
  const overlay: Record<string, unknown> = {}
  const m = coerceMeta(meta)
  if (m.title !== undefined) overlay.title = m.title
  if (m.slug !== undefined) overlay.slug = m.slug
  if (m.summary !== undefined) overlay.summary = m.summary
  if (m.state !== undefined) overlay.isPublished = m.state === 'publish'
  if (m.tags !== undefined) overlay.tags = m.tags
  return overlay
}

export const edit = Command.make(
  'edit',
  { slugOrId, ...postWriteOptions },
  ({ slugOrId, ...rest }) =>
    Effect.gen(function* () {
      const flags = toPostFlagInputs(rest)
      const api = yield* Api
      const editor = yield* Editor
      const renderer = yield* Renderer
      const resolver = yield* Resolver

      // Editor round-trip path: no --file and no --content → spawn $EDITOR.
      if (!flags.file && flags.content === undefined) {
        const xml = yield* materializeForEditor(slugOrId)
        const next = yield* editor.openEditor({
          filename: `post-${slugOrId}.xml`,
          initialContent: xml,
        })
        if (next.trim() === xml.trim()) {
          yield* renderer.emitInfo('no changes')
          return
        }
        const parsed = yield* Effect.try({
          try: () => parseEnvelope(next, 'post'),
          catch: (err) =>
            err instanceof ValidationXml
              ? err
              : new ValidationXml({ message: String(err), cause: err }),
        })
        const built = yield* buildPostPayload({
          ...flags,
          content: parsed.contentXml,
          format: flags.format ?? 'lexical',
        })
        const payload = { ...built.payload, ...metaFromEnvelope(parsed.meta) }
        const resolved = yield* resolveCategoryRefs(payload)
        const id = yield* resolver.resolvePostId(slugOrId)
        const res = yield* api.request(`/posts/${id}`, {
          method: 'PUT',
          body: resolved,
        })
        yield* renderer.emitSuccess(res)
        return
      }

      // Non-interactive path: build from flags / file.
      const built = yield* buildPostPayload(flags)
      const resolved = yield* resolveCategoryRefs(built.payload)
      const id = yield* resolver.resolvePostId(slugOrId)
      const res = yield* api.request(`/posts/${id}`, {
        method: 'PUT',
        body: resolved,
      })
      yield* renderer.emitSuccess(res)
    }),
).pipe(Command.withDescription('edit a post via $EDITOR or flags'))
