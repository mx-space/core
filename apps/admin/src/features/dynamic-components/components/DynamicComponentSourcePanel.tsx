import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, RotateCcw } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { toast } from 'sonner'

import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { PropsEditor } from '~/ui/patterns/PropsEditor'
import { Button } from '~/ui/primitives/button'
import { CodeEditor } from '~/ui/primitives/code-editor'

import { useApplyDynamicCatalog } from '../hooks/use-dynamic-catalog'
import { useLiveModule } from '../hooks/use-live-module'
import type { DynamicComponentItem } from '../types/dynamic-components'
import {
  fetchComponentSource,
  saveComponentSource,
} from '../utils/component-source'
import { DynamicComponentPreview } from './DynamicComponentPreview'

const allowAnyUrl = () => true

export function DynamicComponentSourcePanel(props: {
  draft: string | null
  item: DynamicComponentItem
  onDraftChange: Dispatch<SetStateAction<string | null>>
  onPreviewPropsChange: (value: Record<string, unknown>) => void
  previewProps: Record<string, unknown>
}) {
  const { t } = useI18n()
  const { item } = props
  const queryClient = useQueryClient()
  const applyCatalog = useApplyDynamicCatalog()

  const sourceQuery = useQuery({
    queryFn: () => fetchComponentSource(item.url),
    queryKey: adminQueryKeys.dynamicComponents.source(item.url),
    staleTime: Infinity,
  })
  const source = props.draft ?? sourceQuery.data ?? null
  const dirty = props.draft !== null && props.draft !== sourceQuery.data
  const live = useLiveModule(source, props.previewProps)

  const saveMutation = useMutation({
    mutationFn: (code: string) => saveComponentSource(item, code),
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t('dynamicComponents.source.saveFailed'),
      )
    },
    onSuccess: (catalog, code) => {
      const saved = catalog.components.find((entry) => entry.id === item.id)
      if (saved) {
        queryClient.setQueryData(
          adminQueryKeys.dynamicComponents.source(saved.url),
          code,
        )
      }
      applyCatalog(catalog)
      props.onDraftChange((current) => (current === code ? null : current))
      toast.success(t('dynamicComponents.source.saved'))
    },
  })

  const save = () => {
    if (dirty && source !== null && !saveMutation.isPending)
      saveMutation.mutate(source)
  }

  if (sourceQuery.isError) {
    return (
      <div className="flex items-start gap-2 p-4 text-sm text-fg-muted">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {t('dynamicComponents.source.unavailable')}
      </div>
    )
  }

  return (
    <div className="grid min-h-[32rem] grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex min-h-[32rem] min-w-0 flex-col">
        <div className="min-h-0 flex-1">
          {source === null ? (
            <div className="flex h-full items-center justify-center text-sm text-fg-muted">
              {t('common.loading')}
            </div>
          ) : (
            <CodeEditor
              dirty={dirty}
              language="javascript"
              onChange={(next) =>
                props.onDraftChange(next === sourceQuery.data ? null : next)
              }
              onSave={save}
              saving={saveMutation.isPending}
              title={t('dynamicComponents.source.title')}
              value={source}
            />
          )}
        </div>
        {live.error ? (
          <div
            className="border-t border-red-500/20 bg-red-500/10 px-4 py-2 font-mono text-xs text-red-600 dark:text-red-400"
            role="alert"
          >
            {live.error} · {t('dynamicComponents.source.keptLastWorking')}
          </div>
        ) : null}
        <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
          <Button
            disabled={!dirty || saveMutation.isPending}
            onClick={() => props.onDraftChange(null)}
            type="button"
            variant="subtle"
          >
            <RotateCcw aria-hidden="true" className="size-3.5" />
            {t('dynamicComponents.source.revert')}
          </Button>
          <Button
            disabled={!dirty || saveMutation.isPending}
            onClick={save}
            type="button"
          >
            {t(
              saveMutation.isPending
                ? 'dynamicComponents.editor.saving'
                : 'dynamicComponents.source.saveVersion',
            )}
          </Button>
        </div>
      </div>

      <div className="grid content-start gap-4 border-t border-border bg-surface-inset/50 p-4 lg:border-l lg:border-t-0">
        <div className="rounded-md bg-surface-card p-3">
          {live.url ? (
            <DynamicComponentPreview
              componentProps={props.previewProps}
              initialHeight={item.initialHeight}
              url={live.url}
              validateUrl={allowAnyUrl}
            />
          ) : (
            <p className="py-6 text-center text-xs text-fg-muted">
              {t('common.loading')}
            </p>
          )}
        </div>
        <PropsEditor
          onChange={props.onPreviewPropsChange}
          schema={item.propsSchema}
          value={props.previewProps}
        />
        <p className="text-xs text-fg-muted">
          {t('dynamicComponents.detail.samplePropsHint')}
        </p>
      </div>
    </div>
  )
}
