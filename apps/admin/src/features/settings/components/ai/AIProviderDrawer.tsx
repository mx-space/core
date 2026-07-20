import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Loader2, Settings } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { getModelList, getRegistryModels, testConfig } from '~/api/ai'
import { useI18n } from '~/i18n'
import { Drawer } from '~/ui/feedback/drawer'
import { Button } from '~/ui/primitives/button'
import { Combobox } from '~/ui/primitives/combobox'
import { Scroll } from '~/ui/primitives/scroll'
import { SelectField } from '~/ui/primitives/select'
import { Switch } from '~/ui/primitives/switch'
import { TextInput } from '~/ui/primitives/text-field'

import { aiProviderTypeOptions } from '../../constants'
import type {
  AIProviderConfig,
  AIProviderModel,
  AIProviderType,
} from '../../types/settings'
import {
  formatAIProviderLabel,
  getAIProviderKeyPlaceholder,
  getAIProviderModelPlaceholder,
  getAIProviderNamePlaceholder,
  getDefaultAIModel,
  getErrorMessage,
  matchRegistryModel,
  mergeModelOptions,
  resolvePiProviderId,
} from '../../utils/settings'
import { FieldShell } from '../SettingsPrimitives'

const BUILD_HASH =
  (typeof window !== 'undefined' && (window as any).version) || 'dev'
const REGISTRY_STALE_MS = 10 * 60 * 1000

