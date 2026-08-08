import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Loader2 } from 'lucide-react'
import { useCallback, useMemo } from 'react'

import { getTtsVoices, type TtsVoiceOption } from '~/api/ai'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { Combobox } from '~/ui/primitives/combobox'
import { Scroll } from '~/ui/primitives/scroll'

import { FieldShell } from '../SettingsPrimitives'

const VOICE_CATALOG_STALE_MS = 5 * 60 * 1000
const EMPTY_VOICES: TtsVoiceOption[] = []

export function TtsVoiceField(props: {
  model?: string
  onChange: (voice: string) => void
  providerId?: string
  value: string
}) {
  const { t } = useI18n()
  const providerId = props.providerId?.trim() ?? ''
  const model = props.model?.trim() ?? ''
  const ready = Boolean(providerId && model)
  const voicesQuery = useQuery({
    enabled: ready,
    queryFn: () => getTtsVoices(providerId, model),
    queryKey: adminQueryKeys.ai.ttsVoices(providerId, model),
    retry: false,
    staleTime: VOICE_CATALOG_STALE_MS,
  })
  const voices = voicesQuery.data?.voices ?? EMPTY_VOICES
  const voiceCatalog = useMemo(
    () => ({
      ids: voices.map((voice) => voice.id),
      byId: new Map(voices.map((voice) => [voice.id, voice])),
    }),
    [voices],
  )
  const filterVoice = useCallback(
    (itemValue: unknown, query: string) => {
      if (typeof itemValue !== 'string') return false
      const normalizedQuery = query.trim().toLocaleLowerCase()
      const voice = voiceCatalog.byId.get(itemValue)
      return [itemValue, voice?.name].some((value) =>
        value?.toLocaleLowerCase().includes(normalizedQuery),
      )
    },
    [voiceCatalog],
  )
  const error =
    voicesQuery.data?.error ||
    (voicesQuery.error instanceof Error ? voicesQuery.error.message : '')

  return (
    <FieldShell label={t('settings.ai.field.voice')}>
      <Combobox
        autoComplete="list"
        disabled={!ready}
        filter={filterVoice}
        inputValue={props.value}
        items={voiceCatalog.ids}
        onInputValueChange={(next) => props.onChange(next)}
        onValueChange={(next) => {
          if (typeof next === 'string') props.onChange(next)
        }}
      >
        <Combobox.Control>
          <Combobox.Input
            aria-label={t('settings.ai.field.voice')}
            placeholder={
              ready
                ? t('settings.ai.voiceDiscovery.inputPlaceholder')
                : t('settings.ai.voiceDiscovery.selectModel')
            }
          />
          <Combobox.Trigger aria-label={t('settings.ai.voiceDiscovery.open')}>
            {voicesQuery.isFetching ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <ChevronDown aria-hidden="true" className="size-4" />
            )}
          </Combobox.Trigger>
        </Combobox.Control>
        <Combobox.Content>
          <Combobox.Empty>
            {t('settings.ai.voiceDiscovery.empty')}
          </Combobox.Empty>
          <Scroll
            className="max-h-64"
            innerClassName="p-1"
            viewportClassName="max-h-64"
          >
            <Combobox.List>
              {(id: string) => {
                const voice = voiceCatalog.byId.get(id)
                return (
                  <Combobox.Item key={id} value={id}>
                    <span>{voice?.name ?? id}</span>
                    {voice?.name && voice.name !== id ? (
                      <span className="ml-2 text-xs text-fg-subtle">{id}</span>
                    ) : null}
                  </Combobox.Item>
                )
              }}
            </Combobox.List>
          </Scroll>
        </Combobox.Content>
      </Combobox>
      {ready ? (
        <span className="text-xs text-fg-subtle">
          {error
            ? t('settings.ai.voiceDiscovery.error', { error })
            : voices.length > 0
              ? t('settings.ai.voiceDiscovery.found', {
                  count: voices.length,
                })
              : t('settings.ai.voiceDiscovery.manual')}
        </span>
      ) : null}
    </FieldShell>
  )
}
