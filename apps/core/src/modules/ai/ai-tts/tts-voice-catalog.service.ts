import { Injectable } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'
import type { AIProviderConfig } from '~/modules/ai/ai.types'
import { AIProviderType } from '~/modules/ai/ai.types'
import { createModelRuntime } from '~/modules/ai/runtime'
import { getVertexMediaModels } from '~/modules/ai/vertex/vertex-model-catalog'
import { ConfigsService } from '~/modules/configs/configs.service'

const VOICE_LIST_TIMEOUT_MS = 5000

const OPENAI_BUILTIN_VOICE_IDS = [
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'onyx',
  'nova',
  'sage',
  'shimmer',
  'verse',
  'marin',
  'cedar',
] as const

export interface TtsVoiceOption {
  id: string
  kind: 'builtin' | 'provider'
  name: string
  previewUrl?: string
}

export interface TtsVoiceDiscoveryResult {
  error?: string
  manualInputAllowed: true
  source: 'builtin' | 'none' | 'remote'
  voices: TtsVoiceOption[]
}

@Injectable()
export class TtsVoiceCatalogService {
  constructor(private readonly configsService: ConfigsService) {}

  async discover(input: {
    model: string
    providerId: string
  }): Promise<TtsVoiceDiscoveryResult> {
    const resolved = await this.configsService.resolveAiProviderForCapability(
      'speech',
      input,
    )
    if (!resolved) {
      throw createAppException(AppErrorCode.TTS_PROVIDER_NOT_CONFIGURED)
    }

    const fallback = await discoverTtsVoices(resolved.provider, input.model)
    if (fallback.voices.length > 0 || resolved.provider.voiceListUrl?.trim()) {
      return fallback
    }

    try {
      const runtime = createModelRuntime(resolved.provider, input.model)
      const models = (await runtime.listModels?.('speech')) ?? []
      const normalizedModel = input.model.trim().toLowerCase()
      const modelInfo = models.find(
        (item) => item.id.trim().toLowerCase() === normalizedModel,
      )
      return discoverTtsVoices(
        resolved.provider,
        input.model,
        modelInfo?.supportedVoices,
      )
    } catch (error) {
      return {
        ...fallback,
        error:
          error instanceof Error ? error.message : 'Voice discovery failed',
      }
    }
  }
}

export async function discoverTtsVoices(
  provider: AIProviderConfig,
  model: string,
  supportedVoices: string[] = [],
): Promise<TtsVoiceDiscoveryResult> {
  if (provider.type === AIProviderType.GoogleVertex) {
    const modelInfo = getVertexMediaModels('speech').find(
      (item) => item.id.toLowerCase() === model.trim().toLowerCase(),
    )
    return resultFromBuiltin(
      normalizeRemoteVoices(modelInfo?.supportedVoices ?? []).map((voice) => ({
        ...voice,
        kind: 'builtin',
      })),
    )
  }
  const builtinVoices = getBuiltinTtsVoices(model)
  const modelVoices = normalizeRemoteVoices(supportedVoices)
  if (!provider.voiceListUrl?.trim()) {
    return modelVoices.length > 0
      ? resultFromRemote(modelVoices)
      : resultFromBuiltin(builtinVoices)
  }

  try {
    const remoteVoices = await fetchRemoteVoices(
      provider.voiceListUrl,
      provider.apiKey,
    )
    if (remoteVoices.length > 0) {
      return {
        manualInputAllowed: true,
        source: 'remote',
        voices: remoteVoices,
      }
    }

    return withDiscoveryError(
      modelVoices.length > 0
        ? resultFromRemote(modelVoices)
        : resultFromBuiltin(builtinVoices),
      'Voice list response did not contain any valid voices',
    )
  } catch (error) {
    return withDiscoveryError(
      modelVoices.length > 0
        ? resultFromRemote(modelVoices)
        : resultFromBuiltin(builtinVoices),
      error instanceof Error ? error.message : 'Voice discovery failed',
    )
  }
}

function resultFromRemote(voices: TtsVoiceOption[]): TtsVoiceDiscoveryResult {
  return {
    manualInputAllowed: true,
    source: 'remote',
    voices,
  }
}

function withDiscoveryError(
  result: TtsVoiceDiscoveryResult,
  error: string,
): TtsVoiceDiscoveryResult {
  return { ...result, error }
}

function resultFromBuiltin(voices: TtsVoiceOption[]): TtsVoiceDiscoveryResult {
  return {
    manualInputAllowed: true,
    source: voices.length > 0 ? 'builtin' : 'none',
    voices,
  }
}

function getBuiltinTtsVoices(model: string): TtsVoiceOption[] {
  const normalizedModel = model
    .trim()
    .toLowerCase()
    .replace(/^openai\//, '')
  const isOpenAiSpeechModel =
    normalizedModel === 'tts-1' ||
    normalizedModel === 'tts-1-hd' ||
    normalizedModel.startsWith('gpt-4o-mini-tts')

  if (!isOpenAiSpeechModel) return []

  return OPENAI_BUILTIN_VOICE_IDS.map((id) => ({
    id,
    kind: 'builtin',
    name: id[0].toUpperCase() + id.slice(1),
  }))
}

async function fetchRemoteVoices(
  voiceListUrl: string,
  apiKey: string,
): Promise<TtsVoiceOption[]> {
  const url = new URL(voiceListUrl.trim())
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Voice list URL must use HTTP or HTTPS')
  }

  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(VOICE_LIST_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`Voice list request failed with status ${response.status}`)
  }

  return normalizeRemoteVoices(await response.json())
}

function normalizeRemoteVoices(payload: unknown): TtsVoiceOption[] {
  const records = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.data)
      ? payload.data
      : isRecord(payload) && Array.isArray(payload.voices)
        ? payload.voices
        : []
  const voices: TtsVoiceOption[] = []
  const seen = new Set<string>()

  for (const item of records) {
    const normalized = normalizeRemoteVoice(item)
    if (!normalized) continue
    const dedupeKey = normalized.id.toLowerCase()
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    voices.push(normalized)
  }

  return voices
}

function normalizeRemoteVoice(item: unknown): TtsVoiceOption | null {
  if (typeof item === 'string') {
    const id = item.trim()
    return id ? { id, kind: 'provider', name: id } : null
  }
  if (!isRecord(item)) return null

  const id = readString(item.id, item.voiceId, item.voice_id)
  if (!id) return null
  const name = readString(item.name, item.label) || id
  const previewUrl = readString(item.previewUrl, item.preview_url, item.preview)

  return {
    id,
    kind: 'provider',
    name,
    ...(previewUrl ? { previewUrl } : {}),
  }
}

function readString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}
