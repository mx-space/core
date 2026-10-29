import { describe, expect, it } from 'vitest'

import { CommentAnchorMode } from '~/modules/comment/comment.enum'
import { CommentAnchorSchema } from '~/modules/comment/comment.schema'

const blockAnchor = (lang: string | null) => ({
  mode: CommentAnchorMode.Block,
  blockId: 'block-1',
  lang,
})

describe('CommentAnchorSchema lang', () => {
  it('canonicalizes the anchor language', () => {
    expect(CommentAnchorSchema.parse(blockAnchor('en')).lang).toBe('en-US')
    expect(CommentAnchorSchema.parse(blockAnchor('zh_TW')).lang).toBe('zh-TW')
  })

  it('drops an unusable language instead of rejecting the comment', () => {
    expect(CommentAnchorSchema.parse(blockAnchor('jp')).lang).toBeNull()
    expect(CommentAnchorSchema.parse(blockAnchor(null)).lang).toBeNull()
  })
})
