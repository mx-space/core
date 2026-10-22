import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { getModelsByCapability } from '~/api/ai'
import type { AIProviderCapability } from '~/features/settings/types/settings'
import { useI18n } from '~/i18n'
import type { TranslationKey } from '~/i18n/types'
import { adminQueryKeys } from '~/query/keys'
import { Button } from '~/ui/primitives/button'
import { SelectField } from '~/ui/primitives/select'

import {
  useOnboardingAiConfig,
  useSaveOnboardingAiConfig,
} from '../hooks/use-onboarding-ai'
import type { ModelFeature, ModelOption } from '../utils/onboarding'
import {
  applyModelPlan,
  buildModelOptions,
  parseModelOption,
  toModelOption,
} from '../utils/onboarding'
import { getErrorMessage } from '../utils/setup'
import {
  OnboardingAsideTitle,
  OnboardingCard,
  OnboardingFooter,
  OnboardingShell,
} from './OnboardingShell'

const featureRows: Array<{
  capability: AIProviderCapability
  feature: ModelFeature
  hintKey: TranslationKey
  labelKey: TranslationKey
}> = [
  {
    capability: 'text',
    feature: 'writerModel',
    hintKey: 'setup.onboarding.ai.models.writerHint',
    labelKey: 'setup.onboarding.ai.models.writer',
  },
  {
    capability: 'text',
    feature: 'summaryModel',
    hintKey: 'setup.onboarding.ai.models.summaryHint',
    labelKey: 'setup.onboarding.ai.models.summary',
  },
  {
    capability: 'text',
    feature: 'translationModel',
    hintKey: 'setup.onboarding.ai.models.translationHint',
    labelKey: 'setup.onboarding.ai.models.translation',
  },
  {
    capability: 'text',
    feature: 'translationReviewModel',
    hintKey: 'setup.onboarding.ai.models.translationReviewHint',
    labelKey: 'setup.onboarding.ai.models.translationReview',
  },
  {
    capability: 'text',
    feature: 'insightsModel',
    hintKey: 'setup.onboarding.ai.models.insightsHint',
    labelKey: 'setup.onboarding.ai.models.insights',
  },
  {
    capability: 'speech',
    feature: 'ttsModel',
    hintKey: 'setup.onboarding.ai.models.ttsHint',
    labelKey: 'setup.onboarding.ai.models.tts',
  },
  {
    capability: 'image',
    feature: 'imageModel',
    hintKey: 'setup.onboarding.ai.models.imageHint',
    labelKey: 'setup.onboarding.ai.models.image',
  },
]

function useModelOptions(capability: AIProviderCapability) {
  return useQuery({
    queryFn: async () =>
      buildModelOptions(await getModelsByCapability(capability)),
    queryKey: adminQueryKeys.onboarding.models(capability),
  })
}

export function AiModelsStep(props: {
  onBack: () => void
  onLater?: () => void
  onNext: () => void
}) {
  const { t } = useI18n()
  const configQuery = useOnboardingAiConfig()
  const save = useSaveOnboardingAiConfig()
  const imageQuery = useModelOptions('image')
  const speechQuery = useModelOptions('speech')
  const textQuery = useModelOptions('text')
  const optionsByCapability: Record<AIProviderCapability, ModelOption[]> = {
    decision: [],
    image: imageQuery.data ?? [],
    speech: speechQuery.data ?? [],
    text: textQuery.data ?? [],
  }
  const modelsLoading =
    imageQuery.isPending || speechQuery.isPending || textQuery.isPending
  const textOptions = optionsByCapability.text
  const [defaultChoice, setDefaultChoice] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<
    Partial<Record<ModelFeature, string>>
  >({})
  const [submitting, setSubmitting] = useState(false)

  const savedDefault = toModelOption(configQuery.data?.writerModel)
  const defaultValue =
    defaultChoice ??
    (textOptions.some((option) => option.value === savedDefault)
      ? savedDefault
      : (textOptions[0]?.value ?? ''))

  const savedOverride = (feature: ModelFeature) => {
    if (feature === 'ttsModel')
      return toModelOption(configQuery.data?.tts?.model)
    if (feature === 'imageModel') {
      return toModelOption(configQuery.data?.imageGeneration?.model)
    }
    const saved = toModelOption(configQuery.data?.[feature])
    return saved === savedDefault ? '' : saved
  }

  const submit = async () => {
    if (!configQuery.data || submitting) return
    setSubmitting(true)
    try {
      const plan = {
        defaultModel: parseModelOption(defaultValue),
        overrides: Object.fromEntries(
          featureRows.map(({ feature }) => [
            feature,
            parseModelOption(overrides[feature] ?? savedOverride(feature)),
          ]),
        ),
      }
      await save(applyModelPlan(configQuery.data, plan))
      props.onNext()
    } catch (error) {
      toast.error(
        getErrorMessage(error, t('setup.onboarding.ai.models.saveError')),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <OnboardingShell
      aside={
        <>
          <OnboardingAsideTitle>
            {t('setup.onboarding.ai.models.asideTitle')}
          </OnboardingAsideTitle>
          <div className="flex flex-col gap-2.5 text-sm">
            <p>{t('setup.onboarding.ai.models.asideWriter')}</p>
            <p>{t('setup.onboarding.ai.models.asideBulk')}</p>
            <p className="text-fg-muted">
              {t('setup.onboarding.ai.models.asideLater')}
            </p>
          </div>
        </>
      }
      onLater={props.onLater}
      step="ai-models"
    >
      <OnboardingCard
        description={t('setup.onboarding.ai.models.description')}
        footer={
          <OnboardingFooter onBack={props.onBack}>
            <Button
              data-testid="onboarding-submit"
              disabled={submitting || modelsLoading || !configQuery.data}
              onClick={() => void submit()}
              type="button"
            >
              {t('setup.onboarding.action.continue')}
            </Button>
          </OnboardingFooter>
        }
        title={t('setup.onboarding.ai.models.title')}
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-1.5 text-sm">
            <span className="font-medium text-fg">
              {t('setup.onboarding.ai.models.default')}
            </span>
            <SelectField
              aria-label={t('setup.onboarding.ai.models.default')}
              disabled={textOptions.length === 0}
              onValueChange={setDefaultChoice}
              options={textOptions}
              value={defaultValue}
            />
          </div>
          <div className="divide-y divide-border rounded-sm border border-border">
            {featureRows.map((row) => {
              const capabilityOptions = optionsByCapability[row.capability]
              const unavailable = capabilityOptions.length === 0
              const emptyLabel = unavailable
                ? t('setup.onboarding.ai.models.notConfigured')
                : row.capability === 'text'
                  ? t('setup.onboarding.ai.models.followDefault')
                  : t('setup.onboarding.ai.models.none')
              return (
                <div
                  className="flex items-center gap-3 px-3 py-2.5"
                  key={row.feature}
                >
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block font-medium text-fg">
                      {t(row.labelKey)}
                    </span>
                    <span className="block text-fg-muted">
                      {t(row.hintKey)}
                    </span>
                  </span>
                  <SelectField
                    aria-label={t(row.labelKey)}
                    className="w-44 shrink-0 sm:w-56"
                    disabled={unavailable}
                    onValueChange={(value) =>
                      setOverrides((current) => ({
                        ...current,
                        [row.feature]: value,
                      }))
                    }
                    options={[
                      { label: emptyLabel, value: '' },
                      ...capabilityOptions,
                    ]}
                    value={overrides[row.feature] ?? savedOverride(row.feature)}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </OnboardingCard>
    </OnboardingShell>
  )
}
