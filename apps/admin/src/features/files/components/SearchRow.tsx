import { Search } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { ChangeEvent } from 'react'

import { useI18n } from '~/i18n'

interface SearchRowProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  scopeId?: string
}

export function SearchRow(props: SearchRowProps) {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    props.onChange(event.target.value)
  }

  // `/` focuses search when its scope is active.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== '/') return
      const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      const editable = (event.target as HTMLElement | null)?.isContentEditable
      if (editable) return
      event.preventDefault()
      inputRef.current?.focus()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="shrink-0 border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400"
        />
        <input
          aria-label={props.placeholder ?? t('files.search.placeholder')}
          className="focus-visible:outline-hidden pl-7.5 h-8 w-full rounded border border-neutral-200 bg-white pr-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50 dark:focus-visible:ring-neutral-500"
          onChange={onChange}
          placeholder={props.placeholder ?? t('files.search.placeholder')}
          ref={inputRef}
          style={{ paddingLeft: '1.75rem' }}
          type="search"
          value={props.value}
        />
      </div>
    </div>
  )
}
