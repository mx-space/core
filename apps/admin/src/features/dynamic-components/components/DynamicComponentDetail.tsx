import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useBlocker } from 'react-router'

import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { formatJson, samplePropsFromSchema } from '~/lib/dynamic-props'
import { confirmDialog } from '~/ui/feedback/confirm'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { PropsEditor } from '~/ui/patterns/PropsEditor'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { SegmentedControl } from '~/ui/primitives/segmented-control'
import { cn } from '~/utils/cn'

import type { DynamicComponentItem } from '../types/dynamic-components'
import { DynamicComponentPreview } from './DynamicComponentPreview'
import { DynamicComponentSourcePanel } from './DynamicComponentSourcePanel'

type DetailTab = 'preview' | 'schema' | 'source'

export function DynamicComponentDetail(props: {
  item: DynamicComponentItem
  onBack: () => void
  onDelete: () => void
  onEdit: () => void
}) {
  const { t } = useI18n()
  const { item } = props
  const [tab, setTab] = useState<DetailTab>('preview')
  const [previewProps, setPreviewProps] = useState(() =>
    samplePropsFromSchema(item.propsSchema),
  )
  const [sourceDraft, setSourceDraft] = useState<string | null>(null)

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      sourceDraft !== null &&
      currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    void confirmDialog({
      confirmText: t('common.leave'),
      description: t('dynamicComponents.source.leaveDescription'),
      title: t('dynamicComponents.source.leaveTitle'),
    }).then((ok) => {
      if (ok) blocker.proceed()
      else blocker.reset()
    })
  }, [blocker, t])

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-2 border-b border-neutral-200 px-4 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <MobileHeaderAffordance />
          <Button
            aria-label={t('dynamicComponents.detail.backAria')}
            className="h-8 px-2 lg:hidden"
            onClick={props.onBack}
            type="button"
            variant="subtle"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
          </Button>
          <h2 className="truncate text-lg font-semibold text-fg">
            {item.name}
          </h2>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            className="h-8 px-2"
            onClick={props.onEdit}
            type="button"
            variant="subtle"
          >
            <Pencil aria-hidden="true" className="size-3.5" />
            {t('dynamicComponents.detail.edit')}
          </Button>
          <Button
            className="h-8 px-2 text-red-600 dark:text-red-400"
            onClick={props.onDelete}
            type="button"
            variant="subtle"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
            {t('dynamicComponents.detail.delete')}
          </Button>
        </div>
      </div>

      <Scroll className="flex-1">
        <div
          className={cn(
            'mx-auto space-y-6 p-6',
            tab === 'source' ? 'max-w-7xl' : 'max-w-4xl',
          )}
        >
          <p className="whitespace-pre-wrap text-sm leading-6 text-fg-muted">
            {item.description || t('dynamicComponents.detail.noDescription')}
          </p>

          <div className="overflow-hidden rounded-lg border border-border bg-surface-card">
            <div className="flex items-center justify-end border-b border-border px-3 py-2">
              <SegmentedControl<DetailTab>
                onValueChange={setTab}
                options={[
                  {
                    label: t('dynamicComponents.detail.preview'),
                    value: 'preview',
                  },
                  {
                    label: t('dynamicComponents.detail.propsSchema'),
                    value: 'schema',
                  },
                  {
                    label: t('dynamicComponents.detail.source'),
                    value: 'source',
                  },
                ]}
                value={tab}
              />
            </div>
            {tab === 'preview' ? (
              <div className="space-y-4 bg-surface-inset/50 p-4">
                <div className="rounded-md bg-surface-card p-3">
                  <DynamicComponentPreview
                    componentProps={previewProps}
                    initialHeight={item.initialHeight}
                    url={item.url}
                  />
                </div>
                <PropsEditor
                  onChange={setPreviewProps}
                  schema={item.propsSchema}
                  value={previewProps}
                />
                <p className="text-xs text-fg-muted">
                  {t('dynamicComponents.detail.samplePropsHint')}
                </p>
              </div>
            ) : tab === 'schema' ? (
              <pre className="overflow-auto bg-surface-inset p-4 font-mono text-xs leading-5 text-fg">
                {formatJson(item.propsSchema)}
              </pre>
            ) : (
              <DynamicComponentSourcePanel
                draft={sourceDraft}
                item={item}
                onDraftChange={setSourceDraft}
                onPreviewPropsChange={setPreviewProps}
                previewProps={previewProps}
              />
            )}
          </div>

          <dl className="grid gap-3 rounded-lg border border-border p-4 text-sm">
            <DetailRow label={t('dynamicComponents.detail.url')} mono>
              {item.url}
            </DetailRow>
            <DetailRow label={t('dynamicComponents.detail.initialHeight')}>
              {item.initialHeight}px
            </DetailRow>
            {item.parentUrl && !item.previousUrls?.includes(item.parentUrl) ? (
              <DetailRow label={t('dynamicComponents.detail.parentUrl')} mono>
                {item.parentUrl}
              </DetailRow>
            ) : null}
            {item.previousUrls?.length ? (
              <DetailRow
                label={t('dynamicComponents.detail.previousUrls')}
                mono
              >
                {item.previousUrls.toReversed().map((url) => (
                  <span className="block" key={url}>
                    {url}
                  </span>
                ))}
              </DetailRow>
            ) : null}
          </dl>
        </div>
      </Scroll>
    </section>
  )
}

function DetailRow(props: {
  children: ReactNode
  label: string
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-fg-subtle">{props.label}</dt>
      <dd
        className={cn(
          'min-w-0 break-all text-fg sm:text-right',
          props.mono && 'font-mono text-xs leading-5',
        )}
      >
        {props.children}
      </dd>
    </div>
  )
}
