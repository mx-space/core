import { describe, expect, it, vi } from 'vitest'

import {
  createTranslationTools,
  TRANSLATION_FILE,
} from '~/modules/ai/ai-translation/engine/translation-tools'
import type { TranslationUnit } from '~/modules/ai/ai-translation/translation-unit.types'
import { VirtualFs } from '~/modules/ai/message-engine/vfs/virtual-fs'

const units: TranslationUnit[] = [
  { id: 'text:p1', payload: '你好', meta: 'text' },
  {
    id: '__inline_group___0',
    payload: {
      type: 'text.group',
      segments: [
        { id: 'text:g1', text: '甲' },
        { id: 'text:g2', text: '乙' },
      ],
    },
    meta: 'text.group',
    memberIds: ['text:g1', 'text:g2'],
  },
]

const reviewerStub = (outputs: Array<{ issues: unknown[] }>) => {
  let call = 0
  return {
    providerInfo: { id: 'stub', type: 'openai-compatible', model: 'stub' },
    generateText: vi.fn(),
    generateStructured: vi.fn(async () => ({
      output: outputs[Math.min(call++, outputs.length - 1)],
    })),
  } as any
}

const setup = (
  opts: Partial<Parameters<typeof createTranslationTools>[0]> = {},
) => {
  const vfs = new VirtualFs()
  const created = createTranslationTools({
    vfs,
    units,
    targetLang: 'ja',
    ...opts,
  })
  const byName = Object.fromEntries(created.tools.map((t) => [t.name, t]))
  return { vfs, byName, state: created.state }
}

describe('write_translation', () => {
  it('flattens groups, reports missing, captures sourceLang', async () => {
    const onSegments = vi.fn(async () => {})
    const { vfs, byName, state } = setup({ onSegments })
    const result = await byName.write_translation.execute({
      sourceLang: 'zh',
      translations: {
        'text:p1': 'こんにちは',
        __inline_group___0: { 'text:g1': 'A', 'text:g2': 'B' },
      },
    })
    expect(state.sourceLang).toBe('zh')
    expect(state.firstWriteAt).not.toBeNull()
    expect(JSON.parse(result.content)).toEqual({
      written: ['text:p1', 'text:g1', 'text:g2'],
      missing: [],
    })
    expect(vfs.read(TRANSLATION_FILE)).toEqual({
      'text:p1': 'こんにちは',
      'text:g1': 'A',
      'text:g2': 'B',
    })
    expect(onSegments).toHaveBeenCalledWith({
      'text:p1': 'こんにちは',
      'text:g1': 'A',
      'text:g2': 'B',
    })
  })

  it('rejects partial group coverage and reports member ids as missing', async () => {
    const { byName } = setup()
    const result = await byName.write_translation.execute({
      sourceLang: 'zh',
      translations: {
        'text:p1': 'こんにちは',
        __inline_group___0: { 'text:g1': 'A' },
      },
    })
    expect(JSON.parse(result.content)).toEqual({
      written: ['text:p1'],
      missing: ['text:g1', 'text:g2'],
    })
  })
})

describe('patch_translation', () => {
  const seed = async (byName: any) => {
    await byName.write_translation.execute({
      sourceLang: 'zh',
      translations: {
        'text:p1': '内部循環という言葉と内部の話',
        __inline_group___0: { 'text:g1': 'A', 'text:g2': 'B' },
      },
    })
  }

  it('applies unique find/replace and records state', async () => {
    const { byName, state } = setup()
    await seed(byName)
    const result = await byName.patch_translation.execute({
      edits: [{ id: 'text:p1', find: '内部循環', replace: '内輪で回る' }],
    })
    expect(JSON.parse(result.content)).toEqual({
      applied: ['text:p1'],
      failed: [],
    })
    expect(state.patchesApplied[0]).toEqual({
      id: 'text:p1',
      before: '内部循環という言葉と内部の話',
      after: '内輪で回るという言葉と内部の話',
    })
  })

  it('reports ambiguous and not-found finds; whole-segment replace works without find', async () => {
    const { byName, state } = setup()
    await seed(byName)
    const result = await byName.patch_translation.execute({
      edits: [
        { id: 'text:p1', find: '内部', replace: 'X' },
        { id: 'text:p1', find: '不存在', replace: 'X' },
        { id: 'text:g1', replace: '全置換' },
        { id: 'ghost', replace: 'X' },
      ],
    })
    expect(JSON.parse(result.content)).toEqual({
      applied: ['text:g1'],
      failed: [
        { id: 'text:p1', reason: 'find-ambiguous' },
        { id: 'text:p1', reason: 'find-not-found' },
        { id: 'ghost', reason: 'missing-key' },
      ],
    })
    expect(state.patchKeysDropped).toEqual(['text:p1', 'text:p1', 'ghost'])
  })
})

