import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ExternalLink,
  ImageIcon,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  getEnrichmentById,
  invalidateEnrichment,
  refreshEnrichment,
} from '~/api/enrichment'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import type { EnrichmentRow, EnrichmentRowDetail } from '~/models/enrichment'
import { adminQueryKeys } from '~/query/keys'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'
import { relativeTimeFromNow } from '~/utils/time'

import { enrichmentQueryKey } from '../constants'
import { formatBytes, getErrorMessage } from '../utils/enrichment'
import {
  Code,
  DetailBlock,
  DetailLoading,
  Field,
  JsonBlock,
  ProviderBadge,
  SmallBadge,
} from './EnrichmentPrimitives'

export function CacheDetailPanel(props: {
  fallback: EnrichmentRow | null
  id: string
  invalidateAll: () => Promise<void>
  onBack: () => void
  onJumpToScreenshot: (id: string) => void
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const detailQuery = useQuery({
    initialData: props.fallback
      ? {
          ...props.fallback,
          capture: null,
        }
      : undefined,
    queryFn: () => getEnrichmentById(props.id),
    queryKey: adminQueryKeys.enrichment.cacheDetail(props.id),
  })

  const row = detailQuery.data
  const refreshMutation = useMutation({
    mutationFn: () => {
      if (!row) throw new Error(t('enrichment.cache.dataNotLoaded'))
      return refreshEnrichment(row.provider, row.externalId, row.locale)
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('enrichment.cache.refreshFailed'))),
    onSuccess: async () => {
      toast.success(t('enrichment.cache.refreshed'))
      await queryClient.invalidateQueries({ queryKey: enrichmentQueryKey })
    },
  })
  const invalidateMutation = useMutation({
    mutationFn: () => {
      if (!row) throw new Error(t('enrichment.cache.dataNotLoaded'))
      return invalidateEnrichment(row.provider, row.externalId)
    },
    onError: (error: unknown) =>
      toast.error(
        getErrorMessage(error, t('enrichment.cache.invalidateFailed')),
      ),
    onSuccess: async () => {
      toast.success(t('enrichment.cache.invalidated'))
      await props.invalidateAll()
    },
  })

  if (!row) {
    return <DetailLoading label={t('enrichment.cache.loading')} />
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <button
            className="inline-flex size-8 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950 lg:hidden dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-50"
            onClick={props.onBack}
            type="button"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
          </button>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <ProviderBadge provider={row.provider} />
              <h2 className="truncate text-lg font-semibold text-neutral-950 dark:text-neutral-50">
                {row.normalized.title || row.url}
              </h2>
              {detailQuery.isFetching ? (
                <Loader2
                  aria-hidden="true"
                  className="size-3.5 animate-spin text-neutral-400"
                />
              ) : null}
            </div>
            <p className="mt-1 truncate text-sm text-neutral-500 dark:text-neutral-400">
              {row.url}
            </p>
          </div>
        </div>
        <a
          className="inline-flex size-9 items-center justify-center rounded border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
          href={row.url}
          rel="noreferrer"
          target="_blank"
          title={t('enrichment.cache.openOriginal')}
        >
          <ExternalLink aria-hidden="true" className="size-4" />
        </a>
      </div>

      <Scroll className="flex-1" innerClassName="px-5 py-4">
        <NormalizedPreview row={row} />

        {row.capture ? (
          <DetailBlock title={t('enrichment.cache.screenshotTitle')}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                <span>
                  {row.capture.width} x {row.capture.height}
                </span>
                <span>{formatBytes(row.capture.bytes)}</span>
                <span>
                  {t('enrichment.cache.createdAtRel', {
                    time: relativeTimeFromNow(row.capture.createdAt),
                  })}
                </span>
                <span>
                  {t('enrichment.cache.lastAccessedRel', {
                    time: relativeTimeFromNow(row.capture.lastAccessedAt),
                  })}
                </span>
              </div>
              <Button
                onClick={() => props.onJumpToScreenshot(row.id)}
                type="button"
                variant="subtle"
              >
                <ImageIcon aria-hidden="true" className="size-4" />
                {t('enrichment.cache.viewScreenshot')}
              </Button>
            </div>
          </DetailBlock>
        ) : null}

        <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          <Field label="External ID">
            <Code>{row.externalId}</Code>
          </Field>
          <Field label="Locale">{row.locale || 'default'}</Field>
          <Field label={t('enrichment.cache.field.fetchedAt')}>
            {relativeTimeFromNow(row.fetchedAt)}
          </Field>
          <Field label={t('enrichment.cache.field.expiresAt')}>
            {row.expiresAt ? relativeTimeFromNow(row.expiresAt) : '-'}
          </Field>
          <Field label={t('enrichment.cache.field.failureCount')}>
            <span className="tabular-nums">{row.failureCount}</span>
          </Field>
          <Field label={t('enrichment.cache.field.lastError')}>
            {row.lastError || '-'}
          </Field>
        </div>

        <DetailBlock title="Raw">
          <JsonBlock value={row.raw} />
        </DetailBlock>
      </Scroll>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-neutral-200 px-5 py-4 dark:border-neutral-800">
        <Button
          disabled={refreshMutation.isPending}
          onClick={() => refreshMutation.mutate()}
          type="button"
          variant="subtle"
        >
          {refreshMutation.isPending ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <RefreshCw aria-hidden="true" className="size-4" />
          )}
          {t('enrichment.cache.refresh')}
        </Button>
        <Button
          className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-950 dark:text-red-400 dark:hover:bg-red-950/30"
          disabled={invalidateMutation.isPending}
          onClick={() => {
            if (window.confirm(t('enrichment.cache.confirmInvalidate'))) {
              invalidateMutation.mutate()
            }
          }}
          type="button"
          variant="subtle"
        >
          {invalidateMutation.isPending ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Trash2 aria-hidden="true" className="size-4" />
          )}
          {t('enrichment.cache.invalidate')}
        </Button>
      </div>
    </div>
  )
}

function NormalizedPreview(props: { row: EnrichmentRowDetail }) {
  const result = props.row.normalized
  const image =
    result.previewImage ?? result.thumbnailImage ?? result.captureImage

  return (
    <section className="grid gap-4 border-b border-neutral-200 pb-5 md:grid-cols-[12rem_minmax(0,1fr)] dark:border-neutral-800">
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900">
        {image?.url ? (
          <img
            alt={image.alt ?? result.title}
            className="h-full w-full object-cover"
            src={image.url}
          />
        ) : (
          <ImageIcon aria-hidden="true" className="size-8 text-neutral-300" />
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <SmallBadge>{result.category}</SmallBadge>
          {result.subtype ? <SmallBadge>{result.subtype}</SmallBadge> : null}
        </div>
        <h3 className="mt-3 text-sm font-semibold text-neutral-950 dark:text-neutral-50">
          {result.title || props.row.url}
        </h3>
        {result.description ? (
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
            {result.description}
          </p>
        ) : null}
        {result.attributes?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {result.attributes.slice(0, 8).map((attribute) => (
              <SmallBadge key={`${attribute.key}-${attribute.value}`}>
                {attribute.label ?? attribute.key}: {String(attribute.value)}
              </SmallBadge>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
