import { Popover } from '@base-ui/react/popover'
import { Braces, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useI18n } from '~/i18n'
import { PortalLayerScope, useFloatingZ } from '~/ui/feedback/portal-layer'
import { cn } from '~/utils/cn'

interface TemplatePropsPopoverProps {
  defaultProps: unknown
  onChange: (next: unknown) => void
  value: unknown
}

export function TemplatePropsPopover(props: TemplatePropsPopoverProps) {
  const { t } = useI18n()
  const { z, depth } = useFloatingZ('popover')

  const stringified = useMemo(
    () => JSON.stringify(props.value ?? {}, null, 2),
    [props.value],
  )
  const [draft, setDraft] = useState(stringified)
  const [parseError, setParseError] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setDraft(stringified)
    setParseError('')
  }, [stringified])

  const handleDraftChange = (next: string) => {
    setDraft(next)
    if (!next.trim()) {
      setParseError('')
      props.onChange({})
      return
    }
    try {
      const parsed = JSON.parse(next)
      setParseError('')
      props.onChange(parsed)
    } catch (error) {
      setParseError(
        error instanceof SyntaxError
          ? error.message
          : t('templates.props.invalid'),
      )
    }
  }

  const resetToDefault = () => {
    const next = JSON.stringify(props.defaultProps ?? {}, null, 2)
    setDraft(next)
    setParseError('')
    props.onChange(props.defaultProps ?? {})
  }

  return (
    <Popover.Root onOpenChange={setOpen} open={open}>
      <Popover.Trigger
        className={cn(
          'focus-visible:outline-hidden inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400',
          open
            ? 'border-neutral-300 bg-neutral-100 text-neutral-950 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50'
            : 'border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50 dark:hover:bg-neutral-900',
        )}
        type="button"
      >
        <Braces aria-hidden="true" className="size-4" />
        <span className="hidden lg:inline">{t('templates.props.button')}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          align="end"
          side="bottom"
          sideOffset={8}
          style={{ zIndex: z }}
        >
          <PortalLayerScope depth={depth}>
            <Popover.Popup className="outline-hidden flex w-[min(92vw,22rem)] flex-col overflow-hidden rounded-md border border-neutral-200 bg-white text-sm shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
                <span className="text-xs font-medium uppercase text-neutral-500">
                  {t('templates.props.title')}
                </span>
                <button
                  className="inline-flex items-center gap-1 text-xs text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
                  onClick={resetToDefault}
                  type="button"
                >
                  <RotateCcw aria-hidden="true" className="size-3.5" />
                  {t('templates.props.reset')}
                </button>
              </div>
              <textarea
                className="outline-hidden h-72 w-full resize-none bg-neutral-50 p-3 font-mono text-xs leading-relaxed text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                onChange={(event) => handleDraftChange(event.target.value)}
                spellCheck={false}
                value={draft}
              />
              <div className="flex shrink-0 items-center justify-between border-t border-neutral-200 px-3 py-2 text-xs dark:border-neutral-800">
                {parseError ? (
                  <span className="truncate text-red-600">{parseError}</span>
                ) : (
                  <span className="text-neutral-500">
                    {t('templates.props.hint')}
                  </span>
                )}
              </div>
            </Popover.Popup>
          </PortalLayerScope>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
