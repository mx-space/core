import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Camera, ExternalLink, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type {
  EnrichmentCaptureJoinedRow,
  EnrichmentCaptureQuota,
} from '~/models/enrichment'

import { deleteEnrichmentCapture, recaptureEnrichment } from '~/api/enrichment'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'
import { relativeTimeFromNow } from '~/utils/time'

import {
  formatBytes,
  getErrorMessage,
  getRecaptureDisabledReason,
} from '../utils/enrichment'
import { Code, DetailBlock, Field } from './EnrichmentPrimitives'

export function CaptureDetail(props: {
  invalidateAll: () => Promise<void>
  onDeleted: (id: string) => void
  onBack: () => void
  quota: EnrichmentCaptureQuota | null
  row: EnrichmentCaptureJoinedRow
}) {
  const { t } = useI18n()
  const recaptureDisabledReason = getRecaptureDisabledReason(props.quota, t)
  const recaptureMutation = useMutation({
    mutationFn: () => recaptureEnrichment(props.row.enrichmentId),
    onError: (error: unknown) =>
      toast.error(
        getErrorMessage(error, t('enrichment.capture.recaptureFailed')),
      ),
    onSuccess: async () => {
      toast.success(t('enrichment.capture.recaptured'))
      await props.invalidateAll()
    },
  })
  const deleteMutation = useMutation({
    mutationFn: () => deleteEnrichmentCapture(props.row.enrichmentId),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('enrichment.capture.deleteFailed'))),
    onSuccess: async () => {
      toast.success(t('enrichment.capture.deleted'))
      props.onDeleted(props.row.enrichmentId)
      await props.invalidateAll()
    },
  })

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
            <h2 className="truncate text-lg font-semibold text-neutral-950 dark:text-neutral-50">
              {props.row.title || props.row.url}
            </h2>
            <p className="mt-1 truncate text-sm text-neutral-500 dark:text-neutral-400">
              {props.row.provider} · {props.quota?.fetchMode ?? 'capture'}
            </p>
          </div>
        </div>
        <a
          className="inline-flex size-9 items-center justify-center rounded border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
          href={props.row.url}
          rel="noreferrer"
          target="_blank"
          title={t('enrichment.capture.openOriginal')}
        >
          <ExternalLink aria-hidden="true" className="size-4" />
        </a>
      </div>
      <Scroll className="flex-1" innerClassName="px-5 py-4">
        <div
          className="overflow-hidden rounded border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
          style={
            props.row.palette?.dominant
              ? { backgroundColor: props.row.palette.dominant }
              : undefined
          }
        >
          <a
            className="block"
            href={props.row.publicUrl}
            rel="noreferrer"
            target="_blank"
          >
            <img
              alt={props.row.title || props.row.url}
              className="max-h-[32rem] w-full object-contain"
              src={props.row.publicUrl}
            />
          </a>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          <Field label="Provider">{props.row.provider}</Field>
          <Field label="External ID">
            <Code>{props.row.externalId}</Code>
          </Field>
          <Field label={t('enrichment.capture.field.size')}>
            {props.row.width} x {props.row.height}
          </Field>
          <Field label={t('enrichment.capture.field.bytes')}>
            {formatBytes(props.row.bytes)}
          </Field>
          <Field label={t('enrichment.capture.field.createdAt')}>
            {relativeTimeFromNow(props.row.createdAt)}
          </Field>
          <Field label={t('enrichment.capture.field.lastAccessed')}>
            {relativeTimeFromNow(props.row.lastAccessedAt)}
          </Field>
          <Field label="Object Key">
            <Code>{props.row.objectKey}</Code>
          </Field>
          <Field label="Enrichment ID">
            <Code>{props.row.enrichmentId}</Code>
          </Field>
        </div>
        {props.row.palette?.swatches?.length ? (
          <DetailBlock title={t('enrichment.capture.paletteTitle')}>
            <div className="flex items-center gap-1.5">
              {props.row.palette.swatches.slice(0, 5).map((color) => (
                <span
                  className="block size-7 rounded border border-neutral-200 dark:border-neutral-800"
                  key={color}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </DetailBlock>
        ) : null}
      </Scroll>
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-neutral-200 px-5 py-4 dark:border-neutral-800">
        <Button
          disabled={recaptureMutation.isPending || !!recaptureDisabledReason}
          onClick={() => recaptureMutation.mutate()}
          title={recaptureDisabledReason ?? t('enrichment.capture.recapture')}
          type="button"
          variant="subtle"
        >
          {recaptureMutation.isPending ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Camera aria-hidden="true" className="size-4" />
          )}
          {t('enrichment.capture.recapture')}
        </Button>
        <Button
          className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-950 dark:text-red-400 dark:hover:bg-red-950/30"
          disabled={deleteMutation.isPending}
          onClick={() => {
            if (window.confirm(t('enrichment.capture.confirmDelete')))
              deleteMutation.mutate()
          }}
          type="button"
          variant="subtle"
        >
          {deleteMutation.isPending ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Trash2 aria-hidden="true" className="size-4" />
          )}
          {t('enrichment.capture.delete')}
        </Button>
      </div>
    </div>
  )
}
