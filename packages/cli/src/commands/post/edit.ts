import type { ApiClient } from '../../core/api-client'
import { runEditorRoundTrip } from '../../core/editor'
import { parseEnvelope } from '../../core/envelope'
import { serializeFromLexical } from '../../core/litexml-codec'
import { emitInfo, emitSuccess, type OutputOptions } from '../../core/output'
import { buildPostPayload, type PostFlagInputs } from '../../core/payload'
import { buildResolver, resolveCategoryRefs } from '../_resolve-helpers'
import { buildApiClient, type GlobalFlags, resolveContext } from '../_shared'
import { resolvePostId, resolvePostReadPath } from './resolve'

export async function run(
  slugOrId: string,
  opts: PostFlagInputs,
  flags: GlobalFlags,
  out: OutputOptions,
) {
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)

  if (!opts.file && opts.content === undefined) {
    const xml = await materializeForEditor(client, slugOrId)
    const next = await runEditorRoundTrip({
      filename: `post-${slugOrId}.xml`,
      initialContent: xml,
    })
    if (next.trim() === xml.trim()) {
      emitInfo('no changes', out)
      return
    }
    const parsed = parseEnvelope(next, 'post')
    const payloadInputs: PostFlagInputs = {
      ...opts,
      content: parsed.contentXml,
      format: opts.format ?? 'lexical',
    }
    const built = await buildPostPayload(payloadInputs)
    Object.assign(built.payload, await metaFromEnvelope(parsed.meta))
    if (flags.dryRun) {
      emitSuccess(built.payload, out)
      return
    }
    const resolver = buildResolver(client)
    await resolveCategoryRefs(built.payload, resolver)
    const res = await client.request(
      `/posts/${await resolvePostId(client, slugOrId)}`,
      { method: 'PUT', body: built.payload },
    )
    emitSuccess(res.data, out)
    return
  }

  const built = await buildPostPayload(opts)
  if (flags.dryRun) {
    emitSuccess(built.payload, out)
    return
  }
  const resolver = buildResolver(client)
  await resolveCategoryRefs(built.payload, resolver)
  const res = await client.request(
    `/posts/${await resolvePostId(client, slugOrId)}`,
    { method: 'PUT', body: built.payload },
  )
  emitSuccess(res.data, out)
}

async function materializeForEditor(
  client: ApiClient,
  slugOrId: string,
): Promise<string> {
  const path = await resolvePostReadPath(client, slugOrId)
  const res = await client.request<{
    id: string
    title?: string
    slug?: string
    contentFormat?: string
    content?: string
    summary?: string
    isPublished?: boolean
    tags?: string[]
  }>(path, { query: { prefer: 'lexical' } })
  const post = res.data
  const isLexical = post.contentFormat === 'lexical'
  const innerXml =
    isLexical && post.content
      ? serializeFromLexical(JSON.parse(post.content))
      : (post.content ?? '')
  const tagsXml = (post.tags ?? [])
    .map((t: string) => `    <tag>${escapeXml(t)}</tag>`)
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
}

function escapeXml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

async function metaFromEnvelope(
  meta: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const overlay: Record<string, unknown> = {}
  if (typeof meta.title === 'string') overlay.title = meta.title
  if (typeof meta.slug === 'string') overlay.slug = meta.slug
  if (typeof meta.summary === 'string') overlay.summary = meta.summary
  if (meta.state === 'publish' || meta.state === 'draft')
    overlay.isPublished = meta.state === 'publish'
  if (Array.isArray(meta.tags)) overlay.tags = meta.tags
  return overlay
}
