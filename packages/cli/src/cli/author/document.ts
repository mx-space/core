import { basename } from 'node:path'

import {
  type EnvelopeKind,
  parseEnvelope,
  spliceEnvelopeContent,
} from '../../domain/envelope'
import { ValidationXml } from '../../domain/errors'

export type AuthorKind = 'envelope' | 'fragment'
export type AuthorVariant = 'article' | 'note'

export interface AuthorDocument {
  readonly filePath: string
  readonly kind: AuthorKind
  readonly variant: AuthorVariant
  originalBody: string
  lastFileText: string
  saved: boolean
}

export interface AuthorSave {
  readonly fileText: string
  readonly diff: string
  readonly diffPath: string
}

export interface AuthorFs {
  readonly writeFile: (path: string, data: string) => Promise<void>
  readonly rename: (from: string, to: string) => Promise<void>
}

export function openAuthorDocument(
  filePath: string,
  source: string,
  variantOverride?: AuthorVariant,
): AuthorDocument {
  const trimmed = source.trimStart()
  if (trimmed.startsWith('<mxpost')) {
    const parsed = parseEnvelope(source, 'post')
    return {
      filePath,
      kind: 'envelope',
      variant: 'article',
      originalBody: parsed.contentXml,
      lastFileText: source,
      saved: false,
    }
  }
  if (trimmed.startsWith('<mxnote')) {
    const parsed = parseEnvelope(source, 'note')
    return {
      filePath,
      kind: 'envelope',
      variant: 'note',
      originalBody: parsed.contentXml,
      lastFileText: source,
      saved: false,
    }
  }
  return {
    filePath,
    kind: 'fragment',
    variant: variantOverride ?? 'article',
    originalBody: source,
    lastFileText: source,
    saved: false,
  }
}

// The editor mints block ids and reshapes lists on hydration, so the raw
// source is never what a zero-edit save produces. Accept the hydrated body as
// the diff baseline until the first save locks it.
export function setAuthorBaseline(doc: AuthorDocument, body: string): boolean {
  if (doc.saved) return false
  doc.originalBody = body
  return true
}

export function currentAuthorBody(doc: AuthorDocument): string {
  if (doc.kind === 'fragment') return doc.lastFileText
  const kind: EnvelopeKind = doc.variant === 'note' ? 'note' : 'post'
  return parseEnvelope(doc.lastFileText, kind).contentXml
}

export function applyAuthorBody(
  doc: AuthorDocument,
  newBody: string,
): AuthorSave {
  const fileText =
    doc.kind === 'envelope' ? spliceCurrentContent(doc, newBody) : newBody
  return {
    fileText,
    diff: unifiedDiff(doc.originalBody, newBody, basename(doc.filePath)),
    diffPath: `${doc.filePath}.diff`,
  }
}

const spliceCurrentContent = (doc: AuthorDocument, newBody: string): string => {
  const kind: EnvelopeKind = doc.variant === 'note' ? 'note' : 'post'
  const parsed = parseEnvelope(doc.lastFileText, kind)
  if (!parsed.contentSpan) {
    throw new ValidationXml({
      message: 'envelope is missing <content>',
    })
  }
  return spliceEnvelopeContent(doc.lastFileText, parsed.contentSpan, newBody)
}

export function unifiedDiff(
  original: string,
  current: string,
  fileName: string,
): string {
  const header = `--- ${fileName} (original)\n+++ ${fileName} (current)\n`
  if (original === current) return header

  const a = original.split('\n')
  const b = current.split('\n')
  const ops = diffLines(a, b)
  const hunk = [
    `@@ -1,${a.length} +1,${b.length} @@`,
    ...ops.map(([type, line]) => {
      if (type === 'eq') return ` ${line}`
      if (type === 'del') return `-${line}`
      return `+${line}`
    }),
  ]
  return `${header}${hunk.join('\n')}\n`
}

export const diffLines = (
  a: readonly string[],
  b: readonly string[],
): ReadonlyArray<readonly ['eq' | 'del' | 'add', string]> => {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1]![j - 1]! + 1
          : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!)
    }
  }
  const out: Array<['eq' | 'del' | 'add', string]> = []
  let i = m
  let j = n
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      out.push(['eq', a[i - 1]!])
      i--
      j--
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      out.push(['del', a[i - 1]!])
      i--
    } else {
      out.push(['add', b[j - 1]!])
      j--
    }
  }
  while (i > 0) {
    out.push(['del', a[i - 1]!])
    i--
  }
  while (j > 0) {
    out.push(['add', b[j - 1]!])
    j--
  }
  return out.reverse()
}

export async function persistAuthorSave(
  doc: AuthorDocument,
  fileText: string,
  diff: string,
  fs: AuthorFs,
): Promise<void> {
  const xmlTmp = `${doc.filePath}.tmp`
  const diffPath = `${doc.filePath}.diff`
  const diffTmp = `${diffPath}.tmp`
  const previous = doc.lastFileText
  await fs.writeFile(xmlTmp, fileText)
  await fs.writeFile(diffTmp, diff)
  await fs.rename(xmlTmp, doc.filePath)
  try {
    await fs.rename(diffTmp, diffPath)
  } catch (err) {
    await fs.writeFile(doc.filePath, previous)
    throw err
  }
  doc.lastFileText = fileText
  doc.saved = true
}
