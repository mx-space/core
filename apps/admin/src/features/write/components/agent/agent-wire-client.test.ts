import { applyFilePatch, hashAgentText, hashAgentValue } from '@mx-space/ai'
import { describe, expect, it } from 'vitest'

import { createAgentWireClient } from './agent-wire-client'

const system = ['sys']
const tools = [{ description: 'd', name: 'bash', parameters: {} }]
const v1 = '<doc>\n  <p>one</p>\n</doc>'
const v2 = '<doc>\n  <p>two</p>\n</doc>'

describe('agent wire client: static context', () => {
  it('sends full content until the server has acknowledged it', async () => {
    const wire = createAgentWireClient()
    const first = await wire.encodeStatic(system, tools)
    expect(first).toEqual({
      system,
      systemHash: await hashAgentValue(system),
      tools,
      toolsHash: await hashAgentValue(tools),
    })
    expect(await wire.encodeStatic(system, tools)).toEqual(first)

    wire.commitStatic(first)
    expect(await wire.encodeStatic(system, tools)).toEqual({
      systemHash: first.systemHash,
      toolsHash: first.toolsHash,
    })
  })

  it('sends full content again after the server reports it missing', async () => {
    const wire = createAgentWireClient()
    wire.commitStatic(await wire.encodeStatic(system, tools))
    wire.forgetStatic()
    expect(await wire.encodeStatic(system, tools)).toMatchObject({
      system,
      tools,
    })
  })
})

describe('agent wire client: files', () => {
  it('sends full files for a conversation it has no baseline for', async () => {
    const wire = createAgentWireClient()
    expect(
      await wire.encodeFiles('c1', [{ content: v1, path: '/doc.xml' }]),
    ).toEqual([{ content: v1, path: '/doc.xml' }])
    expect(
      await wire.encodeFiles(null, [{ content: v1, path: '/doc.xml' }]),
    ).toEqual([{ content: v1, path: '/doc.xml' }])
  })

  it('sends a hash for unchanged files and a patch for changed ones after commit', async () => {
    const wire = createAgentWireClient()
    wire.commitFiles('c1', [
      { content: v1, path: '/doc.xml' },
      { attach: true, content: '', path: '/selection.xml' },
    ])
    const frames = await wire.encodeFiles('c1', [
      { content: v2, path: '/doc.xml' },
      { attach: true, content: '', path: '/selection.xml' },
    ])
    expect(frames[1]).toEqual({
      attach: true,
      hash: await hashAgentText(''),
      path: '/selection.xml',
    })
    const patchFrame = frames[0] as { baseHash: string; patch: string }
    expect(patchFrame.baseHash).toBe(await hashAgentText(v1))
    expect(applyFilePatch(v1, patchFrame.patch)).toBe(v2)
  })

  it('sends full content for the paths it is forced to', async () => {
    const wire = createAgentWireClient()
    wire.commitFiles('c1', [{ content: v1, path: '/doc.xml' }])
    expect(
      await wire.encodeFiles('c1', [{ content: v2, path: '/doc.xml' }], {
        full: new Set(['/doc.xml']),
      }),
    ).toEqual([{ content: v2, path: '/doc.xml' }])
  })

  it('forgets every baseline on reset', async () => {
    const wire = createAgentWireClient()
    wire.commitStatic(await wire.encodeStatic(system, tools))
    wire.commitFiles('c1', [{ content: v1, path: '/doc.xml' }])
    wire.reset()
    expect(
      await wire.encodeFiles('c1', [{ content: v1, path: '/doc.xml' }]),
    ).toEqual([{ content: v1, path: '/doc.xml' }])
    expect(await wire.encodeStatic(system, tools)).toMatchObject({ system })
  })
})
