import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, GitCompare, Loader2, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import { getDraftRevisions } from '~/api/drafts'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import type { DraftModel } from '~/models/draft'
import { adminQueryKeys } from '~/query/keys'
import { FocusScope, useScopeArrowNav } from '~/ui/focus-scope'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'
import { relativeTimeFromNow } from '~/utils/time'

import { refTypeMeta } from '../constants'
import { buildVersionItems, computeDiffStats } from '../utils/draft-diff'
import {
  getEditPathForDraft,
  getEditPathForRevision,
} from '../utils/draft-edit-path'
import { DraftDetailEmpty } from './DraftDetailEmpty'
import { DraftDiffPreview } from './DraftDiffPreview'
import { VersionRow } from './VersionRow'

export function DraftDetail(props: {
  deleting: boolean
  draft: DraftModel
  onBack: () => void
  onDelete: (draft: DraftModel) => void
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const revisionsQuery = useQuery({
    enabled: Boolean(props.draft.id),
    queryFn: () => getDraftRevisions(props.draft.id),
    queryKey: adminQueryKeys.drafts.history(props.draft.id),
  })
  const meta = refTypeMeta[props.draft.document.refType]
  const versionItems = useMemo(
    () => buildVersionItems(props.draft.headRevisionId, revisionsQuery.data),
    [props.draft.headRevisionId, revisionsQuery.data],
  )
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(
    null,
  )
  const versionsScopeId = `draft-versions-${props.draft.id}`

  useScopeArrowNav({
    itemSelector: '[data-scope-item="row"]',
    onItemFocus: (element) => {
      const revisionId = element.getAttribute('data-id')
      if (revisionId) setSelectedRevisionId(revisionId)
    },
    scopeId: versionsScopeId,
  })

  useEffect(() => {
    setSelectedRevisionId(
      versionItems.find((item) => !item.isCurrent)?.id ??
        versionItems[0]?.id ??
        null,
    )
  }, [props.draft.id, versionItems])

  const selectedItem = versionItems.find(
    (item) => item.id === selectedRevisionId,
  )
  const selectedRevision = revisionsQuery.data?.find(
    (revision) => revision.id === selectedRevisionId,
  )
  const diffStats = selectedRevision
    ? computeDiffStats(selectedRevision, props.draft.headRevision)
    : null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <MobileHeaderAffordance />
          <Button
            aria-label={t('drafts.detail.backAria')}
            className="h-8 px-2 lg:hidden"
            onClick={props.onBack}
            type="button"
            variant="subtle"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Button>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-neutral-950 dark:text-neutral-50">
              {props.draft.headRevision.title || t('drafts.row.untitled')}
            </h2>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              <span>{t(meta.labelKey)}</span>
              <time dateTime={props.draft.updatedAt ?? props.draft.createdAt}>
                {relativeTimeFromNow(
                  props.draft.updatedAt ?? props.draft.createdAt,
                )}
              </time>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            className="h-8 px-2.5"
            onClick={() => navigate(getEditPathForDraft(props.draft))}
            type="button"
            variant="subtle"
          >
            <Pencil aria-hidden="true" className="size-4" />
            {t('drafts.detail.edit')}
          </Button>
          <Button
            className="h-8 border-red-200 px-2.5 text-red-600 hover:bg-red-50 dark:border-red-950 dark:text-red-400 dark:hover:bg-red-950/30"
            disabled={props.deleting}
            onClick={() => props.onDelete(props.draft)}
            type="button"
            variant="subtle"
          >
            {props.deleting ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Trash2 aria-hidden="true" className="size-4" />
            )}
            {t('drafts.detail.delete')}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {revisionsQuery.isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-neutral-400" />
          </div>
        ) : versionItems.length === 0 ? (
          <DraftDetailEmpty />
        ) : (
          <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
            <FocusScope
              className="outline-hidden min-h-0 border-b border-neutral-200 lg:border-b-0 lg:border-r dark:border-neutral-800"
              id={versionsScopeId}
            >
              <div className="flex h-10 items-center gap-2 border-b border-neutral-200 px-4 text-sm font-medium text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
                <GitCompare aria-hidden="true" className="size-4" />
                {t('drafts.history.title')}
                <span className="text-xs font-normal text-neutral-400">
                  ({versionItems.length})
                </span>
              </div>
              <Scroll className="max-h-72 lg:h-[calc(100%-2.5rem)] lg:max-h-none">
                {versionItems.map((item) => (
                  <VersionRow
                    diffStats={
                      item.id === selectedRevisionId ? diffStats : null
                    }
                    item={item}
                    key={item.id}
                    onRestore={() =>
                      navigate(getEditPathForRevision(props.draft, item.id))
                    }
                    onSelect={() => setSelectedRevisionId(item.id)}
                    restorePending={false}
                    selected={selectedRevisionId === item.id}
                  />
                ))}
              </Scroll>
            </FocusScope>

            <div className="flex min-h-0 flex-col bg-neutral-50 dark:bg-neutral-950">
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800">
                <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                  {selectedItem ? (
                    <>
                      <span>{relativeTimeFromNow(selectedItem.savedAt)}</span>
                      <span className="text-neutral-400">→</span>
                      <span>{t('drafts.history.current')}</span>
                    </>
                  ) : (
                    <span>{t('drafts.history.pickVersion')}</span>
                  )}
                </div>
                {diffStats && !diffStats.isSame ? (
                  <span className="text-xs tabular-nums text-neutral-500">
                    {t('drafts.history.deltaChars', {
                      delta:
                        diffStats.delta > 0
                          ? `+${diffStats.delta}`
                          : diffStats.delta,
                    })}
                  </span>
                ) : null}
              </div>
              <Scroll className="flex-1" innerClassName="p-4">
                {selectedRevision ? (
                  <DraftDiffPreview
                    currentDraft={props.draft.headRevision}
                    diffStats={diffStats}
                    selectedDraft={selectedRevision}
                  />
                ) : (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {t('drafts.history.cannotLoad')}
                  </p>
                )}
              </Scroll>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
