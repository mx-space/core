import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { coerceMeta, parseEnvelope } from '../../domain/envelope'
import { ResourceNotFound, ValidationXml } from '../../domain/errors'
import { buildPagePayload } from '../../domain/payload'
import { Api, type ApiService } from '../../services/Api'
import { Editor } from '../../services/Editor'
import { Lexical } from '../../services/Lexical'
import { Renderer } from '../../services/Renderer'
import { isSnowflakeId } from '../../services/Resolver'
import { pageWriteOptions, toPageFlagInputs } from './create'

const slugOrId = Args.text({ name: 'slugOrId' })

const escapeXml = (s: string): string =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

interface PageForEditor {
  id?: string
  title?: string
  slug?: string
  subtitle?: string
  order?: number
  contentFormat?: string
  content?: string
}

const resolvePageId = (
  api: ApiService,
  ref: string,
): Effect.Effect<string, ResourceNotFound> =>
  Effect.gen(function* () {
    if (isSnowflakeId(ref)) return ref
    const res = yield* api
      .request<{
        id?: string
        data?: { id?: string }
      }>(`/pages/slug/${encodeURIComponent(ref)}`)
      .pipe(Effect.catchAll(() => Effect.succeed(null)))
    const id =
      (res && (res as { id?: string }).id) ??
      (res && (res as { data?: { id?: string } }).data?.id)
    if (!id) {
      return yield* Effect.fail(
        new ResourceNotFound({
          kind: 'page',
          ref,
          message: `page not found: ${ref}`,
        }),
      )
    }
    return id
  })

const materializeForEditor = (ref: string) =>
  Effect.gen(function* () {
    const api = yield* Api
    const lexical = yield* Lexical
    const path = isSnowflakeId(ref)
      ? `/pages/${ref}`
      : `/pages/slug/${encodeURIComponent(ref)}`
    const page = (yield* api.request(path, {
      query: { prefer: 'lexical' },
    })) as PageForEditor
    const isLexical = page.contentFormat === 'lexical'
    let innerXml: string
    if (isLexical && page.content) {
      const state = JSON.parse(page.content)
      innerXml = yield* lexical.payloadToLitexml(state)
    } else {
      innerXml = page.content ?? ''
    }
    return `<mxpost>
  <meta>
    <title>${escapeXml(page.title ?? '')}</title>
    <slug>${escapeXml(page.slug ?? '')}</slug>
  </meta>
  <content>
${innerXml}
  </content>
</mxpost>
`
  })

const overlayPageMeta = (
  payload: Record<string, unknown>,
  rawMeta: Record<string, unknown>,
): Record<string, unknown> => {
  const meta = coerceMeta(rawMeta)
  const next = { ...payload }
  if (meta.title !== undefined) next.title = meta.title
  if (meta.slug !== undefined) next.slug = meta.slug
  if (meta.subtitle !== undefined) next.subtitle = meta.subtitle
  if (meta.order !== undefined) next.order = meta.order
  return next
}

export const edit = Command.make(
  'edit',
  { slugOrId, ...pageWriteOptions },
  ({ slugOrId, ...rest }) =>
    Effect.gen(function* () {
      const flags = toPageFlagInputs(rest)
      const api = yield* Api
      const editor = yield* Editor
      const renderer = yield* Renderer

      // Editor round-trip path: no --file and no --content → spawn $EDITOR.
      if (!flags.file && flags.content === undefined) {
        const xml = yield* materializeForEditor(slugOrId)
        const next = yield* editor.openEditor({
          filename: `page-${slugOrId}.xml`,
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
        const built = yield* buildPagePayload({
          ...flags,
          content: parsed.contentXml,
          format: flags.format ?? 'lexical',
        })
        const payload = overlayPageMeta(built.payload, parsed.meta)
        const id = yield* resolvePageId(api, slugOrId)
        const res = yield* api.request(`/pages/${id}`, {
          method: 'PUT',
          body: payload,
        })
        yield* renderer.emitSuccess(res)
        return
      }

      // Non-interactive path: build from flags / file.
      const built = yield* buildPagePayload(flags)
      const id = yield* resolvePageId(api, slugOrId)
      const res = yield* api.request(`/pages/${id}`, {
        method: 'PUT',
        body: built.payload,
      })
      yield* renderer.emitSuccess(res)
    }),
)
