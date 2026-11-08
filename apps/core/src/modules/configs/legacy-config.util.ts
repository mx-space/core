import { cloneDeep } from 'es-toolkit/compat'

import { AIProviderType } from '~/modules/ai/ai.types'

import { generateDefaultConfig } from './configs.default'
import type { IConfig } from './configs.interface'

export class LegacyConfigConflictError extends Error {
  readonly code = 'CONFIG_SECRET_CONFLICT'
  constructor(public readonly path: string) {
    super(`CONFIG_SECRET_CONFLICT (${path})`)
  }
}

export function legacySecretConflicts(
  key: string,
  raw: Record<string, any>,
): string[] {
  const pairs =
    key === 'membership'
      ? [
          ['apiKey', 'dodoApiKey'],
          ['webhookSigningKey', 'dodoWebhookKey'],
        ]
      : key === 'thirdPartyServiceIntegration'
        ? [['github.token', 'githubToken']]
        : []
  return pairs
    .filter(([current, old]) => {
      const value = current
        .split('.')
        .reduce<any>((node, part) => node?.[part], raw)
      return (
        typeof value === 'string' &&
        value !== '' &&
        typeof raw[old] === 'string' &&
        raw[old] !== '' &&
        value !== raw[old]
      )
    })
    .map(([current]) => current)
}

function legacySecret(current: any, previous: any) {
  return current === '' || current == null ? (previous ?? '') : current
}

function isGoogleVertexEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint)
    return (
      url.hostname === 'aiplatform.googleapis.com' &&
      url.pathname.endsWith('/endpoints/openapi')
    )
  } catch {
    return false
  }
}

function extractGoogleVertexProjectId(endpoint: string): string | undefined {
  try {
    const match = new URL(endpoint).pathname.match(/\/projects\/([^/]+)/)
    return match?.[1] ? decodeURIComponent(match[1]) : undefined
  } catch {
    return undefined
  }
}

