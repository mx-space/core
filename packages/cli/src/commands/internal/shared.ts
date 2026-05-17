import { ApiClient } from '../../core/api-client'
import { readConfig, resolveConfig, writeConfig } from '../../core/config-store'
import { MxsError } from '../../core/errors'
import { runOnboarding } from '../../core/onboarding'
import { emitInfo, type OutputOptions } from '../../core/output'

export interface GlobalFlags {
  json?: boolean
  apiUrl?: string
  token?: string
  apiKey?: string
  quiet?: boolean
  verbose?: boolean
  dryRun?: boolean
}

export async function resolveContext(flags: GlobalFlags, out: OutputOptions) {
  let resolved
  try {
    resolved = await resolveConfig({
      apiUrl: flags.apiUrl,
      token: flags.token,
      apiKey: flags.apiKey,
    })
  } catch (err) {
    if (err instanceof MxsError && err.code === 'config.missing.api_url') {
      const probed = await runOnboarding()
      emitInfo(`saved ${probed.apiUrl} to config`, out)
      resolved = await resolveConfig({
        apiUrl: flags.apiUrl,
        token: flags.token,
        apiKey: flags.apiKey,
      })
    } else {
      throw err
    }
  }
  return resolved
}

export function buildApiClient(
  resolved: Awaited<ReturnType<typeof resolveConfig>>,
  flags: GlobalFlags,
) {
  return new ApiClient({
    apiBase: resolved.apiBase,
    authBase: resolved.authBase,
    clientId: resolved.clientId,
    token: resolved.token,
    apiKey: resolved.apiKey,
    autoRefresh:
      Boolean(resolved.token) &&
      !resolved.apiKey &&
      !flags.token &&
      !process.env.MXS_TOKEN,
    verbose: flags.verbose,
  })
}

export async function persistApiVersion(version: number) {
  const cfg = await readConfig()
  if (cfg.api_version === version) return
  await writeConfig({ ...cfg, api_version: version })
}
