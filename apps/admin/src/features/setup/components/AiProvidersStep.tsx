import { CircleAlert, CircleCheck, Loader2, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { getModelList, testConfig } from '~/api/ai'
import type { AIProviderPreset } from '~/features/settings/config/aiProviderPresets'
import {
  aiProviderPresets,
  createProviderFromPreset,
} from '~/features/settings/config/aiProviderPresets'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

import {
  useOnboardingAiConfig,
  useSaveOnboardingAiConfig,
} from '../hooks/use-onboarding-ai'
import { getErrorMessage } from '../utils/setup'
import {
  FieldHint,
  OnboardingAsideTitle,
  OnboardingCard,
  OnboardingFooter,
  OnboardingShell,
} from './OnboardingShell'

const onboardingPresetIds = ['anthropic', 'openai', 'openrouter', 'custom']

const onboardingPresets = onboardingPresetIds
  .map((id) => aiProviderPresets.find((preset) => preset.id === id))
  .filter((preset): preset is AIProviderPreset => Boolean(preset))

type TestResult = { count: number; ok: true } | { message: string; ok: false }

export function AiProvidersStep(props: {
  onBack: () => void
  onLater?: () => void
  onNext: () => void
  onSkip: () => void
}) {
  const { t } = useI18n()
  const configQuery = useOnboardingAiConfig()
  const save = useSaveOnboardingAiConfig()
  const [preset, setPreset] = useState(onboardingPresets[0])
  const [apiKey, setApiKey] = useState('')
  const [endpoint, setEndpoint] = useState(preset.endpoint ?? '')
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)
  const [modelCounts, setModelCounts] = useState<Record<string, number>>({})
  const providers = configQuery.data?.providers ?? []

  const presetLabel = (item: AIProviderPreset) =>
    item.id === 'custom'
      ? t('setup.onboarding.ai.providers.compatible')
      : item.name

  const selectPreset = (item: AIProviderPreset) => {
    setPreset(item)
    setEndpoint(item.endpoint ?? '')
    setResult(null)
  }

  const addProvider = async () => {
    if (!configQuery.data || !apiKey.trim() || testing) return
    setTesting(true)
    setResult(null)
    const base = createProviderFromPreset(preset)
    const trimmedEndpoint = endpoint.trim() || base.endpoint
    const provider = {
      ...base,
      apiKey: apiKey.trim(),
      endpoint: trimmedEndpoint,
      name: base.name || hostnameOf(trimmedEndpoint) || presetLabel(preset),
    }

    try {
      const list = await getModelList({
        apiKey: provider.apiKey,
        endpoint: provider.endpoint,
        modelListUrl: provider.modelListUrl,
        providerId: provider.id,
        type: provider.type,
      })
      if (list.error) throw new Error(list.error)
      const model = provider.defaultModel || list.models[0]?.id
      if (!model) throw new Error(t('setup.onboarding.ai.providers.testFailed'))
      await testConfig({
        apiKey: provider.apiKey,
        appendV1: provider.appendV1,
        endpoint: provider.endpoint,
        model,
        providerId: provider.id,
        type: provider.type,
      })
      await save({
        ...configQuery.data,
        providers: [...providers, { ...provider, defaultModel: model }],
      })
      setModelCounts((current) => ({
        ...current,
        [provider.id]: list.models.length,
      }))
      setResult({ count: list.models.length, ok: true })
      setApiKey('')
    } catch (error) {
      setResult({
        message: getErrorMessage(
          error,
          t('setup.onboarding.ai.providers.testFailed'),
        ),
        ok: false,
      })
    } finally {
      setTesting(false)
    }
  }

  const removeProvider = async (id: string) => {
    if (!configQuery.data) return
    try {
      await save({
        ...configQuery.data,
        providers: providers.filter((provider) => provider.id !== id),
      })
    } catch (error) {
      toast.error(
        getErrorMessage(error, t('setup.onboarding.ai.providers.saveError')),
      )
    }
  }

  return (
    <OnboardingShell
      aside={
        <>
          <OnboardingAsideTitle>
            {t('setup.onboarding.ai.providers.asideTitle')}
          </OnboardingAsideTitle>
          <div className="flex flex-col gap-2">
            {providers.length === 0 ? (
              <p className="text-sm text-fg-subtle">
                {t('setup.onboarding.ai.providers.asideEmpty')}
              </p>
            ) : (
              providers.map((provider) => (
                <div
                  className="flex h-9 items-center gap-2 rounded-sm border border-border bg-white px-3 text-sm shadow-xs"
                  key={provider.id}
                >
                  <span className="size-1.5 rounded-full bg-green-600" />
                  <span className="truncate font-medium">{provider.name}</span>
                  {modelCounts[provider.id] ? (
                    <span className="ml-auto shrink-0 text-fg-muted">
                      {t('setup.onboarding.ai.providers.models', {
                        count: modelCounts[provider.id],
                      })}
                    </span>
                  ) : null}
                  <button
                    aria-label={t('setup.onboarding.ai.providers.remove')}
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-subtle hover:bg-surface-inset hover:text-fg',
                      !modelCounts[provider.id] && 'ml-auto',
                    )}
                    onClick={() => void removeProvider(provider.id)}
                    type="button"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
          <p className="mt-3 text-sm text-fg-muted">
            {t('setup.onboarding.ai.providers.asideHint')}
          </p>
        </>
      }
      onLater={props.onLater}
      step="ai-providers"
    >
      <OnboardingCard
        description={t('setup.onboarding.ai.providers.description')}
        footer={
          <OnboardingFooter onBack={props.onBack}>
            <Button onClick={props.onSkip} type="button" variant="ghost">
              {t('setup.onboarding.action.skipAi')}
            </Button>
            <Button
              data-testid="onboarding-submit"
              disabled={providers.length === 0}
              onClick={props.onNext}
              type="button"
            >
              {t('setup.onboarding.action.continue')}
            </Button>
          </OnboardingFooter>
        }
        title={t('setup.onboarding.ai.providers.title')}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {onboardingPresets.map((item) => (
              <button
                aria-pressed={item.id === preset.id}
                className={cn(
                  'h-8 truncate rounded-sm border px-2 text-sm font-medium transition-colors',
                  item.id === preset.id
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border bg-surface-card text-fg shadow-xs hover:bg-surface-inset',
                )}
                data-testid={`onboarding-preset-${item.id}`}
                key={item.id}
                onClick={() => selectPreset(item)}
                type="button"
              >
                {presetLabel(item)}
              </button>
            ))}
          </div>
          <TextInput
            autoComplete="off"
            label={t('setup.onboarding.ai.providers.apiKey')}
            name="apiKey"
            onChange={setApiKey}
            type="password"
            value={apiKey}
          />
          <div>
            <TextInput
              label={t('setup.onboarding.ai.providers.endpoint')}
              name="endpoint"
              onChange={setEndpoint}
              placeholder="https://"
              type="url"
              value={endpoint}
            />
            <FieldHint>
              {t('setup.onboarding.ai.providers.endpointHint')}
            </FieldHint>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              data-testid="onboarding-provider-add"
              disabled={!apiKey.trim() || testing || !configQuery.data}
              onClick={() => void addProvider()}
              type="button"
              variant="secondary"
            >
              {testing ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : null}
              {t('setup.onboarding.ai.providers.add')}
            </Button>
            {result ? <TestResultRow result={result} /> : null}
          </div>
        </div>
      </OnboardingCard>
    </OnboardingShell>
  )
}

function TestResultRow(props: { result: TestResult }) {
  const { t } = useI18n()
  if (props.result.ok) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-green-700">
        <CircleCheck aria-hidden="true" className="size-4" />
        {t('setup.onboarding.ai.providers.testOk', {
          count: props.result.count,
        })}
      </span>
    )
  }
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-sm text-red-600">
      <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{props.result.message}</span>
    </span>
  )
}

function hostnameOf(url?: string) {
  if (!url) return ''
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}
