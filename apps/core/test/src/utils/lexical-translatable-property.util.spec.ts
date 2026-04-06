import { extractLexicalTranslatableProperties } from '~/utils/lexical-translatable-property.util'

describe('lexical-translatable-property.util', () => {
  it('extracts properties only from whitelisted lexical node attributes', () => {
    expect(
      extractLexicalTranslatableProperties({
        type: 'details',
        summary: 'Expand me',
      }),
    ).toEqual([{ property: 'summary', text: 'Expand me' }])

    expect(
      extractLexicalTranslatableProperties({
        type: 'footnote-section',
        definitions: { a: 'Alpha', b: 'Beta', c: '' },
      }),
    ).toEqual([
      { property: 'definitions', key: 'a', text: 'Alpha' },
      { property: 'definitions', key: 'b', text: 'Beta' },
    ])

    expect(
      extractLexicalTranslatableProperties({
        type: 'ruby',
        reading: 'かんじ',
      }),
    ).toEqual([{ property: 'reading', text: 'かんじ' }])
  })

  it('ignores non-whitelisted lexical attributes', () => {
    expect(
      extractLexicalTranslatableProperties({
        type: 'link',
        title: 'Title',
        url: 'https://example.com',
      }),
    ).toEqual([])

    expect(
      extractLexicalTranslatableProperties({
        type: 'details',
        summary: '   ',
      }),
    ).toEqual([])
  })
})
