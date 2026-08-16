import { describe, expect, it } from 'vitest'

import {
  type CredentialSignInGate,
  denyEmailSignIn,
  denyUsernameSignIn,
} from '~/modules/auth/email-sign-in-gate'
import {
  isReviewDemoEmail,
  isReviewDemoEnabled,
  isReviewDemoProvisioned,
  REVIEW_DEMO_EMAIL,
} from '~/modules/auth/review-demo.constants'

const open: CredentialSignInGate = {
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

describe('denyUsernameSignIn', () => {
  it('denies every username when password login is disabled', () => {
    expect(
      denyUsernameSignIn('owner', {
        ...open,
        disablePasswordLogin: true,
      }),
    ).toBe(true)
    expect(
      denyUsernameSignIn('app-review', {
        ...open,
        disablePasswordLogin: true,
      }),
    ).toBe(true)
  })

  it('denies the demo username when the demo is disabled or banned', () => {
    expect(
      denyUsernameSignIn('app-review', {
        ...open,
        reviewDemoEnabled: false,
      }),
    ).toBe(true)
    expect(
      denyUsernameSignIn('app-review', {
        ...open,
        reviewDemoBanned: true,
      }),
    ).toBe(true)
    expect(denyUsernameSignIn('owner', open)).toBe(false)
  })
})

describe('review demo identity', () => {
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

  it('reserves the email independently of mutable profile fields', () => {
    const mutatedProfile = {
      email: REVIEW_DEMO_EMAIL,
      handle: 'someone-else',
    }
    expect(
      isReviewDemoEmail({
        email: REVIEW_DEMO_EMAIL,
      }),
    ).toBe(true)
    expect(isReviewDemoEmail(mutatedProfile)).toBe(true)
  })

  it('requires the complete immutable provisioned shape', () => {
    expect(
      isReviewDemoProvisioned({
        email: REVIEW_DEMO_EMAIL,
        emailVerified: true,
        handle: 'app-review',
        role: 'reader',
        username: 'app-review',
      }),
    ).toBe(true)
    expect(
      isReviewDemoProvisioned({
        email: REVIEW_DEMO_EMAIL,
        emailVerified: true,
        handle: 'someone-else',
        role: 'reader',
        username: 'app-review',
      }),
    ).toBe(false)
  })
})
