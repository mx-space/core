import { safePathJoin } from '~/utils'

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
})
