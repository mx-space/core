import {
  deserializeMxLitexmlToLexical,
  serializeMxLexicalToLitexml,
} from '@mx-space/editor'
import { describe, expect, it } from 'vitest'

import {
  applyPatchBlocks,
  findDroppedReplacements,
  parsePatchBlocks,
  PatchError,
} from '../../../src/cli/draft/collab/patch'

const doc = `<doc>
  <h2 id="h1">背景</h2>
  <p id="p1">价格是 $5/月，A&amp;B 两个方案任选，年付再打 8 折。</p>
  <p id="p2">整个过程大约花了 &quot;两个周末&quot;。</p>
  <p id="p3">重复的一句。</p>
  <p id="p4">重复的一句。</p>
</doc>`

const block = (search: string, replace: string) =>
  `<<<<<<< SEARCH\n${search}\n=======\n${replace}\n>>>>>>> REPLACE`

const roundTrip = (xml: string) =>
  serializeMxLexicalToLitexml(deserializeMxLitexmlToLexical(xml) as never, {
    compact: false,
  })

describe('parsePatchBlocks', () => {
  it('reads several blocks in order', () => {
    const blocks = parsePatchBlocks(
      `${block('a', 'b')}\n\n${block('c\nd', 'e')}\n`,
    )
    expect(blocks).toEqual([
      { search: 'a', replace: 'b' },
      { search: 'c\nd', replace: 'e' },
    ])
  })

  it('accepts an empty REPLACE as a deletion', () => {
    expect(parsePatchBlocks(block('a', '').replace('\n\n>>>', '\n>>>'))).toEqual(
      [{ search: 'a', replace: '' }],
    )
  })

  it('normalizes CRLF input', () => {
    expect(parsePatchBlocks(block('a', 'b').replaceAll('\n', '\r\n'))).toEqual([
      { search: 'a', replace: 'b' },
    ])
  })

  it('rejects input without blocks', () => {
    expect(() => parsePatchBlocks('just text')).toThrow(PatchError)
  })

  it('rejects an unterminated block', () => {
    expect(() =>
      parsePatchBlocks('<<<<<<< SEARCH\na\n=======\nb\n'),
    ).toThrow(/unterminated|REPLACE/)
  })
})

describe('applyPatchBlocks', () => {
  it('matches SEARCH text retyped with raw quotes and ampersands', () => {
    const out = applyPatchBlocks(
      doc,
      parsePatchBlocks(
        block(
          '<p id="p2">整个过程大约花了 "两个周末"。</p>',
          '<p id="p2">花了两个周末。</p>',
        ),
      ),
    )
    expect(out).toContain('<p id="p2">花了两个周末。</p>')
  })

  it('escapes raw ampersands in REPLACE text', () => {
    const out = applyPatchBlocks(
      doc,
      parsePatchBlocks(block('<p id="p3">', '<p id="p3">A&B ')),
    )
    expect(out).toContain('<p id="p3">A&amp;B 重复的一句。</p>')
  })

  it('replaces literal text containing regex and xml specials', () => {
    const out = applyPatchBlocks(doc, [
      {
        search: '<p id="p1">价格是 $5/月，A&amp;B 两个方案任选，年付再打 8 折。</p>',
        replace: '<p id="p1">$5/月，A&amp;B 任选，年付 8 折。</p>',
      },
    ])
    expect(out).toContain('<p id="p1">$5/月，A&amp;B 任选，年付 8 折。</p>')
    expect(out).toContain('<p id="p2">')
  })

  it('matches when the agent dropped the leading indentation', () => {
    const out = applyPatchBlocks(doc, [
      {
        search: '<h2 id="h1">背景</h2>\n<p id="p1">价格是 $5/月，A&amp;B 两个方案任选，年付再打 8 折。</p>',
        replace: '<h2 id="h1">背景</h2>\n<p id="p1">新</p>',
      },
    ])
    expect(out).toContain('<p id="p1">新</p>')
    expect(out).not.toContain('价格是')
  })

  it('applies blocks in sequence, each seeing the previous result', () => {
    const out = applyPatchBlocks(doc, [
      { search: '背景', replace: '起因' },
      { search: '<h2 id="h1">起因</h2>', replace: '<h2 id="h1">起因与动机</h2>' },
    ])
    expect(out).toContain('起因与动机')
  })

  it('fails with the current block content when SEARCH no longer matches', () => {
    const error = catchPatch(() =>
      applyPatchBlocks(doc, [
        { search: '<p id="p2">整个过程大约花了 &quot;一个周末&quot;。</p>', replace: 'x' },
      ]),
    )
    expect(error.reason).toBe('not-found')
    expect(error.blockIndex).toBe(0)
    expect(error.message).toContain('<p id="p2">整个过程大约花了 &quot;两个周末&quot;。</p>')
  })

  it('says the block is gone when its id no longer exists', () => {
    const error = catchPatch(() =>
      applyPatchBlocks(doc, [{ search: '<p id="gone">x</p>', replace: 'y' }]),
    )
    expect(error.message).toMatch(/gone.*no longer exists/)
  })

  it('refuses an ambiguous SEARCH', () => {
    const error = catchPatch(() =>
      applyPatchBlocks(doc, [{ search: '重复的一句。', replace: 'x' }]),
    )
    expect(error.reason).toBe('ambiguous')
    expect(error.message).toMatch(/2 places/)
  })

  it('is all-or-nothing: a later failing block leaves the input untouched', () => {
    const input = doc
    expect(() =>
      applyPatchBlocks(input, [
        { search: '背景', replace: '起因' },
        { search: 'missing', replace: 'x' },
      ]),
    ).toThrow(PatchError)
    expect(input).toBe(doc)
  })

  it('reports the 1-based block number in the message', () => {
    const error = catchPatch(() =>
      applyPatchBlocks(doc, [
        { search: '背景', replace: '起因' },
        { search: 'missing', replace: 'x' },
      ]),
    )
    expect(error.blockIndex).toBe(1)
    expect(error.message).toMatch(/^block 2:/)
  })
})

