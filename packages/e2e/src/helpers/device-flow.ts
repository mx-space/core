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

  await backend.authApi.deviceVerify({
    query: { user_code: userCode },
    headers: approver.approvalHeaders,
  })
  await backend.authApi.deviceApprove({
    body: { userCode },
    headers: approver.approvalHeaders,
  })

  return spawned.result
}
