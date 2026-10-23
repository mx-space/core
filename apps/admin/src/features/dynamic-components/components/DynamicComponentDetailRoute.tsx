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

  useDocumentTitle(item?.name)

  if (!item) return <DynamicComponentDetailEmptyState />

  return (
    <DynamicComponentDetail
      item={item}
      key={item.id}
      onBack={ctx.onBack}
      onDelete={() => ctx.onDelete(item)}
      onEdit={() => ctx.onEdit(item)}
    />
  )
}

export default DynamicComponentDetailRoute
