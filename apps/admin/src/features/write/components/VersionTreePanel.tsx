import { GitBranch } from 'lucide-react'
import { useMemo } from 'react'

import { useI18n } from '~/i18n'
import type { DraftModel, VersionTreeNode } from '~/models/draft'
import { AsidePanel } from '~/ui/layout/content-layout'
import { EmptyState } from '~/ui/patterns/EmptyState'
import { Scroll } from '~/ui/primitives/scroll'

import { buildGraphRows } from './version-tree/layout'
import { VersionTreeGraph } from './version-tree/VersionTreeGraph'

export interface VersionTreePanelProps {
  currentDraftId: string
  currentPublishedRevisionId: string | null
  deletingDraftId: string | null
  drafts: DraftModel[]
  nodes: VersionTreeNode[]
  onClose: () => void
  onCompare: (draft: DraftModel) => void
  onContinue: (draft: DraftModel) => void
  onDelete: (draft: DraftModel) => void
  onHistory: (draft: DraftModel) => void
  onPublish: (draft: DraftModel) => void
  onViewOnline: () => void
}

export function VersionTreePanel(props: VersionTreePanelProps) {
  const { t } = useI18n()
  const rows = useMemo(
    () =>
      buildGraphRows(
        props.nodes,
        props.drafts,
        props.currentPublishedRevisionId,
      ),
    [props.currentPublishedRevisionId, props.drafts, props.nodes],
  )

  return (
    <AsidePanel
      icon={GitBranch}
      onClose={props.onClose}
      title={t('write.versionTree.title')}
    >
      {rows.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          <EmptyState
            description={t('write.versionTree.emptyDescription')}
            icon={GitBranch}
            title={t('write.versionTree.emptyTitle')}
          />
        </div>
      ) : (
        <Scroll className="min-h-0 flex-1" innerClassName="px-3 py-4">
          <VersionTreeGraph
            currentDraftId={props.currentDraftId}
            deletingDraftId={props.deletingDraftId}
            onCompare={props.onCompare}
            onContinue={props.onContinue}
            onDelete={props.onDelete}
            onHistory={props.onHistory}
            onPublish={props.onPublish}
            onViewOnline={props.onViewOnline}
            rows={rows}
          />
        </Scroll>
      )}
    </AsidePanel>
  )
}
