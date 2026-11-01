import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { getCleanupPreview, runCleanup } from '~/api/drafts'
import { formatBytes } from '~/features/files/utils/format'
import { useI18n } from '~/i18n'
import type { CleanupCategory, CleanupResult } from '~/models/draft'
import { adminQueryKeys } from '~/query/keys'
import { ModalFooter, ModalTitle } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'
import { SelectField } from '~/ui/primitives/select'
import { cn } from '~/utils/cn'

import { getErrorMessage } from '../utils/errors'
import {
  CLEANUP_CATEGORIES as CATEGORIES,
  CLEANUP_CATEGORY_COPY as CATEGORY_COPY,
  defaultCleanupPicks,
} from './cleanup-categories'
import { CleanupArchivedList } from './CleanupArchivedList'

const PREVIEW_TITLES = 6

const DAY_OPTIONS = [7, 30, 90, 180]

function CleanupDialogBody(props: { focus?: CleanupCategory }) {
  const { t } = useI18n()
  const modal = useModal<CleanupResult>()
  const queryClient = useQueryClient()
  const [days, setDays] = useState(30)
  const [picked, setPicked] =
    useState<Set<CleanupCategory>>(defaultCleanupPicks)
  const focusRef = useRef<HTMLLabelElement | null>(null)
  const [archived, setArchived] = useState<Set<string>>(() => new Set())
  const previewQuery = useQuery({
    queryFn: () => getCleanupPreview(days),
    queryKey: adminQueryKeys.drafts.cleanupPreview(days),
  })
  const preview = previewQuery.data
  const focusReady = Boolean(preview && props.focus)
  useEffect(() => {
    if (focusReady) focusRef.current?.scrollIntoView({ block: 'center' })
  }, [focusReady])
  const archivedBytes = (preview?.archived ?? [])
    .filter((item) => archived.has(item.draftId))
    .reduce((sum, item) => sum + item.bytes, 0)
  const total =
    CATEGORIES.filter((key) => picked.has(key)).reduce(
      (sum, key) => sum + (preview?.categories[key].bytes ?? 0),
      0,
    ) + archivedBytes
  const run = useMutation({
    mutationFn: () =>
      runCleanup({
        archivedDraftIds: [...archived],
        categories: CATEGORIES.filter((key) => picked.has(key)),
        olderThanDays: days,
      }),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('drafts.cleanup.failed'))),
    onSuccess: async (result) => {
      toast.success(
        t('drafts.cleanup.done', { size: formatBytes(result.freed.bytes) }),
      )
      await queryClient.invalidateQueries({
        queryKey: adminQueryKeys.drafts.root,
      })
      modal.close(result)
    },
  })
  const toggle = (key: CleanupCategory, on: boolean) =>
    setPicked((current) => {
      const next = new Set(current)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })

  return (
    <div className="flex max-h-[80vh] w-full flex-col">
      <div className="flex flex-col gap-1 px-6 pt-5 pb-4">
        <ModalTitle className="text-lg font-semibold text-fg">
          {t('drafts.cleanup.title')}
        </ModalTitle>
        <p className="text-sm text-fg-muted">{t('drafts.cleanup.subtitle')}</p>
      </div>
      <div className="flex items-center gap-2 border-y border-border bg-surface-inset px-6 py-3 text-sm text-fg">
        {t('drafts.cleanup.olderThanPrefix')}
        <SelectField
          aria-label={t('drafts.cleanup.days', { count: days })}
          className="w-auto"
          onValueChange={setDays}
          options={DAY_OPTIONS.map((value) => ({
            label: t('drafts.cleanup.days', { count: value }),
            value,
          }))}
          popupClassName="w-auto min-w-[var(--anchor-width)]"
          value={days}
        />
        {t('drafts.cleanup.olderThanSuffix')}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {CATEGORIES.map((key) => (
          <label
            className={cn(
              'flex gap-3 border-b border-border px-6 py-3.5',
              props.focus === key && 'bg-accent-soft',
            )}
            key={key}
            ref={props.focus === key ? focusRef : undefined}
          >
            <Checkbox
              checked={picked.has(key)}
              className="mt-0.5"
              onCheckedChange={(checked) => toggle(key, checked)}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-baseline gap-2">
                <span className="flex-1 text-sm font-medium text-fg">
                  {t(CATEGORY_COPY[key].title)}
                </span>
                <span className="text-xs text-fg-muted">
                  {preview
                    ? t('drafts.cleanup.count', {
                        count: preview.categories[key].count,
                      })
                    : '—'}
                </span>
                <span className="w-20 text-right text-sm font-semibold tabular-nums text-fg">
                  {preview ? formatBytes(preview.categories[key].bytes) : '—'}
                </span>
              </span>
              <span className="text-xs leading-relaxed text-fg-muted">
                {t(CATEGORY_COPY[key].description)}
              </span>
              {key === 'E' && preview?.testDrafts.length ? (
                <span className="text-xs text-fg">
                  {preview.testDrafts
                    .slice(0, PREVIEW_TITLES)
                    .map((item) => item.title || t('drafts.row.untitled'))
                    .join('、')}
                  {preview.testDrafts.length > PREVIEW_TITLES
                    ? ` ${t('drafts.cleanup.more', { count: preview.testDrafts.length })}`
                    : null}
                </span>
              ) : null}
            </span>
          </label>
        ))}
        <CleanupArchivedList
          items={preview?.archived ?? []}
          onChange={setArchived}
          selected={archived}
        />
        <section className="mx-3 my-4 flex flex-col gap-2 rounded-md bg-emerald-50 px-3 py-3 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <span className="text-sm font-semibold">
            {t('drafts.cleanup.keptTitle')}
          </span>
          <ul className="grid gap-1 text-xs sm:grid-cols-2">
            <li>{t('drafts.cleanup.kept.ahead')}</li>
            <li>{t('drafts.cleanup.kept.published')}</li>
            <li>{t('drafts.cleanup.kept.shared')}</li>
            <li>{t('drafts.cleanup.kept.base')}</li>
          </ul>
        </section>
      </div>
      <ModalFooter className="px-6">
        <span className="mr-auto flex items-center gap-3 text-sm text-fg-muted">
          {t('drafts.cleanup.total', { size: formatBytes(total) })}
          <button
            className="text-xs underline-offset-2 hover:text-fg hover:underline"
            onClick={() => {
              modal.dismiss()
              window.location.hash = '#/drafts/organize'
            }}
            type="button"
          >
            {t('drafts.organizer.open')}
          </button>
        </span>
        <Button onClick={() => modal.dismiss()} variant="secondary">
          {t('common.cancel')}
        </Button>
        <Button
          className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
          disabled={
            run.isPending ||
            !preview ||
            (picked.size === 0 && archived.size === 0)
          }
          onClick={() => run.mutate()}
        >
          {run.isPending ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {t('drafts.cleanup.run')}
        </Button>
      </ModalFooter>
    </div>
  )
}

export function openCleanupDialog(options: { focus?: CleanupCategory } = {}) {
  return present<{ focus?: CleanupCategory }, CleanupResult>(
    CleanupDialogBody,
    options,
    { modalProps: { popupStyle: { width: 'min(94vw, 40rem)' } } },
  )
}
