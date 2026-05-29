import { getJson } from './http'

export function sendTestEmail() {
  return getJson<{ message?: string; trace?: string }>('/health/email/test')
}
