import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildTtsObjectKey,
  computeTtsObjectFingerprint,
  resolveTtsObjectKeyPrefix,
} from '~/modules/ai/ai-tts/tts-object-key'

const base = {
  refId: '123',
  lang: 'zh',
  blockId: 'blk-a',
  chunkIndex: 0,
  fingerprint: 'abcdef1234567890',
}

describe('buildTtsObjectKey', () => {
  it('builds a content-addressed key', () => {
    expect(buildTtsObjectKey(base)).toBe('tts/123/zh/blk-a-0-abcdef123456.mp3')
  })

  it('applies the storage prefix without doubling slashes', () => {
    expect(buildTtsObjectKey({ ...base, prefix: 'media/' })).toBe(
      'media/tts/123/zh/blk-a-0-abcdef123456.mp3',
    )
  })

  it('changes the key when the fingerprint changes', () => {
    expect(
      buildTtsObjectKey({ ...base, fingerprint: 'ffffff0000001111' }),
    ).not.toBe(buildTtsObjectKey(base))
  })

  it('uses the selected audio container extension', () => {
    expect(buildTtsObjectKey({ ...base, format: 'wav' })).toBe(
      'tts/123/zh/blk-a-0-abcdef123456.wav',
    )
  })

  it('sanitizes path separators out of the block id', () => {
    expect(buildTtsObjectKey({ ...base, blockId: '../escape' })).toBe(
      'tts/123/zh/--escape-0-abcdef123456.mp3',
    )
  })
})

describe('resolveTtsObjectKeyPrefix', () => {
  afterEach(() => vi.useRealTimers())

  it('expands the configured storage date and file-type placeholders once', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 22, 12, 30, 0))

    expect(resolveTtsObjectKeyPrefix('mx-space/{Y}/{m}{d}/{type}')).toBe(
      'mx-space/2026/0822/audio',
    )
  })
})

describe('computeTtsObjectFingerprint', () => {
  const voice = { model: 'tts-1', voice: 'alloy', speed: 1 }

  it('is stable for the same text and voice config', () => {
    expect(computeTtsObjectFingerprint('fp', voice)).toBe(
      computeTtsObjectFingerprint('fp', voice),
    )
  })

  it('changes when any part of the voice config changes', () => {
    const baseline = computeTtsObjectFingerprint('fp', voice)

    expect(
      computeTtsObjectFingerprint('fp', { ...voice, voice: 'nova' }),
    ).not.toBe(baseline)
    expect(
      computeTtsObjectFingerprint('fp', { ...voice, model: 'tts-2' }),
    ).not.toBe(baseline)
    expect(
      computeTtsObjectFingerprint('fp', { ...voice, speed: 1.25 }),
    ).not.toBe(baseline)
  })

  it('changes when the speech fingerprint changes', () => {
    expect(computeTtsObjectFingerprint('other', voice)).not.toBe(
      computeTtsObjectFingerprint('fp', voice),
    )
  })

  it('changes when the synthesis profile changes', () => {
    expect(computeTtsObjectFingerprint('fp', voice, 'auto:v1')).not.toBe(
      computeTtsObjectFingerprint('fp', voice, 'openrouter-xai-language:v1:ja'),
    )
  })
})
