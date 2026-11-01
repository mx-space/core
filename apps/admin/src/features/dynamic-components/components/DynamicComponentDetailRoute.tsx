import { useMemo } from 'react'
import { useParams } from 'react-router'

import { useDocumentTitle } from '~/hooks/use-document-title'

import { useDynamicCatalog } from '../hooks/use-dynamic-catalog'
import { useDynamicComponentsRouteContext } from './dynamic-components-route-context'
import { DynamicComponentDetail } from './DynamicComponentDetail'
import { DynamicComponentDetailEmptyState } from './DynamicComponentStates'

export function DynamicComponentDetailRoute() {
  const { id } = useParams<{ id: string }>()
  const ctx = useDynamicComponentsRouteContext()
  const { items } = useDynamicCatalog()
  const item = items.find((entry) => entry.id === id)
  const report = ctx.usage?.entries.find((entry) => entry.entryId === id)
  const deletable = useMemo(
    () =>
      new Map(
        (ctx.usage?.candidates.unusedVersions ?? [])
          .filter(
            (candidate) =>
              candidate.action?.type === 'previousUrl' &&
              candidate.action.entryId === id,
          )
          .map((candidate) => [candidate.urls[0], candidate]),
      ),
    [ctx.usage, id],
  )

  useDocumentTitle(item?.name)

  if (!item) return <DynamicComponentDetailEmptyState />

  return (
    <DynamicComponentDetail
      deletable={deletable}
      deletingKey={ctx.deletingKey}
      item={item}
      key={item.id}
      onBack={ctx.onBack}
      onDelete={() => ctx.onDelete(item)}
      onDeleteVersion={ctx.onDeleteCandidate}
      onEdit={() => ctx.onEdit(item)}
      report={report}
    />
  )
}

export default DynamicComponentDetailRoute