describe('request_review', () => {
  it('first call is monolingual, second bilingual; issues filtered to allowed ids', async () => {
    const runtime = reviewerStub([
      {
        issues: [
          { id: 'text:p1', severity: 'minor', problem: 'p', hint: 'h' },
          { id: 'ghost', severity: 'minor', problem: 'x' },
        ],
      },
      { issues: [] },
    ])
    const { byName, state } = setup({
      reviewer: { runtime, systemPrompt: 'REV' },
      styleHints: 'ARTICLE_TYPE: note',
    })
    await byName.write_translation.execute({
      sourceLang: 'zh',
      translations: {
        'text:p1': '訳',
        __inline_group___0: { 'text:g1': 'A', 'text:g2': 'B' },
      },
    })
    const first = await byName.request_review.execute({})
    expect(JSON.parse(first.content).issues).toEqual([
      { id: 'text:p1', severity: 'minor', problem: 'p', hint: 'h' },
    ])
    const firstPrompt = runtime.generateStructured.mock.calls[0][0].prompt
    expect(firstPrompt).not.toContain('"source"')
    expect(firstPrompt).toContain('"target"')

    await byName.request_review.execute({})
    const secondPrompt = runtime.generateStructured.mock.calls[1][0].prompt
    expect(secondPrompt).toContain('"source"')
    expect(state.reviewRounds).toBe(2)
    expect(state.lastIssues).toEqual([])
  })

  it('windows large files at 60 segments per sub-agent call', async () => {
    const manyUnits: TranslationUnit[] = Array.from({ length: 65 }, (_, i) => ({
      id: `text:p${i}`,
      payload: `源${i}`,
      meta: 'text',
    }))
    const vfs = new VirtualFs()
    const runtime = reviewerStub([{ issues: [] }])
    const { tools } = createTranslationTools({
      vfs,
      units: manyUnits,
      targetLang: 'ja',
      reviewer: { runtime, systemPrompt: 'REV' },
    })
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]))
    await byName.write_translation.execute({
      sourceLang: 'zh',
      translations: Object.fromEntries(
        manyUnits.map((u) => [u.id, `訳${u.id}`]),
      ),
    })
    await byName.request_review.execute({})
    expect(runtime.generateStructured).toHaveBeenCalledTimes(2)
    const promptLines: string[] =
      runtime.generateStructured.mock.calls[0][0].prompt.split('\n')
    const allowedLine =
      promptLines[
        promptLines.findIndex((line) => line.startsWith('## ALLOWED_IDS')) + 1
      ]
    expect(JSON.parse(allowedLine)).toHaveLength(60)
  })

  it('accepts caller-defined review windows for chunk-aligned review', async () => {
    const manyUnits: TranslationUnit[] = Array.from({ length: 5 }, (_, i) => ({
      id: `text:p${i}`,
      payload: `源${i}`,
      meta: 'text',
    }))
    const vfs = new VirtualFs()
    const runtime = reviewerStub([{ issues: [] }])
    const { tools } = createTranslationTools({
      vfs,
      units: manyUnits,
      targetLang: 'ja',
      reviewer: { runtime, systemPrompt: 'REV' },
      reviewWindows: [
        ['text:p0', 'text:p1'],
        ['text:p2', 'text:p3', 'text:p4'],
      ],
    })
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]))
    await byName.write_translation.execute({
      sourceLang: 'zh',
      translations: Object.fromEntries(
        manyUnits.map((unit) => [unit.id, `訳${unit.id}`]),
      ),
    })

    await byName.request_review.execute({})

    expect(runtime.generateStructured).toHaveBeenCalledTimes(2)
    const allowedIds = runtime.generateStructured.mock.calls.map((call) => {
      const lines: string[] = call[0].prompt.split('\n')
      return JSON.parse(
        lines[lines.findIndex((line) => line.startsWith('## ALLOWED_IDS')) + 1],
      )
    })
    expect(allowedIds).toEqual([
      ['text:p0', 'text:p1'],
      ['text:p2', 'text:p3', 'text:p4'],
    ])
  })

  it('retries a failed window once and succeeds on the second attempt', async () => {
    const runtime = reviewerStub([{ issues: [] }])
    let calls = 0
    const inner = runtime.generateStructured
    runtime.generateStructured = vi.fn(async (opts: any) => {
      if (++calls === 1) throw new Error('degenerate output')
      return inner(opts)
    })
    const { byName, state } = setup({
      reviewer: { runtime, systemPrompt: 'REV' },
    })
    await byName.write_translation.execute({
      sourceLang: 'zh',
      translations: {
        'text:p1': '訳',
        __inline_group___0: { 'text:g1': 'A', 'text:g2': 'B' },
      },
    })
    const result = await byName.request_review.execute({})
    expect(result.isError).toBeUndefined()
    expect(JSON.parse(result.content)).toEqual({ issues: [] })
    expect(state.reviewerFailed).toBe(false)
    expect(runtime.generateStructured).toHaveBeenCalledTimes(2)
  })

  it('all windows failing yields an error result and sets reviewerFailed', async () => {
    const runtime = reviewerStub([{ issues: [] }])
    runtime.generateStructured = vi.fn(async () => {
      throw new Error('down')
    })
    const { byName, state } = setup({
      reviewer: { runtime, systemPrompt: 'REV' },
    })
    await byName.write_translation.execute({
      sourceLang: 'zh',
      translations: {
        'text:p1': '訳',
        __inline_group___0: { 'text:g1': 'A', 'text:g2': 'B' },
      },
    })
    const result = await byName.request_review.execute({})
    expect(result.isError).toBe(true)
    expect(state.reviewerFailed).toBe(true)
  })

  it('is absent when no reviewer spec is provided', () => {
    const { byName } = setup()
    expect(byName.request_review).toBeUndefined()
  })
})
