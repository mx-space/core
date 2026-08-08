import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus, Settings, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { toast } from 'sonner'

import { getModelsByCapability } from '~/api/ai'
import { useI18n } from '~/i18n'
import type { TranslationKey } from '~/i18n/types'
import { DropdownMenu } from '~/ui/overlay/dropdown-menu'
import { Button } from '~/ui/primitives/button'
import { SelectField } from '~/ui/primitives/select'
import { Switch, Toggle } from '~/ui/primitives/switch'
import { TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

import {
  type AIProviderPreset,
  type AIProviderPresetCategory,
  createProviderFromPreset,
  groupAIProviderPresets,
} from '../../config/aiProviderPresets'
import type {
  AIConfig,
  AIProviderConfig,
  AIProviderModel,
} from '../../types/settings'
import { formatAIProviderLabel } from '../../utils/settings'
import { EmptyState, FieldShell, SettingsSection } from '../SettingsPrimitives'
import { AIModelAssignmentField } from './AIModelAssignmentField'
import { AIProviderDrawer } from './AIProviderDrawer'
import { presentAIProviderPresetModal } from './AIProviderPresetModal'
import { AITextListField } from './AITextListField'
import { TtsVoiceField } from './TtsVoiceField'

const PRESET_CATEGORY_LABEL_KEYS: Record<
  AIProviderPresetCategory,
  TranslationKey
> = {
  aggregator: 'settings.ai.preset.category.aggregator',
  cn_official: 'settings.ai.preset.category.cnOfficial',
  custom: 'settings.ai.preset.category.custom',
  official: 'settings.ai.preset.category.official',
}

const PRESET_NAME_KEYS: Partial<Record<string, TranslationKey>> = {
  anthropic: 'settings.ai.preset.name.anthropic',
  custom: 'settings.ai.preset.name.custom',
  deepseek: 'settings.ai.preset.name.deepseek',
  google: 'settings.ai.preset.name.google',
  googleVertex: 'settings.ai.preset.name.googleVertex',
  moonshot: 'settings.ai.preset.name.moonshot',
  openai: 'settings.ai.preset.name.openai',
  openrouter: 'settings.ai.preset.name.openrouter',
  siliconflow: 'settings.ai.preset.name.siliconflow',
  xai: 'settings.ai.preset.name.xai',
}

async function getProviderModels(capability: 'image' | 'speech' | 'text') {
  const response = await getModelsByCapability(capability)
  const entries: Array<[string, AIProviderModel[]]> = response.map(
    (provider) => [provider.providerId, provider.models ?? []],
  )
  return Object.fromEntries(entries) as Record<string, AIProviderModel[]>
}

export function AIConfigEditor(props: {
  modelCacheKey: readonly unknown[]
  onChange: (value: AIConfig) => void
  value: AIConfig
}) {
  const { t } = useI18n()
  const [editingId, setEditingId] = useState<string | null>(null)
  const providers = props.value.providers ?? []
  const hasEnabledTextProvider = providers.some(
    (provider) => provider.enabled && (provider.capabilities?.text ?? true),
  )
  const hasEnabledSpeechProvider = providers.some(
    (provider) => provider.enabled && provider.capabilities?.speech,
  )
  const hasEnabledImageProvider = providers.some(
    (provider) => provider.enabled && provider.capabilities?.image,
  )
  const modelsQuery = useQuery({
    enabled: hasEnabledTextProvider,
    queryFn: () => getProviderModels('text'),
    queryKey: props.modelCacheKey,
    staleTime: 24 * 60 * 60 * 1000,
  })
  const speechModelsQuery = useQuery({
    enabled: hasEnabledSpeechProvider,
    queryFn: () => getProviderModels('speech'),
    queryKey: [...props.modelCacheKey, 'speech'],
    staleTime: 24 * 60 * 60 * 1000,
  })
  const imageModelsQuery = useQuery({
    enabled: hasEnabledImageProvider,
    queryFn: () => getProviderModels('image'),
    queryKey: [...props.modelCacheKey, 'image'],
    staleTime: 24 * 60 * 60 * 1000,
  })
  const providerModels = modelsQuery.data ?? {}
  const speechProviderModels = speechModelsQuery.data ?? {}
  const imageProviderModels = imageModelsQuery.data ?? {}

  const updateConfig = (patch: Partial<AIConfig>) =>
    props.onChange({ ...props.value, ...patch })

  const updateProvider = (id: string, patch: Partial<AIProviderConfig>) => {
    updateConfig({
      providers: providers.map((provider) =>
        provider.id === id ? { ...provider, ...patch } : provider,
      ),
    })
  }

  const addProviderFromPreset = async (preset: AIProviderPreset) => {
    const values = preset.templateFields?.length
      ? await presentAIProviderPresetModal(preset)
      : {}
    if (values === undefined) return
    const provider = createProviderFromPreset(preset, values)
    updateConfig({ providers: [...providers, provider] })
    setEditingId(provider.id)
  }

  const presetGroups = groupAIProviderPresets()

  const deleteProvider = (id: string) => {
    const references = [
      props.value.summaryModel,
      props.value.writerModel,
      props.value.commentReviewModel,
      props.value.translationModel,
      props.value.translationReviewModel,
      props.value.insightsModel,
      props.value.insightsTranslationModel,
      props.value.imageGeneration?.model,
      props.value.tts?.model,
    ]
    if (references.some((assignment) => assignment?.providerId === id)) {
      toast.warning(t('settings.ai.error.providerInUse'))
      return
    }
    updateConfig({
      providers: providers.filter((provider) => provider.id !== id),
    })
  }

  const editingProvider =
    providers.find((provider) => provider.id === editingId) ?? null

  return (
    <>
      <div className="space-y-10">
        <SettingsSection
          actions={
            <DropdownMenu>
              <DropdownMenu.Trigger
                className="inline-flex h-8 items-center gap-2 rounded-sm border border-border bg-surface-card px-3 text-sm font-medium text-fg shadow-xs outline-hidden transition-colors hover:bg-surface-inset focus-visible:ring-[3px] focus-visible:ring-accent/15 data-[popup-open]:bg-surface-inset"
                type="button"
              >
                <Plus aria-hidden="true" className="size-4" />
                {t('settings.ai.action.addProvider')}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end" className="min-w-56">
                {presetGroups.map((group, index) => (
                  <DropdownMenu.Group key={group.category}>
                    {index > 0 ? <DropdownMenu.Separator /> : null}
                    <DropdownMenu.GroupLabel>
                      {t(PRESET_CATEGORY_LABEL_KEYS[group.category])}
                    </DropdownMenu.GroupLabel>
                    {group.presets.map((preset) => {
                      const nameKey = PRESET_NAME_KEYS[preset.id]
                      return (
                        <DropdownMenu.Item
                          className="items-start py-2"
                          key={preset.id}
                          onClick={() => void addProviderFromPreset(preset)}
                        >
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate font-medium">
                              {nameKey ? t(nameKey) : preset.name}
                            </span>
                            {preset.endpoint ? (
                              <span className="truncate text-xs text-fg-subtle">
                                {preset.endpoint}
                              </span>
                            ) : null}
                          </span>
                        </DropdownMenu.Item>
                      )
                    })}
                  </DropdownMenu.Group>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu>
          }
          description={t('settings.ai.provider.sectionTitleDescription')}
          title={t('settings.ai.provider.sectionTitle')}
        >
          {providers.length === 0 ? (
            <EmptyState
              icon={<Settings className="size-7" />}
              label={t('settings.ai.empty.providers')}
            />
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
              {providers.map((provider) => (
                <ProviderRow
                  key={provider.id}
                  onDelete={() => {
                    if (
                      window.confirm(t('settings.ai.confirm.deleteProvider'))
                    ) {
                      deleteProvider(provider.id)
                    }
                  }}
                  onEdit={() => setEditingId(provider.id)}
                  onToggle={(enabled) =>
                    updateProvider(provider.id, { enabled })
                  }
                  provider={provider}
                />
              ))}
            </div>
          )}
        </SettingsSection>

        <FeatureSection
          assignment={
            <AIModelAssignmentField
              label={t('settings.ai.assignment.summaryLabel')}
              models={providerModels}
              onChange={(summaryModel) => updateConfig({ summaryModel })}
              providers={providers}
              value={props.value.summaryModel}
            />
          }
          description={t('settings.ai.section.summaryDescription')}
          enabled={Boolean(props.value.enableSummary)}
          onEnabledChange={(enableSummary) => updateConfig({ enableSummary })}
          title={t('settings.ai.section.summary')}
          toggleLabel={t('settings.ai.switch.enableSummary')}
        >
          <Switch
            checked={Boolean(props.value.enableAutoGenerateSummaryOnCreate)}
            disabled={!props.value.enableSummary}
            label={t('settings.ai.switch.enableAutoSummaryCreate')}
            onCheckedChange={(enableAutoGenerateSummaryOnCreate) =>
              updateConfig({ enableAutoGenerateSummaryOnCreate })
            }
          />
          <Switch
            checked={Boolean(props.value.enableAutoGenerateSummaryOnUpdate)}
            disabled={!props.value.enableSummary}
            label={t('settings.ai.switch.enableAutoSummaryUpdate')}
            onCheckedChange={(enableAutoGenerateSummaryOnUpdate) =>
              updateConfig({ enableAutoGenerateSummaryOnUpdate })
            }
          />
          <AITextListField
            disabled={!props.value.enableSummary}
            label={t('settings.ai.switch.summaryTargetLanguages')}
            onChange={(summaryTargetLanguages) =>
              updateConfig({ summaryTargetLanguages })
            }
            value={props.value.summaryTargetLanguages ?? []}
          />
          <TextInput
            disabled={!props.value.enableSummary}
            inputMode="numeric"
            label={t('settings.ai.switch.summaryMinTextLength')}
            onChange={(value) =>
              updateConfig({
                summaryMinTextLength: value.trim() ? Number(value) : 0,
              })
            }
            type="number"
            value={String(props.value.summaryMinTextLength ?? 0)}
          />
        </FeatureSection>

        <FeatureSection
          assignment={
            <>
              <AIModelAssignmentField
                label={t('settings.ai.assignment.insightsLabel')}
                models={providerModels}
                onChange={(insightsModel) => updateConfig({ insightsModel })}
                providers={providers}
                value={props.value.insightsModel}
              />
              <AIModelAssignmentField
                label={t('settings.ai.assignment.insightsTranslationLabel')}
                models={providerModels}
                onChange={(insightsTranslationModel) =>
                  updateConfig({ insightsTranslationModel })
                }
                providers={providers}
                value={props.value.insightsTranslationModel}
              />
            </>
          }
          description={t('settings.ai.section.insightsDescription')}
          enabled={Boolean(props.value.enableInsights)}
          onEnabledChange={(enableInsights) => updateConfig({ enableInsights })}
          title={t('settings.ai.section.insights')}
          toggleLabel={t('settings.ai.switch.enableInsights')}
        >
          <Switch
            checked={Boolean(props.value.enableAutoGenerateInsightsOnCreate)}
            disabled={!props.value.enableInsights}
            label={t('settings.ai.switch.enableAutoInsightsCreate')}
            onCheckedChange={(enableAutoGenerateInsightsOnCreate) =>
              updateConfig({ enableAutoGenerateInsightsOnCreate })
            }
          />
          <Switch
            checked={Boolean(props.value.enableAutoGenerateInsightsOnUpdate)}
            disabled={!props.value.enableInsights}
            label={t('settings.ai.switch.enableAutoInsightsUpdate')}
            onCheckedChange={(enableAutoGenerateInsightsOnUpdate) =>
              updateConfig({ enableAutoGenerateInsightsOnUpdate })
            }
          />
          <Switch
            checked={Boolean(props.value.enableAutoTranslateInsights)}
            disabled={!props.value.enableInsights}
            label={t('settings.ai.switch.enableAutoTranslateInsights')}
            onCheckedChange={(enableAutoTranslateInsights) =>
              updateConfig({ enableAutoTranslateInsights })
            }
          />
          <AITextListField
            disabled={!props.value.enableInsights}
            label={t('settings.ai.switch.insightsTargetLanguages')}
            onChange={(insightsTargetLanguages) =>
              updateConfig({ insightsTargetLanguages })
            }
            value={props.value.insightsTargetLanguages ?? []}
          />
          <TextInput
            disabled={!props.value.enableInsights}
            inputMode="numeric"
            label={t('settings.ai.switch.insightsMinTextLength')}
            onChange={(value) =>
              updateConfig({
                insightsMinTextLength: value.trim() ? Number(value) : 0,
              })
            }
            type="number"
            value={String(props.value.insightsMinTextLength ?? 0)}
          />
        </FeatureSection>

        <FeatureSection
          assignment={
            <>
              <AIModelAssignmentField
                label={t('settings.ai.assignment.translationLabel')}
                models={providerModels}
                onChange={(translationModel) =>
                  updateConfig({ translationModel })
                }
                providers={providers}
                value={props.value.translationModel}
              />
              <AIModelAssignmentField
                label={t('settings.ai.assignment.translationReviewLabel')}
                models={providerModels}
                onChange={(translationReviewModel) =>
                  updateConfig({ translationReviewModel })
                }
                providers={providers}
                value={props.value.translationReviewModel}
              />
            </>
          }
          description={t('settings.ai.section.translationDescription')}
          enabled={Boolean(props.value.enableTranslation)}
          onEnabledChange={(enableTranslation) =>
            updateConfig({ enableTranslation })
          }
          title={t('settings.ai.section.translation')}
          toggleLabel={t('settings.ai.switch.enableTranslation')}
        >
          <Switch
            checked={Boolean(props.value.enableAutoGenerateTranslation)}
            disabled={!props.value.enableTranslation}
            label={t('settings.ai.switch.enableAutoTranslate')}
            onCheckedChange={(enableAutoGenerateTranslation) =>
              updateConfig({ enableAutoGenerateTranslation })
            }
          />
          <Switch
            checked={Boolean(props.value.enableTranslationReview)}
            disabled={!props.value.enableTranslation}
            label={t('settings.ai.switch.enableTranslationReview')}
            onCheckedChange={(enableTranslationReview) =>
              updateConfig({ enableTranslationReview })
            }
          />
          <AITextListField
            disabled={!props.value.enableTranslation}
            label={t('settings.ai.switch.translationTargetLanguages')}
            onChange={(translationTargetLanguages) =>
              updateConfig({ translationTargetLanguages })
            }
            value={props.value.translationTargetLanguages ?? []}
          />
        </FeatureSection>

        <FeatureSection
          assignment={
            <AIModelAssignmentField
              capability="image"
              label={t('settings.ai.assignment.imageGenerationLabel')}
              modelPlaceholder={t(
                'settings.ai.assignment.mediaModelPlaceholder',
              )}
              models={imageProviderModels}
              onChange={(model) =>
                updateConfig({
                  imageGeneration: {
                    ...props.value.imageGeneration,
                    model,
                  },
                })
              }
              providers={providers}
              value={props.value.imageGeneration?.model}
            />
          }
          description={t('settings.ai.section.imageGenerationDescription')}
          enabled={Boolean(props.value.imageGeneration?.enable)}
          onEnabledChange={(enable) =>
            updateConfig({
              imageGeneration: {
                ...props.value.imageGeneration,
                enable,
              },
            })
          }
          title={t('settings.ai.section.imageGeneration')}
          toggleLabel={t('settings.ai.switch.enableImageGeneration')}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <FieldShell label={t('settings.ai.field.defaultAspectRatio')}>
              <SelectField<string>
                onValueChange={(defaultAspectRatio) =>
                  updateConfig({
                    imageGeneration: {
                      ...props.value.imageGeneration,
                      defaultAspectRatio,
                    },
                  })
                }
                options={[
                  '1:1',
                  '3:2',
                  '2:3',
                  '4:3',
                  '3:4',
                  '16:9',
                  '9:16',
                ].map((value) => ({ label: value, value }))}
                value={
                  props.value.imageGeneration?.defaultAspectRatio ?? '16:9'
                }
              />
            </FieldShell>
            <FieldShell label={t('settings.ai.field.defaultQuality')}>
              <SelectField<'high' | 'low' | 'standard'>
                onValueChange={(defaultQuality) =>
                  updateConfig({
                    imageGeneration: {
                      ...props.value.imageGeneration,
                      defaultQuality,
                    },
                  })
                }
                options={[
                  { label: t('settings.ai.option.qualityLow'), value: 'low' },
                  {
                    label: t('settings.ai.option.qualityStandard'),
                    value: 'standard',
                  },
                  { label: t('settings.ai.option.qualityHigh'), value: 'high' },
                ]}
                value={
                  props.value.imageGeneration?.defaultQuality ?? 'standard'
                }
              />
            </FieldShell>
            <FieldShell label={t('settings.ai.field.defaultFormat')}>
              <SelectField<'jpeg' | 'png' | 'webp'>
                onValueChange={(defaultFormat) =>
                  updateConfig({
                    imageGeneration: {
                      ...props.value.imageGeneration,
                      defaultFormat,
                    },
                  })
                }
                options={['png', 'jpeg', 'webp'].map((value) => ({
                  label: value.toUpperCase(),
                  value: value as 'jpeg' | 'png' | 'webp',
                }))}
                value={props.value.imageGeneration?.defaultFormat ?? 'png'}
              />
            </FieldShell>
          </div>
        </FeatureSection>

        <FeatureSection
          assignment={
            <AIModelAssignmentField
              capability="speech"
              label={t('settings.ai.assignment.ttsLabel')}
              modelPlaceholder={t(
                'settings.ai.assignment.mediaModelPlaceholder',
              )}
              models={speechProviderModels}
              onChange={(model) =>
                updateConfig({
                  tts: {
                    ...props.value.tts,
                    model,
                  },
                })
              }
              providers={providers}
              value={props.value.tts?.model}
            />
          }
          description={t('settings.ai.section.ttsDescription')}
          enabled={Boolean(props.value.tts?.enable)}
          onEnabledChange={(enable) =>
            updateConfig({ tts: { ...props.value.tts, enable } })
          }
          title={t('settings.ai.section.tts')}
          toggleLabel={t('settings.ai.switch.enableTts')}
        >
          <div className="grid items-start gap-4 md:grid-cols-2">
            <TtsVoiceField
              model={props.value.tts?.model?.model}
              onChange={(voice) =>
                updateConfig({ tts: { ...props.value.tts, voice } })
              }
              providerId={props.value.tts?.model?.providerId}
              value={props.value.tts?.voice ?? ''}
            />
            <TextInput
              inputMode="decimal"
              label={t('settings.ai.field.speed')}
              onChange={(value) =>
                updateConfig({
                  tts: {
                    ...props.value.tts,
                    speed: value.trim() ? Number(value) : 1,
                  },
                })
              }
              type="number"
              value={String(props.value.tts?.speed ?? 1)}
            />
            <TextInput
              inputMode="numeric"
              label={t('settings.ai.field.maxCharsPerChunk')}
              onChange={(value) =>
                updateConfig({
                  tts: {
                    ...props.value.tts,
                    maxCharsPerChunk: value.trim() ? Number(value) : 1800,
                  },
                })
              }
              type="number"
              value={String(props.value.tts?.maxCharsPerChunk ?? 1800)}
            />
            <TextInput
              inputMode="numeric"
              label={t('settings.ai.field.concurrency')}
              onChange={(value) =>
                updateConfig({
                  tts: {
                    ...props.value.tts,
                    concurrency: value.trim() ? Number(value) : 3,
                  },
                })
              }
              type="number"
              value={String(props.value.tts?.concurrency ?? 3)}
            />
            <TextInput
              inputMode="numeric"
              label={t('settings.ai.field.maxCharsPerRun')}
              onChange={(value) =>
                updateConfig({
                  tts: {
                    ...props.value.tts,
                    maxCharsPerRun: value.trim() ? Number(value) : 120000,
                  },
                })
              }
              type="number"
              value={String(props.value.tts?.maxCharsPerRun ?? 120000)}
            />
          </div>
        </FeatureSection>

        <SettingsSection
          description={t('settings.ai.section.otherModelsDescription')}
          title={t('settings.ai.section.otherModels')}
        >
          <div className="space-y-4">
            <AIModelAssignmentField
              label={t('settings.ai.assignment.writerLabel')}
              models={providerModels}
              onChange={(writerModel) => updateConfig({ writerModel })}
              providers={providers}
              value={props.value.writerModel}
            />
            <AIModelAssignmentField
              label={t('settings.ai.assignment.commentReviewLabel')}
              models={providerModels}
              onChange={(commentReviewModel) =>
                updateConfig({ commentReviewModel })
              }
              providers={providers}
              value={props.value.commentReviewModel}
            />
          </div>
        </SettingsSection>
      </div>

      <AIProviderDrawer
        modelCacheKey={props.modelCacheKey}
        onChange={(patch) =>
          editingId ? updateProvider(editingId, patch) : undefined
        }
        onClose={() => setEditingId(null)}
        provider={editingProvider}
        providerModels={
          editingProvider ? (providerModels[editingProvider.id] ?? []) : []
        }
      />
    </>
  )
}

function ProviderRow(props: {
  onDelete: () => void
  onEdit: () => void
  onToggle: (enabled: boolean) => void
  provider: AIProviderConfig
}) {
  const { t } = useI18n()
  const provider = props.provider
  const capabilities = [
    (provider.capabilities?.text ?? true)
      ? t('settings.ai.capability.text')
      : null,
    provider.capabilities?.image ? t('settings.ai.capability.image') : null,
    provider.capabilities?.speech ? t('settings.ai.capability.speech') : null,
  ].filter(Boolean)
  return (
    <div className="flex items-center gap-3 py-3">
      <div className={cn('min-w-0 flex-1', !provider.enabled && 'opacity-60')}>
        <div className="truncate text-sm font-medium">
          {formatAIProviderLabel(provider)}
        </div>
        <div className="mt-1 truncate text-xs text-neutral-500">
          {capabilities.join(' · ') || t('settings.ai.provider.row.empty')}
        </div>
      </div>
      <Toggle
        aria-label={t('settings.oauth.switch.enabled')}
        checked={provider.enabled}
        onCheckedChange={props.onToggle}
      />
      <Button
        aria-label={t('settings.ai.provider.editAction')}
        onClick={props.onEdit}
        type="button"
        variant="subtle"
      >
        <Pencil aria-hidden="true" className="size-4" />
      </Button>
      <Button
        aria-label={t('common.delete')}
        onClick={props.onDelete}
        type="button"
        variant="subtle"
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </Button>
    </div>
  )
}

function FeatureSection(props: {
  assignment: ReactNode
  children: ReactNode
  description?: string
  enabled: boolean
  onEnabledChange: (value: boolean) => void
  title: string
  toggleLabel: string
}) {
  return (
    <SettingsSection description={props.description} title={props.title}>
      <div className="space-y-4">
        <Switch
          checked={props.enabled}
          label={props.toggleLabel}
          onCheckedChange={props.onEnabledChange}
        />
        {props.assignment}
        {props.children}
      </div>
    </SettingsSection>
  )
}
