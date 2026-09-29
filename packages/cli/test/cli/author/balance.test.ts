import { describe, expect, it } from 'vitest'

import { unbalancedTag } from '../../../src/cli/author/balance'

describe('unbalancedTag', () => {
  it('accepts well-formed LiteXML with void, self-closing, CDATA and comments', () => {
    expect(
      unbalancedTag(
        '<h2 id="a">T</h2><p>a<br>b<img src="x" /></p><hr><!-- <p> --><mermaid><![CDATA[a --> <b>]]></mermaid>',
      ),
    ).toBeNull()
  })

  it('reports a mismatched closing tag', () => {
    expect(unbalancedTag('<h2>Title</h3><p>x</p>')).toMatch(/<\/h3>.*<h2>/)
  })

  it('reports an unclosed tag', () => {
    expect(unbalancedTag('<p>x</p><ul><li>a</li>')).toMatch(/<ul>/)
  })

  it('reports a stray closing tag', () => {
    expect(unbalancedTag('<p>x</p></div>')).toMatch(/<\/div>/)
  })
})
