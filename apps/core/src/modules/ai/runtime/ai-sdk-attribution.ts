/**
 * Fixed app attribution for upstream AI providers (e.g. OpenRouter X-Title / HTTP-Referer).
 * @see https://openrouter.ai/docs/app-attribution
 */
export const AI_SDK_ATTRIBUTION_APP_NAME = 'Mix Space' as const
export const AI_SDK_ATTRIBUTION_APP_URL =
  'https://github.com/mx-space/core' as const

export function buildAiSdkDefaultHeaders(): Record<string, string> {
  return {
    'X-Title': AI_SDK_ATTRIBUTION_APP_NAME,
    'HTTP-Referer': AI_SDK_ATTRIBUTION_APP_URL,
  }
}
