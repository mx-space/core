import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Import,
  MoreHorizontal,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import type { SnippetModel } from '~/models/snippet'
import type { ContextMenuItem } from '~/ui/overlay/context-menu'
import type { SelectedSnippetId } from '../types/snippets'
import type { SnippetGroupState } from './SnippetList'

import { getDependencyInstallUrl } from '~/api/dependencies'
import {
  deleteSnippet,
  getGroupSnippets,
  getSnippetById,
  getSnippetGroups,
  resetFunctionSnippet,
} from '~/api/snippets'
import { API_URL } from '~/constants/env'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { presentTerminalOutput } from '~/features/snippets/components/terminal-output-modal'
import { useI18n } from '~/i18n'
import { SnippetType } from '~/models/snippet'
import { FocusScope } from '~/ui/focus-scope'
import { MasterDetailLayout } from '~/ui/layout/page-layout'
import { useListKeyboard } from '~/ui/list-actions'
import { showContextMenu } from '~/ui/overlay/context-menu'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

import { emptySnippet, snippetsQueryKey } from '../constants'
import { getErrorMessage } from '../utils/snippets'
import { CompiledCodeModal } from './CompiledCodeModal'
import { FunctionLogsDrawer } from './FunctionLogsDrawer'
import { ImportSnippetModal } from './ImportSnippetModal'
import { InstallDependencyModal } from './InstallDependencyModal'
import { SnippetEditor } from './SnippetEditor'
import {
  filterGroupsBySearch,
  flattenVisibleSnippets,
  SnippetList,
} from './SnippetList'
import {
  SnippetDetailEmpty,
  SnippetDetailLoading,
  SnippetEmpty,
  SnippetSkeleton,
} from './SnippetStates'
import { UpdateDependenciesModal } from './UpdateDependenciesModal'

const FOCUS_SCOPE_ID = 'snippets-list'

interface GroupRuntimeState {
  expanded: boolean
  loading: boolean
  snippets: SnippetModel[] | null
}

function buildSnippetExternalUrl(snippet: SnippetModel) {
  if (snippet.customPath) return `${API_URL}/s/${snippet.customPath}`
  const path =
    snippet.type === SnippetType.Function
      ? `/fn/${snippet.reference}/${snippet.name}`
      : `/snippets/${snippet.reference}/${snippet.name}`
  return `${API_URL}${path}`
}

