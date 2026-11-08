import { describe, expect, it } from 'vitest'

import {
  classifyFile,
  type ComposerAttachment,
  toAgentAttachments,
  toBubbleAttachments,
} from './composer-attachments'

const file = (name: string, type: string) => new File(['x'], name, { type })

const ready = (overrides: Partial<ComposerAttachment>): ComposerAttachment => ({
  id: crypto.randomUUID(),
  kind: 'text',
  mimeType: 'text/markdown',
  name: 'a.md',
  progress: 100,
  size: 1,
  status: 'ready',
  ...overrides,
})

describe('classifyFile', () => {
  it('treats images as images', () => {
    expect(classifyFile(file('shot.png', 'image/png'))).toBe('image')
  })

  it('treats text-like files as text, by type or extension', () => {
    expect(classifyFile(file('notes.txt', 'text/plain'))).toBe('text')
    expect(classifyFile(file('data.json', 'application/json'))).toBe('text')
    expect(classifyFile(file('glossary.md', ''))).toBe('text')
  })

  it('rejects other binaries', () => {
    expect(classifyFile(file('report.pdf', 'application/pdf'))).toBeNull()
    expect(classifyFile(file('clip.mp4', 'video/mp4'))).toBeNull()
  })
})

describe('toAgentAttachments', () => {
  it('sends uploaded images by URL and text files as attached files', () => {
    expect(
      toAgentAttachments([
        ready({
          kind: 'image',
          mimeType: 'image/png',
          name: 'shot.png',
          url: 'https://cdn.test/shot.png',
        }),
        ready({ content: '# terms', name: 'glossary.md' }),
      ]),
    ).toEqual({
      files: [
        { attach: true, content: '# terms', path: '/attachments/glossary.md' },
      ],
      images: [{ mimeType: 'image/png', url: 'https://cdn.test/shot.png' }],
    })
  })

  it('gives files with the same name distinct paths', () => {
    const { files } = toAgentAttachments([
      ready({ content: 'one', name: 'a.md' }),
      ready({ content: 'two', name: 'a.md' }),
    ])

    expect(files.map((entry) => entry.path)).toEqual([
      '/attachments/a.md',
      '/attachments/a-2.md',
    ])
  })

  it('skips attachments that are not ready', () => {
    expect(
      toAgentAttachments([
        ready({ kind: 'image', status: 'uploading' }),
        ready({ status: 'error' }),
      ]),
    ).toEqual({ files: [], images: [] })
  })
})

describe('toBubbleAttachments', () => {
  it('keeps what the user bubble shows', () => {
    expect(
      toBubbleAttachments([
        ready({
          kind: 'image',
          name: 'shot.png',
          url: 'https://cdn.test/shot.png',
        }),
        ready({ name: 'glossary.md', size: 2048 }),
      ]),
    ).toEqual([
      { kind: 'image', name: 'shot.png', url: 'https://cdn.test/shot.png' },
      { kind: 'file', name: 'glossary.md', size: 2048 },
    ])
  })
})
