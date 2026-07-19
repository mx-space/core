import {
  CreditCard,
  ListPlus,
  Mail,
  Settings,
  Shield,
  User,
} from 'lucide-react'

import type { ConfigFormField } from '~/api/options'
import type { TranslationKey, TranslationValues } from '~/i18n/types'
import type { CreateMetaPresetDto, MetaPresetField } from '~/models/meta-preset'

import { aiProviderTypeOptions, typesWithOptions } from '../constants'
import type {
  AIConfig,
  AIProviderConfig,
  AIProviderType,
} from '../types/settings'

type Translator = (key: TranslationKey, values?: TranslationValues) => string

export function getGroupIcon(icon: string) {
  const iconMap: Record<string, typeof User> = {
    bell: Mail,
    'credit-card': CreditCard,
    database: Settings,
    globe: Settings,
    search: Settings,
    settings: Settings,
    shield: Shield,
    sparkles: Settings,
    user: User,
    'file-text': Settings,
    'list-plus': ListPlus,
  }
  return iconMap[icon] ?? Settings
}

export function shouldShowField(
  field: ConfigFormField,
  formData: Record<string, unknown>,
  sectionPrefix: string,
) {
  const showWhen = field.ui.showWhen
  if (!showWhen) return true

  return Object.entries(showWhen).every(([key, expected]) => {
    const actual = getPath(formData, `${sectionPrefix}.${key}`)
    const values = Array.isArray(expected) ? expected : [expected]
    return values.some((value) => String(actual) === String(value))
  })
}

export function getPath(source: unknown, path: string) {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[key]
  }, source)
}

export function setPathImmutable<T extends Record<string, unknown>>(
  source: T,
  path: string,
  value: unknown,
): T {
  const [head, ...rest] = path.split('.')
  if (!head) return source

  if (rest.length === 0) return { ...source, [head]: value }

  const current =
    source[head] && typeof source[head] === 'object'
      ? (source[head] as Record<string, unknown>)
      : {}

  return {
    ...source,
    [head]: setPathImmutable(current, rest.join('.'), value),
  }
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? {})) as T
}

