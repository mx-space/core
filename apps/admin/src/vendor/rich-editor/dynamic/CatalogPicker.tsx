import { Code2 } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { DynamicCatalogEntry } from '~/api/dynamic-components'
import { useI18n } from '~/i18n'
import { fieldsFromSchema } from '~/lib/dynamic-props'
import { TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

import { filterCatalogEntries } from './catalog-picker'

export function CatalogPicker(props: {
  entries: DynamicCatalogEntry[] | null
  onManual: () => void
  onPick: (entry: DynamicCatalogEntry) => void
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  // Lexical restores focus to the editor right after the slash command that
  // inserted this node, which wins over autoFocus.
  useEffect(() => {
    const frame = requestAnimationFrame(() => searchRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [])
  const visible = useMemo(
    () => filterCatalogEntries(props.entries ?? [], query),
    [props.entries, query],
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((index) =>
        visible.length === 0
          ? 0
          : (index + step + visible.length) % visible.length,
      )
    } else if (event.key === 'Enter' && visible[active]) {
      event.preventDefault()
      props.onPick(visible[active])
    }
  }

  return (
    <div className="grid">
      <div className="border-b border-border p-2">
        <TextInput
          aria-label={t('dynamicNode.search')}
          onChange={(value) => {
            setQuery(value)
            setActive(0)
          }}
          onKeyDown={handleKeyDown}
          placeholder={t('dynamicNode.search')}
          ref={searchRef}
          type="search"
          value={query}
        />
      </div>
      <div
        className="grid max-h-72 gap-0.5 overflow-y-auto p-1.5"
        role="listbox"
      >
        {props.entries === null ? (
          <p className="px-2 py-4 text-center text-xs text-fg-muted">
            {t('common.loading')}
          </p>
        ) : visible.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-fg-muted">
            {t('dynamicNode.noMatch')}
          </p>
        ) : (
          visible.map((entry, index) => (
            <button
              aria-selected={index === active}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-sm px-2 py-2 text-left transition-colors',
                index === active ? 'bg-accent-soft' : 'hover:bg-surface-inset',
              )}
              key={entry.url}
              onClick={() => props.onPick(entry)}
              onMouseEnter={() => setActive(index)}
              role="option"
              type="button"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-surface-inset text-fg-muted">
                <Code2 aria-hidden="true" className="size-4" />
              </span>
              <span className="grid min-w-0 flex-1">
                <span className="truncate text-sm font-medium text-fg">
                  {entry.name}
                </span>
                <span className="truncate text-xs text-fg-muted">
                  {entry.description}
                </span>
              </span>
              <span className="shrink-0 text-xs text-fg-subtle">
                {t('dynamicNode.fieldCount', {
                  count: fieldsFromSchema(entry.propsSchema).length,
                })}
              </span>
            </button>
          ))
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-fg-muted">
        <span>{t('dynamicNode.pickerHint')}</span>
        <button
          className="text-accent hover:text-accent-hover"
          onClick={props.onManual}
          type="button"
        >
          {t('dynamicNode.manualLink')}
        </button>
      </div>
    </div>
  )
}
