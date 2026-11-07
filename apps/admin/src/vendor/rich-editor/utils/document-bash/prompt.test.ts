import { describe, expect, it } from 'vitest'

import { buildDocumentBashSystemMessages } from './prompt'

const text = (shared: boolean) =>
  buildDocumentBashSystemMessages({ shared })
    .map((message) => ('content' in message ? message.content : ''))
    .join('\n')

describe('buildDocumentBashSystemMessages', () => {
  it('describes reviewable proposals for a private draft', () => {
    expect(text(false)).toContain('/review.xml')
  })

  it('describes direct, shared edits for a collaborative document', () => {
    const prompt = text(true)
    expect(prompt).not.toContain('/review.xml')
    expect(prompt).not.toContain('propos')
    expect(prompt).toContain('immediately')
    expect(prompt).toMatch(/other people/i)
  })

  it('explains embedded files under /embeds', () => {
    const prompt = text(false)
    expect(prompt).toContain('/embeds/')
    expect(prompt).toContain('view /embeds/')
    expect(prompt).toContain('excalidraw-editing')
    expect(prompt).toContain('.meta.json')
  })
})
