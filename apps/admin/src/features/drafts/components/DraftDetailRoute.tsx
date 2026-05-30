import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { getDraftById } from '~/api/drafts'
import { findInListCache } from '~/api/list-cache'
import { useDocumentTitle } from '~/hooks/use-document-title'
import type { DraftModel } from '~/models/draft'
import { adminQueryKeys } from '~/query/keys'

import { DraftDetail } from './DraftDetail'
import { DraftDetailEmpty } from './DraftDetailEmpty'
import { useDraftsRouteContext } from './drafts-route-context'

const LIST_PREFIX = adminQueryKeys.drafts.listRoot

export function DraftDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const ctx = useDraftsRouteContext()

  const initialDraft = id
    ? findInListCache<DraftModel>(queryClient, LIST_PREFIX, id)
    : undefined

  const draftQuery = useQuery({
    enabled: Boolean(id),
    initialData: initialDraft,
    queryFn: () => getDraftById(id!),
    queryKey: adminQueryKeys.drafts.detail(id ?? ''),
    staleTime: initialDraft ? 30_000 : 0,
  })

  useDocumentTitle(draftQuery.data?.title)

  if (!id || !draftQuery.data) return <DraftDetailEmpty />

  return (
    <DraftDetail
      deleting={ctx.deleting}
      draft={draftQuery.data}
      onBack={ctx.onBack}
      onDelete={ctx.onDelete}
    />
  )
}

export default DraftDetailRoute
