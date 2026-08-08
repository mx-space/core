import type { AIProviderConfig, AIProviderType } from '../types/settings'
import { getDefaultAIModel } from '../utils/settings'

export type AIProviderPresetCategory =
  'aggregator' | 'cn_official' | 'custom' | 'official'

export interface AIProviderPresetTemplateField {
  key: 'projectId'
  required?: boolean
}

export type AIProviderPresetTemplateValues = Partial<
  Record<AIProviderPresetTemplateField['key'], string>
>

export interface AIProviderPreset {
  apiKeyUrl?: string
  appendV1?: boolean
  capabilities?: AIProviderConfig['capabilities']
  category: AIProviderPresetCategory
  defaultModel: string
  endpoint?: string
  id: string
  modelListUrl?: string
  name: string
  templateFields?: readonly AIProviderPresetTemplateField[]
  type: AIProviderType
  websiteUrl?: string
}

const TEXT_ONLY: AIProviderConfig['capabilities'] = {
  image: false,
  speech: false,
  text: true,
}

const ALL_CAPABILITIES: AIProviderConfig['capabilities'] = {
  image: true,
  speech: true,
  text: true,
}

export const aiProviderPresets: readonly AIProviderPreset[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai-compatible',
    endpoint: 'https://api.openai.com/v1',
    appendV1: false,
    defaultModel: '',
    category: 'official',
    websiteUrl: 'https://platform.openai.com',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    capabilities: TEXT_ONLY,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'anthropic',
    endpoint: 'https://api.anthropic.com',
    defaultModel: getDefaultAIModel('anthropic'),
    category: 'official',
    websiteUrl: 'https://console.anthropic.com',
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    capabilities: TEXT_ONLY,
  },
  {
    id: 'google',
    name: 'Google AI (Gemini)',
    type: 'openai-compatible',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai',
    modelListUrl:
      'https://generativelanguage.googleapis.com/v1beta/openai/models',
    appendV1: false,
    defaultModel: 'gemini-3.6-flash',
    category: 'official',
    websiteUrl: 'https://ai.google.dev/gemini-api',
    apiKeyUrl: 'https://aistudio.google.com/app/apikey',
    capabilities: TEXT_ONLY,
  },
  {
    id: 'googleVertex',
    name: 'Google Vertex AI',
    type: 'google-vertex',
    endpoint:
      'https://aiplatform.googleapis.com/v1/projects/{{projectId}}/locations/global/endpoints/openapi',
    appendV1: false,
    defaultModel: 'google/gemini-3.6-flash',
    category: 'official',
    websiteUrl: 'https://console.cloud.google.com/vertex-ai',
    apiKeyUrl: 'https://console.cloud.google.com/apis/credentials',
    capabilities: ALL_CAPABILITIES,
    templateFields: [{ key: 'projectId', required: true }],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    type: 'openai-compatible',
    endpoint: 'https://api.deepseek.com',
    appendV1: true,
    defaultModel: 'deepseek-chat',
    category: 'cn_official',
    websiteUrl: 'https://platform.deepseek.com',
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
    capabilities: TEXT_ONLY,
  },
  {
    id: 'moonshot',
    name: 'Kimi / Moonshot',
    type: 'openai-compatible',
    endpoint: 'https://api.moonshot.cn/v1',
    appendV1: false,
    defaultModel: 'kimi-k2.5',
    category: 'cn_official',
    websiteUrl: 'https://platform.moonshot.cn',
    apiKeyUrl: 'https://platform.moonshot.cn/console/api-keys',
    capabilities: TEXT_ONLY,
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    type: 'openai-compatible',
    endpoint: 'https://api.siliconflow.cn/v1',
    appendV1: false,
    defaultModel: '',
    category: 'cn_official',
    websiteUrl: 'https://siliconflow.cn',
    apiKeyUrl: 'https://cloud.siliconflow.cn/account/ak',
    capabilities: TEXT_ONLY,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'openai-compatible',
    endpoint: 'https://openrouter.ai/api/v1',
    appendV1: false,
    defaultModel: '',
    category: 'aggregator',
    websiteUrl: 'https://openrouter.ai',
    apiKeyUrl: 'https://openrouter.ai/keys',
    capabilities: TEXT_ONLY,
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    type: 'openai-compatible',
    endpoint: 'https://api.x.ai/v1',
    appendV1: false,
    defaultModel: 'grok-3',
    category: 'official',
    websiteUrl: 'https://console.x.ai',
    apiKeyUrl: 'https://console.x.ai',
    capabilities: TEXT_ONLY,
  },
  {
    id: 'custom',
    name: 'Custom',
    type: 'openai-compatible',
    endpoint: '',
    appendV1: true,
    defaultModel: '',
    category: 'custom',
    capabilities: TEXT_ONLY,
  },
] as const