export function SnippetsRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const searchParamsKey = searchParams.toString()
  const [selectedId, setSelectedId] = useState<SelectedSnippetId>(
    searchParams.get('id'),
  )
  const [search, setSearch] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [installOpen, setInstallOpen] = useState(false)
  const [installInitialPackages, setInstallInitialPackages] = useState('')
  const [dependenciesOpen, setDependenciesOpen] = useState(false)
  const [compiledOpen, setCompiledOpen] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(false)
  const [runtime, setRuntime] = useState<Record<string, GroupRuntimeState>>({})

  useLayoutEffect(() => {
    const nextId = searchParams.get('id')
    setSelectedId((value) => (value === nextId ? value : nextId))
    setShowDetailOnMobile(Boolean(nextId))
  }, [searchParamsKey])

  useEffect(() => {
    const nextId = selectedId && selectedId !== 'new' ? selectedId : null
    const next = new URLSearchParams(searchParams)
    if (nextId) next.set('id', nextId)
    else next.delete('id')
    // Strip legacy filter params from the URL.
    next.delete('type')
    next.delete('reference')
    if (next.toString() === searchParamsKey) return
    setSearchParams(next, { replace: true })
  }, [searchParams, searchParamsKey, selectedId, setSearchParams])

  const groupsQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => getSnippetGroups({ page: 1, size: 50 }),
    queryKey: [...snippetsQueryKey, 'groups'],
  })

  const detailQuery = useQuery({
    enabled: Boolean(selectedId && selectedId !== 'new'),
    queryFn: () => getSnippetById(String(selectedId)),
    queryKey: [...snippetsQueryKey, 'detail', selectedId],
  })

  const baseGroups = groupsQuery.data?.data ?? []

  // When a snippet was loaded directly (deep-link via id), auto-expand its
  // group so the row is visible in the list.
  const detailRef = detailQuery.data?.reference
  useEffect(() => {
    if (!detailRef) return
    setRuntime((state) => {
      const current = state[detailRef]
      if (current?.expanded) return state
      return {
        ...state,
        [detailRef]: {
          expanded: true,
          loading: current?.loading ?? false,
          snippets: current?.snippets ?? null,
        },
      }
    })
  }, [detailRef])

  const fetchGroup = async (reference: string) => {
    setRuntime((state) => ({
      ...state,
      [reference]: {
        expanded: state[reference]?.expanded ?? true,
        loading: true,
        snippets: state[reference]?.snippets ?? null,
      },
    }))
    try {
      const snippets = await getGroupSnippets(reference)
      setRuntime((state) => ({
        ...state,
        [reference]: {
          expanded: state[reference]?.expanded ?? true,
          loading: false,
          snippets,
        },
      }))
    } catch (error) {
      setRuntime((state) => ({
        ...state,
        [reference]: {
          expanded: state[reference]?.expanded ?? true,
          loading: false,
          snippets: state[reference]?.snippets ?? [],
        },
      }))
      toast.error(getErrorMessage(error, t('snippets.toast.deleteFailed')))
    }
  }

  useEffect(() => {
    if (!detailRef) return
    const state = runtime[detailRef]
    if (state?.snippets == null && !state?.loading) {
      void fetchGroup(detailRef)
    }
    // fetchGroup reads latest runtime via setState updater.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailRef])

  const toggleGroup = (reference: string) => {
    const current = runtime[reference]
    const nextExpanded = !(current?.expanded ?? false)
    setRuntime((state) => ({
      ...state,
      [reference]: {
        expanded: nextExpanded,
        loading: state[reference]?.loading ?? false,
        snippets: state[reference]?.snippets ?? null,
      },
    }))
    if (nextExpanded && current?.snippets == null && !current?.loading) {
      void fetchGroup(reference)
    }
  }

  const groups: SnippetGroupState[] = useMemo(
    () =>
      baseGroups
        .map((group) => {
          const state = runtime[group.reference]
          return {
            count: group.count,
            expanded: state?.expanded ?? false,
            loading: state?.loading ?? false,
            reference: group.reference,
            snippets: state?.snippets ?? [],
          }
        })
        .sort((left, right) => left.reference.localeCompare(right.reference)),
    [baseGroups, runtime],
  )

  const displayGroups = useMemo(
    () => filterGroupsBySearch(groups, search),
    [groups, search],
  )

  const flatItems = useMemo(
    () => flattenVisibleSnippets(displayGroups),
    [displayGroups],
  )

  const selectedSnippet = useMemo(() => {
    if (detailQuery.data) return detailQuery.data
    for (const group of groups) {
      const found = group.snippets.find((snippet) => snippet.id === selectedId)
      if (found) return found
    }
    return null
  }, [detailQuery.data, groups, selectedId])

  const selectedFunction =
    selectedSnippet?.type === SnippetType.Function ? selectedSnippet : null

  const invalidateGroups = async () => {
    await queryClient.invalidateQueries({ queryKey: snippetsQueryKey })
  }

  const refreshAll = async () => {
    await invalidateGroups()
    await Promise.all(
      Object.entries(runtime)
        .filter(([, state]) => state.expanded)
        .map(([reference]) => fetchGroup(reference)),
    )
  }

  const deleteMutation = useMutation({
    mutationFn: deleteSnippet,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('snippets.toast.deleteFailed'))),
    onSuccess: async () => {
      toast.success(t('snippets.toast.deleted'))
      setSelectedId(null)
      setShowDetailOnMobile(false)
      await invalidateGroups()
    },
  })

  const resetMutation = useMutation({
    mutationFn: resetFunctionSnippet,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('snippets.toast.resetFailed'))),
    onSuccess: async () => {
      toast.success(t('snippets.toast.reset'))
      await invalidateGroups()
    },
  })

  const selectSnippet = (snippet: SnippetModel) => {
    setSelectedId(snippet.id)
    setShowDetailOnMobile(true)
  }

  const startCreate = () => {
    setSelectedId('new')
    setShowDetailOnMobile(true)
  }

  const requestDelete = (snippet: SnippetModel) => {
    const isReset = snippet.builtIn && snippet.type === SnippetType.Function
    const confirmed = window.confirm(
      isReset
        ? t('snippets.confirm.resetBuiltIn', { name: snippet.name })
        : t('snippets.confirm.delete', { name: snippet.name }),
    )
    if (!confirmed) return
    const refetchAfter = () => {
      if (snippet.reference) void fetchGroup(snippet.reference)
    }
    if (isReset) {
      resetMutation.mutate(snippet.id, { onSuccess: refetchAfter })
    } else {
      deleteMutation.mutate(snippet.id, { onSuccess: refetchAfter })
    }
  }

  const openExternal = (snippet: SnippetModel) => {
    window.open(buildSnippetExternalUrl(snippet), '_blank', 'noopener')
  }

  useListKeyboard<SnippetModel>({
    actions: [],
    getId: (snippet) => snippet.id,
    items: flatItems,
    onItemFocus: (id) => {
      const snippet = flatItems.find((entry) => entry.id === id)
      if (snippet) selectSnippet(snippet)
    },
    resetOn: [search],
    scopeId: FOCUS_SCOPE_ID,
  })

  const overflowMenuItems: ContextMenuItem[] = [
    {
      icon: Import,
      key: 'import',
      label: t('snippets.action.importPackage'),
      onClick: () => setImportOpen(true),
    },
    {
      icon: PackagePlus,
      key: 'update-deps',
      label: t('snippets.action.updateDeps'),
      onClick: () => setDependenciesOpen(true),
    },
  ]

  const listHasGroups = groups.length > 0
  const visibleHasContent = displayGroups.length > 0

  return (
    <>
      <MasterDetailLayout
        list={
          <FocusScope
            className="outline-hidden flex h-full min-h-0 flex-col"
            id={FOCUS_SCOPE_ID}
          >
            <div
              className={cn(
                'flex shrink-0 items-center justify-between gap-2 border-b border-neutral-200 px-2 dark:border-neutral-800',
                APP_SHELL_HEADER_HEIGHT_CLASS,
              )}
            >
              <div className="relative min-w-0 flex-1">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400"
                />
                <TextInput
                  controlClassName="h-8 pl-7 text-sm focus:border-neutral-400 focus:ring-0"
                  onChange={setSearch}
                  placeholder={t('snippets.list.searchPlaceholder')}
                  value={search}
                />
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  aria-label={t('snippets.action.create')}
                  className="h-8 w-8"
                  iconOnly
                  onClick={startCreate}
                  title={t('snippets.action.create')}
                  type="button"
                >
                  <Plus aria-hidden="true" className="size-4" />
                </Button>
                <Button
                  aria-label={t('snippets.action.refresh')}
                  className="h-8 w-8"
                  disabled={groupsQuery.isFetching}
                  iconOnly
                  onClick={() => void refreshAll()}
                  title={t('snippets.action.refresh')}
                  type="button"
                  variant="subtle"
                >
                  <RefreshCw
                    aria-hidden="true"
                    className={cn(
                      'size-4',
                      groupsQuery.isFetching && 'animate-spin',
                    )}
                  />
                </Button>
                <Button
                  aria-label={t('shared.contentListItem.moreActions')}
                  className="h-8 w-8"
                  iconOnly
                  onClick={() => showContextMenu(overflowMenuItems)}
                  title={t('shared.contentListItem.moreActions')}
                  type="button"
                  variant="subtle"
                >
                  <MoreHorizontal aria-hidden="true" className="size-4" />
                </Button>
              </div>
            </div>

            <Scroll className="flex-1">
              {groupsQuery.isLoading && !listHasGroups ? (
                <SnippetSkeleton />
              ) : !listHasGroups ? (
                <SnippetEmpty />
              ) : !visibleHasContent ? (
                <div className="flex min-h-[12rem] items-center justify-center px-4 text-center text-sm text-neutral-400">
                  {t('snippets.list.noResults')}
                </div>
              ) : (
                <SnippetList
                  groups={displayGroups}
                  onDelete={requestDelete}
                  onOpenExternal={openExternal}
                  onSelect={selectSnippet}
                  onToggleGroup={toggleGroup}
                  selectedId={
                    typeof selectedId === 'string' && selectedId !== 'new'
                      ? selectedId
                      : null
                  }
                />
              )}
            </Scroll>
          </FocusScope>
        }
        showDetailOnMobile={showDetailOnMobile}
        detail={
          <section className="h-full min-h-0">
            {selectedId === 'new' ? (
              <SnippetEditor
                initialValue={emptySnippet}
                mode="create"
                onBack={() => setShowDetailOnMobile(false)}
                onSaved={(snippet) => {
                  setSelectedId(snippet.id)
                  void invalidateGroups()
                  if (snippet.reference) void fetchGroup(snippet.reference)
                }}
              />
            ) : selectedSnippet ? (
              <SnippetEditor
                deleting={deleteMutation.isPending}
                initialValue={selectedSnippet}
                mode="edit"
                onBack={() => setShowDetailOnMobile(false)}
                onDelete={(snippet) => requestDelete(snippet)}
                onInstallDependency={() => {
                  setInstallInitialPackages('')
                  setInstallOpen(true)
                }}
                onOpenCompiled={() => setCompiledOpen(true)}
                onOpenLogs={() => setLogsOpen(true)}
                onReset={(snippet) => requestDelete(snippet)}
                onSaved={(snippet) => {
                  setSelectedId(snippet.id)
                  void invalidateGroups()
                  if (snippet.reference) void fetchGroup(snippet.reference)
                }}
                resetting={resetMutation.isPending}
              />
            ) : detailQuery.isFetching ? (
              <SnippetDetailLoading />
            ) : (
              <SnippetDetailEmpty />
            )}
          </section>
        }
      />

      <ImportSnippetModal
        onClose={() => setImportOpen(false)}
        onImported={(packages) => {
          void invalidateGroups()
          setShowDetailOnMobile(false)
          if (packages.length > 0) {
            setInstallInitialPackages(packages.join('\n'))
            setInstallOpen(true)
          }
        }}
        open={importOpen}
      />
      <InstallDependencyModal
        initialPackages={installInitialPackages}
        onInstall={(packages) => {
          presentTerminalOutput({
            onFinish: () => toast.success(t('snippets.toast.installComplete')),
            title: t('snippets.dialog.install.title'),
            url: getDependencyInstallUrl(packages),
          })
        }}
        onClose={() => {
          setInstallOpen(false)
          setInstallInitialPackages('')
        }}
        open={installOpen}
      />
      <UpdateDependenciesModal
        onInstall={(packageName, onFinish) => {
          presentTerminalOutput({
            onFinish: () => {
              toast.success(t('snippets.toast.updateComplete'))
              onFinish?.()
            },
            title: t('snippets.dialog.updateTitle', { name: packageName }),
            url: getDependencyInstallUrl(packageName),
          })
        }}
        onClose={() => setDependenciesOpen(false)}
        open={dependenciesOpen}
      />
      <CompiledCodeModal
        onClose={() => setCompiledOpen(false)}
        open={compiledOpen}
        snippet={selectedFunction}
      />
      <FunctionLogsDrawer
        onClose={() => setLogsOpen(false)}
        open={logsOpen}
        snippet={selectedFunction}
      />
    </>
  )
}
