import { wrapPcmAsWav } from './tts-audio'
import { resolveTtsBaseUrl } from './tts-base-url'
import type {
  ITtsProtocolAdapter,
  TtsProtocolAdapterConfig,
  TtsProtocolRequest,
} from './tts-protocol.types'
import { TtsProtocolHttpError } from './tts-protocol.types'

export class OpenAiCompatibleTtsProtocolAdapter implements ITtsProtocolAdapter {
  private readonly baseUrl: string

  constructor(private readonly config: TtsProtocolAdapterConfig) {
    this.baseUrl = resolveTtsBaseUrl(config.provider, config.endpoint)
  }

  async generateSpeech({
    input,
    languageControl,
    options,
  }: TtsProtocolRequest): Promise<{ buffer: Buffer; mimeType: string }> {
    const sessionId =
      this.config.sessionId &&
      (this.config.provider === 'openrouter' ||
        new URL(this.baseUrl).hostname === 'openrouter.ai')
        ? this.config.sessionId
        : undefined
    const response = await fetch(`${this.baseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        'content-type': 'application/json',
        ...(sessionId ? { 'x-session-id': sessionId } : undefined),
      },
      body: JSON.stringify({
        model: this.config.model,
        input,
        voice: options.voice,
        speed: options.speed,
        response_format: languageControl?.responseFormat ?? 'mp3',
        ...languageControl?.requestParams,
        ...options.providerParams,
      }),
      signal: options.signal,
    })

    if (!response.ok) {
      throw new TtsProtocolHttpError(response.status, await safeText(response))
    }

    const mimeType = response.headers.get('content-type') ?? ''
    if (!mimeType.startsWith('audio/')) {
      throw new TtsProtocolHttpError(response.status, await safeText(response))
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

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ''
  }
}
