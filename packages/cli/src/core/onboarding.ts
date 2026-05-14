import { text } from '@clack/prompts'

import { type AuthHttp, defaultHttp, probeAuthEndpoint } from './auth'
import { normalizeApiUrl, readConfig, writeConfig } from './config-store'
import { MxsError } from './errors'

export interface OnboardingResult {
  apiUrl: string
  apiBase: string
  authBase: string
  apiVersion: number
}

export interface OnboardingOptions {
  http?: AuthHttp
  initialApiUrl?: string
  isTTY?: boolean
  prompt?: (question: string) => Promise<string>
}

export async function runOnboarding(
  opts: OnboardingOptions = {},
): Promise<OnboardingResult> {
  const tty = opts.isTTY ?? Boolean(process.stdin.isTTY && process.stdout.isTTY)
  let input = opts.initialApiUrl
  if (!input) {
    if (!tty) {
      throw new MxsError({
        code: 'config.missing.api_url',
        message: 'API URL is not configured',
        hint: 'set MXS_API_URL or pass --api-url <url>, or run `mxs auth login` in an interactive shell',
      })
    }
    if (opts.prompt) {
      input = await opts.prompt('API URL of your mx-core server')
    } else {
      const answer = await text({
        message: 'API URL of your mx-core server',
        placeholder: 'https://blog.example.com',
        validate: (v) => (v.trim().length === 0 ? 'required' : undefined),
      })
      if (typeof answer !== 'string') {
        throw new MxsError({
          code: 'config.missing.api_url',
          message: 'onboarding aborted',
        })
      }
      input = answer
    }
  }

  const apiUrl = normalizeApiUrl(input)
  const probed = await probeAuthEndpoint(apiUrl, opts.http ?? defaultHttp())

  const existing = await readConfig()
  await writeConfig({
    ...existing,
    api_url: probed.apiUrl,
    api_base: probed.apiBase,
    auth_base: probed.authBase,
    api_version: probed.apiVersion,
    client_id: existing.client_id ?? 'mxs-cli',
  })

  return probed
}
