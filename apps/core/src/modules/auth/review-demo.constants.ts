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

export function isReviewDemoIdentity(input: {
  email?: string | null
  handle?: string | null
  username?: string | null
}): boolean {
  return (
    input.email === REVIEW_DEMO_EMAIL &&
    (input.handle === REVIEW_DEMO_HANDLE ||
      input.username === REVIEW_DEMO_HANDLE)
  )
}
