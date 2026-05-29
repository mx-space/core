import { useEffect, useRef, useState } from 'react'
import type { DiffRendererInstance } from '../types/drafts'

import { useI18n } from '~/i18n'
import { Scroll } from '~/ui/primitives/scroll'

import { ensureDiffHighlighter } from '../utils/diff-highlighter'

export function MarkdownDraftDiffPanel(props: {
  currentText: string
  currentVersion: number
  selectedText: string
  selectedVersion: number
}) {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return

    let disposed = false
    let diffInstance: DiffRendererInstance | null = null

    setIsLoading(true)
    setHasError(false)
    containerRef.current.innerHTML = ''

    void import('@pierre/diffs')
      .then(async ({ FileDiff, preloadHighlighter }) => {
        await ensureDiffHighlighter(preloadHighlighter)

        if (disposed || !containerRef.current) return

        setIsLoading(false)
        const nextDiffInstance = new FileDiff({
          diffIndicators: 'bars',
          diffStyle: 'unified',
          disableFileHeader: true,
          themeType: 'system',
        }) as unknown as DiffRendererInstance
        nextDiffInstance.render({
          containerWrapper: containerRef.current,
          newFile: {
            contents: props.currentText,
            name: `v${props.currentVersion}.md`,
          },
          oldFile: {
            contents: props.selectedText,
            name: `v${props.selectedVersion}.md`,
          },
        })
        diffInstance = nextDiffInstance
      })
      .catch((error: unknown) => {
        console.error('[DraftsPage] Failed to render markdown diff:', error)
        if (!disposed) {
          setHasError(true)
          setIsLoading(false)
        }
      })

    return () => {
      disposed = true
      diffInstance?.cleanUp()
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [
    props.currentText,
    props.currentVersion,
    props.selectedText,
    props.selectedVersion,
  ])

  return (
    <section className="min-h-full min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200">
          {t('drafts.diff.markdown.title')}
        </h3>
        <span className="shrink-0 text-xs tabular-nums text-neutral-500">
          v{props.selectedVersion} → v{props.currentVersion}
        </span>
      </div>
      <Scroll
        className="relative min-h-[20rem] border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
        orientation="both"
        viewportClassName="min-h-[20rem]"
      >
        <div className="min-h-[20rem]" ref={containerRef} />
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-sm text-neutral-500 backdrop-blur-sm dark:bg-neutral-950/80 dark:text-neutral-400">
            {t('drafts.diff.loading')}
          </div>
        ) : null}
        {hasError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white text-sm text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">
            {t('drafts.diff.failed')}
          </div>
        ) : null}
        {!isLoading &&
        !hasError &&
        !props.selectedText &&
        !props.currentText ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
            {t('drafts.diff.empty')}
          </div>
        ) : null}
      </Scroll>
    </section>
  )
}
