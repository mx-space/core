import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'

import { getOption } from '~/api/options'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { Button } from '~/ui/primitives/button'

import { CoverGenerationDrawer } from './CoverGenerationDrawer'
import { useCoverGeneration } from './use-cover-generation'

export function CoverGenerationEntry(props: {
  currentCover: string
  draftId?: string
  onSelectCover: (url: string) => void
  refId?: string
  summary: string
  text: string
  title: string
}) {
  const { t } = useI18n()

  const optionsQuery = useQuery({
    queryFn: () =>
      getOption<{
        imageGeneration?: { enable?: boolean; model?: { model?: string } }
      }>('ai'),
    queryKey: adminQueryKeys.ai.imageGenerationOptions(),
    staleTime: 60_000,
  })
  const enabled = Boolean(optionsQuery.data?.imageGeneration?.enable)

  const generation = useCoverGeneration({
    currentCover: props.currentCover,
    defaultModel: optionsQuery.data?.imageGeneration?.model?.model,
    draftId: props.draftId,
    enabled,
    onSelectCover: props.onSelectCover,
    refId: props.refId,
    summary: props.summary,
    text: props.text,
    title: props.title,
  })

  if (!enabled) return null

  return (
    <>
      <Button
        className="w-full"
        onClick={generation.openDrawer}
        type="button"
        variant="subtle"
      >
        <Sparkles aria-hidden="true" className="size-4" />
        {t('write.coverGeneration.entry')}
      </Button>
      <CoverGenerationDrawer {...generation} />
    </>
  )
}
