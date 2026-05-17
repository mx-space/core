import type { ApiClient } from '../../core/api-client'
import { runEditorRoundTrip } from '../../core/editor'
import { parseEnvelope } from '../../core/envelope'
import { MxsError } from '../../core/errors'
import { serializeFromLexical } from '../../core/litexml-codec'
import { emitInfo, emitSuccess, type OutputOptions } from '../../core/output'
import { buildPagePayload, type PageFlagInputs } from '../../core/payload'
import { isSnowflakeId } from '../../core/resolve'
import { applyPageEnvelopeMeta } from '../_envelope-overlays'
import { buildApiClient, type GlobalFlags, resolveContext } from '../_shared'

export async function run(
  slugOrId: string,
  opts: PageFlagInputs,
  flags: GlobalFlags,
  out: OutputOptions,
) {
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)

  if (!opts.file && opts.content === undefined) {
    const xml = await materialize(client, slugOrId)
    const next = await runEditorRoundTrip({
      filename: `page-${slugOrId}.xml`,
      initialContent: xml,
    })
    if (next.trim() === xml.trim()) {
      emitInfo('no changes', out)
      return
    }
    const parsed = parseEnvelope(next, 'post')
    const built = await buildPagePayload({
      ...opts,
      content: parsed.contentXml,
      format: opts.format ?? 'lexical',
    })
    applyPageEnvelopeMeta(built.payload, parsed.meta)
    if (flags.dryRun) {
      emitSuccess(built.payload, out)
      return
    }
    const id = await resolveId(client, slugOrId)
    const res = await client.request(`/pages/${id}`, {
      method: 'PUT',
      body: built.payload,
    })
    emitSuccess(res.data, out)
    return
  }

  const built = await buildPagePayload(opts)
  if (flags.dryRun) {
    emitSuccess(built.payload, out)
    return
  }
  const id = await resolveId(client, slugOrId)
  const res = await client.request(`/pages/${id}`, {
    method: 'PUT',
    body: built.payload,
  })
  emitSuccess(res.data, out)
}

async function resolveId(client: ApiClient, slugOrId: string): Promise<string> {
  if (isSnowflakeId(slugOrId)) return slugOrId
  const res = await client.request<{ id: string }>(`/pages/slug/${slugOrId}`)
  if (!res.data?.id)
    throw new MxsError({
      code: 'resource.not_found',
      message: `page not found: ${slugOrId}`,
    })
  return res.data.id
}

async function materialize(
  client: ApiClient,
  slugOrId: string,
): Promise<string> {
  const path = isSnowflakeId(slugOrId)
    ? `/pages/${slugOrId}`
    : `/pages/slug/${slugOrId}`
  const res = await client.request<any>(path, { query: { prefer: 'lexical' } })
  const page = res.data
  const inner =
    page.contentFormat === 'lexical' && page.content
      ? serializeFromLexical(JSON.parse(page.content))
      : (page.content ?? '')
  return `<mxpost>
  <meta>
    <title>${esc(page.title ?? '')}</title>
    <slug>${esc(page.slug ?? '')}</slug>
  </meta>
  <content>
${inner}
  </content>
</mxpost>
`
}

function esc(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}
