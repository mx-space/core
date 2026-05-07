import camelcaseKeysLib from 'camelcase-keys'

import { camelcase, camelcaseKeys } from '~/utils/camelcase-keys'

describe('test camelcase keys', () => {
  it('case 1 normal', () => {
    const obj = {
      tool: 'too',
      tool_name: 'too_name',

      a_b: 1,
      a: 1,
      b: {
        c_d: 1,
      },
    }

    expect(camelcaseKeys(obj)).toStrictEqual(
      camelcaseKeysLib(obj, {
        deep: true,
      }),
    )
  })

  it('case 2: key has number', () => {
    const obj = {
      b147da0eaecbea00aeb62055: {
        data: {},
      },
      a_c11ab_Ac: [
        {
          a_b: 1,
        },
        1,
      ],
    }

    expect(camelcaseKeys(obj)).toStrictEqual({
      b147da0eaecbea00aeb62055: {
        data: {},
      },
      aC11abAc: [
        {
          aB: 1,
        },
        1,
      ],
    })
  })

  it('case 3: not a object', () => {
    const value = 1
    expect(camelcaseKeys(value)).toBe(value)
  })

  it('case 4: nullable value', () => {
    let value = null
    expect(camelcaseKeys(value)).toBe(value)

    value = undefined
    expect(camelcaseKeys(value)).toBe(value)

    value = Number.NaN
    expect(camelcaseKeys(value)).toBe(value)
  })

  it('case 5: array', () => {
    const arr = [
      {
        a_b: 1,
      },
      null,
      undefined,
      +0,
      -0,
      Number.POSITIVE_INFINITY,
      {
        a_b: 1,
      },
    ]

    expect(camelcaseKeys(arr)).toStrictEqual(
      camelcaseKeysLib(arr as any, { deep: true }),
    )
  })

  it('case 6: filter out mongo id', () => {
    const obj = {
      _id: '123',
      a_b: 1,
      collections: {
        posts: {
          '661bb93307d35005ba96731b': {},
        },
      },
    }

    expect(camelcaseKeys(obj)).toStrictEqual({
      id: '123',
      aB: 1,
      collections: {
        posts: {
          '661bb93307d35005ba96731b': {},
        },
      },
    })
  })

  it('case 7: start with underscore should not camelcase', () => {
    expect(camelcase('_id')).toBe('id')
  })

  it('case 8: shouldSkipKey hook keeps caller-decided keys verbatim', () => {
    const obj = {
      a_b: 1,
      enrichments: {
        'https://github.com/mx-space/core/pull/2659': { url_field: 'a' },
      },
    }

    expect(
      camelcaseKeys(obj, {
        shouldSkipKey: (k) => /^https?:\/\//.test(k),
      }),
    ).toStrictEqual({
      aB: 1,
      enrichments: {
        'https://github.com/mx-space/core/pull/2659': { urlField: 'a' },
      },
    })
  })

  it('case 9: shouldSkipKey composes (OR) with the built-in Mongo ID skip', () => {
    const obj = {
      a_b: 1,
      '661bb93307d35005ba96731b': { v_v: 1 }, // mongo id (built-in skip)
      'snow-7234567890': { x_y: 2 }, // caller-provided skip
    }

    expect(
      camelcaseKeys(obj, {
        shouldSkipKey: (k) => k.startsWith('snow-'),
      }),
    ).toStrictEqual({
      aB: 1,
      '661bb93307d35005ba96731b': { vV: 1 },
      'snow-7234567890': { xY: 2 },
    })
  })
})
