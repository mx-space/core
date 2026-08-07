import { useQuery } from '@tanstack/react-query'
import { AudioLines } from 'lucide-react'

import { getOption } from '~/api/options'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { Button } from '~/ui/primitives/button'

import { TtsGenerationDrawer } from './TtsGenerationDrawer'
import { useTtsGeneration } from './use-tts-generation'

export function TtsGenerationEntry(props: { refId?: string }) {
  const { t } = useI18n()

  const optionsQuery = useQuery({
    queryFn: () => getOption<{ enable?: boolean }>('ttsOptions'),
    queryKey: adminQueryKeys.ai.ttsOptions(),
    staleTime: 60_000,
  })
  const enabled = Boolean(optionsQuery.data?.enable)

  const generation = useTtsGeneration({ enabled, refId: props.refId })

  if (!enabled || !props.refId) return null

  return (
    <>
      <Button
        className="w-full"
        onClick={generation.openDrawer}
        type="button"
        variant="subtle"
      >
        <AudioLines aria-hidden="true" className="size-4" />
        {t('write.ttsGeneration.entry')}
      </Button>
      <TtsGenerationDrawer {...generation} />
    </>
  )
}
