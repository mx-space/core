import { REVIEW_DEMO_EMAIL } from './review-demo.constants'

export type EmailSignInGate = {
  disablePasswordLogin: boolean
  reviewDemoEnabled: boolean
  reviewDemoBanned: boolean
}

export function denyEmailSignIn(email: string, gate: EmailSignInGate): boolean {
  const isDemo = email.trim().toLowerCase() === REVIEW_DEMO_EMAIL
  if (isDemo) {
    return !gate.reviewDemoEnabled || gate.reviewDemoBanned
  }
  return gate.disablePasswordLogin
}
