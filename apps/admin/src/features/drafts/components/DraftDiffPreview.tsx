import { GitCompare } from 'lucide-react'
import type { DraftModel } from '~/models/draft'
import type { DraftDiffStats } from '../types/drafts'

import { useI18n } from '~/i18n'

import { getDraftTextForDiff } from '../utils/draft-diff'
import { MarkdownDraftDiffPanel } from './MarkdownDraftDiffPanel'
import { RichDraftDiffPanel } from './RichDraftDiffPanel'

export function DraftDiffPreview(props: {
  currentDraft: DraftModel
  diffStats: DraftDiffStats | null
  selectedDraft: DraftModel
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
        currentContent={props.currentDraft.content}
        currentVersion={props.currentDraft.version}
        selectedContent={props.selectedDraft.content}
        selectedVersion={props.selectedDraft.version}
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
      currentText={currentText}
      currentVersion={props.currentDraft.version}
      selectedText={selectedText}
      selectedVersion={props.selectedDraft.version}
    />
  )
}
