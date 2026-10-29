import { describe, expect, it } from 'vitest'

import {
  DraftFieldsSchema,
  DraftWriteDataSchema,
} from '~/modules/draft/draft.schema'
import { WriteBaseSchema } from '~/shared/schema/write-base.schema'

const base = { title: 'T', text: 'x' }

describe('meta.lang on write', () => {
  it('canonicalizes meta.lang', () => {
    expect(
      WriteBaseSchema.parse({ ...base, meta: { lang: 'zh', mood: 'ok' } }).meta,
    ).toEqual({ lang: 'zh-CN', mood: 'ok' })
    expect(
      DraftWriteDataSchema.parse({ meta: { lang: 'zh_TW' } }).meta,
    ).toEqual({ lang: 'zh-TW' })
    expect(DraftFieldsSchema.parse({ meta: { lang: 'ja' } }).meta).toEqual({
      lang: 'ja-JP',
    })
  })

  it('rejects an unknown meta.lang', () => {
    expect(() =>
      WriteBaseSchema.parse({ ...base, meta: { lang: 'jp' } }),
    ).toThrow()
    expect(() =>
      DraftWriteDataSchema.parse({ meta: { lang: 'english' } }),
    ).toThrow()
  })

  it('clears an empty meta.lang and keeps meta without one', () => {
    expect(WriteBaseSchema.parse({ ...base, meta: { lang: '' } }).meta).toEqual(
      {},
    )
    expect(WriteBaseSchema.parse({ ...base, meta: { a: 1 } }).meta).toEqual({
      a: 1,
    })
    expect(WriteBaseSchema.parse(base).meta).toBeNull()
  })
})
