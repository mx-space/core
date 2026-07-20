import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus, Settings, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { getModels } from '~/api/ai'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { Switch, Toggle } from '~/ui/primitives/switch'
import { TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

import type {
  AIConfig,
  AIProviderConfig,
  AIProviderModel,
  AIProviderType,
} from '../../types/settings'
import { formatAIProviderLabel, getDefaultAIModel } from '../../utils/settings'
import { EmptyState, SettingsSection } from '../SettingsPrimitives'
import { AIModelAssignmentField } from './AIModelAssignmentField'
import { AIProviderDrawer } from './AIProviderDrawer'
import { AITextListField } from './AITextListField'

export function AIConfigEditor(props: {
  modelCacheKey: readonly unknown[]
  onChange: (value: AIConfig) => void
  value: AIConfig
}) {
  const { t } = useI18n()
  const [editingId, setEditingId] = useState<string | null>(null)
  const hasEnabledProvider = (props.value.providers ?? []).some(
    (provider) => provider.enabled,
  )
  const modelsQuery = useQuery({
    enabled: hasEnabledProvider,
    queryFn: async () => {
      const response = await getModels()
      const entries: Array<[string, AIProviderModel[]]> = response.map(
        (provider) => [provider.providerId, provider.models ?? []],
      )
      return Object.fromEntries(entries) as Record<string, AIProviderModel[]>
    },
    queryKey: props.modelCacheKey,
    staleTime: 24 * 60 * 60 * 1000,
  })
  const providerModels = modelsQuery.data ?? {}
  const providers = props.value.providers ?? []

  const updateConfig = (patch: Partial<AIConfig>) =>
    props.onChange({ ...props.value, ...patch })

  const updateProvider = (id: string, patch: Partial<AIProviderConfig>) => {
    updateConfig({
      providers: providers.map((provider) =>
        provider.id === id ? { ...provider, ...patch } : provider,
      ),
    })
  }

  const addProvider = () => {
    const type: AIProviderType = 'openai-compatible'
    const provider: AIProviderConfig = {
      apiKey: '',
      defaultModel: getDefaultAIModel(type),
      enabled: true,
      id: crypto.randomUUID(),
      name: '',
      type,
    }
    updateConfig({ providers: [...providers, provider] })
    setEditingId(provider.id)
  }

  const deleteProvider = (id: string) => {
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
            <Button onClick={addProvider} type="button" variant="subtle">
              <Plus aria-hidden="true" className="size-4" />
              {t('settings.ai.action.addProvider')}
            </Button>
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
          <TextInput
            disabled={
              !props.value.enableTranslation ||
              !props.value.enableTranslationReview
            }
            inputMode="numeric"
            label={t('settings.ai.switch.translationReviewScoreThreshold')}
            min={0}
            onChange={(value) => {
              const trimmed = value.trim()
              if (!trimmed) {
                updateConfig({ translationReviewScoreThreshold: 85 })
                return
              }
              const parsed = Number(trimmed)
              if (Number.isNaN(parsed)) return
              updateConfig({
                translationReviewScoreThreshold: Math.max(
                  0,
                  Math.min(100, parsed),
                ),
              })
            }}
            type="number"
            value={String(props.value.translationReviewScoreThreshold ?? 85)}
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
  return (
    <div className="flex items-center gap-3 py-3">
      <div className={cn('min-w-0 flex-1', !provider.enabled && 'opacity-60')}>
        <div className="truncate text-sm font-medium">
          {formatAIProviderLabel(provider, t)}
        </div>
        <div className="mt-1 truncate text-xs text-neutral-500">
          {provider.defaultModel || t('settings.ai.provider.row.empty')}
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
