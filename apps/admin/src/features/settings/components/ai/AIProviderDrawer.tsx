import { Combobox } from '@base-ui/react/combobox'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, Loader2, Settings } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
  getModelList,
  getRegistryModels,
  type RegistryModel,
  testConfig,
} from '~/api/ai'
import { useI18n } from '~/i18n'
import { Drawer } from '~/ui/feedback/drawer'
import { PortalLayerScope, useFloatingZ } from '~/ui/feedback/portal-layer'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { SelectField } from '~/ui/primitives/select'
import { Switch } from '~/ui/primitives/switch'
import { TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

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
  const registryDisabled = piProviderId === null
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
        providerId: provider.id,
        type: provider.type,
      })
      queryClient.setQueryData<Record<string, AIProviderModel[]>>(
        props.modelCacheKey,
        (current) => ({ ...current, [provider.id]: response.models ?? [] }),
      )
      if (response.error)
        toast.warning(
          t('settings.ai.toast.modelListError', { message: response.error }),
        )
      else toast.success(t('settings.ai.toast.modelListUpdated'))
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
      title={provider ? formatAIProviderLabel(provider) : ''}
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
              options={aiProviderTypeOptions}
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
          <FieldShell label={t('settings.ai.field.defaultModel')}>
            <ModelCombobox
              disabled={registryDisabled}
              loading={registryQuery.isFetching}
              models={registryModels}
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
  models: RegistryModel[]
  onChange: (value: string) => void
  placeholder?: string
  value: string
}) {
  const { z, depth } = useFloatingZ('popover')
  const items = useMemo(() => props.models.map((m) => m.id), [props.models])

  return (
    <Combobox.Root
      autoComplete="none"
      disabled={props.disabled}
      inputValue={props.value}
      items={items}
      onInputValueChange={(next) => props.onChange(next)}
      onValueChange={(next) => {
        if (typeof next === 'string') props.onChange(next)
      }}
    >
      <div className="relative">
        <Combobox.Input
          className={cn(
            'outline-hidden flex h-9 w-full items-center rounded border border-neutral-200 bg-white px-3 pr-8 text-left text-sm text-neutral-900 transition-colors hover:bg-neutral-50 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60 data-[focus-visible]:ring-2 data-[focus-visible]:ring-[var(--color-primary-shallow)] dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900',
          )}
          placeholder={props.placeholder}
        />
        <Combobox.Trigger
          aria-label="Open model list"
          className="outline-hidden absolute inset-y-0 right-0 flex w-8 items-center justify-center text-neutral-400 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60"
        >
          {props.loading ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <ChevronDown aria-hidden="true" className="size-4" />
          )}
        </Combobox.Trigger>
      </div>
      <Combobox.Portal>
        <Combobox.Positioner style={{ zIndex: z }}>
          <PortalLayerScope depth={depth}>
            <Combobox.Popup className="outline-hidden w-[var(--anchor-width)] rounded border border-neutral-200 bg-white text-sm shadow-lg dark:border-neutral-800 dark:bg-neutral-950">
              <Combobox.Empty className="px-2 py-1.5 text-xs text-neutral-500">
                {/* shown when filter yields no matches */}
              </Combobox.Empty>
              <Scroll
                className="max-h-72"
                innerClassName="p-1"
                viewportClassName="max-h-72"
              >
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item
                      className="outline-hidden flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-neutral-700 data-[highlighted]:bg-neutral-100 data-[selected]:text-[var(--color-primary)] dark:text-neutral-200 dark:data-[highlighted]:bg-neutral-800"
                      key={item}
                      value={item}
                    >
                      <span className="truncate">{item}</span>
                      <Combobox.ItemIndicator>
                        <Check aria-hidden="true" className="size-4" />
                      </Combobox.ItemIndicator>
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Scroll>
            </Combobox.Popup>
          </PortalLayerScope>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
