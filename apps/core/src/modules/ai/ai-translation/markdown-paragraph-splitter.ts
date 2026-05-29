export interface MarkdownParagraph {
  id: string
  text: string
}

const FENCE_PATTERN = /^(\s{0,3})(`{3,}|~{3,})/

function findFenceMatch(
  line: string,
): { indent: string; marker: string } | null {
  const match = FENCE_PATTERN.exec(line)
  if (!match) return null
  return { indent: match[1], marker: match[2] }
}

export function splitMarkdownIntoParagraphs(text: string): MarkdownParagraph[] {
  const lines = text.split('\n')
  const paragraphs: string[] = []
  let buffer: string[] = []
  let fenceMarker: string | null = null

  const flush = () => {
    if (buffer.length === 0) return
    const joined = buffer.join('\n')
    if (joined.trim().length > 0) {
      paragraphs.push(joined)
    }
    buffer = []
  }

  for (const line of lines) {
    if (fenceMarker === null) {
      const open = findFenceMatch(line)
      if (open) {
        if (buffer.some((l) => l.trim().length > 0)) {
          flush()
        }
        fenceMarker = open.marker
        buffer.push(line)
        continue
      }

      if (line.trim() === '') {
        flush()
        continue
      }

      buffer.push(line)
      continue
    }

    buffer.push(line)
    const close = findFenceMatch(line)
    if (
      close &&
      close.marker.startsWith(fenceMarker[0]) &&
      close.marker.length >= fenceMarker.length
    ) {
      fenceMarker = null
      flush()
    }
  }

  flush()

  return paragraphs.map((paragraph, index) => ({
    id: `text:p${index}`,
    text: paragraph,
  }))
}

export function joinMarkdownParagraphs(
  paragraphs: readonly MarkdownParagraph[],
): string {
  return paragraphs.map((p) => p.text).join('\n\n')
}

export function applyParagraphPatches(
  text: string,
  patches: Record<string, string>,
): {
  joined: string
  appliedIds: string[]
  unknownIds: string[]
} {
  const paragraphs = splitMarkdownIntoParagraphs(text)
  const idSet = new Set(paragraphs.map((p) => p.id))
  const appliedIds: string[] = []
  const unknownIds: string[] = []

  for (const key of Object.keys(patches)) {
    if (!idSet.has(key)) unknownIds.push(key)
  }

  const next = paragraphs.map((p) => {
    if (Object.prototype.hasOwnProperty.call(patches, p.id)) {
      appliedIds.push(p.id)
      return { id: p.id, text: patches[p.id] }
    }
    return p
  })

  return {
    joined: joinMarkdownParagraphs(next),
    appliedIds,
    unknownIds,
  }
}
