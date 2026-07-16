import { assertCompanionLiveDeskAvailable } from '~/modules/companion/companion-feature.policy'

describe('CompanionFeaturePolicy', () => {
  it('hard-rejects unavailable features and admits an enabled deployment', () => {
    expect(() => assertCompanionLiveDeskAvailable(false)).toThrowError(
      expect.objectContaining({ code: 'COMPANION_FEATURE_UNAVAILABLE' }),
    )
    expect(() => assertCompanionLiveDeskAvailable(true)).not.toThrow()
  })
})
