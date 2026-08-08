import { AppErrorCode, createAppException } from '~/common/errors'
import { sleep } from '~/utils/tool.util'

import { wrapPcmAsWav } from './tts-audio'
import {
  defaultTtsLanguageStrategyRegistry,
  type TtsLanguageStrategyResolution,
} from './tts-language-strategy'

export interface TtsGenerateOptions {
  input: string
  language?: string
  voice: string
  speed: number
  providerParams?: Record<string, unknown>
  signal?: AbortSignal
}

export interface ITtsRuntime {
  generateSpeech: (
    opts: TtsGenerateOptions,
  ) => Promise<{ buffer: Buffer; mimeType: string }>
}

export interface TtsRuntimeAdapterConfig {
  provider: string
  apiKey: string
  endpoint?: string
  model: string
  maxAttempts?: number
  retryDelayMs?: number
}

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

export function resolveTtsLanguageControl(
  config: Pick<TtsRuntimeAdapterConfig, 'endpoint' | 'model' | 'provider'>,
  language: string,
): TtsLanguageStrategyResolution {
  return defaultTtsLanguageStrategyRegistry.resolve({
    baseUrl: resolveTtsBaseUrl(config.provider, config.endpoint),
    language,
    model: config.model,
  })
}

export class TtsRuntimeAdapter implements ITtsRuntime {
  private readonly baseUrl: string
  private readonly maxAttempts: number
  private readonly retryDelayMs: number

  constructor(private readonly config: TtsRuntimeAdapterConfig) {
    this.baseUrl = resolveTtsBaseUrl(config.provider, config.endpoint)
    this.maxAttempts = config.maxAttempts ?? 3
    this.retryDelayMs = config.retryDelayMs ?? 500
  }

  async generateSpeech(
    opts: TtsGenerateOptions,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await this.requestOnce(opts)
      } catch (error) {
        lastError = error as Error
        // an aborted signal is caller cancellation, not a transient failure — fail fast.
        if (
          opts.signal?.aborted ||
          !isRetryable(error) ||
          attempt === this.maxAttempts
        )
          break
        await sleep(this.retryDelayMs * 2 ** (attempt - 1))
      }
    }

    throw createAppException(AppErrorCode.TTS_GENERATION_FAILED, {
      message: lastError?.message,
    })
  }

  private async requestOnce(opts: TtsGenerateOptions) {
    const languageControl = opts.language
      ? resolveTtsLanguageControl(this.config, opts.language)
      : undefined
    const input = languageControl?.transformInput?.(opts.input) ?? opts.input
    const response = await fetch(`${this.baseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        input,
        voice: opts.voice,
        speed: opts.speed,
        // response_format defaults to pcm on OpenRouter; mp3 must be explicit.
        response_format: languageControl?.responseFormat ?? 'mp3',
        ...languageControl?.requestParams,
        ...opts.providerParams,
      }),
      signal: opts.signal,
    })

    if (!response.ok) {
      throw new HttpStatusError(response.status, await safeText(response))
    }

    // some providers respond 200 with a JSON error body instead of audio.
    const mimeType = response.headers.get('content-type') ?? ''
    if (!mimeType.startsWith('audio/')) {
      throw new HttpStatusError(response.status, await safeText(response))
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    if (languageControl?.responseFormat === 'pcm') {
      return {
        buffer: wrapPcmAsWav(buffer, mimeType),
        mimeType: 'audio/wav',
      }
    }

    return { buffer, mimeType }
  }
}

class HttpStatusError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`tts request failed (${status}): ${body.slice(0, 300)}`)
  }
}

function isRetryable(error: unknown): boolean {
  if (error instanceof HttpStatusError) {
    return error.status >= 500 || error.status === 429
  }
  return true
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ''
  }
}
