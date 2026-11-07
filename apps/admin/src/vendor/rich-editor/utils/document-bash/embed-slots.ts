import type { SerializedEditorState } from 'lexical'

type UploadKind = 'excalidraw' | 'dynamic'

export type NodeRecord = Record<string, unknown> & {
  type?: unknown
  $?: { blockId?: string }
}

export type Slot = {
  kind: UploadKind | 'media'
  blockId?: string
  node: NodeRecord
  get: () => string
  set: (value: string) => void
}

const MEDIA_TYPES = new Set(['image', 'video', 'file'])

export function hash8(text: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function extensionOf(url: string) {
  try {
    const match = /\.([\da-z]{1,8})$/i.exec(new URL(url).pathname)
    return match ? match[1].toLowerCase() : 'bin'
  } catch {
    return 'bin'
  }
}

export const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  pdf: 'application/pdf',
}

export function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export function parseScene(snapshot: string) {
  const json = tryParseJson(snapshot)
  if (json && typeof json === 'object')
    return { storage: 'inline' as const, data: json }
  const [first, ...rest] = snapshot.split('\n')
  const url = first.trim()
  const delta = tryParseJson(rest.join('\n').trim())
  if (delta && typeof delta === 'object')
    return { storage: 'delta' as const, url, delta }
  return { storage: 'remote' as const, url }
}

function collectSlots(value: unknown, out: Slot[]) {
  if (Array.isArray(value)) {
    for (const item of value) collectSlots(item, out)
    return
  }
  if (!value || typeof value !== 'object') return
  const node = value as NodeRecord
  const blockId = node.$?.blockId || undefined
  if (node.type === 'excalidraw' && typeof node.snapshot === 'string') {
    out.push({
      kind: 'excalidraw',
      blockId,
      node,
      get: () => node.snapshot as string,
      set: (next) => (node.snapshot = next),
    })
  } else if (node.type === 'dynamic' && typeof node.url === 'string') {
    out.push({
      kind: 'dynamic',
      blockId,
      node,
      get: () => node.url as string,
      set: (next) => (node.url = next),
    })
  } else if (
    typeof node.type === 'string' &&
    MEDIA_TYPES.has(node.type) &&
    typeof node.src === 'string'
  ) {
    out.push({
      kind: 'media',
      blockId,
      node,
      get: () => node.src as string,
      set: (next) => (node.src = next),
    })
  } else if (node.type === 'gallery' && Array.isArray(node.images)) {
    for (const image of node.images as NodeRecord[]) {
      if (typeof image?.src !== 'string') continue
      out.push({
        kind: 'media',
        node: image,
        get: () => image.src as string,
        set: (next) => (image.src = next),
      })
    }
  }
  for (const [key, child] of Object.entries(node)) {
    if (key !== '$' && child && typeof child === 'object')
      collectSlots(child, out)
  }
}

export function slotsOf(state: SerializedEditorState) {
  const slots: Slot[] = []
  collectSlots(state.root, slots)
  return slots
}

export function mediaMetadata(node: NodeRecord, url: string) {
  const ext = extensionOf(url)
  const alt = node.altText ?? node.alt
  const lines = [
    `type: ${typeof node.type === 'string' ? node.type : 'image'}`,
    `mime: ${MIME[ext] ?? 'application/octet-stream'}`,
  ]
  if (typeof node.width === 'number' && typeof node.height === 'number')
    lines.push(`size: ${node.width}x${node.height}`)
  if (typeof alt === 'string' && alt) lines.push(`alt: ${alt}`)
  return `${lines.join('\n')}\n`
}