export function normalizeAiConfig(
  storedAiConfig: Record<string, any> | undefined,
  aiConfig: IConfig['ai'],
  legacyImageConfig: IConfig['imageGenerationOptions'],
  legacyTtsConfig: IConfig['ttsOptions'],
): IConfig['ai'] {
  const providers = (aiConfig.providers ?? []).map((provider) => {
    const endpoint = provider.endpoint?.trim() ?? ''
    const isLegacyVertex =
      provider.type === AIProviderType.OpenAICompatible &&
      isGoogleVertexEndpoint(endpoint)
    return {
      ...provider,
      ...(isLegacyVertex
        ? {
            type: AIProviderType.GoogleVertex,
            modelListUrl: undefined,
          }
        : {}),
      projectId: provider.projectId ?? extractGoogleVertexProjectId(endpoint),
      capabilities: isLegacyVertex
        ? { text: true, image: true, speech: true }
        : {
            decision: provider.capabilities?.decision ?? false,
            text: provider.capabilities?.text ?? true,
            image: provider.capabilities?.image ?? false,
            speech: provider.capabilities?.speech ?? false,
          },
    }
  })

  const imageGeneration = {
    enable: legacyImageConfig.enable,
    model: undefined as { providerId: string; model?: string } | undefined,
    defaultAspectRatio: legacyImageConfig.defaultAspectRatio,
    defaultQuality: legacyImageConfig.defaultQuality,
    defaultFormat: legacyImageConfig.defaultFormat,
  }
  const tts = {
    enable: legacyTtsConfig.enable,
    model: undefined as { providerId: string; model?: string } | undefined,
    voice: legacyTtsConfig.voice,
    speed: legacyTtsConfig.speed,
    maxCharsPerChunk: legacyTtsConfig.maxCharsPerChunk,
    concurrency: legacyTtsConfig.concurrency,
    maxCharsPerRun: legacyTtsConfig.maxCharsPerRun,
  }

  const addLegacyProvider = (input: {
    apiKey?: string | null
    capability: 'image' | 'speech'
    defaultModel?: string | null
    endpoint?: string | null
    id: string
    name: string
  }): string | undefined => {
    if (!input.apiKey) return undefined

    const normalizedEndpoint = input.endpoint?.trim().replace(/\/+$/, '')
    const existing = providers.find(
      (provider) =>
        provider.apiKey === input.apiKey &&
        provider.endpoint?.trim().replace(/\/+$/, '') === normalizedEndpoint,
    )
    if (existing) {
      existing.capabilities = {
        ...existing.capabilities,
        text: existing.capabilities?.text ?? true,
        image: existing.capabilities?.image || input.capability === 'image',
        speech: existing.capabilities?.speech || input.capability === 'speech',
      }
      return existing.id
    }

    let id = input.id
    let suffix = 2
    while (providers.some((provider) => provider.id === id)) {
      id = `${input.id}-${suffix}`
      suffix += 1
    }

    providers.push({
      id,
      name: input.name,
      type: AIProviderType.OpenAICompatible,
      apiKey: input.apiKey,
      endpoint: normalizedEndpoint,
      projectId: undefined,
      defaultModel: input.defaultModel ?? '',
      enabled: true,
      capabilities: {
        decision: false,
        text: false,
        image: input.capability === 'image',
        speech: input.capability === 'speech',
      },
    })
    return id
  }

  const imageProviderId = addLegacyProvider({
    apiKey: legacyImageConfig.apiKey,
    capability: 'image',
    defaultModel: legacyImageConfig.model,
    endpoint:
      legacyImageConfig.endpoint ||
      (legacyImageConfig.provider === 'openrouter'
        ? 'https://openrouter.ai/api/v1'
        : undefined),
    id: '__legacy_image_generation__',
    name: 'Imported image generation provider',
  })
  if (imageProviderId && legacyImageConfig.model) {
    imageGeneration.model = {
      providerId: imageProviderId,
      model: legacyImageConfig.model,
    }
  }

  const ttsProviderId = addLegacyProvider({
    apiKey: legacyTtsConfig.apiKey,
    capability: 'speech',
    defaultModel: legacyTtsConfig.model,
    endpoint:
      legacyTtsConfig.endpoint ||
      (legacyTtsConfig.provider === 'openrouter'
        ? 'https://openrouter.ai/api/v1'
        : legacyTtsConfig.provider === 'openai'
          ? 'https://api.openai.com/v1'
          : undefined),
    id: '__legacy_tts__',
    name: 'Imported speech provider',
  })
  if (ttsProviderId && legacyTtsConfig.model) {
    tts.model = {
      providerId: ttsProviderId,
      model: legacyTtsConfig.model,
    }
  }

  return storedAiConfig?.version === 2
    ? { ...aiConfig, version: 2, providers }
    : { ...aiConfig, version: 2, providers, imageGeneration, tts }
}

/**
 * Backward-compat: migrate old flat { githubToken } to new nested
 * { github: { enabled, token } } shape at read time.
 */
export function normalizeThirdPartyConfig(
  raw: Record<string, any>,
): IConfig['thirdPartyServiceIntegration'] {
  // Already new shape
  if (raw?.github && typeof raw.github === 'object') {
    return {
      ...raw,
      github: {
        ...raw.github,
        token: legacySecret(raw.github.token, raw.githubToken),
      },
    } as IConfig['thirdPartyServiceIntegration']
  }
  // Old flat shape — convert
  return {
    github: { enabled: true, token: raw.githubToken || '' },
    tmdb: { enabled: false, apiKey: '' },
    bangumi: { enabled: true, accessToken: '' },
    neodb: { enabled: true },
    arxiv: { enabled: true },
    leetcode: { enabled: true },
    neteaseMusic: { enabled: true },
    qqMusic: { enabled: true },
  } as IConfig['thirdPartyServiceIntegration']
}

export function normalizeMembershipConfig(
  raw: Record<string, any>,
): IConfig['membership'] {
  const { dodoApiKey, dodoEnvironment, dodoWebhookKey, ...providerConfig } = raw

  return {
    ...providerConfig,
    apiKey: legacySecret(providerConfig.apiKey, dodoApiKey),
    webhookSigningKey: legacySecret(
      providerConfig.webhookSigningKey,
      dodoWebhookKey,
    ),
    environment: providerConfig.environment ?? dodoEnvironment ?? 'live_mode',
  } as IConfig['membership']
}

