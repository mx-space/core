import {
  buildVertexPublisherModelUrl,
  getVertexHeaders,
  readVertexError,
} from '../vertex/vertex-api'
import { wrapPcmAsWav } from './tts-audio'
import type {
  ITtsProtocolAdapter,
  TtsProtocolAdapterConfig,
  TtsProtocolRequest,
} from './tts-protocol.types'
import { TtsProtocolHttpError } from './tts-protocol.types'

export class VertexTtsProtocolAdapter implements ITtsProtocolAdapter {
  constructor(private readonly config: TtsProtocolAdapterConfig) {}

  async generateSpeech({
    input,
    options,
  }: TtsProtocolRequest): Promise<{ buffer: Buffer; mimeType: string }> {
    const spokenInput =
      options.speed === 1
        ? input
        : `Speak at ${options.speed} times the normal speed.\n\n${input}`
    const response = await fetch(
      buildVertexPublisherModelUrl({
        config: this.config,
        method: 'generateContent',
        model: this.config.model,
        version: 'v1beta1',
      }),
      {
        method: 'POST',
        headers: getVertexHeaders(this.config.apiKey),
        body: JSON.stringify({
          contents: {
            role: 'user',
            parts: { text: spokenInput },
          },
          generation_config: {
            response_modalities: ['AUDIO'],
            speech_config: {
              ...(options.language
                ? { language_code: normalizeVertexLanguage(options.language) }
                : {}),
              voice_config: {
                prebuilt_voice_config: { voice_name: options.voice },
              },
            },
          },
          ...options.providerParams,
        }),
        signal: options.signal,
      },
    )

    if (!response.ok) {
      throw new TtsProtocolHttpError(
        response.status,
        await readVertexError(response),
      )
    }
    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: { data?: unknown; mimeType?: unknown }
            inline_data?: { data?: unknown; mime_type?: unknown }
          }>
        }
      }>
    }
    const inline = payload.candidates?.[0]?.content?.parts?.[0]
    const data = inline?.inlineData?.data ?? inline?.inline_data?.data
    const mimeType =
      inline?.inlineData?.mimeType ?? inline?.inline_data?.mime_type
    if (typeof data !== 'string' || !data) {
      throw new TtsProtocolHttpError(
        response.status,
        'response contained no audio',
      )
    }
    const pcm = Buffer.from(data, 'base64')
    return {
      buffer: wrapPcmAsWav(
        pcm,
        typeof mimeType === 'string'
          ? mimeType
          : 'audio/pcm;rate=24000;channels=1',
      ),
      mimeType: 'audio/wav',
    }
  }
}

function normalizeVertexLanguage(language: string): string {
  const normalized = language.trim().replace('_', '-')
  const defaults: Record<string, string> = {
    en: 'en-US',
    ja: 'ja-JP',
    zh: 'zh-CN',
  }
  return defaults[normalized.toLowerCase()] ?? normalized
}
