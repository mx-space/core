import { destructureData } from '~/utils'

describe('test utils', () => {
  test('destructureData', () => {
    const d = destructureData({ data: { a: 1, b: 2 } })
    expect(d).toEqual({ a: 1, b: 2 })

    const d2 = destructureData({ data: { a: 1, b: 2 }, c: 3 })
    expect(d2).toEqual({ data: { a: 1, b: 2 }, c: 3 })

    const d3 = destructureData({ data: [{ a: 1 }] })
    expect(d3).toEqual({ data: [{ a: 1 }] })

    const d4 = destructureData({ a: 1 })
    expect(d4).toEqual({ a: 1 })

    const d5 = destructureData([])
    expect(d5).toEqual([])

    const d6 = destructureData({ data: [] })
    expect(d6).toEqual({ data: [] })

    const d7 = destructureData(
      (() => {
        const d = { data: { a: 1 } }
        Object.defineProperty(d, '$raw', {
          value: { a: 1 },
          enumerable: false,
        })
        return d
      })(),
    )
    expect(d7).toEqual({ a: 1 })
    expect(d7.$raw).toBeTruthy()
  })
})