/** Input must be decrypted at its original paths before calling this converter. */
export function normalizeLegacyConfig(
  raw: Record<string, any>,
  options: { allowConflicts?: boolean } = {},
): IConfig {
  if (!options.allowConflicts) {
    for (const key of ['membership', 'thirdPartyServiceIntegration']) {
      const conflict = legacySecretConflicts(key, raw[key] ?? {})[0]
      if (conflict) throw new LegacyConfigConflictError(`${key}.${conflict}`)
    }
  }
  const config = generateDefaultConfig()
  for (const key of Object.keys(config) as Array<keyof IConfig>) {
    if (raw[key] && typeof raw[key] === 'object' && !Array.isArray(raw[key])) {
      ;(config as any)[key] = { ...config[key], ...cloneDeep(raw[key]) }
    }
  }
  if (raw.thirdPartyServiceIntegration)
    config.thirdPartyServiceIntegration = {
      ...config.thirdPartyServiceIntegration,
      ...normalizeThirdPartyConfig(raw.thirdPartyServiceIntegration),
    }
  if (raw.membership)
    config.membership = {
      ...config.membership,
      ...normalizeMembershipConfig(raw.membership),
    }
  delete (config.thirdPartyServiceIntegration as any).githubToken
  for (const key of ['dodoApiKey', 'dodoEnvironment', 'dodoWebhookKey'])
    delete (config.membership as any)[key]
  config.ai = normalizeAiConfig(
    raw.ai,
    config.ai,
    config.imageGenerationOptions,
    config.ttsOptions,
  )
  {
    for (const [section, feature, legacyId] of [
      [
        'imageGenerationOptions',
        'imageGeneration',
        '__legacy_image_generation__',
      ],
      ['ttsOptions', 'tts', '__legacy_tts__'],
    ] as const) {
      const route = config.ai[feature]
      const provider =
        (config.ai.providers ?? []).find(
          (p) => p.id === route?.model?.providerId,
        ) ?? (config.ai.providers ?? []).find((p) => p.id === legacyId)
      const { model: assignment, ...settings } = route ?? {}
      ;(config as any)[section] = {
        ...config[section],
        ...settings,
        ...(provider
          ? {
              apiKey: provider.apiKey,
              endpoint: provider.endpoint,
              model: assignment?.model ?? provider.defaultModel,
              provider: provider.endpoint?.includes('openrouter.ai')
                ? 'openrouter'
                : 'custom',
            }
          : {}),
      }
    }
  }
  return config
}

/** Canonical storage has one source for media credentials and assignments. */
export function canonicalConfigRows(config: IConfig): Record<string, unknown> {
  const {
    imageGenerationOptions: _image,
    ttsOptions: _speech,
    ...canonical
  } = config
  return canonical
}

export function normalizeLegacyPatch(key: keyof IConfig, input: object) {
  const value = cloneDeep(input) as Record<string, any>
  const conflict = legacySecretConflicts(key, value)[0]
  if (conflict) throw new LegacyConfigConflictError(`${key}.${conflict}`)
  if (key === 'thirdPartyServiceIntegration' && 'githubToken' in value) {
    value.github = {
      ...value.github,
      token: legacySecret(value.github?.token, value.githubToken),
    }
    delete value.githubToken
  }
  if (key === 'membership') {
    for (const [old, current] of [
      ['dodoApiKey', 'apiKey'],
      ['dodoWebhookKey', 'webhookSigningKey'],
      ['dodoEnvironment', 'environment'],
    ]) {
      if (old in value)
        value[current] = legacySecret(value[current], value[old])
      delete value[old]
    }
  }
  return value
}

export function updateLegacyMedia(
  config: IConfig,
  section: 'imageGenerationOptions' | 'ttsOptions',
  value: object,
): IConfig {
  const updated = { ...config, [section]: { ...config[section], ...value } }
  // Reuse the import converter, then expose the v17 view from the canonical result.
  updated.ai = normalizeAiConfig(
    undefined,
    updated.ai,
    updated.imageGenerationOptions,
    updated.ttsOptions,
  )
  return normalizeLegacyConfig(updated)
}
