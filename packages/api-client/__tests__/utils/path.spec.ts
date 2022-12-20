import { resolveFullPath } from '~/utils/path'

describe('TEST path.utils', () => {
  it('should resolve full path', () => {
    const path = resolveFullPath('http://localhost:3000', '/api/v1/users')
    expect(path).toBe('http://localhost:3000/api/v1/users')
  })
})
