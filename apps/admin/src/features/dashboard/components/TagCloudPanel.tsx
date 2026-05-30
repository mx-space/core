import { useI18n } from '~/i18n'
import { Panel } from '~/ui/primitives/panel'

import { EmptyDashboardBlock } from './DashboardPrimitives'

export function TagCloudPanel(props: {
  tags: Array<{ count: number; tag: string }>
}) {
  const { t } = useI18n()
  return (
    <Panel title={t('dashboard.tagCloud.title')}>
      <div className="flex min-h-40 flex-wrap content-start gap-2 p-4">
        {props.tags.length === 0 ? (
          <EmptyDashboardBlock />
        ) : (
          props.tags.map((tag) => (
            <span
              className="rounded-sm bg-surface-inset px-2 py-1 text-sm text-fg-muted"
              key={tag.tag}
            >
              {tag.tag}
              <span className="ml-1 text-xs text-fg-subtle">{tag.count}</span>
            </span>
          ))
        )}
      </div>
    </Panel>
  )
}