export const AI_PROVIDER_PRESET_CATEGORY_ORDER: readonly AIProviderPresetCategory[] =
  ['official', 'cn_official', 'aggregator', 'custom'] as const

export function createProviderFromPreset(
  preset: AIProviderPreset,
  values: AIProviderPresetTemplateValues = {},
): AIProviderConfig {
  const projectId = values.projectId?.trim()
  return {
    apiKey: '',
    appendV1: preset.appendV1,
    capabilities: preset.capabilities ?? {
      image: false,
      speech: false,
      text: true,
    },
    defaultModel: preset.defaultModel,
    enabled: true,
    endpoint: interpolatePresetTemplate(preset.endpoint, values),
    id: crypto.randomUUID(),
    modelListUrl: preset.modelListUrl,
    name: preset.id === 'custom' ? '' : preset.name,
    projectId: projectId || undefined,
    type: preset.type,
  }
}

export function interpolatePresetTemplate(
  template: string | undefined,
  values: AIProviderPresetTemplateValues,
): string | undefined {
  const normalized = template?.trim()
  if (!normalized) return undefined

  let cursor = 0
  let result = ''
  while (cursor < normalized.length) {
    const start = normalized.indexOf('{{', cursor)
    if (start === -1) return result + normalized.slice(cursor)
    const end = normalized.indexOf('}}', start + 2)
    if (end === -1) return result + normalized.slice(cursor)

    const key = normalized.slice(start + 2, end).trim()
    const value = values[key as keyof AIProviderPresetTemplateValues]?.trim()
    result += normalized.slice(cursor, start)
    result += value ? encodeURIComponent(value) : ''
    cursor = end + 2
  }
  return result
}

export function findAIProviderPreset(
  provider: Pick<AIProviderConfig, 'endpoint' | 'name' | 'type'>,
): AIProviderPreset | undefined {
  const endpoint = provider.endpoint?.trim().replace(/\/+$/, '') ?? ''
  if (endpoint) {
    const byEndpoint = aiProviderPresets.find((preset) => {
      if (preset.id === 'custom') return false
      const presetEndpoint = preset.endpoint?.trim().replace(/\/+$/, '') ?? ''
      return presetEndpoint !== '' && presetEndpoint === endpoint
    })
    if (byEndpoint) return byEndpoint
  }

  const name = provider.name.trim().toLowerCase()
  if (!name) return undefined
  return aiProviderPresets.find(
    (preset) =>
      preset.id !== 'custom' &&
      preset.name.toLowerCase() === name &&
      preset.type === provider.type,
  )
}

export function groupAIProviderPresets(
  presets: readonly AIProviderPreset[] = aiProviderPresets,
): Array<{ category: AIProviderPresetCategory; presets: AIProviderPreset[] }> {
  return AI_PROVIDER_PRESET_CATEGORY_ORDER.map((category) => ({
    category,
    presets: presets.filter((preset) => preset.category === category),
  })).filter((group) => group.presets.length > 0)
}
