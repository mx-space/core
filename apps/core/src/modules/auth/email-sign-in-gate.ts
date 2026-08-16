import { REVIEW_DEMO_EMAIL, REVIEW_DEMO_HANDLE } from './review-demo.constants'

export type CredentialSignInGate = {
  disablePasswordLogin: boolean
  reviewDemoEnabled: boolean
  reviewDemoBanned: boolean
}

export function denyEmailSignIn(
  email: string,
  gate: CredentialSignInGate,
): boolean {
  const isDemo = email.trim().toLowerCase() === REVIEW_DEMO_EMAIL
  if (isDemo) {
    return !gate.reviewDemoEnabled || gate.reviewDemoBanned
  }
  return gate.disablePasswordLogin
}

export function denyUsernameSignIn(
  username: string,
  gate: CredentialSignInGate,
): boolean {
  if (gate.disablePasswordLogin) {
    return true
  }
  const isDemo = username.trim().toLowerCase() === REVIEW_DEMO_HANDLE
  return isDemo && (!gate.reviewDemoEnabled || gate.reviewDemoBanned)
}
