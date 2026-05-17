import { emitDocument, type DocumentKind } from '../../core/document-output'
import type { OutputOptions } from '../../core/output'
import { buildApiClient, type GlobalFlags, resolveContext } from '../_shared'
import { resolvePostReadPath } from './resolve'

const KIND: DocumentKind = 'post'

export async function run(
  slugOrId: string,
  flags: GlobalFlags,
  out: OutputOptions,
) {
  const ctx = await resolveContext(flags, out)
  const client = buildApiClient(ctx, flags)
  const path = await resolvePostReadPath(client, slugOrId)
  const res = await client.request(path, {
    query: { prefer: 'lexical' },
  })
  emitDocument(KIND, res.data, out)
}
