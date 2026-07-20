import { ListPlus, Shield, User } from 'lucide-react'

import type { TranslationKey } from '~/i18n/types'
import type { MetaFieldType, MetaPresetScope } from '~/models/meta-preset'
import { adminQueryKeys } from '~/query/keys'

import type {
  AIProviderType,
  OauthProviderType,
  SettingsGroupSummary,
} from './types/settings'

export const settingsQueryKey = adminQueryKeys.settings.root
export const metaPresetsQueryKey = adminQueryKeys.metaPresets.root
export const accountQueryKey = adminQueryKeys.settings.accountRoot

export const systemGroupTranslationKeys: Record<
  string,
  { descriptionKey: TranslationKey; titleKey: TranslationKey }
> = {
  ai: {
    descriptionKey: 'settings.group.ai.description',
    titleKey: 'settings.group.ai.title',
  },
  content: {
    descriptionKey: 'settings.group.content.description',
    titleKey: 'settings.group.content.title',
  },
  integrations: {
    descriptionKey: 'settings.group.integrations.description',
    titleKey: 'settings.group.integrations.title',
  },
  membership: {
    descriptionKey: 'settings.group.membership.description',
    titleKey: 'settings.group.membership.title',
  },
  notification: {
    descriptionKey: 'settings.group.notification.description',
    titleKey: 'settings.group.notification.title',
  },
  search: {
    descriptionKey: 'settings.group.search.description',
    titleKey: 'settings.group.search.title',
  },
  site: {
    descriptionKey: 'settings.group.site.description',
    titleKey: 'settings.group.site.title',
  },
  storage: {
    descriptionKey: 'settings.group.storage.description',
    titleKey: 'settings.group.storage.title',
  },
  system: {
    descriptionKey: 'settings.group.system.description',
    titleKey: 'settings.group.system.title',
  },
}

export const aiProviderTypeOptions: Array<{
  labelKey: TranslationKey
  value: AIProviderType
}> = [
  {
    labelKey: 'settings.ai.providerType.openaiCompatible',
    value: 'openai-compatible',
  },
  { labelKey: 'settings.ai.providerType.anthropic', value: 'anthropic' },
  { labelKey: 'settings.ai.providerType.generic', value: 'generic' },
]

type SocialOption =
  | { label: string; labelKey?: undefined; value: string }
  | { label?: undefined; labelKey: TranslationKey; value: string }

export const socialOptions: readonly SocialOption[] = [
  { label: 'GitHub', value: 'github' },
  { label: 'Weibo', value: 'weibo' },
  { labelKey: 'settings.social.netease', value: 'netease' },
  { labelKey: 'settings.social.bilibili', value: 'bilibili' },
] as const

export const staticGroupsBefore: SettingsGroupSummary[] = [
  {
    descriptionKey: 'settings.group.user.description',
    icon: User,
    key: 'user',
    titleKey: 'settings.group.user.title',
    type: 'user',
  },
]

export const staticGroupsAfter: SettingsGroupSummary[] = [
  {
    descriptionKey: 'settings.group.account.description',
    icon: Shield,
    key: 'account',
    titleKey: 'settings.group.account.title',
    type: 'account',
  },
  {
    descriptionKey: 'settings.group.metaPreset.description',
    icon: ListPlus,
    key: 'meta-preset',
    titleKey: 'settings.group.metaPreset.title',
    type: 'meta-preset',
  },
]

export const oauthProviders = [
  { label: 'GitHub', type: 'github' },
  { label: 'Google', type: 'google' },
] as const satisfies Array<{ label: string; type: OauthProviderType }>

export const fieldTypeLabelKeys: Record<MetaFieldType, TranslationKey> = {
  boolean: 'settings.fieldType.boolean',
  checkbox: 'settings.fieldType.checkbox',
  'multi-select': 'settings.fieldType.multiSelect',
  number: 'settings.fieldType.number',
  object: 'settings.fieldType.object',
  select: 'settings.fieldType.select',
  tags: 'settings.fieldType.tags',
  text: 'settings.fieldType.text',
  textarea: 'settings.fieldType.textarea',
  url: 'settings.fieldType.url',
}

export const scopeLabelKeys: Record<MetaPresetScope, TranslationKey> = {
  both: 'settings.scope.both',
  note: 'settings.scope.note',
  post: 'settings.scope.post',
}

export const fieldTypeOptionKeys: Array<{
  labelKey: TranslationKey
  value: MetaFieldType
}> = [
  { labelKey: 'settings.fieldType.text', value: 'text' },
  { labelKey: 'settings.fieldType.textarea', value: 'textarea' },
  { labelKey: 'settings.fieldType.number', value: 'number' },
  { labelKey: 'settings.fieldType.url', value: 'url' },
  { labelKey: 'settings.fieldType.select', value: 'select' },
  { labelKey: 'settings.fieldType.multiSelect', value: 'multi-select' },
  { labelKey: 'settings.fieldType.checkbox', value: 'checkbox' },
  { labelKey: 'settings.fieldType.tags', value: 'tags' },
  { labelKey: 'settings.fieldType.boolean', value: 'boolean' },
  { labelKey: 'settings.fieldType.object', value: 'object' },
]

export const scopeOptionKeys: Array<{
  labelKey: TranslationKey
  value: MetaPresetScope
}> = [
  { labelKey: 'settings.scope.post', value: 'post' },
  { labelKey: 'settings.scope.note', value: 'note' },
  { labelKey: 'settings.scope.both', value: 'both' },
]

export const typesWithOptions: MetaFieldType[] = [
  'checkbox',
  'multi-select',
  'select',
]
