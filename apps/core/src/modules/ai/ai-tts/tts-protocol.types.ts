import type { TtsLanguageStrategyResolution } from './tts-language-strategy'
import type {
  TtsGenerateOptions,
  TtsRuntimeAdapterConfig,
} from './tts-runtime.interface'

export interface TtsProtocolRequest {
  input: string
  languageControl?: TtsLanguageStrategyResolution
  options: TtsGenerateOptions
}

export interface ITtsProtocolAdapter {
  generateSpeech: (
    request: TtsProtocolRequest,
  ) => Promise<{ buffer: Buffer; mimeType: string }>
}

export type TtsProtocolAdapterConfig = TtsRuntimeAdapterConfig

export class TtsProtocolHttpError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`tts request failed (${status}): ${body.slice(0, 300)}`)
    this.name = 'TtsProtocolHttpError'
  }
}
