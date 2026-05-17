import { snakecaseKeysWithCompat } from '~/utils/case.util'

describe('snakecaseKeysWithCompat', () => {
  test('should convert plain object keys to snake_case', () => {
    const obj = {
      a: 1,
      bA: 2,
    }
    expect(snakecaseKeysWithCompat(obj)).toEqual({ a: 1, b_a: 2 })
  })

  test('should handle nested objects', () => {
    const obj = {
      outerKey: {
        innerKey: 1,
      },
    }
    expect(snakecaseKeysWithCompat(obj)).toEqual({
      outer_key: {
        inner_key: 1,
      },
    })
  })
})
