import { describe, expect, it } from 'vitest'

import { resolveMembershipReturnUrl } from '~/modules/membership/membership.types'

describe('resolveMembershipReturnUrl', () => {
  const web = 'https://blog.example.com'

  it('joins a relative path onto webUrl and appends the marker', () => {
    expect(resolveMembershipReturnUrl('/posts/tech/foo', web)).toBe(
      'https://blog.example.com/posts/tech/foo?membership=success',
    )
  })

  it('preserves existing query and adds the marker', () => {
    expect(resolveMembershipReturnUrl('/posts/foo?ref=x', web)).toBe(
      'https://blog.example.com/posts/foo?ref=x&membership=success',
    )
  })

  it('returns undefined when webUrl or returnPath is missing', () => {
    expect(resolveMembershipReturnUrl(undefined, web)).toBeUndefined()
    expect(resolveMembershipReturnUrl('/posts/foo', undefined)).toBeUndefined()
    expect(resolveMembershipReturnUrl('/posts/foo', '')).toBeUndefined()
  })

  it('rejects absolute, protocol-relative, and backslash paths (open redirect guard)', () => {
    expect(resolveMembershipReturnUrl('https://evil.com', web)).toBeUndefined()
    expect(resolveMembershipReturnUrl('//evil.com', web)).toBeUndefined()
    expect(resolveMembershipReturnUrl('/\\evil.com', web)).toBeUndefined()
    expect(resolveMembershipReturnUrl('posts/foo', web)).toBeUndefined()
  })

  it('returns undefined when webUrl is not a valid URL', () => {
    expect(
      resolveMembershipReturnUrl('/posts/foo', 'not-a-url'),
    ).toBeUndefined()
  })
})
