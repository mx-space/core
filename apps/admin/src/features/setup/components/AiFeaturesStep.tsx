import type { PropsWithChildren } from 'react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { Switch } from '~/ui/primitives/switch'
import { cn } from '~/utils/cn'

import {
  useOnboardingAiConfig,
  useSaveOnboardingAiConfig,
} from '../hooks/use-onboarding-ai'
import { onboardingLanguages } from '../utils/onboarding'
import { getErrorMessage } from '../utils/setup'
import {
  OnboardingAsideTitle,
  OnboardingCard,
  OnboardingFooter,
  OnboardingShell,
} from './OnboardingShell'

interface FeatureDraft {
  insights: boolean
  languages: string[]
  summary: boolean
  translation: boolean
  tts: boolean
}

export function AiFeaturesStep(props: {
  onBack: () => void
  onLater?: () => void
  onNext: () => void
}) {
  const { t } = useI18n()
  const configQuery = useOnboardingAiConfig()
  const save = useSaveOnboardingAiConfig()
  const config = configQuery.data
  const [draft, setDraft] = useState<FeatureDraft | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const ttsAvailable = Boolean(
    config?.tts?.model?.providerId && config.tts.model.model,
  )

  useEffect(() => {
    if (!config || draft) return
    setDraft({
      insights: Boolean(config.enableInsights),
      languages: config.translationTargetLanguages ?? [],
      summary: Boolean(config.enableSummary),
      translation: Boolean(config.enableTranslation),
      tts: Boolean(config.tts?.enable),
    })
  }, [config, draft])

  const update = (patch: Partial<FeatureDraft>) =>
    setDraft((current) => (current ? { ...current, ...patch } : current))

  const toggleLanguage = (code: string) => {
    if (!draft) return
    update({
      languages: draft.languages.includes(code)
        ? draft.languages.filter((item) => item !== code)
        : [...draft.languages, code],
    })
  }

  const submit = async () => {
    if (!config || !draft || submitting) return
    setSubmitting(true)
    try {
      await save({
        ...config,
        enableInsights: draft.insights,
        enableSummary: draft.summary,
        enableTranslation: draft.translation,
        summaryTargetLanguages: config.summaryTargetLanguages?.length
          ? config.summaryTargetLanguages
          : draft.languages,
        translationTargetLanguages: draft.languages,
        tts: { ...config.tts, enable: ttsAvailable && draft.tts },
      })
      props.onNext()
    } catch (error) {
      toast.error(
        getErrorMessage(error, t('setup.onboarding.ai.features.saveError')),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const previewLanguages = onboardingLanguages.filter((language) =>
    draft?.languages.includes(language.code),
  )

  return (
    <OnboardingShell
      aside={
        <>
          <OnboardingAsideTitle>
            {t('setup.onboarding.ai.features.asideTitle')}
          </OnboardingAsideTitle>
          <div className="flex flex-col gap-2 rounded-sm border border-border bg-white p-3 shadow-xs">
            {draft?.translation && previewLanguages.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                <LanguageTag active>中文</LanguageTag>
                {previewLanguages.map((language) => (
                  <LanguageTag key={language.code}>
                    {language.label}
                  </LanguageTag>
                ))}
              </div>
            ) : null}
            <div className="h-3 w-3/4 rounded-xs bg-surface-inset" />
            <div className="h-2 w-full rounded-xs bg-surface-inset" />
            {draft?.summary ? (
              <div className="rounded-xs bg-surface-inset px-2.5 py-2 text-sm text-fg-muted">
                <span className="font-medium text-fg">
                  {t('setup.onboarding.ai.features.asideSummary')}
                </span>
                {' · '}
                {t('setup.onboarding.ai.features.asidePlaceholder')}
              </div>
            ) : null}
          </div>
        </>
      }
      onLater={props.onLater}
      step="ai-features"
    >
      <OnboardingCard
        description={t('setup.onboarding.ai.features.description')}
        footer={
          <OnboardingFooter onBack={props.onBack}>
            <Button
              data-testid="onboarding-submit"
              disabled={!draft || submitting}
              onClick={() => void submit()}
              type="button"
            >
              {t('setup.onboarding.ai.features.submit')}
            </Button>
          </OnboardingFooter>
        }
        title={t('setup.onboarding.ai.features.title')}
      >
        <div className="-my-1 divide-y divide-border">
          <FeatureRow
            checked={Boolean(draft?.translation)}
            hint={t('setup.onboarding.ai.features.translationHint')}
            id="translation"
            label={t('setup.onboarding.ai.features.translation')}
            onCheckedChange={(translation) => update({ translation })}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-sm text-fg-muted">
                {t('setup.onboarding.ai.features.targetLanguages')}
              </span>
              {onboardingLanguages.map((language) => {
                const selected = Boolean(
                  draft?.languages.includes(language.code),
                )
                return (
                  <button
                    aria-pressed={selected}
                    className={cn(
                      'h-6 rounded-xs px-2 text-sm transition-colors disabled:opacity-50',
                      selected
                        ? 'bg-accent-soft text-accent'
                        : 'bg-surface-inset text-fg hover:bg-black/[0.06]',
                    )}
                    data-testid={`onboarding-language-${language.code}`}
                    disabled={!draft?.translation}
                    key={language.code}
                    onClick={() => toggleLanguage(language.code)}
                    type="button"
                  >
                    {language.label}
                  </button>
                )
              })}
            </div>
          </FeatureRow>
          <FeatureRow
            checked={Boolean(draft?.summary)}
            hint={t('setup.onboarding.ai.features.summaryHint')}
            id="summary"
            label={t('setup.onboarding.ai.features.summary')}
            onCheckedChange={(summary) => update({ summary })}
          />
          <FeatureRow
            checked={Boolean(draft?.insights)}
            hint={t('setup.onboarding.ai.features.insightsHint')}
            id="insights"
            label={t('setup.onboarding.ai.features.insights')}
            onCheckedChange={(insights) => update({ insights })}
          />
          <FeatureRow
            checked={ttsAvailable && Boolean(draft?.tts)}
            disabled={!ttsAvailable}
            hint={
              ttsAvailable
                ? t('setup.onboarding.ai.features.ttsHint')
                : t('setup.onboarding.ai.features.ttsUnavailable')
            }
            id="tts"
            label={t('setup.onboarding.ai.features.tts')}
            onCheckedChange={(tts) => update({ tts })}
          />
        </div>
      </OnboardingCard>
    </OnboardingShell>
  )
}

function FeatureRow(
  props: PropsWithChildren<{
    checked: boolean
    disabled?: boolean
    hint: string
    id: string
    label: string
    onCheckedChange: (checked: boolean) => void
  }>,
) {
  return (
    <div
      className="flex flex-col gap-3 py-4"
      data-testid={`onboarding-feature-${props.id}`}
    >
      <div className="flex items-start gap-3">
        <span className="min-w-0 flex-1 text-sm">
          <span className="block font-medium text-fg">{props.label}</span>
          <span className="mt-0.5 block text-fg-muted">{props.hint}</span>
        </span>
        <Switch
          aria-label={props.label}
          checked={props.checked}
          disabled={props.disabled}
          onCheckedChange={props.onCheckedChange}
        />
      </div>
      {props.checked ? props.children : null}
    </div>
  )
}

function LanguageTag(props: PropsWithChildren<{ active?: boolean }>) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-xs px-2 text-sm',
        props.active
          ? 'bg-accent-soft text-accent'
          : 'bg-surface-inset text-fg',
      )}
    >
      {props.children}
    </span>
  )
}
