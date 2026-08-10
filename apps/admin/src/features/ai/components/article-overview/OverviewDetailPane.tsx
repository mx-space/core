import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

import type { ActiveGeneration, AiOverviewCapability } from '~/api/ai-overview'
import { getArticleOverview } from '~/api/ai-overview'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { confirmDialog } from '~/ui/feedback/confirm'
import { EmptyState } from '~/ui/patterns/EmptyState'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'

import { getRefTypeMeta } from '../article-grouped/refTypeMeta'
import { ActiveTaskList } from './ActiveTaskList'
import { AddLanguageControl } from './AddLanguageControl'
import type { AssetRow } from './asset-rows'
import { buildAssetRows, firstAnchorIds } from './asset-rows'
import { AssetSection } from './AssetSection'
import { CostSummarySection } from './CostSummarySection'
import type { CellState } from './coverage-cells'
import { isTaskLive } from './coverage-cells'
import { CoverageMatrix } from './CoverageMatrix'
import { OverviewSection } from './OverviewSection'
import { useOverviewActions } from './useOverviewActions'

const HIGHLIGHT_MS = 1200
const ACTIVE_POLL_MS = 2000
/**
 * A dispatched task takes a beat to appear in the queue's indexes, so polling
 * has to outlive the dispatch itself — otherwise the one poll that fires finds
 * nothing running, stops, and the board never learns how the task ended.
 */
const DISPATCH_GRACE_MS = 20_000

function shouldPoll(
  activeTasks: ActiveGeneration[] | undefined,
  pollUntil: number,
): boolean {
  return Boolean(activeTasks?.some(isTaskLive)) || Date.now() < pollUntil
}

