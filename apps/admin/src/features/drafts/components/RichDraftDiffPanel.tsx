import { useEffect, useMemo, useRef } from 'react'

import { useI18n } from '~/i18n'
import { Scroll } from '~/ui/primitives/scroll'

import {
  getCurrentColorScheme,
  parseSerializedDraftContent,
} from '../utils/rich-diff'

export function RichDraftDiffPanel(props: {
  currentContent: string
  currentVersion: number
  selectedContent: string
  selectedVersion: number
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
          newValue: currentValue,
          oldValue: selectedValue,
          theme: getCurrentColorScheme(),
          variant: 'comment',
        })
      },
    )

    return () => {
      disposed = true
      handle?.unmount()
    }
  }, [currentValue, selectedValue])

  if (!selectedValue || !currentValue) {
    return (
      <div className="flex min-h-[20rem] items-center justify-center border border-dashed border-neutral-200 bg-white text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        {t('drafts.diff.richFailed')}
      </div>
    )
  }

  return (
    <section className="min-h-full min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200">
          {t('drafts.diff.rich.title')}
        </h3>
        <span className="shrink-0 text-xs tabular-nums text-neutral-500">
          v{props.selectedVersion} → v{props.currentVersion}
        </span>
      </div>
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
