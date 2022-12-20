import camelcaseKeysLib from 'camelcase-keys'

import { camelcaseKeys } from '~/utils/camelcase-keys'

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

    value = NaN
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
      Infinity,
      {
        a_b: 1,
      },
    ]

    expect(camelcaseKeys(arr)).toStrictEqual(
      camelcaseKeysLib(arr, { deep: true }),
    )
  })
})
