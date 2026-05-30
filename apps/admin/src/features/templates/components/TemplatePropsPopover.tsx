import { Braces, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useI18n } from '~/i18n'
import { Popover } from '~/ui/overlay/popover'
import { cn } from '~/utils/cn'

interface TemplatePropsPopoverProps {
  defaultProps: unknown
  onChange: (next: unknown) => void
  value: unknown
}

export function TemplatePropsPopover(props: TemplatePropsPopoverProps) {
  const { t } = useI18n()

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
    <Popover onOpenChange={setOpen} open={open}>
      <Popover.Trigger
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-sm border px-3 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-accent/15',
          open
            ? 'border-border-strong bg-surface-inset text-fg'
            : 'border-border bg-surface-card text-fg hover:bg-surface-inset',
        )}
        type="button"
      >
        <Braces aria-hidden="true" className="size-4" />
        <span className="hidden lg:inline">{t('templates.props.button')}</span>
      </Popover.Trigger>
      <Popover.Content align="end" side="bottom" sideOffset={8} width="lg">
        <div className="flex flex-col overflow-hidden">
          <Popover.Header>
            <span>{t('templates.props.title')}</span>
            <button
              className="inline-flex items-center gap-1 text-xs normal-case text-fg-muted transition-colors hover:text-fg"
              onClick={resetToDefault}
              type="button"
            >
              <RotateCcw aria-hidden="true" className="size-3.5" />
              {t('templates.props.reset')}
            </button>
          </Popover.Header>
          <textarea
            className="outline-hidden h-72 w-full resize-none bg-surface-inset p-3 font-mono text-xs leading-relaxed text-fg"
            onChange={(event) => handleDraftChange(event.target.value)}
            spellCheck={false}
            value={draft}
          />
          <Popover.Footer>
            {parseError ? (
              <span className="truncate text-red-600">{parseError}</span>
            ) : (
              <span>{t('templates.props.hint')}</span>
            )}
          </Popover.Footer>
        </div>
      </Popover.Content>
    </Popover>
  )
}
