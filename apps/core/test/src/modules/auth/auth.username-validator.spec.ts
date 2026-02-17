import { validateMxUsername } from '~/modules/auth/auth.username-validator'

describe('validateMxUsername', () => {
  it('should allow username with hyphen', () => {
    expect(validateMxUsername('wibus-wee')).toBe(true)
  })

  it('should allow the original default username chars', () => {
    expect(validateMxUsername('user_name.123')).toBe(true)
  })

  it('should reject disallowed chars', () => {
    expect(validateMxUsername('user name')).toBe(false)
    expect(validateMxUsername('user@name')).toBe(false)
  })
})
