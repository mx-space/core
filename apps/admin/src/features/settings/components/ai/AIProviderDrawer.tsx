import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Settings } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type {
  AIProviderConfig,
  AIProviderModel,
  AIProviderType,
} from '../../types/settings'

import { getModelList, testConfig } from '~/api/ai'
import { useI18n } from '~/i18n'
import { Drawer } from '~/ui/feedback/drawer'
import { Button } from '~/ui/primitives/button'
import { SelectField } from '~/ui/primitives/select'
import { Switch } from '~/ui/primitives/switch'
import { TextInput } from '~/ui/primitives/text-field'

import { aiProviderTypeOptions } from '../../constants'
import {
  formatAIProviderLabel,
  getAIProviderKeyPlaceholder,
  getAIProviderModelPlaceholder,
  getAIProviderNamePlaceholder,
  getDefaultAIModel,
  getErrorMessage,
} from '../../utils/settings'
import { FieldShell } from '../SettingsPrimitives'

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

  const showEndpoint =
    provider &&
    (provider.type === 'openai' ||
      provider.type === 'openai-compatible' ||
      provider.type === 'openrouter')

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

  const modelListId = provider ? `ai-models-${provider.id}-drawer` : ''

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
          <TextInput
            label={t('settings.ai.field.defaultModel')}
            list={modelListId}
            onChange={(defaultModel) => props.onChange({ defaultModel })}
            placeholder={getAIProviderModelPlaceholder(t, provider.type)}
            value={provider.defaultModel}
          />
          <datalist id={modelListId}>
            {props.providerModels.map((model) => (
              <option
                key={model.id}
                label={model.name || model.id}
                value={model.id}
              />
            ))}
          </datalist>
        </div>
      ) : null}
    </Drawer>
  )
}
