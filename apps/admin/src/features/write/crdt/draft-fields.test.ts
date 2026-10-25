import { describe, expect, it } from 'vitest'

import { diffDraftFields } from './draft-fields'

describe('diffDraftFields', () => {
  it('returns null when nothing changed', () => {
    const fields = { meta: { a: 1 }, typeSpecificData: { tags: ['x'] } }

    expect(diffDraftFields(fields, structuredClone(fields))).toBeNull()
  })

  it('sends only changed keys, per section', () => {
    expect(
      diffDraftFields(
        { meta: { a: 1, b: 2 }, typeSpecificData: { slug: 's', tags: ['x'] } },
        { meta: { a: 1, b: 3 }, typeSpecificData: { slug: 's', tags: ['x'] } },
      ),
    ).toEqual({ meta: { b: 3 } })
  })

  it('clears a removed key with null', () => {
    expect(
      diffDraftFields(
        { meta: null, typeSpecificData: { password: 'p', slug: 's' } },
        { meta: null, typeSpecificData: { slug: 's' } },
      ),
    ).toEqual({ typeSpecificData: { password: null } })
  })

  it('treats a missing section as empty', () => {
    expect(
      diffDraftFields(
        { meta: null, typeSpecificData: null },
        { meta: { cover: 'c' }, typeSpecificData: null },
      ),
    ).toEqual({ meta: { cover: 'c' } })
  })
})
