import type { E2EBackend } from './e2e-app'
import { type MxsResult, parseEnvelope, spawnMxs } from './mxs'
import { seedOwnerAndWriteProfile } from './seed-auth'

export async function runDeviceFlow(
  backend: E2EBackend,
  opts: { profile: string; tmpHome: string },
): Promise<MxsResult> {
  const approver = await seedOwnerAndWriteProfile(backend, {
    profile: `${opts.profile}-approver`,
    tmpHome: opts.tmpHome,
  })

  const spawned = spawnMxs(
    ['--json', 'auth', 'login'],
    backend.backendEnv(opts.tmpHome),
  )

  const line = await spawned.waitForStdoutLine((candidate) => {
    if (!candidate.startsWith('{')) return false
    try {
      const envelope = JSON.parse(candidate)
      return Boolean(envelope?.ok && envelope?.data?.user_code)
    } catch {
      return false
    }
  })
  const envelope = parseEnvelope(`${line}\n`)
  const userCode = (envelope.data as { user_code: string }).user_code

  const reviewResponse = await fetch(
    `${backend.siteUrl}/device?user_code=${encodeURIComponent(userCode)}`,
    { headers: approver.approvalHeaders },
  )
  if (!reviewResponse.ok) {
    throw new Error(
      `Device request review failed: ${await reviewResponse.text()}`,
    )
  }

  const headers = new Headers(approver.approvalHeaders)
  headers.set('content-type', 'application/json')
  const approvalResponse = await fetch(`${backend.siteUrl}/device/verify`, {
    method: 'POST',
    body: JSON.stringify({ user_code: userCode, action: 'approve' }),
    headers,
  })
  const approval = (await approvalResponse.json()) as { ok?: boolean }
  if (!approvalResponse.ok || approval.ok !== true) {
    throw new Error(
      `Device request approval failed: ${JSON.stringify(approval)}`,
    )
  }

  return spawned.result
}
