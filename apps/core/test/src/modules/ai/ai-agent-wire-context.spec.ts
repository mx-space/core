import {
  type AgentToolSchema,
  createFilePatch,
  hashAgentText,
  hashAgentValue,
} from '@mx-space/ai'
import { describe, expect, it } from 'vitest'

import { createAgentWireContext } from '~/modules/ai/ai-agent/ai-agent-wire-context'

const system = ['You edit documents.']
const tools: AgentToolSchema[] = [
  { name: 'bash', description: 'Run bash', parameters: { type: 'object' } },
]

async function staticFrame(full: boolean) {
  return {
    systemHash: await hashAgentValue(system),
    toolsHash: await hashAgentValue(tools),
    ...(full ? { system, tools } : {}),
  }
}

describe('agent wire context: system and tools', () => {
  it('caches full content and resolves later hash-only frames to it', async () => {
    const wire = createAgentWireContext()
    expect(await wire.resolveStatic(await staticFrame(true))).toEqual({
      ok: true,
      value: { system, tools },
    })
    expect(await wire.resolveStatic(await staticFrame(false))).toEqual({
      ok: true,
      value: { system, tools },
    })
  })

  it('reports which parts are missing from the cache', async () => {
    const wire = createAgentWireContext()
    await wire.resolveStatic(await staticFrame(true))
    const otherTools = [{ ...tools[0], description: 'changed' }]
    expect(
      await wire.resolveStatic({
        systemHash: await hashAgentValue(system),
        toolsHash: await hashAgentValue(otherTools),
      }),
    ).toEqual({ ok: false, code: 'CONTEXT_MISSING', missing: ['tools'] })
    expect(
      await createAgentWireContext().resolveStatic(await staticFrame(false)),
    ).toEqual({
      ok: false,
      code: 'CONTEXT_MISSING',
      missing: ['system', 'tools'],
    })
  })

  it('rejects full content whose hash does not match', async () => {
    const wire = createAgentWireContext()
    expect(
      await wire.resolveStatic({
        systemHash: 'not-the-hash',
        system,
        toolsHash: await hashAgentValue(tools),
        tools,
      }),
    ).toEqual({ ok: false, code: 'VALIDATION_FAILED' })
  })
})

describe('agent wire context: files', () => {
  const v1 = '<doc>\n  <p>one</p>\n</doc>'
  const v2 = '<doc>\n  <p>two</p>\n</doc>'

  it('reconstructs patches and unchanged frames from the baseline', async () => {
    const wire = createAgentWireContext()
    expect(
      await wire.resolveFiles('c1', [
        { path: '/doc.xml', content: v1 },
        { path: '/selection.xml', attach: true, content: '' },
      ]),
    ).toEqual({
      ok: true,
      value: [
        { path: '/doc.xml', content: v1 },
        { path: '/selection.xml', attach: true, content: '' },
      ],
    })
    expect(
      await wire.resolveFiles('c1', [
        {
          path: '/doc.xml',
          baseHash: await hashAgentText(v1),
          patch: createFilePatch(v1, v2),
        },
        {
          path: '/selection.xml',
          attach: true,
          hash: await hashAgentText(''),
        },
      ]),
    ).toEqual({
      ok: true,
      value: [
        { path: '/doc.xml', content: v2 },
        { path: '/selection.xml', attach: true, content: '' },
      ],
    })
  })

  it('advances the baseline after a resolved patch', async () => {
    const wire = createAgentWireContext()
    await wire.resolveFiles('c1', [{ path: '/doc.xml', content: v1 }])
    await wire.resolveFiles('c1', [
      {
        path: '/doc.xml',
        baseHash: await hashAgentText(v1),
        patch: createFilePatch(v1, v2),
      },
    ])
    expect(
      await wire.resolveFiles('c1', [
        { path: '/doc.xml', hash: await hashAgentText(v2) },
      ]),
    ).toEqual({ ok: true, value: [{ path: '/doc.xml', content: v2 }] })
  })

  it('names every path whose baseline does not match', async () => {
    const wire = createAgentWireContext()
    await wire.resolveFiles('c1', [{ path: '/doc.xml', content: v1 }])
    expect(
      await wire.resolveFiles('c1', [
        {
          path: '/doc.xml',
          baseHash: await hashAgentText(v2),
          patch: createFilePatch(v2, v1),
        },
        { path: '/review.xml', hash: await hashAgentText('') },
      ]),
    ).toEqual({
      ok: false,
      code: 'FILE_BASE_MISMATCH',
      paths: ['/doc.xml', '/review.xml'],
    })
  })

  it('leaves the baseline untouched when a frame set is rejected', async () => {
    const wire = createAgentWireContext()
    await wire.resolveFiles('c1', [{ path: '/doc.xml', content: v1 }])
    await wire.resolveFiles('c1', [
      { path: '/doc.xml', content: v2 },
      { path: '/review.xml', hash: 'missing' },
    ])
    expect(
      await wire.resolveFiles('c1', [
        { path: '/doc.xml', hash: await hashAgentText(v1) },
      ]),
    ).toEqual({ ok: true, value: [{ path: '/doc.xml', content: v1 }] })
  })

  it('keeps baselines apart per conversation', async () => {
    const wire = createAgentWireContext()
    await wire.resolveFiles('c1', [{ path: '/doc.xml', content: v1 }])
    expect(
      await wire.resolveFiles('c2', [
        { path: '/doc.xml', hash: await hashAgentText(v1) },
      ]),
    ).toEqual({ ok: false, code: 'FILE_BASE_MISMATCH', paths: ['/doc.xml'] })
  })

  it('moves a baseline to a new conversation key', async () => {
    const wire = createAgentWireContext()
    await wire.resolveFiles('pending:run-1', [
      { path: '/doc.xml', content: v1 },
    ])
    wire.moveBaseline('pending:run-1', 'c1')
    expect(
      await wire.resolveFiles('c1', [
        { path: '/doc.xml', hash: await hashAgentText(v1) },
      ]),
    ).toEqual({ ok: true, value: [{ path: '/doc.xml', content: v1 }] })
  })
})
