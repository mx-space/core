import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'

import { getDrafts, getDraftStorage } from '~/api/drafts'
import { getOption } from '~/api/options'
import { useI18n } from '~/i18n'
import type { DraftCard, DraftRefType } from '~/models/draft'
import { adminQueryKeys } from '~/query/keys'
import { FocusScope } from '~/ui/focus-scope'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import { useListKeyboard } from '~/ui/list-actions'
import { Scroll } from '~/ui/primitives/scroll'

import { useDraftMutations } from '../hooks/use-draft-mutations'
import {
  type DraftRelationFilter,
  type DraftSort,
  parseDraftFilterType,
  parseDraftRelation,
  parseDraftSort,
} from '../utils/draft-filter'
import { buildDraftActions } from './buildDraftActions'
import { openCleanupDialog } from './CleanupDialog'
import { DraftDetailEmpty } from './DraftDetailEmpty'
import { DraftListEmpty } from './DraftListEmpty'
import { DraftListFilters } from './DraftListFilters'
import { DraftListHeader } from './DraftListHeader'
import { DraftListSkeleton } from './DraftListSkeleton'
import { DraftRow } from './DraftRow'
import { DraftsRouteContext } from './drafts-route-context'
import { DraftSelectionBar } from './DraftSelectionBar'
import { DraftStorageBar } from './DraftStorageBar'

const FOCUS_SCOPE_ID = 'drafts-list'

