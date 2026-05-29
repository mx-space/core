import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, DatabaseZap, Loader2, Save, Search } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { EnrichmentProbeResult } from '~/models/enrichment'
import type { FormEvent } from 'react'
import type { ProbeHistoryEntry } from '../types/enrichment'

import { probeEnrichment, refreshEnrichment } from '~/api/enrichment'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'
import { Scroll } from '~/ui/primitives/scroll'
import { TextInput } from '~/ui/primitives/text-field'

import { enrichmentQueryKey } from '../constants'
import { getErrorMessage } from '../utils/enrichment'
import { DetailEmpty, JsonBlock, SmallBadge } from './EnrichmentPrimitives'

export function ProbeConsole(props: {
  onBack: () => void
  onProbed: (entry: ProbeHistoryEntry) => void
  selected: ProbeHistoryEntry | null
}) {
  const { t } = useI18n()
  const [url, setUrl] = useState('')
  const [useCache, setUseCache] = useState(false)
  const probeMutation = useMutation({
    mutationFn: () => probeEnrichment(url.trim(), useCache),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('enrichment.probe.failed'))),
    onSuccess: (result) => {
      const entry = {
        createdAt: Date.now(),
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        result,
        url: url.trim(),
      }
      props.onProbed(entry)
    },
  })

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!url.trim()) return
    probeMutation.mutate()
  }

  const activeResult = probeMutation.data ?? props.selected?.result ?? null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <form
        className="flex shrink-0 flex-col gap-3 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800"
        onSubmit={onSubmit}
      >
        <div className="flex items-center gap-2 lg:hidden">
          <button
            className="inline-flex size-8 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-50"
            onClick={props.onBack}
            type="button"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
          </button>
          <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
            {t('enrichment.probe.title')}
          </span>
        </div>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
          />
          <TextInput
            controlClassName="h-9 pl-9 focus:border-neutral-400"
            onChange={setUrl}
            placeholder="https://..."
            value={url}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Checkbox
            checked={useCache}
            label={t('enrichment.probe.useCacheLabel')}
            onCheckedChange={setUseCache}
          />
          <Button
            disabled={probeMutation.isPending || !url.trim()}
            type="submit"
          >
            {probeMutation.isPending ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <DatabaseZap aria-hidden="true" className="size-4" />
            )}
            {t('enrichment.probe.run')}
          </Button>
        </div>
      </form>
      <Scroll className="flex-1" innerClassName="px-5 py-4">
        {activeResult ? (
          <ProbeResult result={activeResult} />
        ) : (
          <DetailEmpty label={t('enrichment.probe.detailEmpty')} />
        )}
      </Scroll>
    </div>
  )
}

function ProbeResult(props: { result: EnrichmentProbeResult }) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const canPersist =
    !props.result.cached && !props.result.error && !!props.result.matched
  const persistMutation = useMutation({
    mutationFn: () => {
      const matched = props.result.matched
      if (!matched) throw new Error(t('enrichment.probe.noProvider'))
      return refreshEnrichment(matched.provider, matched.externalId)
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('enrichment.probe.persistFailed'))),
    onSuccess: async () => {
      toast.success(t('enrichment.probe.persisted'))
      await queryClient.invalidateQueries({ queryKey: enrichmentQueryKey })
    },
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {props.result.error ? (
          <SmallBadge tone="danger">{props.result.error.code}</SmallBadge>
        ) : props.result.matched ? (
          <SmallBadge tone="success">
            {props.result.matched.provider} · {props.result.matched.externalId}
          </SmallBadge>
        ) : (
          <SmallBadge tone="warning">
            {t('enrichment.probe.noProviderBadge')}
          </SmallBadge>
        )}
        <SmallBadge>
          {props.result.cached
            ? t('enrichment.probe.cachedBadge')
            : t('enrichment.probe.refreshedBadge')}
        </SmallBadge>
      </div>
      {props.result.error ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-950 dark:bg-red-950/40 dark:text-red-300">
          {props.result.error.message}
        </div>
      ) : null}
      {props.result.result ? (
        <section className="rounded border border-neutral-200 p-4 dark:border-neutral-800">
          <h3 className="text-base font-semibold text-neutral-950 dark:text-neutral-50">
            {props.result.result.title}
          </h3>
          {props.result.result.description ? (
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              {props.result.result.description}
            </p>
          ) : null}
        </section>
      ) : null}
      <JsonBlock value={props.result.result ?? props.result} />
      {canPersist ? (
        <div className="flex justify-end">
          <Button
            disabled={persistMutation.isPending}
            onClick={() => persistMutation.mutate()}
            type="button"
          >
            {persistMutation.isPending ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Save aria-hidden="true" className="size-4" />
            )}
            {t('enrichment.probe.persist')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
