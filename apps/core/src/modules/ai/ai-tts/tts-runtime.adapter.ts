import { AppErrorCode, createAppException } from '~/common/errors'
import { sleep } from '~/utils/tool.util'

import { resolveTtsBaseUrl } from './tts-base-url'
import {
  defaultTtsLanguageStrategyRegistry,
  type TtsLanguageStrategyResolution,
} from './tts-language-strategy'
import { defaultTtsProtocolAdapterRegistry } from './tts-protocol.registry'
import type { ITtsProtocolAdapter } from './tts-protocol.types'
import { TtsProtocolHttpError } from './tts-protocol.types'
import type {
  ITtsRuntime,
  TtsGenerateOptions,
  TtsRuntimeAdapterConfig,
} from './tts-runtime.interface'

export { resolveTtsBaseUrl } from './tts-base-url'
export type {
  ITtsRuntime,
  TtsGenerateOptions,
  TtsRuntimeAdapterConfig,
} from './tts-runtime.interface'

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
  private readonly maxAttempts: number
  private readonly protocolAdapter: ITtsProtocolAdapter
  private readonly retryDelayMs: number

  constructor(private readonly config: TtsRuntimeAdapterConfig) {
    this.protocolAdapter = defaultTtsProtocolAdapterRegistry.resolve(config)
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
    return this.protocolAdapter.generateSpeech({
      input,
      languageControl,
      options: opts,
    })
  }
}

function isRetryable(error: unknown): boolean {
  if (error instanceof TtsProtocolHttpError) {
    return error.status >= 500 || error.status === 429
  }
  return true
}