export function DraftsRouteViewContent() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const detailId = params.id ?? null
  const [searchParams, setSearchParams] = useSearchParams()
  const filterType = parseDraftFilterType(searchParams.get('type'))
  const relation = parseDraftRelation(searchParams.get('relation'))
  const sort = parseDraftSort(searchParams.get('sort'))

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const sp = new URLSearchParams(searchParams)
      if (value) sp.set(key, value)
      else sp.delete(key)
      const qs = sp.toString()
      navigate(`/drafts${qs ? `?${qs}` : ''}`, { replace: true })
    },
    [navigate, searchParams],
  )

  const draftsQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () =>
      getDrafts({
        page: 1,
        refType: filterType === 'all' ? undefined : filterType,
        relation: relation === 'all' ? undefined : relation,
        size: 50,
        sort,
      }),
    queryKey: adminQueryKeys.drafts.list({ relation, sort, type: filterType }),
  })
  const storageQuery = useQuery({
    queryFn: () =>
      getDraftStorage(filterType === 'all' ? undefined : filterType),
    queryKey: adminQueryKeys.drafts.storage(filterType),
  })
  const autoCleanupQuery = useQuery({
    queryFn: () => getOption<{ enable?: boolean }>('draftCleanupOptions'),
    queryKey: [...adminQueryKeys.settings.options(), 'draftCleanupOptions'],
  })

  const drafts = draftsQuery.data?.data ?? []
  const selectionClearRef = useRef<(() => void) | null>(null)

  const closeDetail = useCallback(() => {
    const qs = searchParams.toString()
    navigate(`/drafts${qs ? `?${qs}` : ''}`)
  }, [navigate, searchParams])

  const mutations = useDraftMutations({
    onDeleted: () => {
      selectionClearRef.current?.()
      closeDetail()
    },
  })

  const openDraft = useCallback(
    (draft: DraftCard) => {
      const qs = searchParams.toString()
      navigate(`/drafts/${draft.id}${qs ? `?${qs}` : ''}`)
    },
    [navigate, searchParams],
  )

  const startCleanup = useCallback(() => {
    void openCleanupDialog().then(() => selectionClearRef.current?.())
  }, [])

  useEffect(() => {
    if (searchParams.get('cleanup') !== '1') return
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('cleanup')
        return next
      },
      { replace: true },
    )
    startCleanup()
  }, [searchParams, setSearchParams, startCleanup])

  const actions = useMemo(
    () =>
      buildDraftActions(
        { deleteMany: mutations.confirmDelete, open: openDraft },
        t,
      ),
    [mutations.confirmDelete, openDraft, t],
  )

  const { selection } = useListKeyboard<DraftCard>({
    actions,
    getId: (draft) => draft.id,
    items: drafts,
    onItemFocus: (id) => {
      const draft = drafts.find((d) => d.id === id)
      if (draft) openDraft(draft)
    },
    resetOn: [filterType, relation, sort],
    scopeId: FOCUS_SCOPE_ID,
  })
  selectionClearRef.current = selection.clear

  const selected = selection.getSelectedTargets()
  const visibleIds = drafts.map((d) => d.id)
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selection.isSelected(id))

  const routeContextValue = useMemo(
    () => ({
      busy: mutations.deleting || mutations.compacting,
      onBack: closeDetail,
      onCompact: (draft: DraftCard) => void mutations.confirmCompact([draft]),
      onDelete: (draft: DraftCard) => void mutations.confirmDelete([draft]),
    }),
    [closeDetail, mutations],
  )

  return (
    <DraftsRouteContext.Provider value={routeContextValue}>
      <MasterDetailShell
        detailScopeId={`${FOCUS_SCOPE_ID}-detail`}
        emptyDetail={<DraftDetailEmpty />}
        list={
          <FocusScope
            className="outline-hidden flex h-full min-h-0 flex-col"
            id={FOCUS_SCOPE_ID}
          >
            <DraftListHeader
              fetching={draftsQuery.isFetching}
              onRefresh={() => {
                void draftsQuery.refetch()
                void storageQuery.refetch()
              }}
              total={draftsQuery.data?.pagination.total ?? 0}
            />
            <DraftStorageBar
              autoCleanup={autoCleanupQuery.data?.enable}
              onCleanup={startCleanup}
              summary={storageQuery.data}
            />
            <DraftListFilters
              counts={storageQuery.data?.relations}
              onRelation={(next: DraftRelationFilter) =>
                setParam('relation', next === 'all' ? null : next)
              }
              onSort={(next: DraftSort) =>
                setParam('sort', next === 'updated' ? null : next)
              }
              onType={(next: DraftRefType | 'all') =>
                setParam('type', next === 'all' ? null : next)
              }
              relation={relation}
              sort={sort}
              type={filterType}
            />
            {drafts.length > 0 ? (
              <DraftSelectionBar
                allSelected={allVisibleSelected}
                busy={mutations.deleting || mutations.compacting}
                indeterminate={selected.length > 0 && !allVisibleSelected}
                onCompact={() => void mutations.confirmCompact(selected)}
                onDelete={() => void mutations.confirmDelete(selected)}
                onSelectAll={(checked) => {
                  if (checked) selection.selectAll()
                  else selection.clear()
                }}
                selected={selected}
              />
            ) : null}
            <Scroll className="flex-1">
              {draftsQuery.isLoading && drafts.length === 0 ? (
                <DraftListSkeleton />
              ) : drafts.length === 0 ? (
                <DraftListEmpty />
              ) : (
                drafts.map((draft) => (
                  <DraftRow
                    actions={actions}
                    checked={selection.isSelected(draft.id)}
                    cursor={selection.isCursor(draft.id)}
                    draft={draft}
                    isDetailTarget={detailId === draft.id}
                    key={draft.id}
                    onCheck={() => selection.toggleWithAnchor(draft.id)}
                    onSelect={(mode) => {
                      if (mode === 'range') selection.selectRange(draft.id)
                      else if (mode === 'toggle')
                        selection.toggleWithAnchor(draft.id)
                      else {
                        selection.setCursor(draft.id)
                        openDraft(draft)
                      }
                    }}
                    selected={selection.isSelected(draft.id)}
                  />
                ))
              )}
            </Scroll>
          </FocusScope>
        }
      />
    </DraftsRouteContext.Provider>
  )
}
