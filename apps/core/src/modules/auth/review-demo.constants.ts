export const REVIEW_DEMO_EMAIL = 'app-review@users.invalid'
export const REVIEW_DEMO_HANDLE = 'app-review'
export const REVIEW_DEMO_NAME = 'App Reviewer'
export const REVIEW_DEMO_BAN_REASON = 'app-review-demo'
export const REVIEW_DEMO_PUBLIC_ENABLED_KEY = 'reviewDemoEnabled'
export const REVIEW_DEMO_SECRET_PASSWORD_KEY = 'reviewDemoPassword'

export function isReviewDemoEnabled(oauth: {
  public?: Partial<Record<string, Record<string, string>>>
}): boolean {
  return oauth.public?.apple?.[REVIEW_DEMO_PUBLIC_ENABLED_KEY] === 'true'
}

export function isReviewDemoEmail(input: { email?: string | null }): boolean {
  return input.email?.trim().toLowerCase() === REVIEW_DEMO_EMAIL
}

export function isReviewDemoProvisioned(input: {
  email?: string | null
  emailVerified?: boolean | null
  handle?: string | null
  role?: string | null
  username?: string | null
}): boolean {
  return (
    isReviewDemoEmail(input) &&
    input.emailVerified === true &&
    input.handle === REVIEW_DEMO_HANDLE &&
    input.username === REVIEW_DEMO_HANDLE &&
    input.role === 'reader'
  )
}