export function AIProviderDrawer(props: {
  modelCacheKey: readonly unknown[]
  onChange: (patch: Partial<AIProviderConfig>) => void
  onClose: () => void
  provider: AIProviderConfig | null
  providerModels: AIProviderModel[]
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [fetching, setFetching] = useState(false)
  const [testing, setTesting] = useState(false)
  const provider = props.provider

  const showEndpoint = Boolean(provider)
  const piProviderId = provider ? resolvePiProviderId(provider) : null

  const registryQuery = useQuery({
    enabled: Boolean(provider) && piProviderId !== null,
    queryFn: () => getRegistryModels(piProviderId as string),
    queryKey: ['ai-registry-models', piProviderId, BUILD_HASH] as const,
    staleTime: REGISTRY_STALE_MS,
  })

  const registryModels = registryQuery.data ?? []
  const modelOptions = useMemo(
    () => mergeModelOptions(props.providerModels, registryModels),
    [props.providerModels, registryModels],
  )
  const modelsDisabled = piProviderId === null && modelOptions.length === 0
  const modelMatch = useMemo(
    () =>
      provider
        ? matchRegistryModel(registryModels, provider.defaultModel)
        : undefined,
    [registryModels, provider],
  )
  const showCustomTokenFields = Boolean(
    provider && provider.defaultModel.trim() && !modelMatch,
  )

  const refreshModels = async () => {
    if (!provider) return
    setFetching(true)
    try {
      const response = await getModelList({
        apiKey: provider.apiKey || undefined,
        endpoint: provider.endpoint || undefined,
        modelListUrl: provider.modelListUrl || undefined,
        providerId: provider.id,
        type: provider.type,
      })
      const fetchedModels = response.models ?? []
      queryClient.setQueryData<Record<string, AIProviderModel[]>>(
        props.modelCacheKey,
        (current) => ({ ...current, [provider.id]: fetchedModels }),
      )
      if (response.error)
        toast.warning(
          t('settings.ai.toast.modelListError', { message: response.error }),
        )
      else if (fetchedModels.length === 0)
        toast.info(t('settings.ai.toast.modelListEmpty'))
      else
        toast.success(
          t('settings.ai.toast.modelListUpdated', {
            count: fetchedModels.length,
          }),
        )
    } catch (error) {
      toast.error(
        getErrorMessage(error, t('settings.ai.error.fetchModelsFailed')),
      )
    } finally {
      setFetching(false)
    }
  }

  const testProvider = async () => {
    if (!provider) return
    if (!provider.defaultModel.trim()) {
      toast.warning(t('settings.ai.toast.needDefaultModel'))
      return
    }
    setTesting(true)
    try {
      await testConfig({
        apiKey: provider.apiKey || undefined,
        appendV1: provider.appendV1,
        endpoint: provider.endpoint || undefined,
        model: provider.defaultModel,
        providerId: provider.id,
        type: provider.type,
      })
      toast.success(t('settings.ai.toast.testSuccess'))
    } catch (error) {
      toast.error(getErrorMessage(error, t('settings.ai.error.testFailed')))
    } finally {
      setTesting(false)
    }
  }

  return (
    <Drawer
      footer={
        provider ? (
          <>
            <Button
              disabled={fetching}
              onClick={() => void refreshModels()}
              type="button"
              variant="subtle"
            >
              {fetching ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : null}
              {t('settings.ai.action.fetchModels')}
            </Button>
            <Button
              disabled={testing}
              onClick={() => void testProvider()}
              type="button"
              variant="subtle"
            >
              {testing ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : null}
              {t('settings.ai.action.testConnection')}
            </Button>
            <Button onClick={props.onClose} type="button">
              {t('common.close')}
            </Button>
          </>
        ) : null
      }
      icon={Settings}
      onClose={props.onClose}
      open={Boolean(provider)}
      title={provider ? formatAIProviderLabel(provider, t) : ''}
      widthClassName="w-[min(90vw,32rem)]"
    >
      {provider ? (
        <div className="space-y-5 overflow-y-auto p-4">
          <Switch
            checked={provider.enabled}
            label={t('settings.oauth.switch.enabled')}
            onCheckedChange={(enabled) => props.onChange({ enabled })}
          />
          <FieldShell label={t('settings.ai.field.providerType')}>
            <SelectField<AIProviderType>
              aria-label={t('settings.ai.field.providerType')}
              onValueChange={(type) =>
                props.onChange({
                  defaultModel: getDefaultAIModel(type),
                  type,
                })
              }
              options={aiProviderTypeOptions.map((option) => ({
                label: t(option.labelKey),
                value: option.value,
              }))}
              value={provider.type}
            />
          </FieldShell>
          <TextInput
            label={t('settings.ai.field.displayName')}
            onChange={(name) => props.onChange({ name })}
            placeholder={getAIProviderNamePlaceholder(t, provider.type)}
            value={provider.name}
          />
          <TextInput
            label={t('settings.ai.field.apiKey')}
            onChange={(apiKey) => props.onChange({ apiKey })}
            placeholder={getAIProviderKeyPlaceholder(provider.type)}
            type="password"
            value={provider.apiKey}
          />
          {showEndpoint ? (
            <TextInput
              label={t('settings.ai.field.endpoint')}
              onChange={(endpoint) => props.onChange({ endpoint })}
              placeholder={
                provider.type === 'openai-compatible'
                  ? t('settings.ai.placeholder.endpointCompatible')
                  : t('settings.ai.placeholder.endpointDefault')
              }
              value={provider.endpoint ?? ''}
            />
          ) : null}
          {provider.type !== 'anthropic' ? (
            <>
              <TextInput
                label={t('settings.ai.field.modelListUrl')}
                onChange={(modelListUrl) => props.onChange({ modelListUrl })}
                placeholder={t('settings.ai.placeholder.modelListUrl')}
                value={provider.modelListUrl ?? ''}
              />
              <Switch
                checked={provider.appendV1 ?? true}
                label={t('settings.ai.field.appendV1')}
                onCheckedChange={(appendV1) => props.onChange({ appendV1 })}
              />
            </>
          ) : null}
          <FieldShell label={t('settings.ai.field.defaultModel')}>
            <ModelCombobox
              disabled={modelsDisabled}
              loading={registryQuery.isFetching}
              models={modelOptions}
              onChange={(defaultModel) => props.onChange({ defaultModel })}
              placeholder={getAIProviderModelPlaceholder(t, provider.type)}
              value={provider.defaultModel}
            />
          </FieldShell>
          {showCustomTokenFields ? (
            <>
              <TextInput
                inputMode="numeric"
                label={t('settings.ai.field.contextWindow')}
                onChange={(value) =>
                  props.onChange({
                    contextWindow: value.trim() ? Number(value) : undefined,
                  })
                }
                type="number"
                value={
                  provider.contextWindow == null
                    ? ''
                    : String(provider.contextWindow)
                }
              />
              <TextInput
                inputMode="numeric"
                label={t('settings.ai.field.maxTokens')}
                onChange={(value) =>
                  props.onChange({
                    maxTokens: value.trim() ? Number(value) : undefined,
                  })
                }
                type="number"
                value={
                  provider.maxTokens == null ? '' : String(provider.maxTokens)
                }
              />
            </>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  )
}

function ModelCombobox(props: {
  disabled?: boolean
  loading?: boolean
  models: string[]
  onChange: (value: string) => void
  placeholder?: string
  value: string
}) {
  return (
    <Combobox
      autoComplete="none"
      disabled={props.disabled}
      inputValue={props.value}
      items={props.models}
      onInputValueChange={(next) => props.onChange(next)}
      onValueChange={(next) => {
        if (typeof next === 'string') props.onChange(next)
      }}
    >
      <Combobox.Control>
        <Combobox.Input placeholder={props.placeholder} />
        <Combobox.Trigger aria-label="Open model list">
          {props.loading ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <ChevronDown aria-hidden="true" className="size-4" />
          )}
        </Combobox.Trigger>
      </Combobox.Control>
      <Combobox.Content>
        <Combobox.Empty />
        <Scroll
          className="max-h-72"
          innerClassName="p-1"
          viewportClassName="max-h-72"
        >
          <Combobox.List>
            {(item: string) => (
              <Combobox.Item key={item} value={item}>
                {item}
              </Combobox.Item>
            )}
          </Combobox.List>
        </Scroll>
      </Combobox.Content>
    </Combobox>
  )
}
