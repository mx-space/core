import type { LucideIcon } from 'lucide-react'
import {
  ChevronDown,
  ChevronRight,
  Code,
  ExternalLink,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  FunctionSquare,
  Loader2,
  Lock,
  Trash2,
} from 'lucide-react'

import { useI18n } from '~/i18n'
import type { SnippetModel } from '~/models/snippet'
import { SnippetType } from '~/models/snippet'
import { ListRow } from '~/ui/list-actions'
import { cn } from '~/utils/cn'

export interface SnippetGroupState {
  reference: string
  count: number
  snippets: SnippetModel[]
  expanded: boolean
  loading: boolean
}

interface SnippetListProps {
  groups: SnippetGroupState[]
  selectedId: string | null
  onSelect: (snippet: SnippetModel) => void
  onToggleGroup: (reference: string) => void
  onOpenExternal: (snippet: SnippetModel) => void
  onDelete: (snippet: SnippetModel) => void
}

export function SnippetList(props: SnippetListProps) {
  return (
    <div>
      {props.groups.map((group) => (
        <SnippetGroupSection
          group={group}
          key={group.reference}
          onDelete={props.onDelete}
          onOpenExternal={props.onOpenExternal}
          onSelect={props.onSelect}
          onToggle={() => props.onToggleGroup(group.reference)}
          selectedId={props.selectedId}
        />
      ))}
    </div>
  )
}

function SnippetGroupSection(props: {
  group: SnippetGroupState
  selectedId: string | null
  onSelect: (snippet: SnippetModel) => void
  onToggle: () => void
  onOpenExternal: (snippet: SnippetModel) => void
  onDelete: (snippet: SnippetModel) => void
}) {
  const { t } = useI18n()
  const { group } = props
  return (
    <div>
      <button
        className="flex w-full select-none items-center gap-1 px-2 py-1.5 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800/50"
        onClick={props.onToggle}
        type="button"
      >
        <span className="flex size-4 items-center justify-center">
          {group.expanded ? (
            <ChevronDown aria-hidden="true" className="size-3.5" />
          ) : (
            <ChevronRight aria-hidden="true" className="size-3.5" />
          )}
        </span>
        {group.expanded ? (
          <FolderOpen aria-hidden="true" className="size-4 text-amber-500" />
        ) : (
          <Folder aria-hidden="true" className="size-4 text-amber-500" />
        )}
        <span className="flex-1 truncate text-left font-medium">
          {group.reference || 'root'}
        </span>
        <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs tabular-nums dark:bg-neutral-700">
          {group.count}
        </span>
      </button>

      {group.expanded ? (
        <div className="pl-4">
          {group.loading ? (
            <div className="flex items-center justify-center py-3">
              <Loader2
                aria-hidden="true"
                className="size-4 animate-spin text-neutral-400"
              />
            </div>
          ) : group.snippets.length === 0 ? (
            <div className="py-2 pl-6 text-xs text-neutral-400">
              {t('snippets.list.emptyGroup')}
            </div>
          ) : (
            group.snippets.map((snippet) => (
              <SnippetRow
                key={snippet.id}
                onDelete={() => props.onDelete(snippet)}
                onOpenExternal={() => props.onOpenExternal(snippet)}
                onSelect={() => props.onSelect(snippet)}
                selected={props.selectedId === snippet.id}
                snippet={snippet}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

const typeIconMap: Record<SnippetType, LucideIcon> = {
  [SnippetType.JSON]: FileJson,
  [SnippetType.JSON5]: Code,
  [SnippetType.Function]: FunctionSquare,
  [SnippetType.Skill]: FileText,
  [SnippetType.Text]: FileText,
  [SnippetType.YAML]: FileCode,
}

const typeIconColorMap: Record<SnippetType, string> = {
  [SnippetType.JSON]: 'text-orange-500',
  [SnippetType.JSON5]: 'text-purple-500',
  [SnippetType.Function]: 'text-blue-500',
  [SnippetType.Skill]: 'text-teal-500',
  [SnippetType.Text]: 'text-neutral-500',
  [SnippetType.YAML]: 'text-red-500',
}

function SnippetRow(props: {
  onDelete: () => void
  onOpenExternal: () => void
  onSelect: () => void
  selected: boolean
  snippet: SnippetModel
}) {
  const { t } = useI18n()
  const { snippet } = props
  const Icon = typeIconMap[snippet.type] ?? FileText
  const iconColor = typeIconColorMap[snippet.type] ?? 'text-neutral-500'
  const disabled = snippet.enable === false

  return (
    <ListRow
      ariaCurrent={props.selected}
      className={cn(
        'group flex w-full cursor-pointer items-center gap-1.5 px-2 py-1.5 transition-colors',
        'hover:bg-neutral-100 dark:hover:bg-neutral-800/50',
        props.selected ? 'bg-neutral-100 dark:bg-neutral-800' : null,
      )}
      dataId={snippet.id}
      onSelect={props.onSelect}
      role="option"
      selected={props.selected}
    >
      <Icon aria-hidden="true" className={cn('size-3 shrink-0', iconColor)} />
      <span
        className={cn(
          'flex-1 truncate text-sm',
          disabled
            ? 'text-neutral-400 line-through dark:text-neutral-500'
            : 'text-neutral-700 dark:text-neutral-300',
          props.selected && 'font-medium text-neutral-900 dark:text-white',
        )}
      >
        {snippet.name || t('snippets.list.unnamed')}
      </span>
      {snippet.private ? (
        <Lock aria-hidden="true" className="size-3 shrink-0 text-neutral-400" />
      ) : null}
      <button
        aria-label={t('snippets.list.openExternal')}
        className="rounded p-0.5 text-neutral-400 opacity-0 transition-opacity hover:bg-neutral-200 hover:text-neutral-700 group-hover:opacity-100 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
        onClick={(event) => {
          event.stopPropagation()
          props.onOpenExternal()
        }}
        title={t('snippets.list.openExternal')}
        type="button"
      >
        <ExternalLink aria-hidden="true" className="size-3" />
      </button>
      <button
        aria-label={
          snippet.builtIn && snippet.type === SnippetType.Function
            ? t('snippets.editor.action.reset')
            : t('snippets.editor.action.delete')
        }
        className="rounded p-0.5 text-red-500 opacity-0 transition-opacity hover:bg-red-100 group-hover:opacity-100 dark:hover:bg-red-900/50"
        onClick={(event) => {
          event.stopPropagation()
          props.onDelete()
        }}
        title={
          snippet.builtIn && snippet.type === SnippetType.Function
            ? t('snippets.editor.action.reset')
            : t('snippets.editor.action.delete')
        }
        type="button"
      >
        <Trash2 aria-hidden="true" className="size-3" />
      </button>
    </ListRow>
  )
}

export function flattenVisibleSnippets(groups: SnippetGroupState[]) {
  return groups.flatMap((group) => (group.expanded ? group.snippets : []))
}

export function filterGroupsBySearch(
  groups: SnippetGroupState[],
  search: string,
): SnippetGroupState[] {
  const query = search.trim().toLowerCase()
  if (!query) return groups
  const out: SnippetGroupState[] = []
  for (const group of groups) {
    const matched = group.snippets.filter(
      (snippet) =>
        snippet.name.toLowerCase().includes(query) ||
        snippet.comment?.toLowerCase().includes(query),
    )
    const referenceMatches = group.reference.toLowerCase().includes(query)
    if (matched.length === 0 && !(referenceMatches && group.snippets.length))
      continue
    out.push({ ...group, expanded: true, snippets: matched })
  }
  return out
}
