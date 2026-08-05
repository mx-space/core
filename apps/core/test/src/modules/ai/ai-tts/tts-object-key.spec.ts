import { describe, expect, it } from 'vitest'

import { buildTtsObjectKey } from '~/modules/ai/ai-tts/tts-object-key'

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

  it('sanitizes path separators out of the block id', () => {
    expect(buildTtsObjectKey({ ...base, blockId: '../escape' })).toBe(
      'tts/123/zh/--escape-0-abcdef123456.mp3',
    )
  })
})
