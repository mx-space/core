import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { getSnippetById } from '~/api/snippets'
import { useDocumentTitle } from '~/hooks/use-document-title'
import { adminQueryKeys } from '~/query/keys'

import { SnippetEditor } from './SnippetEditor'
import { useSnippetsRouteContext } from './snippets-route-context'
import { SnippetDetailEmpty, SnippetDetailLoading } from './SnippetStates'

export function SnippetDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const ctx = useSnippetsRouteContext()

  const isCreate = id === 'new'

  const detailQuery = useQuery({
    enabled: Boolean(!isCreate && id),
    queryFn: () => getSnippetById(id!),
    queryKey: adminQueryKeys.snippets.detail(id ?? ''),
  })

  useDocumentTitle(detailQuery.data?.path)

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
