import { describe, expect, it } from 'vitest'

import {
  applyFieldsPatch,
  diffDraftFields,
  splitSecretFields,
  withLocalSecrets,
} from './draft-fields'

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

describe('splitSecretFields', () => {
  it('keeps secrets out of the document patch', () => {
    expect(
      splitSecretFields({
        meta: { cover: 'c' },
        typeSpecificData: { password: 'p', slug: 's' },
      }),
    ).toEqual({
      document: { meta: { cover: 'c' }, typeSpecificData: { slug: 's' } },
      secret: { typeSpecificData: { password: 'p' } },
    })
  })

  it('returns null for a side with nothing in it', () => {
    expect(splitSecretFields({ typeSpecificData: { slug: 's' } })).toEqual({
      document: { typeSpecificData: { slug: 's' } },
      secret: null,
    })
    expect(splitSecretFields({ typeSpecificData: { password: null } })).toEqual(
      { document: null, secret: { typeSpecificData: { password: null } } },
    )
  })
})

describe('withLocalSecrets', () => {
  it('takes document fields and keeps the local secrets', () => {
    expect(
      withLocalSecrets(
        { meta: null, typeSpecificData: { slug: 'remote' } },
        { meta: { x: 1 }, typeSpecificData: { password: 'p', slug: 'local' } },
      ),
    ).toEqual({
      meta: null,
      typeSpecificData: { password: 'p', slug: 'remote' },
    })
  })

  it('drops a secret the local side no longer has', () => {
    expect(
      withLocalSecrets(
        { meta: null, typeSpecificData: { password: 'old', slug: 's' } },
        { meta: null, typeSpecificData: { slug: 's' } },
      ),
    ).toEqual({ meta: null, typeSpecificData: { slug: 's' } })
  })
})

describe('applyFieldsPatch', () => {
  it('sets and clears only the patched keys', () => {
    expect(
      applyFieldsPatch(
        { meta: { a: 1 }, typeSpecificData: { slug: 'local', summary: 'x' } },
        { meta: { a: null }, typeSpecificData: { slug: 'remote' } },
      ),
    ).toEqual({
      meta: {},
      typeSpecificData: { slug: 'remote', summary: 'x' },
    })
  })
})
