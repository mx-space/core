import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { getCleanupPreview, runCleanup } from '~/api/drafts'
import { formatBytes } from '~/features/files/utils/format'
import { useI18n } from '~/i18n'
import type { TranslationKey } from '~/i18n/types'
import type { CleanupCategory, CleanupResult } from '~/models/draft'
import { adminQueryKeys } from '~/query/keys'
import { ModalFooter, ModalTitle } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'

import { getErrorMessage } from '../utils/errors'
import { CleanupArchivedList } from './CleanupArchivedList'

const DAY_OPTIONS = [7, 30, 90, 180]

const CATEGORY_COPY: Record<
  CleanupCategory,
  { description: TranslationKey; title: TranslationKey }
> = {
  A: {
    description: 'drafts.cleanup.inSync.description',
    title: 'drafts.cleanup.inSync.title',
  },
  B: {
    description: 'drafts.cleanup.revisions.description',
    title: 'drafts.cleanup.revisions.title',
  },
  C: {
    description: 'drafts.cleanup.crdt.description',
    title: 'drafts.cleanup.crdt.title',
  },
  D: {
    description: 'drafts.cleanup.orphans.description',
    title: 'drafts.cleanup.orphans.title',
  },
}

const CATEGORIES: CleanupCategory[] = ['A', 'B', 'C', 'D']

function CleanupDialogBody() {
  const { t } = useI18n()
  const modal = useModal<CleanupResult>()
  const queryClient = useQueryClient()
  const [days, setDays] = useState(30)
  const [picked, setPicked] = useState<Set<CleanupCategory>>(
    () => new Set(CATEGORIES),
  )
  const [archived, setArchived] = useState<Set<string>>(() => new Set())
  const previewQuery = useQuery({
    queryFn: () => getCleanupPreview(days),
    queryKey: adminQueryKeys.drafts.cleanupPreview(days),
  })
  const preview = previewQuery.data
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
      <label className="flex items-center gap-2 border-y border-border bg-surface-inset px-6 py-3 text-sm text-fg">
        {t('drafts.cleanup.olderThanPrefix')}
        <select
          className="rounded-sm border border-border-strong bg-surface-card px-2 py-1 text-sm"
          onChange={(event) => setDays(Number(event.target.value))}
          value={days}
        >
          {DAY_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {t('drafts.cleanup.days', { count: value })}
            </option>
          ))}
        </select>
        {t('drafts.cleanup.olderThanSuffix')}
      </label>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {CATEGORIES.map((key) => (
          <label
            className="flex gap-3 border-b border-border px-6 py-3.5"
            key={key}
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
            </span>
          </label>
        ))}
        <CleanupArchivedList
          items={preview?.archived ?? []}
          onChange={setArchived}
          selected={archived}
        />
        <section className="mx-6 my-4 flex flex-col gap-2 rounded-md bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
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
      <ModalFooter>
        <span className="mr-auto text-sm text-fg-muted">
          {t('drafts.cleanup.total', { size: formatBytes(total) })}
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

export function openCleanupDialog() {
  return present<Record<string, never>, CleanupResult>(
    CleanupDialogBody,
    {},
    { modalProps: { popupStyle: { width: 'min(94vw, 40rem)' } } },
  )
}
