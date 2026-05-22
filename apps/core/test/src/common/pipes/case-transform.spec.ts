import { camelKey, transformRequestCase } from '~/common/pipes/case-transform'

describe('camelKey', () => {
  test('camelizes snake_case identifiers', () => {
    expect(camelKey('sort_by')).toBe('sortBy')
    expect(camelKey('with_meta_json')).toBe('withMetaJson')
    expect(camelKey('a_b_c')).toBe('aBC')
  })

  test('leaves a string without underscore intact', () => {
    expect(camelKey('sortBy')).toBe('sortBy')
    expect(camelKey('value')).toBe('value')
  })

  test('preserves leading underscores', () => {
    expect(camelKey('__debug')).toBe('__debug')
    expect(camelKey('__api_url')).toBe('__apiUrl')
    expect(camelKey('_internal_value')).toBe('_internalValue')
  })

  test('leaves digit-only segments alone', () => {
    expect(camelKey('foo_1_bar')).toBe('foo1Bar')
  })
})

describe('transformRequestCase (deep)', () => {
  test('camelizes top-level keys', () => {
    expect(
      transformRequestCase({ sort_by: 'createdAt', sort_order: 'asc' }),
    ).toEqual({ sortBy: 'createdAt', sortOrder: 'asc' })
  })

  test('recurses into nested objects and arrays', () => {
    expect(
      transformRequestCase({
        outer_key: { inner_one: 1, inner_two: [{ leaf_key: 'x' }] },
      }),
    ).toEqual({
      outerKey: { innerOne: 1, innerTwo: [{ leafKey: 'x' }] },
    })
  })

  test('leaves primitive scalars alone', () => {
    expect(transformRequestCase(null)).toBe(null)
    expect(transformRequestCase(undefined)).toBe(undefined)
    expect(transformRequestCase(42)).toBe(42)
    expect(transformRequestCase('snake_case_value')).toBe('snake_case_value')
  })

  test('preserves pageproxy double-underscore prefixed keys', () => {
    expect(
      transformRequestCase({ __debug: true, __api_url: 'https://x' }),
    ).toEqual({ __debug: true, __apiUrl: 'https://x' })
  })
})

describe('transformRequestCase (shallow)', () => {
  test('camelizes only top-level keys when deep is false', () => {
    expect(
      transformRequestCase(
        { new_name: 'a', social_ids: { github_user: 'u' } },
        { deep: false },
      ),
    ).toEqual({
      newName: 'a',
      socialIds: { github_user: 'u' },
    })
  })
})
