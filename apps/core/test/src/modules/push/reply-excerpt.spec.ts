import { describe, expect, it } from 'vitest'

import {
  projectReplyExcerpt,
  REPLY_EXCERPT_CODE,
  REPLY_EXCERPT_IMAGE,
} from '~/modules/push/reply-excerpt'

describe('projectReplyExcerpt', () => {
  it('replaces markdown and html images with the image sentinel', () => {
    expect(
      projectReplyExcerpt(
        'GPX 导入在做了 ![截图](https://a.b/c.png) 再看 <img src="https://a.b/d.png">',
      ),
    ).toBe(`GPX 导入在做了 ${REPLY_EXCERPT_IMAGE} 再看 ${REPLY_EXCERPT_IMAGE}`)
  })

  it('replaces fenced code with the code sentinel and keeps inline code text', () => {
    expect(
      projectReplyExcerpt(
        '试试 `pnpm i`：\n\n```bash\npnpm build\n```\n就好了',
      ),
    ).toBe(`试试 pnpm i： ${REPLY_EXCERPT_CODE} 就好了`)
  })

  it('keeps link text and drops the url', () => {
    expect(
      projectReplyExcerpt(
        '进度看[这里](https://github.com/innei/x)，或 https://innei.in',
      ),
    ).toBe('进度看这里，或 https://innei.in')
  })

  it('strips emphasis, headings and quotes and folds whitespace', () => {
    expect(
      projectReplyExcerpt(
        '> 引用一句\n\n## 标题\n**加粗** 和 _斜体_\n\n\n下一段',
      ),
    ).toBe('引用一句 标题 加粗 和 斜体 下一段')
  })

  it('keeps an image-only reply as the sentinel', () => {
    expect(projectReplyExcerpt('![](https://a.b/c.png)')).toBe(
      REPLY_EXCERPT_IMAGE,
    )
  })

  it('truncates to 100 graphemes without splitting emoji', () => {
    const excerpt = projectReplyExcerpt(`${'字'.repeat(99)}👨‍👩‍👧尾巴`)
    expect(excerpt).toBe(`${'字'.repeat(99)}👨‍👩‍👧…`)
  })

  it('stays within 160 UTF-16 units for wide graphemes', () => {
    const hindi = projectReplyExcerpt('नमस्ते दुनिया '.repeat(20))
    const thumbs = projectReplyExcerpt('👍🏻'.repeat(60))
    expect(hindi!.length).toBeLessThanOrEqual(160)
    expect(hindi!.endsWith('…')).toBe(true)
    expect(thumbs!.length).toBeLessThanOrEqual(160)
    expect(thumbs).toBe(`${'👍🏻'.repeat(39)}…`)
  })

  it('returns null for empty or non-string input', () => {
    expect(projectReplyExcerpt('  \n ')).toBeNull()
    expect(projectReplyExcerpt(undefined)).toBeNull()
  })
})
