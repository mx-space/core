import { useMemo } from 'react'

import { useDocumentTitle } from '~/hooks/use-document-title'
import { useI18n } from '~/i18n'

import { templateDescriptors } from '../constants'
import { TemplateDetailPane } from './TemplateDetailPane'
import { useTemplatesRouteContext } from './templates-route-context'

export function TemplateDetailRoute() {
  const ctx = useTemplatesRouteContext()
  const { t } = useI18n()
  const labelKey = useMemo(
    () =>
      templateDescriptors.find((entry) => entry.value === ctx.type)?.labelKey ??
      templateDescriptors[0].labelKey,
    [ctx.type],
  )
  useDocumentTitle(t(labelKey))
  return <TemplateDetailPane />
}

export default TemplateDetailRoute
