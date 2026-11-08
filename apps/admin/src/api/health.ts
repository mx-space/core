import { requestJson } from './http'

export function sendTestEmail() {
  return requestJson<{ message?: string; trace?: string }>(
    '/health/email/test',
    { method: 'POST' },
  )
}
