import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  Folder,
  FolderPlus,
  Import,
  MoreHorizontal,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { getDependencyInstallUrl } from '~/api/dependencies'
import {
  type CreateSnippetData,
  deleteSnippet,
  deleteSnippetByPath,
  getSnippets,
  resetFunctionSnippet,
  type SnippetObject,
} from '~/api/snippets'
import { API_URL } from '~/constants/env'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { presentTerminalOutput } from '~/features/snippets/components/terminal-output-modal'
import { useI18n } from '~/i18n'
import { SnippetModel, SnippetType } from '~/models/snippet'
import { adminQueryKeys } from '~/query/keys'
import { FocusScope } from '~/ui/focus-scope'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import type { ContextMenuItem } from '~/ui/overlay/context-menu'
import { showContextMenu } from '~/ui/overlay/context-menu'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

import { emptySnippet, snippetsQueryKey } from '../constants'
import { useSnippetRename } from '../hooks/use-snippet-rename'
import { useSnippetVfs } from '../hooks/use-snippet-vfs'
import { useTreeDrag } from '../hooks/use-tree-drag'
import type { TreeFlatVisibleEntry } from '../hooks/use-tree-keyboard'
import { useTreeKeyboard } from '../hooks/use-tree-keyboard'
import { useTreeSelection } from '../hooks/use-tree-selection'
import { getErrorMessage } from '../utils/snippets'
import { CompiledCodeModal } from './CompiledCodeModal'
import { FunctionLogsDrawer } from './FunctionLogsDrawer'
import { ImportSnippetModal } from './ImportSnippetModal'
import { InstallDependencyModal } from './InstallDependencyModal'
import {
  buildFileMenuItems,
  buildFolderMenuItems,
  buildMultiSelectFileMenuItems,
} from './SnippetContextMenuItems'
import {
  buildSnippetTree,
  collectDescendantFolderPaths,
  countDescendantFiles,
  filterTreeBySearch,
  flattenVisibleSnippets,
  SnippetList,
  type SnippetTreeFolder,
  type SnippetTreeNode,
} from './SnippetList'
import { basenameOf, SnippetMovePicker } from './SnippetMovePicker'
import { SnippetsRouteContext } from './snippets-route-context'
import {
  SnippetDetailEmpty,
  SnippetEmpty,
  SnippetSkeleton,
} from './SnippetStates'
import { UpdateDependenciesModal } from './UpdateDependenciesModal'

const FOCUS_SCOPE_ID = 'snippets-list'

function toSnippetModel(object: SnippetObject): SnippetModel {
  return {
    ...new SnippetModel(),
    ...object,
    raw: '',
    type: object.type ?? SnippetType.Text,
  }
}

function buildSnippetExternalUrl(snippet: SnippetModel) {
  return `${API_URL}/s/${snippet.path}`
}

function normalizeFolderPrefix(prefix: string) {
  const normalized = prefix.trim().replaceAll(/^\/+|\/+$/g, '')
  return normalized ? `${normalized}/` : ''
}

function getParentPrefix(path: string) {
  const index = path.lastIndexOf('/')
  return index === -1 ? '' : path.slice(0, index + 1)
}

function nextUntitledFilePath(prefix: string, snippets: SnippetModel[]) {
  const normalizedPrefix = normalizeFolderPrefix(prefix)
  const existing = new Set(snippets.map((snippet) => snippet.path))
  const base = `${normalizedPrefix}new.json`
  if (!existing.has(base)) return base
  for (let i = 2; i < 1000; i++) {
    const candidate = `${normalizedPrefix}new-${i}.json`
    if (!existing.has(candidate)) return candidate
  }
  return `${normalizedPrefix}new-${Date.now()}.json`
}

