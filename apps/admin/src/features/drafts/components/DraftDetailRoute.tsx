import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'

import { getDraftPreview } from '~/api/drafts'
import { findInListCache } from '~/api/list-cache'
import { useDocumentTitle } from '~/hooks/use-document-title'
import type { DraftCard } from '~/models/draft'
import { adminQueryKeys } from '~/query/keys'

import { cardFromDraft } from '../utils/draft-card'
import { DraftDetail } from './DraftDetail'
import { DraftDetailEmpty } from './DraftDetailEmpty'
import { useDraftsRouteContext } from './drafts-route-context'

const LIST_PREFIX = adminQueryKeys.drafts.listRoot

export function DraftDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const ctx = useDraftsRouteContext()

  const draftQuery = useQuery({
    enabled: Boolean(id),
    queryFn: () => getDraftPreview(id!),
    queryKey: [...adminQueryKeys.drafts.detail(id ?? ''), 'preview'],
  })

  useDocumentTitle(draftQuery.data?.headRevision.title)

  if (!id || !draftQuery.data) return <DraftDetailEmpty />

  const card =
    findInListCache<DraftCard>(queryClient, LIST_PREFIX, id) ??
    cardFromDraft(draftQuery.data)

  return (
    <DraftDetail
      busy={ctx.busy}
      card={card}
      draft={draftQuery.data}
      onBack={ctx.onBack}
      onCompact={() => ctx.onCompact(card)}
      onDelete={() => ctx.onDelete(card)}
    />
  )
}

export default DraftDetailRoute
