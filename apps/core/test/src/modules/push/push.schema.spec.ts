import { describe, expect, it } from 'vitest'

import {
  PushPreferencesPatchSchema,
  PushReaderPreferencesSchema,
} from '~/modules/push/push.schema'

describe('PushReaderPreferencesSchema', () => {
  const full = {
    contentPost: true,
    contentNote: true,
    contentRecently: false,
    commentReplied: true,
  }

  it('accepts the four camelCase booleans', () => {
    expect(PushReaderPreferencesSchema.parse(full)).toEqual(full)
  })

  it('rejects extra keys and incomplete payloads', () => {
    expect(
      PushReaderPreferencesSchema.safeParse({
        ...full,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      PushReaderPreferencesSchema.safeParse({ contentPost: true }).success,
    ).toBe(false)
    expect(
      PushReaderPreferencesSchema.safeParse({
        content_post: true,
        content_note: true,
        content_recently: true,
        comment_replied: true,
      }).success,
    ).toBe(false)
  })
})

describe('PushPreferencesPatchSchema', () => {
  it('accepts a strict partial or a full preferences object', () => {
    expect(PushPreferencesPatchSchema.parse({ contentPost: false })).toEqual({
      contentPost: false,
    })
    expect(
      PushPreferencesPatchSchema.parse({
        contentPost: false,
        contentNote: true,
        contentRecently: true,
        commentReplied: false,
      }),
    ).toEqual({
      contentPost: false,
      contentNote: true,
      contentRecently: true,
      commentReplied: false,
    })
  })

  it('rejects undeclared keys and non-boolean values', () => {
    expect(
      PushPreferencesPatchSchema.safeParse({ content_post: false }).success,
    ).toBe(false)
    expect(
      PushPreferencesPatchSchema.safeParse({ contentPost: 'yes' }).success,
    ).toBe(false)
    expect(PushPreferencesPatchSchema.safeParse({ extra: true }).success).toBe(
      false,
    )
  })
})
