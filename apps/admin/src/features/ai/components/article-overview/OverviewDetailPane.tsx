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
import type { AssetRow } from './asset-rows'
import { buildAssetRows, firstAnchorIds } from './asset-rows'
import { AssetSection } from './AssetSection'
import { CostSummarySection } from './CostSummarySection'
import type { CellState } from './coverage-cells'
import { isGenerationPending } from './coverage-cells'
import { CoverageMatrix } from './CoverageMatrix'
import { useOverviewActions } from './useOverviewActions'

const HIGHLIGHT_MS = 1200

export function OverviewDetailPane(props: {
  refId: string
  onBack: () => void
}) {
  const { t } = useI18n()
  const actions = useOverviewActions(props.refId)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [activeCell, setActiveCell] = useState<string | null>(null)
  const [justQueued, setJustQueued] = useState<string[]>([])
  const [extraColumns, setExtraColumns] = useState<string[]>([])
  const rowNodes = useRef(new Map<string, HTMLLIElement>())

  const query = useQuery({
    queryFn: () => getArticleOverview(props.refId),
    queryKey: adminQueryKeys.ai.overviewArticle(props.refId),
  })

  const detail = query.data
  const rows = useMemo(() => (detail ? buildAssetRows(detail) : []), [detail])
  const anchors = useMemo(() => firstAnchorIds(rows), [rows])

  // The queue takes a moment to report a task, so a freshly clicked cell holds
  // its own spinner until the server's own `activeTasks` covers it — without
  // it the cell snaps back to `+` and invites a duplicate click.
  const activeTasks = useMemo<ActiveGeneration[]>(() => {
    const fromServer = detail?.activeTasks ?? []
    const optimistic = justQueued.map((key) => {
      const [capability, lang] = key.split(':')
      return {
        capability: capability as AiOverviewCapability,
        langs: [lang],
        status: 'pending',
        taskId: `optimistic:${key}`,
      }
    })
    return [...fromServer, ...optimistic]
  }, [detail?.activeTasks, justQueued])

  useEffect(() => {
    if (!detail || !justQueued.length) return
    const settled = justQueued.filter((key) => {
      const [capability, lang] = key.split(':')
      return (
        isGenerationPending(
          detail.activeTasks,
          capability as AiOverviewCapability,
          lang,
        ) ||
        detail.coverage[capability as AiOverviewCapability].langs.includes(lang)
      )
    })
    if (settled.length) {
      setJustQueued((prev) => prev.filter((key) => !settled.includes(key)))
    }
  }, [detail, justQueued])

  useEffect(() => {
    setHighlightId(null)
    setActiveCell(null)
    setJustQueued([])
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
    if (state === 'gap' || state === 'addable') {
      setJustQueued((prev) => (prev.includes(key) ? prev : [...prev, key]))
      actions.generate(capability, lang, detail)
      return
    }
    const targetId = anchors.get(key)
    if (!targetId) return
    setHighlightId(targetId)
    rowNodes.current.get(targetId)?.scrollIntoView({ block: 'nearest' })
  }

  const handleRegenerate = (row: AssetRow) => {
    if (!detail) return
    actions.generate(row.capability, row.lang, detail, true)
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

          <section className="rounded-md border border-border p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-subtle">
              {t('ai.overview.matrixTitle')}
            </p>
            <CoverageMatrix
              activeKey={activeCell}
              activeTasks={activeTasks}
              coverage={detail.coverage}
              extraColumns={extraColumns}
              onAddColumn={(lang) =>
                setExtraColumns((prev) =>
                  prev.includes(lang) ? prev : [...prev, lang],
                )
              }
              onCellClick={handleCellClick}
            />
          </section>

          <CostSummarySection cost={detail.cost} />

          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-subtle">
              {t('ai.overview.assetsTitle', { count: rows.length })}
            </p>
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
          </section>
        </Scroll>
      )}
    </div>
  )
}
