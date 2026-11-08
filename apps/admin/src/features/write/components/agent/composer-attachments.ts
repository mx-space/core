import type { AgentFileSnapshot, AgentToolImage } from '@mx-space/ai'
import { AGENT_ATTACHMENTS_DIR } from '@mx-space/ai'

import type { ChatAttachment } from './types'

export type AttachmentKind = 'image' | 'text'

export interface ComposerAttachment {
  content?: string
  error?: string
  id: string
  kind: AttachmentKind
  mimeType: string
  name: string
  previewUrl?: string
  progress: number
  size: number
  status: 'error' | 'ready' | 'uploading'
  url?: string
}

export const MAX_ATTACHMENTS = 8
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024
export const MAX_TEXT_BYTES = 256 * 1024

const TEXT_MIME_TYPES = new Set([
  'application/json',
  'application/xml',
  'application/x-yaml',
  'application/yaml',
  'application/javascript',
  'application/typescript',
  'application/toml',
])

const TEXT_EXTENSIONS = new Set([
  'css',
  'csv',
  'diff',
  'go',
  'html',
  'ini',
  'js',
  'json',
  'jsx',
  'log',
  'markdown',
  'md',
  'mdx',
  'patch',
  'py',
  'rs',
  'sh',
  'sql',
  'svg',
  'toml',
  'ts',
  'tsv',
  'tsx',
  'txt',
  'xml',
  'yaml',
  'yml',
])

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

export function classifyFile(file: File): AttachmentKind | null {
  if (file.type.startsWith('image/') && file.type !== 'image/svg+xml')
    return 'image'
  if (file.type.startsWith('text/') || TEXT_MIME_TYPES.has(file.type))
    return 'text'
  if (TEXT_EXTENSIONS.has(extensionOf(file.name))) return 'text'
  return null
}

function uniquePath(name: string, taken: Set<string>) {
  const safe = name.replaceAll(/[\\/]/g, '_') || 'file'
  const dot = safe.lastIndexOf('.')
  const stem = dot > 0 ? safe.slice(0, dot) : safe
  const ext = dot > 0 ? safe.slice(dot) : ''
  let path = `${AGENT_ATTACHMENTS_DIR}${safe}`
  for (let n = 2; taken.has(path); n++) {
    path = `${AGENT_ATTACHMENTS_DIR}${stem}-${n}${ext}`
  }
  taken.add(path)
  return path
}

export function toAgentAttachments(attachments: ComposerAttachment[]) {
  const images: AgentToolImage[] = []
  const files: AgentFileSnapshot[] = []
  const taken = new Set<string>()
  for (const attachment of attachments) {
    if (attachment.status !== 'ready') continue
    if (attachment.kind === 'image' && attachment.url) {
      images.push({ mimeType: attachment.mimeType, url: attachment.url })
    } else if (attachment.kind === 'text' && attachment.content !== undefined) {
      files.push({
        attach: true,
        content: attachment.content,
        path: uniquePath(attachment.name, taken),
      })
    }
  }
  return { files, images }
}

export function toBubbleAttachments(
  attachments: ComposerAttachment[],
): ChatAttachment[] {
  return attachments.flatMap((attachment): ChatAttachment[] => {
    if (attachment.status !== 'ready') return []
    if (attachment.kind === 'image')
      return attachment.url
        ? [{ kind: 'image', name: attachment.name, url: attachment.url }]
        : []
    return [{ kind: 'file', name: attachment.name, size: attachment.size }]
  })
}
