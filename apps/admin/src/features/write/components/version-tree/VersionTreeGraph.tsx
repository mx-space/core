import { useI18n } from '~/i18n'
import type { DraftModel, VersionTreeNode } from '~/models/draft'
import { Button } from '~/ui/primitives/button'

import { DraftNode } from './DraftNode'
import type { GraphRow } from './layout'
import { laneCount, MAX_LANE } from './layout'
import { DraftLine, RevisionLine } from './RevisionLine'
import type { RailTone } from './VersionRail'
import { railWidth, VersionRail } from './VersionRail'

const CARD_DOT_Y = 21
const LINE_DOT_Y = 18

const toneOf = (row: GraphRow, currentDraftId: string): RailTone => {
  if (row.kind !== 'draft') return row.kind
  if (row.draft?.id === currentDraftId) return 'current'
  return row.draft?.relationToPublished === 'diverged' ? 'conflict' : 'draft'
}

export function VersionTreeGraph(props: {
  currentDraftId: string
  deletingDraftId: string | null
  onCompare: (draft: DraftModel) => void
  onContinue: (draft: DraftModel) => void
  onDelete: (draft: DraftModel) => void
  onHistory: (draft: DraftModel) => void
  onPublish: (draft: DraftModel) => void
  onViewOnline: () => void
  rows: GraphRow[]
}) {
  const { t } = useI18n()
  const gutter = railWidth(Math.min(laneCount(props.rows), MAX_LANE + 1))

  return (
    <ol
      aria-label={t('write.versionTree.graphLabel')}
      className="flex flex-col"
    >
      {props.rows.map((row) => {
        const { draft } = row
        const current = draft?.id === props.currentDraftId
        return (
          <li
            className="grid items-stretch gap-x-2"
            key={row.node.revision.id}
            style={{ gridTemplateColumns: `${gutter}px minmax(0, 1fr)` }}
          >
            <VersionRail
              dotY={draft && current ? CARD_DOT_Y : LINE_DOT_Y}
              row={row}
              tone={toneOf(row, props.currentDraftId)}
            />
            <div className="min-w-0 pb-1">
              {draft ? (
                current ? (
                  <DraftNode
                    deleting={draft.id === props.deletingDraftId}
                    draft={draft}
                    handlers={{
                      onCompare: () => props.onCompare(draft),
                      onContinue: () => props.onContinue(draft),
                      onDelete: () => props.onDelete(draft),
                      onHistory: () => props.onHistory(draft),
                      onPublish: () => props.onPublish(draft),
                    }}
                    node={row.node}
                  />
                ) : (
                  <DraftLine
                    deleting={draft.id === props.deletingDraftId}
                    draft={draft}
                    handlers={{
                      onCompare: () => props.onCompare(draft),
                      onContinue: () => props.onContinue(draft),
                      onDelete: () => props.onDelete(draft),
                      onHistory: () => props.onHistory(draft),
                      onPublish: () => props.onPublish(draft),
                    }}
                  />
                )
              ) : row.kind === 'online' ? (
                <OnlineCard node={row.node} onViewOnline={props.onViewOnline} />
              ) : (
                <RevisionLine node={row.node} />
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function OnlineCard(props: {
  node: VersionTreeNode
  onViewOnline: () => void
}) {
  const { format, t } = useI18n()

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.035] px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          {t('write.versionTree.currentOnline')}
        </span>
        <Button
          className="ml-auto h-7 px-2 text-xs"
          onClick={props.onViewOnline}
          type="button"
          variant="ghost"
        >
          {t('write.branch.viewOnline')}
        </Button>
      </div>
      <p className="truncate text-sm font-medium text-fg">
        {props.node.revision.title || t('write.editor.untitled')}
      </p>
      <p className="text-xs tabular-nums text-fg-muted">
        {t('write.versionTree.publishedAt', {
          time: format.relativeTime(
            props.node.publishedAt ?? props.node.revision.createdAt,
          ),
        })}
      </p>
    </div>
  )
}