export function OverviewDetailPane(props: {
  refId: string
  onBack: () => void
}) {
  const { t } = useI18n()
  const actions = useOverviewActions(props.refId)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [activeCell, setActiveCell] = useState<string | null>(null)
  const [extraColumns, setExtraColumns] = useState<string[]>([])
  const [pollUntil, setPollUntil] = useState(0)
  const rowNodes = useRef(new Map<string, HTMLLIElement>())

  const query = useQuery({
    queryFn: () => getArticleOverview(props.refId),
    queryKey: adminQueryKeys.ai.overviewArticle(props.refId),
    refetchInterval: (q) =>
      shouldPoll(q.state.data?.activeTasks, pollUntil) ? ACTIVE_POLL_MS : false,
    // Without this the interval is suspended whenever the window loses focus,
    // so switching away mid-generation freezes the board on whatever state it
    // last saw — a spinner that never resolves.
    refetchIntervalInBackground: true,
  })

  const detail = query.data
  const rows = useMemo(() => (detail ? buildAssetRows(detail) : []), [detail])
  const anchors = useMemo(() => firstAnchorIds(rows), [rows])
  // The server is the single source of truth for what is running: it reports
  // live tasks and recent failures alike. An earlier optimistic entry tried to
  // bridge the gap before the queue registers a task and could outlive every
  // condition meant to retire it, leaving a spinner that never stopped.
  const activeTasks = detail?.activeTasks ?? []

  useEffect(() => {
    setPollUntil(0)
    setHighlightId(null)
    setActiveCell(null)
    setExtraColumns([])
    rowNodes.current.clear()
  }, [props.refId])

  useEffect(() => {
    if (!highlightId) return
    const timer = window.setTimeout(() => setHighlightId(null), HIGHLIGHT_MS)
    return () => window.clearTimeout(timer)
  }, [highlightId])

  const handleCellClick = (
    capability: AiOverviewCapability,
    lang: string,
    state: CellState,
  ) => {
    if (!detail) return
    const key = `${capability}:${lang}`
    setActiveCell(key)
    if (state === 'gap' || state === 'addable' || state === 'failed') {
      dispatchGeneration(capability, [lang], state === 'failed')
      return
    }
    const targetId = anchors.get(key)
    if (!targetId) return
    setHighlightId(targetId)
    rowNodes.current.get(targetId)?.scrollIntoView({ block: 'nearest' })
  }

  const dispatchGeneration = (
    capability: AiOverviewCapability,
    langs: string[] | undefined,
    force: boolean,
  ) => {
    if (!detail) return
    setPollUntil(Date.now() + DISPATCH_GRACE_MS)
    actions.generate(capability, langs, detail, force)
  }

  const addColumn = (lang: string) =>
    setExtraColumns((prev) => (prev.includes(lang) ? prev : [...prev, lang]))

  const handleRegenerate = (row: AssetRow) => {
    dispatchGeneration(row.capability, [row.lang], true)
  }

  const handleDelete = async (row: AssetRow) => {
    const ok = await confirmDialog({
      destructive: true,
      title: t('ai.overview.confirmDelete'),
    })
    if (!ok) return
    actions.remove(row.capability, row.id)
  }

  const meta = getRefTypeMeta(detail?.article.type)
  const TypeIcon = meta.icon
  const editPath = detail ? meta.editPath?.(detail.article.id) : null

  return (
    <div className="outline-hidden flex h-full min-h-0 flex-col bg-surface-card">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <button
          aria-label={t('common.back')}
          className="inline-flex size-8 items-center justify-center rounded text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg lg:hidden"
          onClick={props.onBack}
          type="button"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
        </button>
        <h2 className="truncate text-sm font-medium text-fg">
          {t('ai.overview.detailTitle')}
        </h2>
      </div>

      {query.isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2
            aria-hidden="true"
            className="size-5 animate-spin text-fg-subtle"
          />
        </div>
      ) : query.isError || !detail ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            action={
              <Button onClick={() => void query.refetch()} variant="subtle">
                {t('common.retry')}
              </Button>
            }
            description={t('ai.overview.loadFailedDescription')}
            icon={AlertTriangle}
            title={t('ai.overview.loadFailedTitle')}
          />
        </div>
      ) : (
        <Scroll className="flex-1" innerClassName="flex flex-col gap-4 p-4">
          <div className="flex min-w-0 items-center gap-2">
            <TypeIcon
              aria-hidden="true"
              className="size-5 shrink-0 text-fg-subtle"
            />
            {editPath ? (
              <Link
                className="truncate text-base font-semibold text-fg transition-colors hover:text-accent"
                to={editPath}
              >
                {detail.article.title}
              </Link>
            ) : (
              <span className="truncate text-base font-semibold text-fg">
                {detail.article.title}
              </span>
            )}
          </div>

          <OverviewSection
            action={<AddLanguageControl labelled onAdd={addColumn} />}
            title={t('ai.overview.matrixTitle')}
          >
            <CoverageMatrix
              activeKey={activeCell}
              activeTasks={activeTasks}
              coverage={detail.coverage}
              extraColumns={extraColumns}
              onAddColumn={addColumn}
              onCellClick={handleCellClick}
            />
            <ActiveTaskList
              // An empty `langs` is the task saying "use the configured
              // targets", not "no language" — forwarding it as undefined
              // reruns the whole set instead of one guessed language.
              onRetry={(task) =>
                dispatchGeneration(
                  task.capability,
                  task.langs.length ? task.langs : undefined,
                  true,
                )
              }
              tasks={activeTasks}
            />
          </OverviewSection>

          {detail.cost.total.generationCount ? (
            <OverviewSection title={t('ai.overview.costTitle')}>
              <CostSummarySection cost={detail.cost} />
            </OverviewSection>
          ) : null}

          <OverviewSection
            bodyClassName="p-0"
            title={t('ai.overview.assetsTitle', { count: rows.length })}
          >
            <AssetSection
              highlightId={highlightId}
              onDelete={(row) => void handleDelete(row)}
              onRegenerate={handleRegenerate}
              refId={props.refId}
              registerRow={(id, node) => {
                if (node) rowNodes.current.set(id, node)
                else rowNodes.current.delete(id)
              }}
              rows={rows}
            />
          </OverviewSection>
        </Scroll>
      )}
    </div>
  )
}
