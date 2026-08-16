import { describe, expect, it } from 'vitest'

import {
  denyEmailSignIn,
  type EmailSignInGate,
} from '~/modules/auth/email-sign-in-gate'
import {
  isReviewDemoEnabled,
  isReviewDemoIdentity,
  REVIEW_DEMO_EMAIL,
} from '~/modules/auth/review-demo.constants'

const open: EmailSignInGate = {
  disablePasswordLogin: false,
  reviewDemoEnabled: true,
  reviewDemoBanned: false,
}

describe('denyEmailSignIn', () => {
  it('allows the demo email when the toggle is on and the reader is not banned', () => {
    expect(denyEmailSignIn(REVIEW_DEMO_EMAIL, open)).toBe(false)
    expect(
      denyEmailSignIn(REVIEW_DEMO_EMAIL, {
        ...open,
        disablePasswordLogin: true,
      }),
    ).toBe(false)
  })

  it('denies the demo email when the toggle is off or the reader is banned', () => {
    expect(
      denyEmailSignIn(REVIEW_DEMO_EMAIL, {
        ...open,
        reviewDemoEnabled: false,
      }),
    ).toBe(true)
    expect(
      denyEmailSignIn(REVIEW_DEMO_EMAIL, {
        ...open,
        reviewDemoBanned: true,
      }),
    ).toBe(true)
  })

  it('denies every other email when password login is disabled', () => {
    expect(
      denyEmailSignIn('owner@example.com', {
        ...open,
        disablePasswordLogin: true,
      }),
    ).toBe(true)
  })

  it('allows every other email when password login is enabled', () => {
    expect(denyEmailSignIn('owner@example.com', open)).toBe(false)
  })
})

describe('isReviewDemoEnabled / isReviewDemoIdentity', () => {
  it('reads only apple.reviewDemoEnabled === "true"', () => {
    expect(
      isReviewDemoEnabled({
        public: { apple: { reviewDemoEnabled: 'true' } },
      }),
    ).toBe(true)
    expect(
      isReviewDemoEnabled({
        public: { apple: { reviewDemoEnabled: '' } },
      }),
    ).toBe(false)
  })

  it('matches the reserved email and handle', () => {
    expect(
      isReviewDemoIdentity({
        email: REVIEW_DEMO_EMAIL,
        handle: 'app-review',
      }),
    ).toBe(true)
    expect(
      isReviewDemoIdentity({
        email: REVIEW_DEMO_EMAIL,
        handle: 'someone-else',
      }),
    ).toBe(false)
  })
})
