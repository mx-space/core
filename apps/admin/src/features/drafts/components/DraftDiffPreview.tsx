import { GitCompare } from 'lucide-react'

import { useI18n } from '~/i18n'
import type { RevisionSnapshot } from '~/models/draft'

import type { DraftDiffStats } from '../types/drafts'
import { getDraftTextForDiff } from '../utils/draft-diff'
import { MarkdownDraftDiffPanel } from './MarkdownDraftDiffPanel'
import { RichDraftDiffPanel } from './RichDraftDiffPanel'

export function DraftDiffPreview(props: {
  currentDraft: RevisionSnapshot
  diffStats: DraftDiffStats | null
  selectedDraft: RevisionSnapshot
}) {
  const { t } = useI18n()
  if (
    props.selectedDraft.contentFormat === 'lexical' &&
    props.currentDraft.contentFormat === 'lexical' &&
    props.selectedDraft.content &&
    props.currentDraft.content
  ) {
    return (
      <RichDraftDiffPanel
        comparisonLabel={t('drafts.history.direction')}
        currentContent={props.currentDraft.content}
        selectedContent={props.selectedDraft.content}
      />
    )
  }

  const selectedText = getDraftTextForDiff(props.selectedDraft)
  const currentText = getDraftTextForDiff(props.currentDraft)

  if (props.diffStats?.isSame) {
    return (
      <div className="flex min-h-[20rem] flex-col items-center justify-center text-center">
        <GitCompare aria-hidden="true" className="size-8 text-neutral-300" />
        <p className="mt-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t('drafts.diff.sameContent')}
        </p>
      </div>
    )
  }

  return (
    <MarkdownDraftDiffPanel
      comparisonLabel={t('drafts.history.direction')}
      currentLabel={t('drafts.history.currentFile')}
      currentText={currentText}
      selectedLabel={t('drafts.history.historyFile')}
      selectedText={selectedText}
    />
  )
}
