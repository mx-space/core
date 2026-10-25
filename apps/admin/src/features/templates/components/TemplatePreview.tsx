import { AlertCircle, Eye } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useI18n } from '~/i18n'

interface TemplatePreviewProps {
  error: string
  html: string
}

/**
 * Emails are laid out for a fixed 600px table plus body padding; below that
 * width the preview scales the iframe down instead of showing a horizontal
 * scrollbar. The iframe is sandboxed without `allow-same-origin`, so its
 * content width cannot be measured — hence the constant.
 */
const MAIL_MIN_WIDTH = 620

export function TemplatePreview(props: TemplatePreviewProps) {
  const { t } = useI18n()
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return

    const update = () => {
      const width = element.clientWidth
      setScale(width > 0 && width < MAIL_MIN_WIDTH ? width / MAIL_MIN_WIDTH : 1)
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const fitted = scale < 1

  return (
    <section className="flex h-full min-h-0 flex-col bg-surface-inset">
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-border px-3">
        <span className="inline-flex items-center gap-2 text-xs font-medium uppercase text-fg-muted">
          <Eye aria-hidden="true" className="size-4" />
          {t('templates.preview.title')}
        </span>
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          {fitted ? (
            <span
              className="shrink-0 text-xs tabular-nums text-fg-subtle"
              title={t('templates.preview.fitHint')}
            >
              {t('templates.preview.fit', { percent: Math.round(scale * 100) })}
            </span>
          ) : null}
          {props.error ? (
            <span className="inline-flex min-w-0 items-center gap-1 text-xs text-red-600">
              <AlertCircle aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{t('templates.previewFailed')}</span>
            </span>
          ) : null}
        </div>
      </div>
      {props.error ? (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <pre className="whitespace-pre-wrap rounded border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800 dark:border-red-950 dark:bg-red-950/30 dark:text-red-200">
            {props.error}
          </pre>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden" ref={viewportRef}>
          {/*
            Chrome never paints a sandboxed `srcdoc` iframe that was inserted
            empty and filled afterwards, so the iframe only exists once there is
            HTML to show. Later updates (typing, switching template) re-navigate
            the same element and do render.
          */}
          {props.html ? (
            <iframe
              className={fitted ? 'bg-white' : 'size-full bg-white'}
              sandbox=""
              srcDoc={props.html}
              style={
                fitted
                  ? {
                      width: MAIL_MIN_WIDTH,
                      height: `${100 / scale}%`,
                      transform: `scale(${scale})`,
                      transformOrigin: 'top left',
                    }
                  : undefined
              }
              title={t('templates.preview.title')}
            />
          ) : null}
        </div>
      )}
    </section>
  )
}
