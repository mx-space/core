import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Import,
  MoreHorizontal,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { getDependencyInstallUrl } from '~/api/dependencies'
import {
  deleteSnippet,
  getGroupSnippets,
  getSnippetGroups,
  resetFunctionSnippet,
} from '~/api/snippets'
import { API_URL } from '~/constants/env'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { presentTerminalOutput } from '~/features/snippets/components/terminal-output-modal'
import { useI18n } from '~/i18n'
import type { SnippetModel } from '~/models/snippet'
import { SnippetType } from '~/models/snippet'
import { adminQueryKeys } from '~/query/keys'
import { FocusScope } from '~/ui/focus-scope'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { useListKeyboard } from '~/ui/list-actions'
import type { ContextMenuItem } from '~/ui/overlay/context-menu'
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
import type { SnippetGroupState } from './SnippetList'
import {
  filterGroupsBySearch,
  flattenVisibleSnippets,
  SnippetList,
} from './SnippetList'
import { SnippetsRouteContext } from './snippets-route-context'
import {
  SnippetDetailEmpty,
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
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const selectedId = params.id ?? null
  const isCreating = selectedId === 'new'
  const [search, setSearch] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [installOpen, setInstallOpen] = useState(false)
  const [installInitialPackages, setInstallInitialPackages] = useState('')
  const [dependenciesOpen, setDependenciesOpen] = useState(false)
  const [compiledTarget, setCompiledTarget] = useState<SnippetModel | null>(
    null,
  )
  const [logsTarget, setLogsTarget] = useState<SnippetModel | null>(null)
  const [runtime, setRuntime] = useState<Record<string, GroupRuntimeState>>({})

  const groupsQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => getSnippetGroups({ page: 1, size: 50 }),
    queryKey: adminQueryKeys.snippets.groups(),
  })

  // Detail's reference for auto-expanding the owning group — read from cache.
  const detailRef = useMemo(() => {
    if (!selectedId || isCreating) return undefined
    const detail = queryClient.getQueryData<SnippetModel>(
      adminQueryKeys.snippets.detail(selectedId),
    )
    return detail?.reference
  }, [isCreating, queryClient, selectedId])

  const baseGroups = groupsQuery.data?.data ?? []

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

  const fetchGroup = useCallback(
    async (reference: string) => {
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
        // Mirror into a stable query cache so list-cache findInListCache
        // can locate snippets by id when the detail route mounts.
        queryClient.setQueryData(
          adminQueryKeys.snippets.group(reference),
          snippets,
        )
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
    },
    [queryClient, t],
  )

  useEffect(() => {
    if (!detailRef) return
    const state = runtime[detailRef]
    if (state?.snippets == null && !state?.loading) {
      void fetchGroup(detailRef)
    }
    // fetchGroup reads latest runtime via setState updater.
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

  const invalidateGroups = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: snippetsQueryKey })
  }, [queryClient])

  const refreshAll = useCallback(async () => {
    await invalidateGroups()
    await Promise.all(
      Object.entries(runtime)
        .filter(([, state]) => state.expanded)
        .map(([reference]) => fetchGroup(reference)),
    )
  }, [fetchGroup, invalidateGroups, runtime])

  const closeDetail = useCallback(() => {
    navigate('/snippets')
  }, [navigate])

  const deleteMutation = useMutation({
    mutationFn: deleteSnippet,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('snippets.toast.deleteFailed'))),
    onSuccess: async () => {
      toast.success(t('snippets.toast.deleted'))
      closeDetail()
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

  const selectSnippet = useCallback(
    (snippet: SnippetModel) => {
      navigate(`/snippets/${snippet.id}`)
    },
    [navigate],
  )

  const startCreate = useCallback(() => {
    navigate('/snippets/new')
  }, [navigate])

  const requestDelete = useCallback(
    (snippet: SnippetModel) => {
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
    },
    [deleteMutation, fetchGroup, resetMutation, t],
  )

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

  const handleSaved = useCallback(
    (snippet: SnippetModel) => {
      navigate(`/snippets/${snippet.id}`)
      void invalidateGroups()
      if (snippet.reference) void fetchGroup(snippet.reference)
    },
    [fetchGroup, invalidateGroups, navigate],
  )

  const handleInstallDependency = useCallback(() => {
    setInstallInitialPackages('')
    setInstallOpen(true)
  }, [])

  const routeContextValue = useMemo(
    () => ({
      deleting: deleteMutation.isPending,
      emptySnippet,
      onBack: closeDetail,
      onDelete: requestDelete,
      onInstallDependency: handleInstallDependency,
      onOpenCompiled: (snippet: SnippetModel) => setCompiledTarget(snippet),
      onOpenLogs: (snippet: SnippetModel) => setLogsTarget(snippet),
      onReset: requestDelete,
      onSaved: handleSaved,
      resetting: resetMutation.isPending,
    }),
    [
      closeDetail,
      deleteMutation.isPending,
      handleInstallDependency,
      handleSaved,
      requestDelete,
      resetMutation.isPending,
    ],
  )

  return (
    <SnippetsRouteContext.Provider value={routeContextValue}>
      <MasterDetailShell
        emptyDetail={<SnippetDetailEmpty />}
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
              <MobileHeaderAffordance />
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
      />

      <ImportSnippetModal
        onClose={() => setImportOpen(false)}
        onImported={(packages) => {
          void invalidateGroups()
          closeDetail()
          if (packages.length > 0) {
            setInstallInitialPackages(packages.join('\n'))
            setInstallOpen(true)
          }
        }}
        open={importOpen}
      />
      <InstallDependencyModal
        initialPackages={installInitialPackages}
        onClose={() => {
          setInstallOpen(false)
          setInstallInitialPackages('')
        }}
        onInstall={(packages) => {
          presentTerminalOutput({
            onFinish: () => toast.success(t('snippets.toast.installComplete')),
            title: t('snippets.dialog.install.title'),
            url: getDependencyInstallUrl(packages),
          })
        }}
        open={installOpen}
      />
      <UpdateDependenciesModal
        onClose={() => setDependenciesOpen(false)}
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
        open={dependenciesOpen}
      />
      <CompiledCodeModal
        onClose={() => setCompiledTarget(null)}
        open={compiledTarget !== null}
        snippet={
          compiledTarget?.type === SnippetType.Function ? compiledTarget : null
        }
      />
      <FunctionLogsDrawer
        onClose={() => setLogsTarget(null)}
        open={logsTarget !== null}
        snippet={logsTarget?.type === SnippetType.Function ? logsTarget : null}
      />
    </SnippetsRouteContext.Provider>
  )
}
