export interface PatchBlock {
  readonly search: string
  readonly replace: string
}

export type PatchErrorReason = 'ambiguous' | 'malformed' | 'not-found'

export class PatchError extends Error {
  constructor(
    readonly reason: PatchErrorReason,
    readonly blockIndex: number,
    message: string,
  ) {
    super(message)
    this.name = 'PatchError'
  }
}

const SEARCH = '<<<<<<< SEARCH'
const DIVIDER = '======='
const REPLACE = '>>>>>>> REPLACE'

export function parsePatchBlocks(input: string): PatchBlock[] {
  const lines = input.replaceAll('\r\n', '\n').split('\n')
  const blocks: PatchBlock[] = []
  let i = 0
  while (i < lines.length) {
    if (lines[i].trimEnd() !== SEARCH) {
      i++
      continue
    }
    const index = blocks.length
    const divider = lines.findIndex((l, j) => j > i && l.trimEnd() === DIVIDER)
    const end =
      divider === -1
        ? -1
        : lines.findIndex((l, j) => j > divider && l.trimEnd() === REPLACE)
    if (divider === -1 || end === -1) {
      throw new PatchError(
        'malformed',
        index,
        `block ${index + 1}: unterminated block — expected "${DIVIDER}" and "${REPLACE}" lines`,
      )
    }
    blocks.push({
      search: lines.slice(i + 1, divider).join('\n'),
      replace: lines.slice(divider + 1, end).join('\n'),
    })
    i = end + 1
  }
  if (blocks.length === 0) {
    throw new PatchError(
      'malformed',
      0,
      `no SEARCH/REPLACE blocks found on stdin (expected "${SEARCH}" … "${DIVIDER}" … "${REPLACE}")`,
    )
  }
  return blocks
}

interface Match {
  readonly count: number
  readonly start: number
  readonly end: number
}

function locate(xml: string, search: string): Match {
  if (search.length > 0 && xml.includes(search)) {
    const start = xml.indexOf(search)
    return {
      count: xml.split(search).length - 1,
      start,
      end: start + search.length,
    }
  }
  const lines = xml.split('\n')
  const wanted = search.split('\n').map((l) => l.trim())
  if (wanted.every((l) => l === '')) return { count: 0, start: -1, end: -1 }
  const hits: number[] = []
  for (let i = 0; i + wanted.length <= lines.length; i++) {
    if (wanted.every((w, j) => lines[i + j].trim() === w)) hits.push(i)
  }
  if (hits.length === 0) return { count: 0, start: -1, end: -1 }
  const first = hits[0]
  const before = lines.slice(0, first).join('\n')
  const start =
    (first > 0 ? before.length + 1 : 0) +
    (lines[first].length - lines[first].trimStart().length)
  const last = lines[first + wanted.length - 1]
  const end =
    lines.slice(0, first + wanted.length - 1).join('\n').length +
    (first + wanted.length - 1 > 0 ? 1 : 0) +
    last.trimEnd().length
  return { count: hits.length, start, end }
}

const escapeText = (xml: string) =>
  xml
    .split(/(<[^>]*>)/)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part
            .replaceAll(/&(?!(?:amp|apos|gt|lt|quot|#\d+);)/g, '&amp;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&apos;'),
    )
    .join('')

function currentBlockHint(xml: string, search: string): string {
  const id = search.match(/\bid="([^"]+)"/)?.[1]
  if (!id) return ''
  const line = xml.split('\n').find((l) => l.includes(`id="${id}"`))
  return line
    ? `\ncurrent content of block ${id}:\n${line.trim()}`
    : `\nblock ${id} no longer exists`
}

export function applyPatchBlocks(
  xml: string,
  blocks: readonly PatchBlock[],
): string {
  let result = xml
  blocks.forEach((block, index) => {
    let match = locate(result, block.search)
    if (match.count === 0) match = locate(result, escapeText(block.search))
    if (match.count === 0) {
      throw new PatchError(
        'not-found',
        index,
        `block ${index + 1}: SEARCH text not found in the current article (someone may have edited it; run \`mxs draft cat\` again)${currentBlockHint(result, block.search)}`,
      )
    }
    if (match.count > 1) {
      throw new PatchError(
        'ambiguous',
        index,
        `block ${index + 1}: SEARCH text matches ${match.count} places; include more surrounding text so it matches once`,
      )
    }
    result =
      result.slice(0, match.start) +
      escapeText(block.replace) +
      result.slice(match.end)
  })
  return result
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&apos;': "'",
  '&gt;': '>',
  '&lt;': '<',
  '&quot;': '"',
  '&#39;': "'",
}

const TAG_ALIASES: Record<string, string> = { em: 'i', strong: 'b' }

const decode = (text: string) =>
  text.replaceAll(/&(?:amp|apos|gt|lt|quot|#39);/g, (e) => ENTITIES[e])

const textOf = (xml: string) =>
  decode(xml.replaceAll(/<[^>]*>/g, '')).replaceAll(/\s+/g, '')

const tagNames = (xml: string) =>
  new Set(
    [...xml.matchAll(/<\/?([a-z][\w-]*)/gi)].map((m) => {
      const name = m[1].toLowerCase()
      return TAG_ALIASES[name] ?? name
    }),
  )

export function findDroppedReplacements(
  blocks: readonly PatchBlock[],
  rendered: string,
): string[] {
  const target = textOf(rendered)
  const kept = tagNames(rendered)
  const dropped: string[] = []
  blocks.forEach((block, index) => {
    if (block.replace.trim() === '') return
    const missing = [...tagNames(block.replace)].filter((t) => !kept.has(t))
    const textKept =
      target.includes(textOf(block.replace)) ||
      block.replace.split('\n').every((line) => target.includes(textOf(line)))
    if (missing.length === 0 && textKept) return
    dropped.push(
      missing.length > 0
        ? `block ${index + 1}: ${missing.map((t) => `<${t}>`).join(' ')}`
        : `block ${index + 1}`,
    )
  })
  return dropped
}
