import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  FilePenLine,
  Info,
  ListChecks,
  Loader2,
  Search,
} from 'lucide-react'
import { useState } from 'react'

import {
  getDraftStorage,
  getOrganizerPreview,
  runDraftOrganizer,
} from '~/api/drafts'
import { formatBytes } from '~/features/files/utils/format'
import { useI18n } from '~/i18n'
import type {
  DraftRefType,
  OrganizerArticle,
  OrganizerRunResult,
} from '~/models/draft'
import { adminQueryKeys } from '~/query/keys'
import { CompactPagination } from '~/ui/data/compact-pagination'
import { AppPage, PageHeader } from '~/ui/layout/page-layout'
import { EmptyState } from '~/ui/patterns/EmptyState'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'
import { inputBaseClassName } from '~/ui/primitives/input-styles'
import { Scroll } from '~/ui/primitives/scroll'
import { SelectField } from '~/ui/primitives/select'
import { relativeTimeFromNow } from '~/utils/time'

import { filterOptionKeys, refTypeMeta } from '../constants'
import { organizerTotals } from '../utils/organizer'
import { confirmOrganizer } from './OrganizerConfirmDialog'
import { OrganizerResult } from './OrganizerResult'

const PAGE_SIZE = 20

export function DraftOrganizerPage() {
  const { t } = useI18n()
  const client = useQueryClient()
  const [days, setDays] = useState(90)
  const [refType, setRefType] = useState<DraftRefType | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [page, setPage] = useState(1)
  const [processed, setProcessed] = useState(0)
  const [result, setResult] = useState<OrganizerRunResult | null>(null)
  const preview = useQuery({
    queryKey: [...adminQueryKeys.drafts.root, 'organizer', days, refType],
    queryFn: () =>
      getOrganizerPreview({
        olderThanDays: days,
        refType: refType === 'all' ? undefined : refType,
      }),
    refetchOnWindowFocus: false,
  })
  const storage = useQuery({
    queryKey: adminQueryKeys.drafts.storage('all'),
    queryFn: () => getDraftStorage(),
  })
  const items = (preview.data ?? []).filter((item) =>
    item.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  )
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = items.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )
  const picked = items.filter((item) => selected.has(item.documentId))
  const totals = organizerTotals(picked)
  const allPageSelected =
    visible.length > 0 && visible.every((item) => selected.has(item.documentId))
  const somePageSelected = visible.some((item) => selected.has(item.documentId))
  const run = useMutation({
    mutationFn: (selection: OrganizerArticle[]) =>
      runDraftOrganizer(
        selection,
        selection.some((item) => item.hasChanges),
        setProcessed,
      ),
    onSuccess: async (next) => {
      setResult(next)
      await client.invalidateQueries({ queryKey: adminQueryKeys.drafts.root })
    },
  })
  const resetSelection = () => {
    setSelected(new Set())
    setPage(1)
  }
  const toggle = (id: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  const review = async () => {
    const selection = [...picked]
    if (!selection.length || !(await confirmOrganizer(selection))) return
    setProcessed(0)
    run.mutate(selection)
  }
  const reviewRemaining = () => {
    setResult(null)
    resetSelection()
    void preview.refetch()
  }
  const busy = run.isPending
  const summaryButton = (
    <Button
      className="w-full"
      disabled={busy || preview.isFetching || picked.length === 0}
      onClick={() => void review()}
    >
      {busy ? (
        <>
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          {t('drafts.organizer.progress', {
            count: processed,
            total: picked.length,
          })}
        </>
      ) : (
        t('drafts.organizer.review')
      )}
    </Button>
  )

  return (
    <AppPage className="bg-surface-page">
      <PageHeader
        back={
          busy
            ? undefined
            : { to: '/drafts', label: t('drafts.organizer.backDrafts') }
        }
        title={t('drafts.organizer.title')}
      />
      <Scroll className="min-h-0 flex-1" innerClassName="px-4 py-6 sm:px-7">
        {result ? (
          <OrganizerResult
            items={run.variables ?? []}
            onReview={reviewRemaining}
            result={result}
          />
        ) : (
          <div className="mx-auto max-w-7xl">
            <div className="mb-6 flex items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-semibold text-fg">
                  {t('drafts.organizer.title')}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                  {t('drafts.organizer.description')}
                </p>
              </div>
              {storage.data && (
                <div className="hidden shrink-0 border-l border-border-strong pl-5 text-xs text-fg-muted sm:block">
                  {t('drafts.storage.total')}
                  <p className="mt-1 text-xl font-semibold tabular-nums text-fg">
                    {formatBytes(
                      storage.data.revisions.bytes +
                        storage.data.crdt.bytes +
                        storage.data.updates.bytes,
                    )}
                  </p>
                </div>
              )}
            </div>
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
              <section
                className="min-w-0 overflow-hidden rounded-lg border border-border bg-surface-card shadow-xs"
                aria-label={t('drafts.organizer.matching', {
                  count: items.length,
                })}
              >
                <div className="border-b border-border bg-surface-inset px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-sm border border-border bg-surface-card px-2.5 py-1.5 text-sm text-fg">
                      {t('drafts.organizer.published')}
                    </span>
                    <SelectField
                      aria-label={t('drafts.organizer.ageFilter')}
                      disabled={busy}
                      value={days}
                      onValueChange={(value) => {
                        setDays(value)
                        resetSelection()
                      }}
                      options={[0, 30, 90, 180, 365].map((value) => ({
                        value,
                        label:
                          value === 0
                            ? t('drafts.organizer.anyTime')
                            : t('drafts.organizer.days', { count: value }),
                      }))}
                      className="w-auto"
                      popupClassName="w-auto min-w-[var(--anchor-width)]"
                    />
                    <SelectField
                      aria-label={t('drafts.organizer.typeFilter')}
                      disabled={busy}
                      value={refType}
                      onValueChange={(value) => {
                        setRefType(value)
                        resetSelection()
                      }}
                      options={filterOptionKeys.map((option) => ({
                        value: option.value,
                        label: t(option.labelKey),
                      }))}
                      className="w-auto"
                      popupClassName="w-auto min-w-[var(--anchor-width)]"
                    />
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-fg-muted">
                    <Check aria-hidden="true" className="size-3.5" />
                    {t('drafts.organizer.includeChanges')}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                  <label className="flex min-w-0 flex-1 items-center gap-2">
                    <Search
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-fg-subtle"
                    />
                    <input
                      aria-label={t('drafts.organizer.search')}
                      className={`${inputBaseClassName} h-7 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0`}
                      disabled={busy}
                      maxLength={200}
                      onChange={(event) => {
                        setSearch(event.target.value)
                        resetSelection()
                      }}
                      placeholder={t('drafts.organizer.search')}
                      value={search}
                    />
                  </label>
                  <span className="hidden shrink-0 text-xs text-fg-subtle sm:block">
                    {t('drafts.organizer.oldest')}
                  </span>
                </div>
                {picked.length > 0 && (
                  <div
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-accent-soft px-4 py-2 text-xs text-accent"
                    aria-live="polite"
                  >
                    <span>
                      {t(
                        picked.length === items.length
                          ? 'drafts.organizer.allSelected'
                          : 'drafts.organizer.selected',
                        { count: picked.length },
                      )}
                    </span>
                    {picked.length < items.length && (
                      <button
                        className="font-medium underline underline-offset-2 disabled:opacity-50"
                        disabled={busy}
                        onClick={() =>
                          setSelected(
                            new Set(items.map((item) => item.documentId)),
                          )
                        }
                        type="button"
                      >
                        {t('drafts.organizer.selectAll', {
                          count: items.length,
                        })}
                      </button>
                    )}
                    <button
                      className="ml-auto disabled:opacity-50"
                      disabled={busy}
                      onClick={resetSelection}
                      type="button"
                    >
                      {t('drafts.organizer.clear')}
                    </button>
                  </div>
                )}
                {preview.isLoading ? (
                  <div className="flex justify-center p-12" role="status">
                    <Loader2
                      aria-label={t('common.loading')}
                      className="size-5 animate-spin text-fg-subtle"
                    />
                  </div>
                ) : preview.isError ? (
                  <EmptyState
                    action={
                      <Button
                        onClick={() => void preview.refetch()}
                        variant="secondary"
                      >
                        {t('common.retry')}
                      </Button>
                    }
                    title={t('drafts.organizer.loadFailed')}
                  />
                ) : items.length === 0 ? (
                  <EmptyState
                    icon={ListChecks}
                    title={t('drafts.organizer.empty')}
                    description={t('drafts.organizer.emptyHint')}
                  />
                ) : (
                  <>
                    <div className="flex items-center gap-3 border-b border-border px-4 py-2 text-xs text-fg-subtle">
                      <Checkbox
                        aria-label={t('drafts.organizer.selectPage')}
                        checked={allPageSelected}
                        disabled={busy}
                        indeterminate={!allPageSelected && somePageSelected}
                        onCheckedChange={(checked) =>
                          setSelected((current) => {
                            const next = new Set(current)
                            for (const item of visible) {
                              if (checked) next.add(item.documentId)
                              else next.delete(item.documentId)
                            }
                            return next
                          })
                        }
                      />
                      <span className="flex-1">
                        {t('drafts.organizer.article')}
                      </span>
                      <span className="hidden w-20 text-right sm:block">
                        {t('drafts.organizer.history')}
                      </span>
                      <span className="hidden w-20 text-right sm:block">
                        {t('drafts.organizer.bytes')}
                      </span>
                      <span className="hidden w-24 text-right sm:block">
                        {t('drafts.organizer.lastEdited')}
                      </span>
                    </div>
                    {visible.map((item) => (
                      <div
                        className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0"
                        key={item.documentId}
                      >
                        <Checkbox
                          aria-label={t('drafts.organizer.selectArticle', {
                            title: item.title || t('drafts.row.untitled'),
                          })}
                          checked={selected.has(item.documentId)}
                          disabled={busy}
                          onCheckedChange={(checked) =>
                            toggle(item.documentId, checked)
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-sm font-medium text-fg"
                            title={item.title}
                          >
                            {item.title || t('drafts.row.untitled')}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
                            <span>{t(refTypeMeta[item.refType].labelKey)}</span>
                            <span
                              className={
                                item.hasChanges
                                  ? 'rounded-sm bg-amber-50 px-1.5 py-0.5 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                                  : 'rounded-sm bg-surface-inset px-1.5 py-0.5 text-fg-muted'
                              }
                            >
                              {t(
                                item.hasChanges
                                  ? 'drafts.organizer.changed'
                                  : 'drafts.organizer.inSync',
                              )}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-xs text-fg-subtle sm:hidden">
                            <span>
                              {t('drafts.organizer.draftCount', {
                                count: item.draftCount,
                              })}{' '}
                              · {relativeTimeFromNow(item.lastEditedAt)}
                            </span>
                            <span>{formatBytes(item.bytes)}</span>
                          </div>
                        </div>
                        <div className="hidden w-20 shrink-0 text-right sm:block">
                          <p className="text-sm tabular-nums text-fg">
                            {t('drafts.organizer.draftCount', {
                              count: item.draftCount,
                            })}
                          </p>
                          <p className="mt-0.5 text-xs text-fg-subtle">
                            {t('drafts.organizer.revisionCount', {
                              count: item.revisionCount,
                            })}
                          </p>
                        </div>
                        <span className="hidden w-20 shrink-0 text-right text-sm tabular-nums text-fg-muted sm:block">
                          {formatBytes(item.bytes)}
                        </span>
                        <span
                          className="hidden w-24 shrink-0 text-right text-xs text-fg-muted sm:block"
                          title={new Date(item.lastEditedAt).toLocaleString()}
                        >
                          {relativeTimeFromNow(item.lastEditedAt)}
                        </span>
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
                      <span className="text-xs text-fg-muted">
                        {t('drafts.organizer.matching', {
                          count: items.length,
                        })}
                      </span>
                      <CompactPagination
                        page={currentPage}
                        pageCount={pageCount}
                        pageSize={PAGE_SIZE}
                        pageSizes={[PAGE_SIZE]}
                        onPageChange={setPage}
                        onPageSizeChange={() => {}}
                      />
                    </div>
                  </>
                )}
              </section>
              <div className="hidden lg:sticky lg:top-0 lg:block">
                <aside className="rounded-lg border border-border bg-surface-card p-5 shadow-xs">
                  <h3 className="flex items-center gap-2 text-base font-semibold text-fg">
                    <ListChecks aria-hidden="true" className="size-4" />
                    {t('drafts.organizer.summary')}
                  </h3>
                  <p className="mt-5 text-sm text-fg-muted">
                    {t('drafts.organizer.selected', { count: picked.length })}
                  </p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums text-fg">
                    {formatBytes(totals.bytes)}
                  </p>
                  <p className="mt-1 text-xs text-fg-subtle">
                    {t('drafts.organizer.estimated')}
                  </p>
                  <div className="my-4 space-y-2 border-y border-border py-4 text-sm text-fg-muted">
                    <p>
                      {t('drafts.organizer.draftCount', {
                        count: totals.drafts,
                      })}
                    </p>
                    <p>
                      {t('drafts.organizer.revisionCount', {
                        count: totals.revisions,
                      })}
                    </p>
                    <p>{t('drafts.organizer.collab')}</p>
                  </div>
                  {totals.changed > 0 && (
                    <div className="mb-4 rounded-md bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                      <p className="flex items-start gap-1.5 text-sm font-medium">
                        <FilePenLine
                          aria-hidden="true"
                          className="mt-0.5 size-3.5 shrink-0"
                        />
                        {t('drafts.organizer.changedNotice', {
                          count: totals.changed,
                        })}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed">
                        {t('drafts.organizer.changedHint')}
                      </p>
                    </div>
                  )}
                  <p className="flex items-start gap-1.5 text-sm font-medium text-fg">
                    <Check
                      aria-hidden="true"
                      className="mt-0.5 size-3.5 shrink-0"
                    />
                    {t('drafts.organizer.kept')}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-fg-subtle">
                    {t('drafts.organizer.keptShared')}
                  </p>
                  <div className="mt-5">{summaryButton}</div>
                  <p className="mt-2 text-center text-xs text-fg-subtle">
                    {t('drafts.organizer.nextHint')}
                  </p>
                </aside>
                <p className="mt-3 flex items-start gap-2 px-1 text-xs leading-relaxed text-fg-subtle">
                  <Info
                    aria-hidden="true"
                    className="mt-0.5 size-3.5 shrink-0"
                  />
                  {t('drafts.organizer.skipHint')}
                </p>
              </div>
            </div>
          </div>
        )}
      </Scroll>
      {!result && (
        <footer
          className="flex shrink-0 items-center gap-4 border-t border-border bg-surface-card px-4 pt-3 lg:hidden"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold tabular-nums text-fg">
              {formatBytes(totals.bytes)}
            </p>
            <p className="text-xs text-fg-muted">
              {t('drafts.organizer.mobileSelection', {
                count: picked.length,
                changed: totals.changed,
              })}
            </p>
          </div>
          <div className="shrink-0">{summaryButton}</div>
        </footer>
      )}
    </AppPage>
  )
}
