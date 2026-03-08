import { describe, expect, it } from 'vitest'

import { PartialNoteSchema } from '~/modules/note/note.schema'
import { PartialPageSchema } from '~/modules/page/page.schema'
import { PartialPostSchema } from '~/modules/post/post.schema'

const DEFAULT_LEAK_FIELDS = [
  'title',
  'text',
  'contentFormat',
  'meta',
  'isPublished',
  'bookmark',
  'copyright',
  'images',
  'order',
]

function getLeakedDefaults(schema: any, input: Record<string, any>) {
  const result = schema.parse(input)
  return DEFAULT_LEAK_FIELDS.filter((f) => result[f] !== undefined)
}

describe('Partial schemas should not apply defaults for missing fields', () => {
  it('PartialNoteSchema - only topicId', () => {
    const leaked = getLeakedDefaults(PartialNoteSchema, {
      topicId: '507f1f77bcf86cd799439011',
    })
    expect(leaked).toEqual([])
  })

  it('PartialPostSchema - only categoryId', () => {
    const leaked = getLeakedDefaults(PartialPostSchema, {
      categoryId: '507f1f77bcf86cd799439011',
    })
    expect(leaked).toEqual([])
  })

  it('PartialPageSchema - only subtitle', () => {
    const leaked = getLeakedDefaults(PartialPageSchema, {
      subtitle: 'test',
    })
    expect(leaked).toEqual([])
  })

  it('PartialNoteSchema - provided fields should still be set', () => {
    const result = PartialNoteSchema.parse({
      title: 'my title',
      topicId: '507f1f77bcf86cd799439011',
    })
    expect(result.title).toBe('my title')
    expect(result.topicId).toBe('507f1f77bcf86cd799439011')
  })

  it('PartialNoteSchema - empty title should transform to 无题', () => {
    const result = PartialNoteSchema.parse({ title: '' })
    expect(result.title).toBe('无题')
  })
})
