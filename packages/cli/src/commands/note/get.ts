import { type DocumentKind, emitDocument } from '../../core/document-output'
import { MxsError } from '../../core/errors'
import type { OutputOptions } from '../../core/output'
import { isSnowflakeId } from '../../core/resolve'
import {
  buildApiClient,
  type GlobalFlags,
  resolveContext,
} from '../internal/shared'

const KIND: DocumentKind = 'note'

export async function run(
  slugOrId: string,
  flags: GlobalFlags,
  out: OutputOptions,
) {
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  if (isSnowflakeId(slugOrId)) {
    const res = await client.request(`/notes/${slugOrId}`, {
      query: { prefer: 'lexical' },
    })
    emitDocument(KIND, res.data, out)
    return
  }
  if (/^\d+$/.test(slugOrId)) {
    const res = await client.request(`/notes/nid/${slugOrId}`, {
      query: { single: '1', prefer: 'lexical' },
    })
    emitDocument(KIND, res.data, out)
    return
  }
  throw new MxsError({
    code: 'validation.failed',
    message: `invalid note reference: ${slugOrId} (use snowflake id or numeric nid)`,
  })
}