export function SnippetsRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const selectedId = params.id ?? null
  const [search, setSearch] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [installOpen, setInstallOpen] = useState(false)
  const [installInitialPackages, setInstallInitialPackages] = useState('')
  const [dependenciesOpen, setDependenciesOpen] = useState(false)
  const [compiledTarget, setCompiledTarget] = useState<SnippetModel | null>(
    null,
  )
  const [logsTarget, setLogsTarget] = useState<SnippetModel | null>(null)
  const [createDraft, setCreateDraft] = useState<CreateSnippetData | null>(null)
  const [expandedPrefixes, setExpandedPrefixes] = useState<
    Record<string, boolean>
  >({})
  const [selectedPrefix, setSelectedPrefix] = useState('')
  const [stagedPrefixes, setStagedPrefixes] = useState<string[]>([])
  const [folderDraftParent, setFolderDraftParent] = useState<string | null>(
    null,
  )
  const [folderDraftName, setFolderDraftName] = useState('')
  const [focusedPath, setFocusedPath] = useState<string | null>(null)
  const [movePicker, setMovePicker] = useState<{
    isFolder: boolean
    paths: string[]
  } | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const rename = useSnippetRename({ queryClient, t })
  const {
    cancelRename,
    commitRename,
    pendingRenamePath,
    renamingPath,
    startRename,
  } = rename

  const listQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => getSnippets({ limit: 1000, recursive: true }),
    queryKey: adminQueryKeys.snippets.vfs('', true),
  })

  const snippets = useMemo(
    () => (listQuery.data?.objects ?? []).map(toSnippetModel),
    [listQuery.data?.objects],
  )

  const treeNodes = useMemo(
    () => buildSnippetTree(snippets, stagedPrefixes),
    [snippets, stagedPrefixes],
  )

  const displayTreeNodes = useMemo(
    () => filterTreeBySearch(treeNodes, search),
    [search, treeNodes],
  )

  const flatItems = useMemo(
    () => flattenVisibleSnippets(displayTreeNodes, expandedPrefixes),
    [displayTreeNodes, expandedPrefixes],
  )

  const treeFlatVisible = useMemo<TreeFlatVisibleEntry[]>(() => {
    const out: TreeFlatVisibleEntry[] = []
    const visit = (node: SnippetTreeNode, parentPath: string | null) => {
      if (node.kind === 'file') {
        out.push({
          file: node.snippet,
          kind: 'file',
          parentPath,
          path: node.path,
        })
        return
      }
      out.push({
        folder: node,
        kind: 'folder',
        parentPath,
        path: node.path,
      })
      const expanded = expandedPrefixes[node.path] ?? true
      if (expanded) {
        for (const child of node.children) visit(child, node.path)
      }
    }
    for (const node of displayTreeNodes) visit(node, null)
    return out
  }, [displayTreeNodes, expandedPrefixes])

  // Lazy-initialize focusedPath once the tree is hydrated: prefer the file
  // matching :id, then the current folder selection, then the first visible
  // node. Subsequent navigation updates focusedPath directly.
  useEffect(() => {
    if (focusedPath !== null) return
    if (selectedId && selectedId !== 'new') {
      const match = snippets.find((s) => s.id === selectedId)
      if (match) {
        setFocusedPath(match.path)
        return
      }
    }
    if (selectedPrefix) {
      setFocusedPath(selectedPrefix)
      return
    }
    const firstVisible = flatItems[0]
    if (firstVisible) setFocusedPath(firstVisible.path)
  }, [flatItems, focusedPath, selectedId, selectedPrefix, snippets])

  useEffect(() => {
    if (!focusedPath) return
    const el = document.querySelector<HTMLElement>(
      `[data-tree-path=${CSS.escape(focusedPath)}]`,
    )
    el?.focus()
  }, [focusedPath])

  const invalidateSnippets = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: snippetsQueryKey })
  }, [queryClient])

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
      await invalidateSnippets()
    },
  })

  const deleteFolderMutation = useMutation({
    mutationFn: (path: string) => deleteSnippetByPath(path, true),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('snippets.toast.deleteFailed'))),
    onSuccess: async () => {
      toast.success(t('snippets.toast.deleted'))
      await invalidateSnippets()
    },
  })

  const resetMutation = useMutation({
    mutationFn: resetFunctionSnippet,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('snippets.toast.resetFailed'))),
    onSuccess: async () => {
      toast.success(t('snippets.toast.reset'))
      await invalidateSnippets()
    },
  })

  const selectSnippet = useCallback(
    (snippet: SnippetModel) => {
      setSelectedPrefix(getParentPrefix(snippet.path))
      setFocusedPath(snippet.path)
      navigate(`/snippets/${snippet.id}`)
    },
    [navigate],
  )

  const vfs = useSnippetVfs()
  const selection = useTreeSelection({
    onSelectFile: selectSnippet,
    visibleFiles: flatItems,
  })
  const { checked, clearChecked } = selection

  const runBatchDelete = useCallback(async () => {
    const paths = [...checked]
    if (paths.length === 0) return
    const confirmed = window.confirm(
      t('snippets.confirm.batchDelete', { count: paths.length }),
    )
    if (!confirmed) return
    const result = await vfs.batchDelete(paths)
    if (result.failed.length === 0) {
      toast.success(t('snippets.toast.batchDeleted', { ok: result.ok }))
    } else {
      toast.error(
        t('snippets.toast.batchDeletedPartial', {
          failed: result.failed.length,
          ok: result.ok,
        }),
      )
    }
    clearChecked()
  }, [checked, clearChecked, t, vfs])

  const startCreate = useCallback(() => {
    const path = nextUntitledFilePath(selectedPrefix, snippets)
    setCreateDraft({
      ...emptySnippet,
      path,
    })
    navigate('/snippets/new')
  }, [navigate, selectedPrefix, snippets])

  const startCreateFolder = useCallback((parentPrefix: string) => {
    const normalizedParent = normalizeFolderPrefix(parentPrefix)
    setSelectedPrefix(normalizedParent)
    setFolderDraftParent(normalizedParent)
    setFolderDraftName('')
  }, [])

  const cancelCreateFolder = useCallback(() => {
    setFolderDraftParent(null)
    setFolderDraftName('')
  }, [])

  const commitCreateFolder = useCallback(() => {
    if (folderDraftParent === null) return
    const nextPrefix = normalizeFolderPrefix(
      `${folderDraftParent}${folderDraftName}`,
    )
    if (!nextPrefix) return
    setStagedPrefixes((current) =>
      current.includes(nextPrefix) ? current : [...current, nextPrefix],
    )
    setExpandedPrefixes((current) => ({
      ...current,
      [folderDraftParent]: true,
      [nextPrefix]: true,
    }))
    setSelectedPrefix(nextPrefix)
    setFolderDraftParent(null)
    setFolderDraftName('')
  }, [folderDraftName, folderDraftParent])

  const toggleFolder = useCallback((prefix: string) => {
    setExpandedPrefixes((state) => ({
      ...state,
      [prefix]: !(state[prefix] ?? true),
    }))
  }, [])

  const selectFolder = useCallback(
    (prefix: string) => {
      setSelectedPrefix(prefix)
      setFocusedPath(prefix)
      clearChecked()
    },
    [clearChecked],
  )

  const requestDelete = useCallback(
    (snippet: SnippetModel) => {
      const isReset = snippet.builtIn && snippet.type === SnippetType.Function
      const confirmed = window.confirm(
        isReset
          ? t('snippets.confirm.resetBuiltIn', { name: snippet.path })
          : t('snippets.confirm.delete', { name: snippet.path }),
      )
      if (!confirmed) return
      if (isReset) {
        resetMutation.mutate(snippet.id)
      } else {
        deleteMutation.mutate(snippet.id)
      }
    },
    [deleteMutation, resetMutation, t],
  )

  const handleTreeDelete = useCallback(
    (path: string) => {
      // Batch path: focused row is part of the multi-select.
      if (checked.size > 0 && checked.has(path)) {
        void runBatchDelete()
        return
      }
      const file = snippets.find((entry) => entry.path === path)
      if (file) {
        requestDelete(file)
        return
      }
      // folder
      const confirmed = window.confirm(
        t('snippets.confirm.delete', { name: path }),
      )
      if (!confirmed) return
      deleteFolderMutation.mutate(path)
    },
    [checked, deleteFolderMutation, requestDelete, runBatchDelete, snippets, t],
  )

  const copyToClipboard = useCallback(
    async (value: string) => {
      try {
        await navigator.clipboard.writeText(value)
        toast.success(t('snippets.toast.copied'))
      } catch {
        toast.error(t('snippets.toast.copied'))
      }
    },
    [t],
  )

  const handleFileContextMenu = useCallback(
    (snippet: SnippetModel) => {
      // Multi-select branch: right-click on a checked file with >1 selection.
      if (checked.has(snippet.path) && checked.size > 1) {
        const multiItems = buildMultiSelectFileMenuItems({
          count: checked.size,
          onDelete: () => void runBatchDelete(),
          onMoveTo: () =>
            setMovePicker({ isFolder: false, paths: [...checked] }),
          t,
        })
        showContextMenu(multiItems)
        return
      }
      // Right-click on an unchecked file while multi-select is active clears it
      // first, then falls through to the single-row menu.
      if (checked.size > 0 && !checked.has(snippet.path)) {
        clearChecked()
      }
      const items = buildFileMenuItems({
        onCopyPath: () => void copyToClipboard(snippet.path),
        onCopyRawUrl: () =>
          void copyToClipboard(buildSnippetExternalUrl(snippet)),
        onDelete: () => requestDelete(snippet),
        onMoveTo: () =>
          setMovePicker({ isFolder: false, paths: [snippet.path] }),
        onOpen: () => selectSnippet(snippet),
        onOpenExternal: () =>
          window.open(buildSnippetExternalUrl(snippet), '_blank'),
        onRename: () => startRename(snippet.path),
        onRevealInParent: () => {
          const parent = getParentPrefix(snippet.path)
          setSelectedPrefix(parent)
          setFocusedPath(parent || snippet.path)
        },
        snippet,
        t,
      })
      showContextMenu(items)
    },
    [
      checked,
      clearChecked,
      copyToClipboard,
      requestDelete,
      runBatchDelete,
      selectSnippet,
      t,
    ],
  )

  const handleFolderContextMenu = useCallback(
    (folder: SnippetTreeFolder) => {
      const descendantPaths = collectDescendantFolderPaths(folder)
      const fileCount = countDescendantFiles(folder)
      const items = buildFolderMenuItems({
        fileCount,
        folder,
        onCollapseAll: () => {
          setExpandedPrefixes((current) => {
            const next = { ...current }
            for (const path of descendantPaths) next[path] = false
            return next
          })
        },
        onCopyPath: () => void copyToClipboard(folder.path),
        onDelete: () => {
          const confirmed = window.confirm(
            t('snippets.confirm.delete', {
              name: `${folder.path} (${fileCount})`,
            }),
          )
          if (!confirmed) return
          deleteFolderMutation.mutate(folder.path)
        },
        onExpandAll: () => {
          setExpandedPrefixes((current) => {
            const next = { ...current }
            for (const path of descendantPaths) next[path] = true
            return next
          })
        },
        onMoveTo: () => setMovePicker({ isFolder: true, paths: [folder.path] }),
        onNewFile: () => {
          setSelectedPrefix(folder.path)
          const path = nextUntitledFilePath(folder.path, snippets)
          setCreateDraft({ ...emptySnippet, path })
          navigate('/snippets/new')
        },
        onNewFolder: () => startCreateFolder(folder.path),
        onRename: () => startRename(folder.path),
        t,
      })
      showContextMenu(items)
    },
    [
      copyToClipboard,
      deleteFolderMutation,
      navigate,
      snippets,
      startCreateFolder,
      t,
    ],
  )

  useTreeKeyboard({
    disabled: renamingPath !== null || movePicker !== null,
    expandedPrefixes,
    flatVisible: treeFlatVisible,
    focusedPath,
    onDelete: handleTreeDelete,
    onEscape: () => {
      if (checked.size === 0) return false
      clearChecked()
      return true
    },
    onRename: (path) => startRename(path),
    onSelectFile: selectSnippet,
    onToggleExpand: toggleFolder,
    scopeId: FOCUS_SCOPE_ID,
    searchInputRef,
    setFocusedPath,
  })

  const pendingPaths = useMemo(() => {
    const out = new Set<string>()
    if (pendingRenamePath) {
      out.add(pendingRenamePath)
      if (pendingRenamePath.endsWith('/')) {
        // optimistic patch already moved descendant paths; still mark prefix busy
        for (const snippet of snippets) {
          if (snippet.path.startsWith(pendingRenamePath)) out.add(snippet.path)
        }
      }
    }
    if (deleteMutation.isPending) {
      const id = deleteMutation.variables
      const file = snippets.find((entry) => entry.id === id)
      if (file) out.add(file.path)
    }
    if (deleteFolderMutation.isPending && deleteFolderMutation.variables) {
      out.add(deleteFolderMutation.variables)
    }
    return out
  }, [
    deleteFolderMutation.isPending,
    deleteFolderMutation.variables,
    deleteMutation.isPending,
    deleteMutation.variables,
    pendingRenamePath,
    snippets,
  ])

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

  const handleSaved = useCallback(
    (snippet: SnippetModel) => {
      navigate(`/snippets/${snippet.id}`)
      setStagedPrefixes((current) =>
        current.filter((prefix) => !snippet.path.startsWith(prefix)),
      )
      setCreateDraft(null)
      void invalidateSnippets()
    },
    [invalidateSnippets, navigate],
  )

  const commitSingleMove = useCallback(
    async (args: { from: string; recursive: boolean; to: string }) => {
      const targetPrefix = getParentPrefix(
        args.to.endsWith('/') ? args.to.slice(0, -1) : args.to,
      )
      try {
        await vfs.move(args)
        toast.success(t('snippets.toast.moved', { target: targetPrefix }))
      } catch (error) {
        toast.error(getErrorMessage(error, t('snippets.toast.moveFailed')))
        throw error
      }
    },
    [t, vfs],
  )

  const handleMoveCommit = useCallback(
    async (targetPrefix: string) => {
      if (!movePicker) return
      const { isFolder, paths } = movePicker
      if (paths.length === 0) return
      if (paths.length === 1) {
        const from = paths[0]
        const base = basenameOf(from)
        const to = isFolder
          ? `${targetPrefix}${base}/`
          : `${targetPrefix}${base}`
        await commitSingleMove({ from, recursive: isFolder, to })
        return
      }
      // multi: files only
      const moves = paths.map((from) => ({
        from,
        to: `${targetPrefix}${basenameOf(from)}`,
      }))
      const result = await vfs.batchMove(moves)
      if (result.failed.length === 0) {
        toast.success(t('snippets.toast.movedN', { count: result.ok }))
      } else {
        toast.error(
          t('snippets.toast.movedPartial', {
            failed: result.failed.length,
            ok: result.ok,
            total: paths.length,
          }),
        )
      }
      if (result.ok > 0) clearChecked()
    },
    [clearChecked, commitSingleMove, movePicker, t, vfs],
  )

  const treeDrag = useTreeDrag({
    checkedSize: checked.size,
    clearChecked,
    isChecked: useCallback((path: string) => checked.has(path), [checked]),
    onCommitMove: commitSingleMove,
  })

  const handleRootDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return
      if (!treeDrag.isLegalTarget('')) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
    },
    [treeDrag],
  )

  const handleRootDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return
      if (!treeDrag.isLegalTarget('')) return
      event.preventDefault()
      void treeDrag.onDropTo('')
    },
    [treeDrag],
  )

  const handleInstallDependency = useCallback(() => {
    setInstallInitialPackages('')
    setInstallOpen(true)
  }, [])

  const routeContextValue = useMemo(
    () => ({
      deleting: deleteMutation.isPending,
      emptySnippet: createDraft ?? {
        ...emptySnippet,
        path: nextUntitledFilePath(selectedPrefix, snippets),
      },
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
      createDraft,
      deleteMutation.isPending,
      handleInstallDependency,
      handleSaved,
      requestDelete,
      resetMutation.isPending,
      selectedPrefix,
      snippets,
    ],
  )

  const listHasContent = treeNodes.length > 0
  const visibleHasContent = displayTreeNodes.length > 0
  const selectedPrefixLabel =
    selectedPrefix.length > 0 ? selectedPrefix : t('snippets.list.root')

  return (
    <SnippetsRouteContext.Provider value={routeContextValue}>
      <MasterDetailShell
        detailScopeId={`${FOCUS_SCOPE_ID}-detail`}
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
                  onKeyDown={(event) => {
                    if (event.key !== 'Escape') return
                    if (search) {
                      event.preventDefault()
                      setSearch('')
                      return
                    }
                    event.preventDefault()
                    searchInputRef.current?.blur()
                    if (!focusedPath) return
                    const el = document.querySelector<HTMLElement>(
                      `[data-tree-path=${CSS.escape(focusedPath)}]`,
                    )
                    el?.focus()
                  }}
                  placeholder={t('snippets.list.searchPlaceholder')}
                  ref={searchInputRef}
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
                  aria-label={t('snippets.list.newFolder')}
                  className="h-8 w-8"
                  iconOnly
                  onClick={() => startCreateFolder(selectedPrefix)}
                  title={t('snippets.list.newFolder')}
                  type="button"
                  variant="subtle"
                >
                  <FolderPlus aria-hidden="true" className="size-4" />
                </Button>
                <Button
                  aria-label={t('snippets.action.refresh')}
                  className="h-8 w-8"
                  disabled={listQuery.isFetching}
                  iconOnly
                  onClick={() => void listQuery.refetch()}
                  title={t('snippets.action.refresh')}
                  type="button"
                  variant="subtle"
                >
                  <RefreshCw
                    aria-hidden="true"
                    className={cn(
                      'size-4',
                      listQuery.isFetching && 'animate-spin',
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

            <div className="shrink-0 border-b border-neutral-200 px-2 py-1.5 dark:border-neutral-800">
              <div className="flex min-h-7 items-center justify-between gap-2">
                <button
                  className={cn(
                    'flex min-w-0 items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs transition-colors',
                    'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100',
                  )}
                  onClick={() => setSelectedPrefix('')}
                  title={selectedPrefixLabel}
                  type="button"
                >
                  <Folder aria-hidden="true" className="size-3.5 shrink-0" />
                  <span className="min-w-0 truncate">
                    {selectedPrefixLabel}
                  </span>
                </button>
                <span className="shrink-0 text-xs tabular-nums text-neutral-400">
                  {snippets.length}
                </span>
              </div>

              {folderDraftParent !== null ? (
                <form
                  className="mt-1.5 flex items-center gap-1.5"
                  onSubmit={(event) => {
                    event.preventDefault()
                    commitCreateFolder()
                  }}
                >
                  <FolderPlus
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-neutral-400"
                  />
                  <TextInput
                    autoFocus
                    controlClassName="h-7 min-w-0 flex-1 px-2 text-xs focus:border-neutral-400 focus:ring-0"
                    onChange={setFolderDraftName}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        cancelCreateFolder()
                      }
                    }}
                    placeholder={t('snippets.list.newFolderPlaceholder')}
                    value={folderDraftName}
                  />
                  <Button
                    aria-label={t('snippets.list.confirmFolder')}
                    className="h-7 w-7"
                    disabled={!folderDraftName.trim()}
                    iconOnly
                    title={t('snippets.list.confirmFolder')}
                    type="submit"
                    variant="subtle"
                  >
                    <Check aria-hidden="true" className="size-3.5" />
                  </Button>
                  <Button
                    aria-label={t('snippets.list.cancelFolder')}
                    className="h-7 w-7"
                    iconOnly
                    onClick={cancelCreateFolder}
                    title={t('snippets.list.cancelFolder')}
                    type="button"
                    variant="ghost"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </Button>
                </form>
              ) : null}
            </div>

            <Scroll
              className="flex-1"
              onDragOver={handleRootDragOver}
              onDrop={handleRootDrop}
            >
              {listQuery.isLoading && !listHasContent ? (
                <SnippetSkeleton />
              ) : !listHasContent ? (
                <SnippetEmpty />
              ) : !visibleHasContent ? (
                <div className="flex min-h-[12rem] items-center justify-center px-4 text-center text-sm text-neutral-400">
                  {t('snippets.list.noResults')}
                </div>
              ) : (
                <SnippetList
                  checked={checked}
                  expandedPrefixes={expandedPrefixes}
                  focusedPath={focusedPath}
                  nodes={displayTreeNodes}
                  onCreateFileInFolder={(prefix) => {
                    setSelectedPrefix(prefix)
                    const path = nextUntitledFilePath(prefix, snippets)
                    setCreateDraft({
                      ...emptySnippet,
                      path,
                    })
                    navigate('/snippets/new')
                  }}
                  onDelete={requestDelete}
                  onDragEnd={treeDrag.endDrag}
                  onDragStart={treeDrag.startDrag}
                  onDropTo={(targetPrefix) =>
                    void treeDrag.onDropTo(targetPrefix)
                  }
                  onFileContextMenu={handleFileContextMenu}
                  onFocusPath={setFocusedPath}
                  onFolderContextMenu={handleFolderContextMenu}
                  onOpenExternal={(snippet) =>
                    window.open(buildSnippetExternalUrl(snippet), '_blank')
                  }
                  onRenameCancel={cancelRename}
                  onRenameCommit={commitRename}
                  onSelect={selection.handleFileClick}
                  onSelectFolder={selectFolder}
                  onStartRename={startRename}
                  onToggleFolder={toggleFolder}
                  pendingPaths={pendingPaths}
                  renamingPath={renamingPath}
                  shouldAcceptDrop={treeDrag.isLegalTarget}
                  selectedId={
                    typeof selectedId === 'string' && selectedId !== 'new'
                      ? selectedId
                      : null
                  }
                  selectedPrefix={selectedPrefix}
                />
              )}
            </Scroll>
          </FocusScope>
        }
      />

      <ImportSnippetModal
        onClose={() => setImportOpen(false)}
        onImported={(packages) => {
          void invalidateSnippets()
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
      <SnippetMovePicker
        isFolderSource={movePicker?.isFolder ?? false}
        onClose={() => setMovePicker(null)}
        onCommit={handleMoveCommit}
        open={movePicker !== null}
        sourcePaths={movePicker?.paths ?? []}
        treeNodes={treeNodes}
      />
    </SnippetsRouteContext.Provider>
  )
}
