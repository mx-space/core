import { useDocumentTitle } from '~/hooks/use-document-title'

import { TemplateDetailPane } from './TemplateDetailPane'
import { useTemplatesRouteContext } from './templates-route-context'

export function TemplateDetailRoute() {
  const ctx = useTemplatesRouteContext()
  useDocumentTitle(ctx.type)
  return (
    <TemplateDetailPane
      defaultProps={ctx.defaultProps}
      dirty={ctx.dirty}
      loading={ctx.loading}
      onChangeProps={ctx.onChangeProps}
      onChangeSource={ctx.onChangeSource}
      onChangeView={ctx.onChangeView}
      onRefresh={ctx.onRefresh}
      onReset={ctx.onReset}
      onSave={ctx.onSave}
      onTestSmtp={ctx.onTestSmtp}
      previewError={ctx.previewError}
      previewHtml={ctx.previewHtml}
      propsKeys={ctx.propsKeys}
      propsValue={ctx.propsValue}
      refreshing={ctx.refreshing}
      resetting={ctx.resetting}
      saving={ctx.saving}
      source={ctx.source}
      testing={ctx.testing}
      type={ctx.type}
      viewMode={ctx.viewMode}
    />
  )
}

export default TemplateDetailRoute
