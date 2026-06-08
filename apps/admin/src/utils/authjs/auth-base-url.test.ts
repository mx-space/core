import { describe, expect, it } from 'vitest'

import { resolveAuthBaseURL } from './auth-base-url'

describe('resolveAuthBaseURL', () => {
  it('uses same-origin auth when the API URL is empty', () => {
    expect(resolveAuthBaseURL('', 'http://127.0.0.1:9529')).toBe(
      'http://127.0.0.1:9529/auth',
    )
  })

  it('preserves an explicit API path before the auth suffix', () => {
    expect(
      resolveAuthBaseURL(
        'http://127.0.0.1:2333/api/v2',
        'http://127.0.0.1:9529',
      ),
    ).toBe('http://127.0.0.1:2333/api/v2/auth')
  })

  it('does not duplicate the slash before the auth suffix', () => {
    expect(
      resolveAuthBaseURL(
        'http://127.0.0.1:2333/api/v2/',
        'http://127.0.0.1:9529',
      ),
    ).toBe('http://127.0.0.1:2333/api/v2/auth')
  })
})
