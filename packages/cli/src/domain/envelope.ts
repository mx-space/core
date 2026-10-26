import {
  type EnvelopeKind,
  EnvelopeParseError,
  type ParsedEnvelope,
  parseEnvelope as parseEditorEnvelope,
  type ParseEnvelopeOptions,
} from '@mx-space/editor'

import { ValidationXml } from './errors'

export {
  coerceMeta,
  type ContentSpan,
  type EnvelopeKind,
  type EnvelopeMeta,
  flagToTag,
  listUnknownMetaKeys,
  type ParsedEnvelope,
  spliceEnvelopeContent,
  tagToFlag,
} from '@mx-space/editor'

export function parseEnvelope(
  xml: string,
  kind: EnvelopeKind,
  options?: ParseEnvelopeOptions,
): ParsedEnvelope {
  try {
    return parseEditorEnvelope(xml, kind, options)
  } catch (error) {
    if (error instanceof EnvelopeParseError) {
      throw new ValidationXml({
        message: error.message,
        line: error.line,
        details: { line: error.line },
      })
    }
    throw error
  }
}
