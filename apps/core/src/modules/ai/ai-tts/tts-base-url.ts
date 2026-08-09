import { AppErrorCode, createAppException } from '~/common/errors'

const PRESET_BASE_URLS: Record<string, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  openai: 'https://api.openai.com/v1',
}

export function resolveTtsBaseUrl(provider: string, endpoint?: string): string {
  const trimmed = endpoint?.trim().replace(/\/+$/, '')
  if (trimmed) return trimmed
  const preset = PRESET_BASE_URLS[provider]
  if (!preset) {
    throw createAppException(AppErrorCode.TTS_PROVIDER_NOT_CONFIGURED)
  }
  return preset
}
