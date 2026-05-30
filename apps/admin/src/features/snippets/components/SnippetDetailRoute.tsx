import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { findInListCache } from '~/api/list-cache'
import { getGroupSnippets, getSnippetById } from '~/api/snippets'
import { useDocumentTitle } from '~/hooks/use-document-title'
import type { SnippetModel } from '~/models/snippet'
import { adminQueryKeys } from '~/query/keys'

import { SnippetEditor } from './SnippetEditor'
import { useSnippetsRouteContext } from './snippets-route-context'
import { SnippetDetailEmpty, SnippetDetailLoading } from './SnippetStates'

const GROUPS_KEY = adminQueryKeys.snippets.groups()

// Each cached group fetch (one per reference) stores SnippetModel[].
function extractFromGroupCache(value: unknown): SnippetModel[] | undefined {
  if (Array.isArray(value)) return value as SnippetModel[]
  return undefined
}

export function SnippetDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const ctx = useSnippetsRouteContext()

  const isCreate = id === 'new'

  // Find the snippet from any prior group fetch so the editor can render
  // without flashing a loading state.
  const cachedFromGroup =
    !isCreate && id
      ? findInListCache<SnippetModel>(
          queryClient,
          adminQueryKeys.snippets.groupRoot,
          id,
          { extractItems: extractFromGroupCache },
        )
      : undefined

  const detailQuery = useQuery({
    enabled: Boolean(!isCreate && id),
    initialData: cachedFromGroup,
    queryFn: () => getSnippetById(id!),
    queryKey: adminQueryKeys.snippets.detail(id ?? ''),
    staleTime: cachedFromGroup ? 30_000 : 0,
  })

  // Best-effort: also keep the groups list warm so the list still resolves
  // on a deep link directly into a snippet detail.
  useQuery({
    queryFn: () => getGroupSnippets('root'),
    queryKey: GROUPS_KEY,
    enabled: false,
  })

  useDocumentTitle(detailQuery.data?.name)

  if (isCreate) {
    return (
      <SnippetEditor
        initialValue={ctx.emptySnippet}
        mode="create"
        onBack={ctx.onBack}
        onSaved={ctx.onSaved}
      />
    )
  }

  if (!id) return <SnippetDetailEmpty />

  const snippet = detailQuery.data
  if (!snippet) {
    return detailQuery.isFetching ? (
      <SnippetDetailLoading />
    ) : (
      <SnippetDetailEmpty />
    )
  }

  return (
    <SnippetEditor
      deleting={ctx.deleting}
      initialValue={snippet}
      mode="edit"
      onBack={ctx.onBack}
      onDelete={ctx.onDelete}
      onInstallDependency={ctx.onInstallDependency}
      onOpenCompiled={() => ctx.onOpenCompiled(snippet)}
      onOpenLogs={() => ctx.onOpenLogs(snippet)}
      onReset={ctx.onReset}
      onSaved={ctx.onSaved}
      resetting={ctx.resetting}
    />
  )
}

export default SnippetDetailRoute
