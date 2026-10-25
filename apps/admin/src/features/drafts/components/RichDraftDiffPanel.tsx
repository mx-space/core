import type { RichDiffLayout } from '@haklex/rich-diff'
import { useEffect, useMemo, useRef } from 'react'

import { useI18n } from '~/i18n'
import { Scroll } from '~/ui/primitives/scroll'

import {
  getCurrentColorScheme,
  parseSerializedDraftContent,
} from '../utils/rich-diff'

export function RichDraftDiffPanel(props: {
  collapseUnchanged?: boolean
  comparisonLabel?: string
  currentContent: string
  layout?: RichDiffLayout
  selectedContent: string
  showHeader?: boolean
}) {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const selectedValue = useMemo(
    () => parseSerializedDraftContent(props.selectedContent),
    [props.selectedContent],
  )
  const currentValue = useMemo(
    () => parseSerializedDraftContent(props.currentContent),
    [props.currentContent],
  )

  useEffect(() => {
    if (!containerRef.current || !selectedValue || !currentValue) return

    let disposed = false
    let handle: { unmount: () => void } | null = null

    void import('~/vendor/rich-editor/mount/mount-rich-diff').then(
      ({ mountRichDiff }) => {
        if (disposed || !containerRef.current) return
        handle = mountRichDiff(containerRef.current, {
          className: '!rounded-none !border-0',
          collapseUnchanged: props.collapseUnchanged,
          layout: props.layout,
          newValue: currentValue,
          oldValue: selectedValue,
          renderCollapsed: (count) => t('drafts.compare.collapsed', { count }),
          theme: getCurrentColorScheme(),
          variant: 'comment',
        })
      },
    )

    return () => {
      disposed = true
      const mounted = handle
      // Unmounting a nested root while the parent tree is rendering triggers React's race warning.
      queueMicrotask(() => mounted?.unmount())
    }
  }, [currentValue, selectedValue, props.layout, props.collapseUnchanged, t])

  if (!selectedValue || !currentValue) {
    return (
      <div className="flex min-h-[20rem] items-center justify-center border border-dashed border-neutral-200 bg-white text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        {t('drafts.diff.richFailed')}
      </div>
    )
  }

  return (
    <section className="min-h-full min-w-0">
      {props.showHeader === false ? null : (
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200">
            {t('drafts.diff.rich.title')}
          </h3>
          <span className="shrink-0 text-xs text-neutral-500">
            {props.comparisonLabel ?? t('drafts.history.direction')}
          </span>
        </div>
      )}
      <Scroll
        className="min-h-[20rem] border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
        orientation="both"
        viewportClassName="min-h-[20rem]"
      >
        <div className="min-h-[20rem]" ref={containerRef} />
      </Scroll>
    </section>
  )
}
