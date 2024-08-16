import { camelcaseKeys, safePathJoin } from '~/utils/tool.util'

describe('test tools', () => {
  describe('safePathJoin', () => {
    it('case-1', () => {
      expect(safePathJoin('a', 'b', 'c')).toBe('a/b/c')
    })

    it('case-2', () => {
      expect(safePathJoin('a', 'b', '..')).toBe('a/b')
    })

    it('case-3', () => {
      expect(safePathJoin('a', '~', '..')).toBe('a')
    })

    it('case-4', () => {
      expect(safePathJoin('...', '~', '..', 'c')).toBe('c')
    })
  })

  describe('camelCaseKeys', () => {
    // 编写测试用例
    it('case-1', () => {
      expect(camelcaseKeys({ a_b: 1 })).toStrictEqual({ aB: 1 })
    })
    it('case-2', () => {
      expect(camelcaseKeys({ a_b: { c_d: 1 } })).toStrictEqual({
        aB: { cD: 1 },
      })
    })
    it('case-3', () => {
      expect(camelcaseKeys({ a_b: [{ c_d: 1 }] })).toStrictEqual({
        aB: [{ cD: 1 }],
      })
    })

    it('case-4', () => {
      expect(camelcaseKeys({ a_b: [{ c_d: 1 }], e_f: 2 })).toStrictEqual({
        aB: [{ cD: 1 }],
        eF: 2,
      })
    })
    it('case-5', () => {
      expect(camelcaseKeys(null)).toBe(null)
    })
    it('case-5', () => {
      expect(camelcaseKeys(1)).toBe(1)
    })
  })
})
