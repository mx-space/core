import { describe, expect, it } from 'vitest'

import {
  parseLexicalForTranslation,
  restoreLexicalTranslation,
} from '~/modules/ai/ai-translation/lexical-translation-parser'

const lexicalDocument = {
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Hello world' }],
      },
    ],
  },
}

describe('lexical translation pipeline', () => {
  it('round-trips translated text through parser and restore without repository state', () => {
    const parsed = parseLexicalForTranslation(JSON.stringify(lexicalDocument))
    const segment = parsed.segments.find((item) => item.text === 'Hello world')

    expect(segment).toBeDefined()

    const restored = restoreLexicalTranslation(
      parsed,
      new Map([[segment!.id, '你好，世界']]),
    )

    expect(JSON.stringify(restored)).toContain('你好，世界')
  })
})
