import { describe, expect, it } from 'vitest'

import { flattenOauthOptions } from './oauth'

describe('flattenOauthOptions', () => {
  it('does not treat reviewDemoEnabled as Apple being configured', () => {
    const flat = flattenOauthOptions({
      providers: [{ enabled: true, type: 'apple' }],
      public: { apple: { reviewDemoEnabled: 'true' } },
    })
    expect(flat.apple.configured).toBe(false)
    expect(flat.apple.enabled).toBe(true)
    expect(flat.apple.public.reviewDemoEnabled).toBe('true')
  })

  it('still marks Apple configured when a real public field is set', () => {
    const flat = flattenOauthOptions({
      public: {
        apple: { clientId: 'dev.example.web', reviewDemoEnabled: 'true' },
      },
    })
    expect(flat.apple.configured).toBe(true)
  })
})
