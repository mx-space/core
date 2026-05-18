import { text } from '@clack/prompts'

import { type AuthHttp, defaultHttp, probeAuthEndpoint } from './auth'
import {
  DEV_DEFAULT_PROFILE_NAME,
  isDevDefaultProfileEnabled,
  normalizeApiUrl,
} from './config-store'
import { MxsError, MxsErrorCode } from './errors'
import {
  getCurrentProfile,
  setCurrentProfile,
  writeProfileConfig,
} from './profile'

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
  /** Override the target profile name (mirrors --profile flag). */
  profile?: string
}

export async function runOnboarding(
  opts: OnboardingOptions = {},
): Promise<OnboardingResult> {
  const tty = opts.isTTY ?? Boolean(process.stdin.isTTY && process.stdout.isTTY)
  let input = opts.initialApiUrl
  if (!input) {
    if (!tty) {
      throw new MxsError({
        code: MxsErrorCode.ConfigMissingApiUrl,
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
        validate: (v) => (!v || v.trim().length === 0 ? 'required' : undefined),
      })
      if (typeof answer !== 'string') {
        throw new MxsError({
          code: MxsErrorCode.ConfigMissingApiUrl,
          message: 'onboarding aborted',
        })
      }
      input = answer
    }
  }

  const apiUrl = normalizeApiUrl(input)
  const probed = await probeAuthEndpoint(apiUrl, opts.http ?? defaultHttp())

  // Determine target profile:
  //   --profile > MXS_PROFILE > dev-default > active current > 'default'
  const target =
    opts.profile?.trim() ||
    process.env.MXS_PROFILE?.trim() ||
    (isDevDefaultProfileEnabled() ? DEV_DEFAULT_PROFILE_NAME : null) ||
    (await getCurrentProfile()) ||
    'default'

  await writeProfileConfig(target, {
    api_url: probed.apiUrl,
    api_version: probed.apiVersion,
  })

  await setCurrentProfile(target)

  return probed
}