export function isDeepEqual(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

export function stringValue(value: unknown) {
  if (value === undefined || value === null) return ''
  return String(value)
}

export function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function formatDateTimeInputValue(value: Date) {
  const offsetDate = new Date(
    value.getTime() - value.getTimezoneOffset() * 60_000,
  )
  return offsetDate.toISOString().slice(0, 16)
}

export function normalizeAIConfig(value: unknown): AIConfig {
  if (!value || typeof value !== 'object') {
    return { providers: [] }
  }
  const config = value as AIConfig
  return {
    ...config,
    providers: (config.providers ?? []).map((provider) => ({
      apiKey: provider.apiKey ?? '',
      appendV1: provider.appendV1 ?? true,
      contextWindow: provider.contextWindow ?? undefined,
      defaultModel: provider.defaultModel ?? '',
      enabled: Boolean(provider.enabled),
      endpoint: provider.endpoint ?? '',
      id: provider.id || crypto.randomUUID(),
      maxTokens: provider.maxTokens ?? undefined,
      modelListUrl: provider.modelListUrl ?? '',
      name: provider.name ?? '',
      type: coerceAIProviderType(provider.type),
    })),
  }
}

export function coerceAIProviderType(value: unknown): AIProviderType {
  if (value === 'anthropic' || value === 'generic') return value
  return 'openai-compatible'
}

export function formatAIProviderLabel(provider: AIProviderConfig) {
  const name = provider.name.trim()
  if (name) return name
  return (
    aiProviderTypeOptions.find((option) => option.value === provider.type)
      ?.label ?? provider.type
  )
}

export function getDefaultAIModel(type: AIProviderType) {
  switch (type) {
    case 'anthropic': {
      return 'claude-sonnet-4.5'
    }
    case 'generic': {
      return ''
    }
    case 'openai-compatible': {
      return ''
    }
  }
}

export function getAIProviderNamePlaceholder(
  t: Translator,
  type: AIProviderType,
) {
  switch (type) {
    case 'anthropic': {
      return t('settings.ai.placeholder.nameAnthropic')
    }
    case 'generic': {
      return t('settings.ai.placeholder.nameCompatible')
    }
    case 'openai-compatible': {
      return t('settings.ai.placeholder.nameCompatible')
    }
  }
}

export function getAIProviderKeyPlaceholder(type: AIProviderType) {
  switch (type) {
    case 'anthropic': {
      return 'sk-ant-...'
    }
    case 'generic':
    case 'openai-compatible': {
      return 'sk-...'
    }
  }
}

export function getAIProviderModelPlaceholder(
  t: Translator,
  type: AIProviderType,
) {
  switch (type) {
    case 'anthropic': {
      return t('settings.ai.placeholder.modelAnthropic')
    }
    case 'generic': {
      return t('settings.ai.placeholder.modelCompatible')
    }
    case 'openai-compatible': {
      return t('settings.ai.placeholder.modelCompatible')
    }
  }
}

const PI_PROVIDER_HOSTNAMES: Record<string, string> = {
  'api.anthropic.com': 'anthropic',
  'api.deepseek.com': 'deepseek',
  'api.openai.com': 'openai',
  'openrouter.ai': 'openrouter',
}

export function resolvePiProviderId(provider: {
  endpoint?: string
  type: AIProviderType
}): string | null {
  const endpoint = provider.endpoint?.trim()
  if (endpoint) {
    try {
      const host = new URL(endpoint).hostname.toLowerCase()
      if (PI_PROVIDER_HOSTNAMES[host]) return PI_PROVIDER_HOSTNAMES[host]
    } catch {
      // not a parseable URL — fall through to type fallback
    }
  }
  switch (provider.type) {
    case 'anthropic': {
      return 'anthropic'
    }
    case 'openai-compatible': {
      return 'openai'
    }
    case 'generic': {
      return null
    }
  }
}

export function matchRegistryModel(
  models: { id: string }[] | undefined,
  modelId: string,
): { id: string } | undefined {
  const target = modelId.trim().toLowerCase()
  if (!target) return undefined
  return (models ?? []).find((m) => m.id.trim().toLowerCase() === target)
}

export function mergeModelOptions(
  fetchedModels: { id: string }[] | undefined,
  registryModels: { id: string }[] | undefined,
): string[] {
  const seen = new Set<string>()
  const merged: string[] = []
  for (const model of [...(fetchedModels ?? []), ...(registryModels ?? [])]) {
    const id = model.id.trim()
    if (!id) continue
    const key = id.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(id)
  }
  return merged
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function emptyMetaPreset(): CreateMetaPresetDto {
  return {
    enabled: true,
    key: '',
    label: '',
    scope: 'both',
    type: 'text',
  }
}

export function metaPresetToForm(preset: MetaPresetField): CreateMetaPresetDto {
  return {
    allowCustomOption: preset.allowCustomOption,
    children: preset.children,
    description: preset.description ?? '',
    enabled: preset.enabled,
    key: preset.key,
    label: preset.label,
    options: preset.options,
    placeholder: preset.placeholder ?? '',
    scope: preset.scope,
    type: preset.type,
  }
}

export function validateMetaPreset(t: Translator, form: CreateMetaPresetDto) {
  if (!form.key.trim()) return t('settings.meta.validation.needKey')
  if (!/^[\w-]+$/.test(form.key))
    return t('settings.meta.validation.invalidKey')
  if (!form.label.trim()) return t('settings.meta.validation.needLabel')
  if (typesWithOptions.includes(form.type) && !form.options?.length) {
    return t('settings.meta.validation.needOption')
  }
  if (form.type === 'object' && !form.children?.length) {
    return t('settings.meta.validation.needChildren')
  }
  return null
}