describe('findDroppedReplacements', () => {
  it('accepts replacements the serializer keeps', () => {
    const blocks = [
      { search: '', replace: '<p id="p1">新 <b>加粗</b> 与 &quot;引号&quot;</p>' },
      { search: '', replace: '<p>没有 id 的新段落</p>' },
    ]
    const rendered = roundTrip(
      `<doc><p id="p1">新 <b>加粗</b> 与 &quot;引号&quot;</p><p>没有 id 的新段落</p></doc>`,
    )
    expect(findDroppedReplacements(blocks, rendered)).toEqual([])
  })

  it('names a tag the serializer dropped', () => {
    const blocks = [{ search: '', replace: '<p id="p1">a <blink>b</blink></p>' }]
    const rendered = roundTrip('<doc><p id="p1">a <blink>b</blink></p></doc>')
    expect(findDroppedReplacements(blocks, rendered)).toEqual([
      'block 1: <blink>',
    ])
  })

  it('accepts meta lines the renderer puts in a different order', () => {
    const blocks = [
      {
        search: '<title>t</title>',
        replace: '<title>t</title>\n<summary>摘要</summary>',
      },
    ]
    const rendered = [
      '<mxpost>',
      '  <meta>',
      '    <title>t</title>',
      '    <slug>s</slug>',
      '    <summary>摘要</summary>',
      '  </meta>',
      '</mxpost>',
    ].join('\n')
    expect(findDroppedReplacements(blocks, rendered)).toEqual([])
  })

  it('still flags a block whose text the renderer lost', () => {
    const blocks = [
      { search: '', replace: '<title>t</title>\n<p id="p1">保留</p>' },
    ]
    const rendered = '<title>t</title>\n<p id="p1"></p>'
    expect(findDroppedReplacements(blocks, rendered)).toEqual(['block 1'])
  })

  it.each([
    ['a raw ampersand', '<p id="p1">A&B 方案 &gt; 旧方案</p>'],
    ['a line break', '<p id="p1">上一行<br>下一行</p>'],
    ['attributes in another order', '<p id="p1"><a title="t" href="https://x.dev">链接</a></p>'],
    ['nested marks in another order', '<p id="p1"><i><b>粗斜</b></i></p>'],
    ['strong and em', '<p id="p1"><strong>粗</strong> <em>斜</em></p>'],
    ['adjacent marks the serializer merges', '<p id="p1"><b>a</b><b>b</b></p>'],
  ])('accepts %s', (_, replace) => {
    const rendered = roundTrip(`<doc>${replace.replaceAll(/&(?!(?:gt|lt|amp|quot|apos);)/g, '&amp;')}</doc>`)
    expect(findDroppedReplacements([{ search: '', replace }], rendered)).toEqual([])
  })

  it('ignores deletions', () => {
    expect(findDroppedReplacements([{ search: 'x', replace: '' }], '<doc></doc>')).toEqual([])
  })
})

function catchPatch(fn: () => unknown): PatchError {
  try {
    fn()
  } catch (error) {
    if (error instanceof PatchError) return error
    throw error
  }
  throw new Error('expected a PatchError')
}
